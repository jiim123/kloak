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
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;

  const forwarded = req.headers.get("x-forwarded-for")?.trim();
  if (forwarded) return forwarded.split(",")[0].trim();

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
  const keyHash = req.headers.get("x-key-hash")?.trim();
  if (!keyHash) return null;

  const { data, error } = await supabase
    .from("user_auth")
    .select("user_id")
    .eq("key_hash", keyHash)
    .single();

  if (error || !data?.user_id) return null;
  return data.user_id as string;
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
  const { data, error } = await supabase.rpc("check_rate_limit", {
    _scope: scope,
    _bucket: bucket,
    _max_requests: maxRequests,
    _window_seconds: windowSeconds,
  });

  if (error) {
    console.error("[edge-rate-limit] check_rate_limit failed:", {
      bucket,
      scope,
      message: error.message,
    });
    return false;
  }

  return !!data;
}
