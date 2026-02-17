import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-key-hash, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function resolveUser(supabase: ReturnType<typeof createClient>, keyHash: string) {
  const { data, error } = await supabase.from("user_auth").select("user_id").eq("key_hash", keyHash).single();
  if (error || !data) return null;
  return data.user_id as string;
}

async function checkPermission(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  bucket: string,
  path: string,
): Promise<string | null> {
  const firstSegment = path.split("/")[0];

  switch (bucket) {
    case "avatars":
    case "attachments": {
      if (firstSegment !== userId) {
        return "You can only manage your own files in this bucket";
      }
      return null;
    }

    case "server-icons":
    case "server-emojis": {
      const serverId = firstSegment;

      const { data: membership } = await supabase
        .from("server_members")
        .select("role")
        .eq("server_id", serverId)
        .eq("user_id", userId)
        .eq("is_banned", false)
        .single();

      if (membership && (membership.role === "owner" || membership.role === "admin")) {
        return null;
      }

      const { data: server } = await supabase.from("servers").select("owner_id").eq("id", serverId).single();

      if (server && server.owner_id === userId) {
        return null;
      }

      return "You must be a server owner or admin to manage server files";
    }

    case "badges":
      return "Badge uploads are not permitted through this endpoint";

    default:
      return "Unknown bucket";
  }
}

function defaultCacheControlSeconds(bucket: string): string {
  // These assets are stored with unique paths (timestamp/uuid in filename),
  // so we can safely tell browsers/CDNs to cache aggressively.
  switch (bucket) {
    case "avatars":
    case "server-icons":
    case "server-emojis":
      return "31536000"; // 1 year
    case "attachments":
      return "604800"; // 7 days
    default:
      return "3600"; // 1 hour fallback
  }
}

function normalizeCacheControlSeconds(raw: unknown, fallbackBucket: string): string {
  const fallback = defaultCacheControlSeconds(fallbackBucket);
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  // Supabase expects cacheControl as seconds (string number).
  if (!/^\d{1,10}$/.test(trimmed)) return fallback;
  // Clamp to 1 year max
  const n = Math.min(parseInt(trimmed, 10), 31_536_000);
  return String(n);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const keyHash = req.headers.get("x-key-hash");
    if (!keyHash) {
      return jsonResponse({ error: "Missing x-key-hash header" }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const userId = await resolveUser(supabase, keyHash);
    if (!userId) {
      return jsonResponse({ error: "Invalid credentials" }, 401);
    }

    // ── DELETE ──
    if (req.method === "DELETE") {
      const body = await req.json();
      const bucket = body.bucket as string;
      const paths: string[] = body.paths ? (body.paths as string[]) : body.path ? [body.path as string] : [];

      if (!bucket || paths.length === 0) {
        return jsonResponse({ error: "Missing bucket or path(s)" }, 400);
      }

      // Check permission for every path
      for (const p of paths) {
        const err = await checkPermission(supabase, userId, bucket, p);
        if (err) return jsonResponse({ error: err }, 403);
      }

      const { error: deleteError } = await supabase.storage.from(bucket).remove(paths);
      if (deleteError) {
        return jsonResponse({ error: deleteError.message }, 500);
      }
      return jsonResponse({ success: true });
    }

    // ── POST ──
    if (req.method === "POST") {
      const contentType = req.headers.get("content-type") || "";

      // JSON body → listAndDelete action
      if (contentType.includes("application/json")) {
        const body = await req.json();
        if (body.action === "listAndDelete") {
          const bucket = body.bucket as string;
          const prefix = body.prefix as string;
          const searchFilter = (body.searchFilter as string) || "";

          if (!bucket || !prefix) {
            return jsonResponse({ error: "Missing bucket or prefix" }, 400);
          }

          // Permission check on the prefix itself
          const err = await checkPermission(supabase, userId, bucket, prefix);
          if (err) return jsonResponse({ error: err }, 403);

          const { data: files } = await supabase.storage.from(bucket).list(prefix, { search: searchFilter });

          if (files && files.length > 0) {
            const toRemove = searchFilter
              ? files.filter((f) => f.name.startsWith(searchFilter)).map((f) => `${prefix}/${f.name}`)
              : files.map((f) => `${prefix}/${f.name}`);

            if (toRemove.length > 0) {
              await supabase.storage.from(bucket).remove(toRemove);
            }
          }

          return jsonResponse({ success: true, deleted: (files || []).length });
        }
        return jsonResponse({ error: "Unknown JSON action" }, 400);
      }

      // FormData body → file upload
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const bucket = formData.get("bucket") as string;
      const path = formData.get("path") as string;
      const fileContentType = (formData.get("contentType") as string) || "image/webp";
      const upsert = formData.get("upsert") === "true";
      const cacheControl = normalizeCacheControlSeconds(formData.get("cacheControl"), bucket);

      if (!file || !bucket || !path) {
        return jsonResponse({ error: "Missing file, bucket, or path" }, 400);
      }

      const permErr = await checkPermission(supabase, userId, bucket, path);
      if (permErr) return jsonResponse({ error: permErr }, 403);

      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType: fileContentType, upsert, cacheControl });

      if (uploadError) {
        return jsonResponse({ error: uploadError.message }, 500);
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);

      return jsonResponse({
        success: true,
        path: data?.path,
        publicUrl: urlData.publicUrl,
      });
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: msg }, 500);
  }
});
