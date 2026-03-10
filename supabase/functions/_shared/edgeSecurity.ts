import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

export type EdgeAuthContext = {
  requestUserId: string | null;
  clientId: string;
  scopeBase: string;
};

export function createServiceClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase service credentials are not configured");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getClientIp(req: Request): string {
  const normalize = (value: string | null): string | null => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, 128);
  };

  const forwarded = normalize(req.headers.get("x-forwarded-for"));
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((hop) => hop.trim())
      .filter((hop) => hop.length > 0);
    if (hops.length > 0) {
      // Prefer the right-most proxy-appended hop to reduce spoofing via client-prepended values.
      return hops[hops.length - 1].slice(0, 128);
    }
  }

  const real = normalize(req.headers.get("x-real-ip"));
  if (real) return real;

  const cf = normalize(req.headers.get("cf-connecting-ip"));
  if (cf) return cf;

  return "unknown";
}

export function getClientId(req: Request): string {
  const ip = getClientIp(req);
  const ua = (req.headers.get("user-agent") || "unknown").slice(0, 120);
  return `${ip}:${ua}`;
}

export async function resolveRequestUserId(
  supabase: ReturnType<typeof createServiceClient>,
  req: Request,
): Promise<string | null> {
  const rawKeyHash = req.headers.get("x-key-hash");
  const keyHash = rawKeyHash ? rawKeyHash.trim() : "";
  if (!keyHash) return null;

  const normalizedKeyHash = /^[a-fA-F0-9]{64}$/.test(keyHash) ? keyHash.toLowerCase() : keyHash;

  let matchedUserAuth = false;
  let matchedUsersLegacy = false;

  // Prefer RPC-based resolution to avoid RLS blocking direct reads on user_auth.
  try {
    const rpcClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: {
          "x-key-hash": normalizedKeyHash,
        },
      },
    });
    const { data: rpcUserId, error: rpcError } = await rpcClient.rpc("get_request_user_id");
    if (!rpcError && rpcUserId) {
      matchedUserAuth = true;
      if (debugAuth) {
        console.log("[edge-auth] rpc get_request_user_id match", {
          keyHashLen: keyHash.length,
          isHex64: /^[a-fA-F0-9]{64}$/.test(keyHash),
          normalized: normalizedKeyHash !== keyHash,
        });
      }
      return rpcUserId as string;
    }
  } catch {
    // ignore RPC errors and fall back to direct reads for legacy deployments
  }

  let { data, error } = await supabase
    .from("user_auth")
    .select("user_id")
    .eq("key_hash", normalizedKeyHash)
    .single();

  if (!error && data?.user_id) {
    matchedUserAuth = true;
    if (debugAuth) {
      console.log("[edge-auth] user_auth match", {
        keyHashLen: keyHash.length,
        isHex64: /^[a-fA-F0-9]{64}$/.test(keyHash),
        normalized: normalizedKeyHash !== keyHash,
      });
    }
    return data.user_id as string;
  }

  if (normalizedKeyHash !== keyHash) {
    const retry = await supabase
      .from("user_auth")
      .select("user_id")
      .eq("key_hash", keyHash)
      .single();
    data = retry.data;
    error = retry.error;
    if (!error && data?.user_id) {
      matchedUserAuth = true;
      if (debugAuth) {
        console.log("[edge-auth] user_auth match (raw)", {
          keyHashLen: keyHash.length,
          isHex64: /^[a-fA-F0-9]{64}$/.test(keyHash),
          normalized: true,
        });
      }
      return data.user_id as string;
    }
  }

  // Legacy fallback: some older deployments stored key_hash on users instead of user_auth.
  // Attempt a read if the column still exists, and backfill user_auth on success.
  try {
    const legacy = await supabase
      .from("users")
      .select("id")
      .eq("key_hash", normalizedKeyHash)
      .maybeSingle();

    if (!legacy.error && legacy.data?.id) {
      const legacyUserId = legacy.data.id as string;
      matchedUsersLegacy = true;
      const insertResult = await supabase.from("user_auth").insert({
        user_id: legacyUserId,
        key_hash: normalizedKeyHash,
      });

      if (insertResult.error && !/duplicate|already exists/i.test(insertResult.error.message)) {
        console.warn("[edge-auth] Failed to backfill user_auth:", insertResult.error.message);
      }

      return legacyUserId;
    }
  } catch {
    // ignore legacy fallback errors (e.g. column missing)
  }

  if (debugAuth) {
    console.log("[edge-auth] resolve failed", {
      keyHashLen: keyHash.length,
      isHex64: /^[a-fA-F0-9]{64}$/.test(keyHash),
      normalized: normalizedKeyHash !== keyHash,
      matchedUserAuth,
      matchedUsersLegacy,
    });
  }
  return null;
}

export async function getAuthContext(
  supabase: ReturnType<typeof createServiceClient>,
  req: Request,
): Promise<EdgeAuthContext> {
  const requestUserId = await resolveRequestUserId(supabase, req);
  const clientId = getClientId(req);
  const scopeBase = requestUserId ? `user:${requestUserId}` : `client:${clientId}`;
  return { requestUserId, clientId, scopeBase };
}

export async function enforceRateLimit(
  supabase: ReturnType<typeof createServiceClient>,
  scope: string,
  bucket: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<boolean> {
  // Support both limiter signatures:
  // - legacy: (_ip_hash, _action, _max_attempts, _window_seconds)
  // - newer:  (_scope, _bucket, _max_requests, _window_seconds)
  let { data, error } = await supabase.rpc("check_rate_limit", {
    _ip_hash: scope,
    _action: bucket,
    _max_attempts: maxRequests,
    _window_seconds: windowSeconds,
  });

  if (error && /Could not find the function public\.check_rate_limit/i.test(error.message)) {
    const retry = await supabase.rpc("check_rate_limit", {
      _scope: scope,
      _bucket: bucket,
      _max_requests: maxRequests,
      _window_seconds: windowSeconds,
    });
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error("[edge-rate-limit] check_rate_limit failed:", {
      bucket,
      scope,
      message: error.message,
    });
    throw new Error(`Rate-limit backend error: ${error.message}`);
  }

  return !!data;
}
