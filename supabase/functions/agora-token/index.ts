import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VERSION = "007";
const PRIVILEGES = {
  joinChannel: 1,
  publishAudioStream: 2,
  publishVideoStream: 3,
  publishDataStream: 4,
};

function encodeUint16(val: number): Uint8Array {
  const buf = new Uint8Array(2);
  buf[0] = val & 0xff;
  buf[1] = (val >> 8) & 0xff;
  return buf;
}

function encodeUint32(val: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = val & 0xff;
  buf[1] = (val >> 8) & 0xff;
  buf[2] = (val >> 16) & 0xff;
  buf[3] = (val >> 24) & 0xff;
  return buf;
}

function encodeString(str: string): Uint8Array {
  const encoded = new TextEncoder().encode(str);
  const lenBytes = encodeUint16(encoded.length);
  const result = new Uint8Array(lenBytes.length + encoded.length);
  result.set(lenBytes);
  result.set(encoded, lenBytes.length);
  return result;
}

function encodeMapUint32(map: Record<number, number>): Uint8Array {
  const parts: Uint8Array[] = [];
  const entries = Object.entries(map);
  parts.push(encodeUint16(entries.length));
  for (const [k, v] of entries) {
    parts.push(encodeUint16(Number(k)));
    parts.push(encodeUint32(v));
  }
  const total = parts.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  return result;
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
    "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, data);
  return new Uint8Array(sig);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function buildToken(
  appId: string, appCert: string, channelName: string, uid: number, expireSeconds: number
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expireTs = expireSeconds > 0 ? now + expireSeconds : 0;

  const privileges: Record<number, number> = {};
  privileges[PRIVILEGES.joinChannel] = expireTs;
  privileges[PRIVILEGES.publishAudioStream] = expireTs;
  privileges[PRIVILEGES.publishVideoStream] = expireTs;
  privileges[PRIVILEGES.publishDataStream] = expireTs;

  const serviceContent = concatBytes(encodeString(channelName), encodeString(String(uid)));
  const servicePrivileges = encodeMapUint32(privileges);
  const serviceBytes = concatBytes(
    encodeUint16(1),
    encodeString("rtc"),
    serviceContent,
    servicePrivileges
  );

  const salt = Math.floor(Math.random() * 0xffffffff);
  const issueTs = now;
  const message = concatBytes(
    encodeUint32(salt), encodeUint32(issueTs), encodeUint32(expireSeconds), serviceBytes
  );

  const signing = concatBytes(
    new TextEncoder().encode(appId), encodeUint32(issueTs), encodeUint32(salt), message
  );
  const key = await hmacSign(new TextEncoder().encode(appCert), signing);

  const compressedLen = encodeUint32(message.length);
  const tokenBytes = concatBytes(key, compressedLen, message);
  return VERSION + toBase64(tokenBytes);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const AGORA_APP_ID = (Deno.env.get("AGORA_APP_ID") || "").trim();
    const AGORA_APP_CERTIFICATE = (Deno.env.get("AGORA_APP_CERTIFICATE") || "").trim();

    console.log(`[agora-token] APP_ID length: ${AGORA_APP_ID.length}, CERT length: ${AGORA_APP_CERTIFICATE.length}, APP_ID: "${AGORA_APP_ID}"`);

    if (!AGORA_APP_ID || !AGORA_APP_CERTIFICATE) {
      console.error("Missing Agora secrets. APP_ID exists:", !!AGORA_APP_ID, "CERT exists:", !!AGORA_APP_CERTIFICATE);
      throw new Error("Agora credentials not configured");
    }

    if (AGORA_APP_ID.length !== 32) {
      console.error(`[agora-token] WARNING: App ID is ${AGORA_APP_ID.length} chars, expected 32`);
    }
    if (AGORA_APP_CERTIFICATE.length !== 32) {
      console.error(`[agora-token] WARNING: Certificate is ${AGORA_APP_CERTIFICATE.length} chars, expected 32`);
    }

    const { channelName, uid } = await req.json();

    if (!channelName || typeof channelName !== "string") {
      return new Response(JSON.stringify({ error: "channelName is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!uid || typeof uid !== "number") {
      return new Response(JSON.stringify({ error: "uid (number) is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await buildToken(AGORA_APP_ID, AGORA_APP_CERTIFICATE, channelName, uid, 6 * 60 * 60);

    console.log(`[agora-token] Token generated for channel: ${channelName}, uid: ${uid}`);

    return new Response(JSON.stringify({ token, appId: AGORA_APP_ID }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating Agora token:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
