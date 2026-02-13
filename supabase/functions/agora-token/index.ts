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
const SERVICE_TYPE_RTC = 1;

// --- Packer functions (little-endian, matching official Agora SDK) ---

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
  // Sort by key (matching Python's OrderedDict sorted by key)
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
    "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, data);
  return new Uint8Array(sig);
}

// --- Zlib deflate using DecompressionStream/CompressionStream ---

async function zlibCompress(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream("deflate"));
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

// --- Token builder matching official Agora AccessToken2 (Python reference) ---

async function buildToken(
  appId: string, appCert: string, channelName: string, uid: number, expireSeconds: number
): Promise<string> {
  const issueTs = Math.floor(Date.now() / 1000);
  const salt = Math.floor(Math.random() * 99999999) + 1;
  const expireTs = expireSeconds > 0 ? issueTs + expireSeconds : 0;

  // Step 1: Build signing key (double HMAC per official spec)
  // signing = hmac(pack_uint32(issue_ts), app_cert)
  // signing = hmac(pack_uint32(salt), signing)
  const appCertBytes = new TextEncoder().encode(appCert);
  let signingKey = await hmacSign(packUint32(issueTs), appCertBytes);
  signingKey = await hmacSign(packUint32(salt), signingKey);

  // Step 2: Build service pack
  // ServiceRtc.pack() = pack_uint16(type) + pack_map_uint32(privileges) + pack_string(channel) + pack_string(uid)
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

  // Step 3: Build signing_info
  // signing_info = pack_string(app_id) + pack_uint32(issue_ts) + pack_uint32(expire) + pack_uint32(salt) + pack_uint16(service_count) + services
  const signingInfo = concatBytes(
    packString(appId),
    packUint32(issueTs),
    packUint32(expireSeconds),
    packUint32(salt),
    packUint16(1), // 1 service
    servicePack
  );

  // Step 4: Sign
  const signature = await hmacSign(signingKey, signingInfo);

  // Step 5: Compress and encode
  // token = "007" + base64(zlib.compress(pack_string(signature) + signing_info))
  const raw = concatBytes(packString(signature), signingInfo);
  const compressed = await zlibCompress(raw);

  return VERSION + toBase64(compressed);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const AGORA_APP_ID = (Deno.env.get("AGORA_APP_ID") || "").trim();
    const AGORA_APP_CERTIFICATE = (Deno.env.get("AGORA_APP_CERTIFICATE") || "").trim();

    console.log(`[agora-token] APP_ID length: ${AGORA_APP_ID.length}, CERT length: ${AGORA_APP_CERTIFICATE.length}`);

    if (!AGORA_APP_ID || !AGORA_APP_CERTIFICATE) {
      console.error("Missing Agora secrets.");
      throw new Error("Agora credentials not configured");
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
