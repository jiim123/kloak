import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, enforceRateLimit, getAuthContext } from "../_shared/edgeSecurity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-key-hash, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const API_KEY = Deno.env.get("KLIPY_API_KEY");
  if (!API_KEY) {
    return jsonResponse({ error: "Klipy API key not configured" }, 500);
  }

  try {
    // ── Auth + rate limiting ──
    const supabase = createServiceClient();
    const auth = await getAuthContext(supabase, req);

    let rateOk = false;
    try {
      rateOk = await enforceRateLimit(supabase, auth.scopeBase, "edge_klipy_proxy", 90, 60);
    } catch {
      rateOk = true; // fail open if rate limit backend unavailable
    }
    if (!rateOk) {
      return jsonResponse({ error: "Rate limited: too many GIF lookups" }, 429);
    }

    const body = await req.json();
    const { action, query, perPage = 24, page = 1, userId, slug, locale = "en-US" } = body;

    // ── Input validation ──
    const safePerPage = Number.isFinite(Number(perPage)) ? Math.max(1, Math.min(Number(perPage), 50)) : 24;
    const safePage = Number.isFinite(Number(page)) ? Math.max(1, Math.min(Number(page), 100)) : 1;
    const safeLocale = typeof locale === "string" ? locale.slice(0, 10) : "en-US";

    const BASE = `https://api.klipy.com/api/v1/${API_KEY}`;

    let url: string;
    let method = "GET";
    let fetchBody: string | undefined;

    switch (action) {
      case "trending":
        url = `${BASE}/gifs/trending?page=${safePage}&per_page=${safePerPage}&locale=${encodeURIComponent(safeLocale)}`;
        if (userId && typeof userId === "string") url += `&customer_id=${encodeURIComponent(userId.slice(0, 128))}`;
        break;
      case "search":
        if (!query || typeof query !== "string" || query.length > 200) {
          return jsonResponse({ error: "Invalid query" }, 400);
        }
        url = `${BASE}/gifs/search?q=${encodeURIComponent(query.slice(0, 200))}&page=${safePage}&per_page=${safePerPage}&locale=${encodeURIComponent(safeLocale)}`;
        if (userId && typeof userId === "string") url += `&customer_id=${encodeURIComponent(userId.slice(0, 128))}`;
        break;
      case "recent":
        if (!userId || typeof userId !== "string") {
          return jsonResponse({ error: "userId required" }, 400);
        }
        url = `${BASE}/gifs/recent/${encodeURIComponent(userId.slice(0, 128))}?page=${safePage}&per_page=${safePerPage}`;
        break;
      case "share":
        if (!slug || typeof slug !== "string" || slug.length > 200) {
          return jsonResponse({ error: "slug required" }, 400);
        }
        url = `${BASE}/gifs/share/${encodeURIComponent(slug.slice(0, 200))}`;
        method = "POST";
        fetchBody = JSON.stringify({ customer_id: (typeof userId === "string" ? userId.slice(0, 128) : "anonymous") });
        break;
      case "categories":
        url = `${BASE}/gifs/categories?locale=${encodeURIComponent(safeLocale)}`;
        break;
      default:
        return jsonResponse({ error: "Unknown action" }, 400);
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      ...(fetchBody ? { body: fetchBody } : {}),
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
