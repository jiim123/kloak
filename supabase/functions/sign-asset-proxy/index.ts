// Signs proxy URLs that route external asset fetches through
// `fetch-link-preview-asset`, so the user's browser never contacts
// attacker-controlled origins directly (no IP/UA/referrer leak).
//
// Caller passes { urls: string[] }. Response: { results: Record<url, signed|null> }.
// Signed URLs are valid for 24h and verified by the asset proxy via HMAC.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-key-hash",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PROXY_SECRET = Deno.env.get("LINK_PREVIEW_PROXY_SECRET") || SUPABASE_SERVICE_ROLE_KEY;
const PROXY_FUNCTION = "fetch-link-preview-asset";
const TTL_SECONDS = 60 * 60 * 24; // 24h, matches asset proxy
const MAX_URLS = 24;
const MAX_BODY = 10 * 1024; // 10KB

const textEncoder = new TextEncoder();
let signingKeyPromise: Promise<CryptoKey> | null = null;

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function getSigningKey(): Promise<CryptoKey> {
  if (!signingKeyPromise) {
    if (!PROXY_SECRET) throw new Error("Missing PROXY_SECRET");
    signingKeyPromise = crypto.subtle.importKey(
      "raw",
      textEncoder.encode(PROXY_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  }
  return signingKeyPromise;
}

async function sign(payload: string): Promise<string> {
  const key = await getSigningKey();
  const sig = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));
  return toBase64Url(new Uint8Array(sig));
}

// --- SSRF guard (mirrors fetch-link-preview-asset) ---
const BLOCKED_IP_PATTERNS = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[01])\./, /^192\.168\./,
  /^169\.254\./, /^0\./, /^::1$/, /^fc00:/i, /^fe80:/i, /^fd[0-9a-f]{2}:/i,
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./,
];
const BLOCKED_HOSTNAMES = new Set([
  "localhost", "metadata.google.internal", "metadata", "metadata.azure.com",
  "instance-data", "kubernetes.default", "kubernetes.default.svc", "kubernetes",
]);

function isSafeUrl(raw: string): boolean {
  let p: URL;
  try { p = new URL(raw); } catch { return false; }
  if (p.protocol !== "http:" && p.protocol !== "https:") return false;
  const host = p.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) return false;
  if (BLOCKED_IP_PATTERNS.some((re) => re.test(host))) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const o = host.split(".").map(Number);
    if (o[0] === 0 || o[0] === 127 || o[0] === 10) return false;
    if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return false;
    if (o[0] === 192 && o[1] === 168) return false;
    if (o[0] === 169 && o[1] === 254) return false;
  }
  return true;
}

function isAlreadyProxied(url: string, supabaseHost: string): boolean {
  try {
    const p = new URL(url);
    return p.host === supabaseHost && p.pathname.endsWith(`/${PROXY_FUNCTION}`);
  } catch { return false; }
}

// --- Auth: identify caller by x-key-hash (same as asset proxy) ---
function svc() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function resolveUserId(req: Request): Promise<string | null> {
  const raw = (req.headers.get("x-key-hash") || "").trim();
  if (!raw) return null;
  const norm = /^[a-fA-F0-9]{64}$/.test(raw) ? raw.toLowerCase() : raw;
  const s = svc();
  try {
    const rpc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { "x-key-hash": norm } },
    });
    const { data } = await rpc.rpc("get_request_user_id");
    if (data) return data as string;
  } catch { /* fall through */ }
  const { data } = await s.from("user_auth").select("user_id").eq("key_hash", norm).maybeSingle();
  return (data?.user_id as string) ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const lenHeader = req.headers.get("content-length");
    if (lenHeader && Number(lenHeader) > MAX_BODY) {
      return new Response(JSON.stringify({ error: "Body too large" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const text = await req.text();
    if (text.length > MAX_BODY) {
      return new Response(JSON.stringify({ error: "Body too large" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = await resolveUserId(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: { urls?: unknown };
    try { body = JSON.parse(text); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const urls = Array.isArray(body.urls) ? body.urls.filter((u): u is string => typeof u === "string") : [];
    if (urls.length === 0) {
      return new Response(JSON.stringify({ results: {} }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (urls.length > MAX_URLS) {
      return new Response(JSON.stringify({ error: `Max ${MAX_URLS} urls per request` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseHost = (() => { try { return new URL(SUPABASE_URL).host; } catch { return ""; } })();
    const proxyBase = `${SUPABASE_URL.replace(/\/+$/g, "")}/functions/v1/${PROXY_FUNCTION}`;
    const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;

    const results: Record<string, string | null> = {};
    await Promise.all(urls.map(async (target) => {
      if (target.length > 2048) { results[target] = null; return; }
      if (isAlreadyProxied(target, supabaseHost)) { results[target] = target; return; }
      if (!isSafeUrl(target)) { results[target] = null; return; }
      try {
        const sig = await sign(`${exp}:${target}`);
        const u = new URL(proxyBase);
        u.searchParams.set("u", target);
        u.searchParams.set("exp", String(exp));
        u.searchParams.set("sig", sig);
        results[target] = u.toString();
      } catch {
        results[target] = null;
      }
    }));

    return new Response(JSON.stringify({ results, exp }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("sign-asset-proxy error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
