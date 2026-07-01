import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, enforceRateLimit, getAuthContext } from "../_shared/edgeSecurity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-key-hash, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VERSION = "007";
const PRIVILEGES = {
  joinChannel: 1,
  publishAudioStream: 2,
  publishVideoStream: 3,
  publishDataStream: 4,
};
const SERVICE_TYPE_RTC = 1;

function packUint16(val: number): Uint8Array {
  const buf = new Uint8Array(2);
  buf[0] = val & 0xff;
  buf[1] = (val >> 8) & 0xff;
  return buf;
}

function packUint32(val: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = val & 0xff;
  buf[1] = (val >> 8) & 0xff;
  buf[2] = (val >> 16) & 0xff;
  buf[3] = (val >> 24) & 0xff;
  return buf;
}

function packString(str: Uint8Array | string): Uint8Array {
  const data = typeof str === "string" ? new TextEncoder().encode(str) : str;
  const lenBytes = packUint16(data.length);
  const result = new Uint8Array(lenBytes.length + data.length);
  result.set(lenBytes);
  result.set(data, lenBytes.length);
  return result;
}

function packMapUint32(map: Record<number, number>): Uint8Array {
  const entries = Object.entries(map)
    .map(([k, v]) => [Number(k), v] as [number, number])
    .sort((a, b) => a[0] - b[0]);

  const parts: Uint8Array[] = [];
  parts.push(packUint16(entries.length));
  for (const [k, v] of entries) {
    parts.push(packUint16(k));
    parts.push(packUint32(v));
  }
  return concatBytes(...parts);
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

async function hmacSign(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC", cryptoKey,
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  );
  return new Uint8Array(sig);
}

async function zlibCompress(data: Uint8Array): Promise<Uint8Array> {
  const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const stream = new Blob([buf]).stream().pipeThrough(new CompressionStream("deflate"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return concatBytes(...chunks);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function buildToken(
  appId: string, appCert: string, channelName: string, uid: number, expireSeconds: number
): Promise<string> {
  const issueTs = Math.floor(Date.now() / 1000);
  const salt = Math.floor(Math.random() * 99999999) + 1;
  const expireTs = expireSeconds > 0 ? issueTs + expireSeconds : 0;

  const appCertBytes = new TextEncoder().encode(appCert);
  let signingKey = await hmacSign(packUint32(issueTs), appCertBytes);
  signingKey = await hmacSign(packUint32(salt), signingKey);

  const privileges: Record<number, number> = {};
  privileges[PRIVILEGES.joinChannel] = expireTs;
  privileges[PRIVILEGES.publishAudioStream] = expireTs;
  privileges[PRIVILEGES.publishVideoStream] = expireTs;
  privileges[PRIVILEGES.publishDataStream] = expireTs;

  const uidStr = uid === 0 ? "" : String(uid);
  const servicePack = concatBytes(
    packUint16(SERVICE_TYPE_RTC),
    packMapUint32(privileges),
    packString(channelName),
    packString(uidStr)
  );

  const signingInfo = concatBytes(
    packString(appId),
    packUint32(issueTs),
    packUint32(expireSeconds),
    packUint32(salt),
    packUint16(1),
    servicePack
  );

  const signature = await hmacSign(signingKey, signingInfo);

  const raw = concatBytes(packString(signature), signingInfo);
  const compressed = await zlibCompress(raw);

  return VERSION + toBase64(compressed);
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const AGORA_APP_ID = (Deno.env.get("AGORA_APP_ID") || "").trim();
    const AGORA_APP_CERTIFICATE = (Deno.env.get("AGORA_APP_CERTIFICATE") || "").trim();

    if (!AGORA_APP_ID || !AGORA_APP_CERTIFICATE) {
      throw new Error("Agora credentials not configured");
    }

    // ── Auth check ──
    const supabase = createServiceClient();
    const auth = await getAuthContext(supabase, req);
    if (!auth.requestUserId) {
      return jsonResponse({ error: "Missing or invalid x-key-hash header" }, 401);
    }

    // ── Rate limit: 10 token requests per minute per user ──
    let rateOk = false;
    try {
      rateOk = await enforceRateLimit(supabase, auth.scopeBase, "edge_agora_token", 10, 60);
    } catch (rateError) {
      const msg = rateError instanceof Error ? rateError.message : "Rate-limit backend unavailable";
      return jsonResponse({ error: msg }, 503);
    }
    if (!rateOk) {
      return jsonResponse({ error: "Rate limited: too many token requests" }, 429);
    }

    const body = await req.json().catch(() => ({}));
    const channelName = typeof body?.channelName === "string" ? body.channelName : null;
    const uid = typeof body?.uid === "number" ? body.uid : null;

    if (!channelName || typeof channelName !== "string") {
      return jsonResponse({ error: "channelName is required" }, 400);
    }

    if (channelName.length > 128) {
      return jsonResponse({ error: "channelName too long" }, 400);
    }

    if (!uid || typeof uid !== "number") {
      return jsonResponse({ error: "uid (number) is required" }, 400);
    }

    const requestUserId = auth.requestUserId;

    // Verify user has access to the voice channel (matches get-livekit-token behavior)
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (UUID_RE.test(channelName)) {
      const { data: canAccess, error: accessError } = await supabase.rpc("has_channel_access", {
        _channel_id: channelName,
        _user_id: requestUserId,
      });
      if (accessError || !canAccess) {
        return jsonResponse({ error: "Not allowed to join this voice channel" }, 403);
      }

      try {
        const { error: voiceAchievementError } = await supabase.rpc("record_voice_joined_from_token", {
          _user_id: requestUserId,
          _channel_id: channelName,
        });
        if (voiceAchievementError) {
          console.error("[agora-token] Failed to record voice achievement", voiceAchievementError);
        }
      } catch (voiceAchievementError) {
        console.error("[agora-token] Failed to record voice achievement", voiceAchievementError);
      }
    }

    const token = await buildToken(AGORA_APP_ID, AGORA_APP_CERTIFICATE, channelName, uid, 6 * 60 * 60);

    return jsonResponse({ token, appId: AGORA_APP_ID });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
