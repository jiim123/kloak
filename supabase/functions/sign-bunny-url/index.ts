import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const BUNNY_STORAGE_ZONE = "kloak";
const BUNNY_STORAGE_HOST = "https://storage.bunnycdn.com";

const ALLOWED_PRIVATE_BUCKETS = ["attachments"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-key-hash, Range",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function resolveUserId(req: Request): Promise<string | null> {
  const rawKeyHash = req.headers.get("x-key-hash");
  const keyHash = rawKeyHash ? rawKeyHash.trim() : "";
  if (!keyHash) return null;

  const normalizedKeyHash = /^[a-fA-F0-9]{64}$/.test(keyHash) ? keyHash.toLowerCase() : keyHash;

  const rpcClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "x-key-hash": normalizedKeyHash } },
  });

  try {
    const { data, error } = await rpcClient.rpc("get_request_user_id");
    if (!error && data) return data as string;
  } catch {}

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("user_auth")
    .select("user_id")
    .eq("key_hash", normalizedKeyHash)
    .single();

  if (!error && data?.user_id) return data.user_id as string;

  return null;
}

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  pdf: "application/pdf",
  txt: "text/plain",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const bunnyApiKey = Deno.env.get("BUNNY_STORAGE_API_KEY");
    if (!bunnyApiKey) {
      return jsonResponse({ error: "Not configured" }, 500);
    }

    const userId = await resolveUserId(req);
    if (!userId) {
      return jsonResponse({ error: "Unauthorized: missing or invalid credentials" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const bucket: string = body.bucket;
    const path: string = body.path;
    const mode: "stream" | "exists" = body.mode === "exists" ? "exists" : "stream";

    if (!bucket || !path) {
      return jsonResponse({ error: "Missing bucket or path" }, 400);
    }
    if (!ALLOWED_PRIVATE_BUCKETS.includes(bucket)) {
      return jsonResponse({ error: "Bucket not allowed" }, 403);
    }
    if (path.includes("..") || path.startsWith("/")) {
      return jsonResponse({ error: "Invalid path" }, 400);
    }

    const bunnyPath = `${bucket}/${path}`;
    const storageUrl = `${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE}/${bunnyPath}`;

    // ---- Existence check (HEAD only — no blob download) -------------------
    if (mode === "exists") {
      const head = await fetch(storageUrl, {
        method: "HEAD",
        headers: { AccessKey: bunnyApiKey },
      });
      if (head.ok) {
        return jsonResponse({
          exists: true,
          size: Number(head.headers.get("content-length") || 0) || null,
        });
      }
      // Fall back to Supabase for legacy paths
      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        const supaUrl = `${SUPABASE_URL}/storage/v1/object/authenticated/${bucket}/${path}`;
        const supaHead = await fetch(supaUrl, {
          method: "HEAD",
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        });
        if (supaHead.ok) {
          return jsonResponse({
            exists: true,
            size: Number(supaHead.headers.get("content-length") || 0) || null,
            source: "supabase",
          });
        }
      }
      return jsonResponse({ exists: false }, 404);
    }

    // ---- Stream mode (with Range pass-through) ----------------------------
    const range = req.headers.get("range");
    const upstreamHeaders: Record<string, string> = { AccessKey: bunnyApiKey };
    if (range) upstreamHeaders["Range"] = range;

    let fileRes = await fetch(storageUrl, { headers: upstreamHeaders });

    if (!fileRes.ok && fileRes.status !== 206 && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabaseStorageUrl = `${SUPABASE_URL}/storage/v1/object/authenticated/${bucket}/${path}`;
      const supaHeaders: Record<string, string> = {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      };
      if (range) supaHeaders["Range"] = range;
      fileRes = await fetch(supabaseStorageUrl, { headers: supaHeaders });
      if (!fileRes.ok && fileRes.status !== 206) {
        return jsonResponse({ error: "File not found on Bunny or Supabase" }, 404);
      }
    } else if (!fileRes.ok && fileRes.status !== 206) {
      return jsonResponse({ error: "File not found" }, 404);
    }

    const ext = path.split(".").pop()?.toLowerCase() || "";
    const contentType = CONTENT_TYPES[ext] || fileRes.headers.get("content-type") || "application/octet-stream";

    const respHeaders: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=600",
      "Accept-Ranges": "bytes",
    };
    const cl = fileRes.headers.get("content-length");
    if (cl) respHeaders["Content-Length"] = cl;
    const cr = fileRes.headers.get("content-range");
    if (cr) respHeaders["Content-Range"] = cr;

    return new Response(fileRes.body, {
      status: fileRes.status === 206 ? 206 : 200,
      headers: respHeaders,
    });
  } catch (err) {
    console.error("Proxy error:", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
