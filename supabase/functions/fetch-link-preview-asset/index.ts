import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-key-hash",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_REDIRECTS = 3;
const PROXY_TOKEN_MAX_FUTURE_SECONDS = 60 * 60 * 48; // 48 hours

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LINK_PREVIEW_PROXY_SECRET = Deno.env.get("LINK_PREVIEW_PROXY_SECRET") || SUPABASE_SERVICE_ROLE_KEY;

type EdgeAuthContext = {
  requestUserId: string | null;
  clientId: string;
  scopeBase: string;
};

function createServiceClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase service credentials are not configured");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getClientIp(req: Request): string {
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
      return hops[hops.length - 1].slice(0, 128);
    }
  }

  const real = normalize(req.headers.get("x-real-ip"));
  if (real) return real;

  const cf = normalize(req.headers.get("cf-connecting-ip"));
  if (cf) return cf;

  return "unknown";
}

function getClientId(req: Request): string {
  const ip = getClientIp(req);
  const ua = (req.headers.get("user-agent") || "unknown").slice(0, 120);
  return `${ip}:${ua}`;
}

async function resolveRequestUserId(
  supabase: ReturnType<typeof createServiceClient>,
  req: Request,
): Promise<string | null> {
  const rawKeyHash = req.headers.get("x-key-hash");
  const keyHash = rawKeyHash ? rawKeyHash.trim() : "";
  if (!keyHash) return null;

  const normalizedKeyHash = /^[a-fA-F0-9]{64}$/.test(keyHash) ? keyHash.toLowerCase() : keyHash;

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
      return rpcUserId as string;
    }
  } catch {
    // ignore RPC errors and fall back to direct reads
  }

  let { data, error } = await supabase
    .from("user_auth")
    .select("user_id")
    .eq("key_hash", normalizedKeyHash)
    .single();

  if (!error && data?.user_id) {
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
      return data.user_id as string;
    }
  }

  try {
    const legacy = await supabase
      .from("users")
      .select("id")
      .eq("key_hash", normalizedKeyHash)
      .maybeSingle();

    if (!legacy.error && legacy.data?.id) {
      const legacyUserId = legacy.data.id as string;
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
    // ignore legacy fallback errors
  }

  return null;
}

async function getAuthContext(
  supabase: ReturnType<typeof createServiceClient>,
  req: Request,
): Promise<EdgeAuthContext> {
  const requestUserId = await resolveRequestUserId(supabase, req);
  const clientId = getClientId(req);
  const scopeBase = requestUserId ? `user:${requestUserId}` : `client:${clientId}`;
  return { requestUserId, clientId, scopeBase };
}

async function enforceRateLimit(
  supabase: ReturnType<typeof createServiceClient>,
  scope: string,
  bucket: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<boolean> {
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

// SSRF protection: Block private IPs and cloud metadata endpoints
const BLOCKED_IP_PATTERNS = [
  /^127\./, // localhost
  /^10\./, // private class A
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // private class B
  /^192\.168\./, // private class C
  /^169\.254\./, // link-local (AWS metadata)
  /^0\./, // reserved
  /^::1$/, // IPv6 localhost
  /^fc00:/i, // IPv6 private
  /^fe80:/i, // IPv6 link-local
  /^fd[0-9a-f]{2}:/i, // IPv6 private
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./, // Carrier-grade NAT
];

const BLOCKED_HOSTNAMES = [
  "localhost",
  "metadata.google.internal",
  "metadata",
  "metadata.azure.com",
  "instance-data",
  "kubernetes.default",
  "kubernetes.default.svc",
  "kubernetes",
];

function isPrivateIp(ip: string): boolean {
  if (BLOCKED_IP_PATTERNS.some((pattern) => pattern.test(ip))) return true;
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts[0] === 0 || parts[0] === 127 || parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
  }
  return false;
}

async function isUrlSafe(urlString: string): Promise<{ safe: boolean; error?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { safe: false, error: "Invalid URL format" };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { safe: false, error: "Only HTTP(S) protocols allowed" };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { safe: false, error: "Blocked hostname" };
  }

  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    if (isPrivateIp(hostname)) {
      return { safe: false, error: "Private IP addresses not allowed" };
    }
    return { safe: true };
  }

  try {
    const addresses = await Deno.resolveDns(hostname, "A");
    if (!addresses || addresses.length === 0) {
      return { safe: false, error: "DNS resolution returned no addresses" };
    }
    for (const ip of addresses) {
      if (isPrivateIp(ip)) {
        return { safe: false, error: "Domain resolves to private IP" };
      }
    }
  } catch {
    return { safe: false, error: "DNS resolution failed" };
  }

  return { safe: true };
}

async function fetchSafeWithRedirects(
  initialUrl: string,
  init: RequestInit,
  maxRedirects = MAX_REDIRECTS,
): Promise<Response> {
  let currentUrl = initialUrl;

  for (let i = 0; i <= maxRedirects; i++) {
    const validation = await isUrlSafe(currentUrl);
    if (!validation.safe) {
      throw new Error(validation.error || "Unsafe redirect target");
    }

    const response = await fetch(currentUrl, {
      ...init,
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return response;
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }

    return response;
  }

  throw new Error("Too many redirects");
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

const textEncoder = new TextEncoder();
let signingKeyPromise: Promise<CryptoKey> | null = null;

async function getSigningKey(): Promise<CryptoKey> {
  if (!LINK_PREVIEW_PROXY_SECRET) {
    throw new Error("Missing proxy signing secret");
  }
  if (!signingKeyPromise) {
    signingKeyPromise = crypto.subtle.importKey(
      "raw",
      textEncoder.encode(LINK_PREVIEW_PROXY_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  }
  return signingKeyPromise;
}

async function signPayload(payload: string): Promise<string> {
  const key = await getSigningKey();
  const sigBuffer = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));
  return toBase64Url(new Uint8Array(sigBuffer));
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = textEncoder.encode(a);
  const bBytes = textEncoder.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

async function verifySignedAssetParams(url: string, expRaw: string, sig: string): Promise<boolean> {
  if (!expRaw || !sig || !url) return false;

  const exp = Number(expRaw);
  if (!Number.isInteger(exp)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (exp < now - 30) return false; // small skew tolerance
  if (exp > now + PROXY_TOKEN_MAX_FUTURE_SECONDS) return false;

  const expectedSig = await signPayload(`${exp}:${url}`);
  return timingSafeEqual(expectedSig, sig);
}

function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!["GET", "HEAD"].includes(req.method)) {
    return new Response("Method not allowed", {
      status: 405,
      headers: { ...corsHeaders },
    });
  }

  try {
    const supabase = createServiceClient();
    const auth = await getAuthContext(supabase, req);
    const rateOk = await enforceRateLimit(supabase, auth.scopeBase, "edge_link_preview_asset", 120, 60);
    if (!rateOk) {
      return new Response("Rate limited", {
        status: 429,
        headers: { ...corsHeaders },
      });
    }

    const requestUrl = new URL(req.url);
    const targetUrl = requestUrl.searchParams.get("u")?.trim() || "";
    const exp = requestUrl.searchParams.get("exp")?.trim() || "";
    const sig = requestUrl.searchParams.get("sig")?.trim() || "";

    if (!targetUrl || targetUrl.length > 2048) {
      return new Response("Invalid target URL", {
        status: 400,
        headers: { ...corsHeaders },
      });
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return new Response("Invalid target URL", {
        status: 400,
        headers: { ...corsHeaders },
      });
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return new Response("Only HTTP(S) targets are supported", {
        status: 400,
        headers: { ...corsHeaders },
      });
    }

    const signatureOk = await verifySignedAssetParams(targetUrl, exp, sig);
    if (!signatureOk) {
      return new Response("Invalid or expired signature", {
        status: 403,
        headers: { ...corsHeaders },
      });
    }

    const safety = await isUrlSafe(targetUrl);
    if (!safety.safe) {
      return new Response("Blocked target URL", {
        status: 400,
        headers: { ...corsHeaders },
      });
    }

    const upstream = await fetchSafeWithRedirects(targetUrl, {
      headers: {
        "User-Agent": "KloakLinkPreviewProxy/1.0",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!upstream.ok) {
      const mappedStatus = upstream.status >= 400 && upstream.status <= 499 ? upstream.status : 502;
      return new Response("Failed to fetch image", {
        status: mappedStatus,
        headers: { ...corsHeaders },
      });
    }

    const contentType = upstream.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return new Response("Target is not an image", {
        status: 415,
        headers: { ...corsHeaders },
      });
    }

    const contentLengthRaw = upstream.headers.get("content-length");
    if (contentLengthRaw) {
      const contentLength = Number(contentLengthRaw);
      if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
        return new Response("Image too large", {
          status: 413,
          headers: { ...corsHeaders },
        });
      }
    }

    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    };

    const cacheControl = upstream.headers.get("cache-control");
    if (cacheControl && cacheControl.length <= 256) {
      responseHeaders["Cache-Control"] = cacheControl;
    }

    if (req.method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: responseHeaders,
      });
    }

    const reader = upstream.body?.getReader();
    if (!reader) {
      return new Response("Failed to read image body", {
        status: 502,
        headers: { ...corsHeaders },
      });
    }

    let bytesRead = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      bytesRead += value.length;
      if (bytesRead > MAX_IMAGE_BYTES) {
        reader.cancel();
        return new Response("Image too large", {
          status: 413,
          headers: { ...corsHeaders },
        });
      }
      chunks.push(value);
    }

    const imageBytes = concatChunks(chunks, bytesRead);
    responseHeaders["Content-Length"] = String(imageBytes.byteLength);

    return new Response(imageBytes.buffer as ArrayBuffer, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("fetch-link-preview-asset error:", error);
    return new Response("Internal server error", {
      status: 500,
      headers: { ...corsHeaders },
    });
  }
});
