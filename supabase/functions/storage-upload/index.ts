// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createServiceClient as createSharedServiceClient, enforceRateLimit, getClientId } from "../_shared/edgeSecurity.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-key-hash, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
};

const EXPIRY_SECONDS = 3600; // 1 hour signed URL expiry for private buckets
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AVATAR_FILE_RE = /^(avatar|banner)-\d{10,20}\.(png|jpe?g|gif|webp|avif)$/i;
const SERVER_ICON_FILE_RE = /^(icon|banner)(-\d{10,20})?\.(png|jpe?g|gif|webp|avif)$/i;
const SERVER_EMOJI_FILE_RE =
  /^[a-z0-9_]{2,12}-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpe?g|gif|webp|avif)$/;

type PathKind = "file" | "prefix";

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function normalizeStoragePath(rawPath: string, kind: PathKind): string | null {
  if (typeof rawPath !== "string") return null;
  const path = rawPath.trim();

  if (!path || path.length > 255) return null;
  if (path.startsWith("/") || path.endsWith("/") || path.includes("\\") || path.includes("//")) return null;
  if (hasControlChars(path)) return null;

  const segments = path.split("/");
  if ((kind === "file" && segments.length < 2) || (kind === "prefix" && segments.length < 1)) return null;

  for (const segment of segments) {
    if (!segment || segment === "." || segment === "..") return null;
  }

  return path;
}

async function isServerOwnerOrAdmin(supabase: any, serverId: string, userId: string): Promise<boolean> {
  const { data: membership } = await supabase
    .from("server_members")
    .select("role")
    .eq("server_id", serverId)
    .eq("user_id", userId)
    .eq("is_banned", false)
    .single();

  if (membership && (membership.role === "owner" || membership.role === "admin")) {
    return true;
  }

  const { data: server } = await supabase
    .from("servers")
    .select("owner_id")
    .eq("id", serverId)
    .single();

  return !!(server && server.owner_id === userId);
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function assertServiceRoleKeyConfigured(key: string): void {
  if (!key) {
    throw new Error("Supabase service credentials are not configured");
  }

  // New API keys are prefixed; publishable keys cannot bypass RLS.
  if (key.startsWith("sb_publishable_")) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is a publishable key, not a service-role key");
  }
  if (key.startsWith("sb_secret_")) {
    return; // valid modern secret key format
  }

  // Legacy JWT service key should have role=service_role in claims.
  const payload = decodeJwtPayload(key);
  if (payload && payload.role !== "service_role") {
    throw new Error(`SUPABASE_SERVICE_ROLE_KEY JWT role is '${String(payload.role)}', expected 'service_role'`);
  }
}

function createServiceClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase service credentials are not configured");
  }
  assertServiceRoleKeyConfigured(SERVICE_ROLE_KEY);
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as any;
}

async function resolveUser(supabase: any, keyHash: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_auth")
    .select("user_id")
    .eq("key_hash", keyHash)
    .single();
  if (error || !data) return null;
  return data.user_id as string;
}

async function checkPermission(
  supabase: any,
  userId: string,
  bucket: string,
  path: string,
  kind: PathKind,
): Promise<{ error: string | null; normalizedPath?: string }> {
  const normalizedPath = normalizeStoragePath(path, kind);
  if (!normalizedPath) {
    return { error: "Invalid file path" };
  }

  const segments = normalizedPath.split("/");
  const firstSegment = segments[0];
  if (!UUID_RE.test(firstSegment)) {
    return { error: "Invalid file path" };
  }

  switch (bucket) {
    case "avatars":
      if (firstSegment !== userId) {
        return { error: "You can only manage your own files in this bucket" };
      }
      if (kind === "prefix") {
        if (segments.length !== 1) {
          return { error: "Invalid file path" };
        }
        return { error: null, normalizedPath };
      }
      if (segments.length !== 2 || !AVATAR_FILE_RE.test(segments[1])) {
        return { error: "Invalid file path" };
      }
      return { error: null, normalizedPath };

    case "attachments":
      if (firstSegment !== userId) {
        return { error: "You can only manage your own files in this bucket" };
      }
      if (kind === "prefix") {
        return { error: null, normalizedPath };
      }
      if (segments.length < 2 || segments.length > 6) {
        return { error: "Invalid file path" };
      }
      for (const segment of segments.slice(1)) {
        if (!/^[A-Za-z0-9._-]{1,128}$/.test(segment)) {
          return { error: "Invalid file path" };
        }
      }
      return { error: null, normalizedPath };

    case "server-icons":
    case "server-emojis": {
      const serverId = firstSegment;

      if (!(await isServerOwnerOrAdmin(supabase, serverId, userId))) {
        return { error: "You must be a server owner or admin to manage server files" };
      }

      if (kind === "prefix") {
        if (segments.length !== 1) {
          return { error: "Invalid file path" };
        }
        return { error: null, normalizedPath };
      }

      if (segments.length !== 2) {
        return { error: "Invalid file path" };
      }

      if (bucket === "server-icons" && !SERVER_ICON_FILE_RE.test(segments[1])) {
        return { error: "Invalid file path" };
      }

      if (bucket === "server-emojis" && !SERVER_EMOJI_FILE_RE.test(segments[1])) {
        return { error: "Invalid file path" };
      }

      return { error: null, normalizedPath };
    }

    case "badges":
      return { error: "Badge uploads are not permitted through this endpoint" };

    default:
      return { error: "Unknown bucket" };
  }
}

function defaultCacheControlSeconds(bucket: string): string {
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
  if (!/^\d{1,10}$/.test(trimmed)) return fallback;
  const n = Math.min(parseInt(trimmed, 10), 31_536_000);
  return String(n);
}

function withCacheBust(url: string, shouldBust: boolean): string {
  if (!shouldBust) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${Date.now()}`;
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

    const supabase = createServiceClient();

    const userId = await resolveUser(supabase, keyHash);
    if (!userId) {
      return jsonResponse({ error: "Invalid credentials" }, 401);
    }

    // Rate limit: 60 storage operations per minute per user
    const sharedClient = createSharedServiceClient();
    const rateScope = `user:${userId}`;
    let rateOk = false;
    try {
      rateOk = await enforceRateLimit(sharedClient, rateScope, "edge_storage_upload", 60, 60);
    } catch (rateError) {
      const msg = rateError instanceof Error ? rateError.message : "Rate-limit backend unavailable";
      return jsonResponse({ error: msg }, 503);
    }
    if (!rateOk) {
      return jsonResponse({ error: "Rate limited: too many storage operations" }, 429);
    }

    // ── DELETE ──
    if (req.method === "DELETE") {
      const body = await req.json();
      const bucket = typeof body.bucket === "string" ? body.bucket : "";
      const rawPaths = Array.isArray(body.paths) ? body.paths : typeof body.path === "string" ? [body.path] : [];
      const paths = rawPaths.filter((p: unknown): p is string => typeof p === "string");

      if (!bucket || paths.length === 0 || paths.length !== rawPaths.length) {
        return jsonResponse({ error: "Missing bucket or path(s)" }, 400);
      }

      const normalizedPaths: string[] = [];
      for (const p of paths) {
        const perm = await checkPermission(supabase, userId, bucket, p, "file");
        if (perm.error) return jsonResponse({ error: perm.error }, 403);
        normalizedPaths.push(perm.normalizedPath!);
      }

      const { error: deleteError } = await supabase.storage.from(bucket).remove(normalizedPaths);
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
          const bucket = typeof body.bucket === "string" ? body.bucket : "";
          const prefix = typeof body.prefix === "string" ? body.prefix : "";
          const searchFilter = typeof body.searchFilter === "string" ? body.searchFilter : "";

          if (!bucket || !prefix) {
            return jsonResponse({ error: "Missing bucket or prefix" }, 400);
          }

          const perm = await checkPermission(supabase, userId, bucket, prefix, "prefix");
          if (perm.error) return jsonResponse({ error: perm.error }, 403);
          const normalizedPrefix = perm.normalizedPath!;

          const { data: files } = await supabase.storage.from(bucket).list(normalizedPrefix, { search: searchFilter });

          if (files && files.length > 0) {
            const toRemove = searchFilter
              ? files.filter((f: any) => f.name.startsWith(searchFilter)).map((f: any) => `${normalizedPrefix}/${f.name}`)
              : files.map((f: any) => `${normalizedPrefix}/${f.name}`);

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
      const bucketField = formData.get("bucket");
      const pathField = formData.get("path");
      const contentTypeField = formData.get("contentType");
      const bucket = typeof bucketField === "string" ? bucketField : "";
      const path = typeof pathField === "string" ? pathField : "";
      const fileContentType = typeof contentTypeField === "string" && contentTypeField.trim()
        ? contentTypeField
        : "image/webp";
      const requestedUpsert = formData.get("upsert") === "true";
      const cacheControl = normalizeCacheControlSeconds(formData.get("cacheControl"), bucket);

      if (!file || !bucket || !path) {
        return jsonResponse({ error: "Missing file, bucket, or path" }, 400);
      }

      const perm = await checkPermission(supabase, userId, bucket, path, "file");
      if (perm.error) return jsonResponse({ error: perm.error }, 403);
      const normalizedPath = perm.normalizedPath!;

      if (requestedUpsert && bucket !== "server-icons") {
        return jsonResponse({ error: "Upsert is not allowed for this bucket" }, 400);
      }
      const upsert = requestedUpsert && bucket === "server-icons";

      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(normalizedPath, file, { contentType: fileContentType, upsert, cacheControl });

      if (uploadError) {
        const msg = uploadError.message || "Upload failed";
        const lower = msg.toLowerCase();
        const hint = lower.includes("row-level security")
          ? "Storage RLS blocked upload. Check service key type and grant EXECUTE on public.is_safe_storage_object_key(text,text) / public.enforce_safe_storage_object_keys() to service_role."
          : undefined;
        return jsonResponse({ error: msg, hint }, 500);
      }

      // For private buckets (attachments), return a signed URL instead of public URL
      if (bucket === "attachments") {
        const { data: signedData, error: signError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(normalizedPath, EXPIRY_SECONDS);
        if (signError || !signedData?.signedUrl) {
          return jsonResponse({ error: "Upload succeeded but failed to generate signed URL" }, 500);
        }
        return jsonResponse({
          success: true,
          path: data?.path || normalizedPath,
          publicUrl: signedData.signedUrl,
        });
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(normalizedPath);
      const shouldCacheBust = bucket === "server-icons" && upsert;

      return jsonResponse({
        success: true,
        path: data?.path || normalizedPath,
        publicUrl: withCacheBust(urlData.publicUrl, shouldCacheBust),
      });
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: msg }, 500);
  }
});
