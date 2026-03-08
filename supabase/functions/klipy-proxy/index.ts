import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const API_KEY = Deno.env.get("KLIPY_API_KEY");
  if (!API_KEY) {
    return new Response(JSON.stringify({ error: "Klipy API key not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const BASE = `https://api.klipy.com/api/v1/${API_KEY}`;

  try {
    const body = await req.json();
    const { action, query, perPage = 24, page = 1, userId, slug, locale = "en-US" } = body;

    let url: string;
    let method = "GET";

    switch (action) {
      case "trending":
        url = `${BASE}/gifs/trending?page=${page}&per_page=${perPage}&locale=${encodeURIComponent(locale)}`;
        if (userId) url += `&customer_id=${encodeURIComponent(userId)}`;
        break;
      case "search":
        if (!query || typeof query !== "string" || query.length > 200) {
          return new Response(JSON.stringify({ error: "Invalid query" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        url = `${BASE}/gifs/search?q=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}&locale=${encodeURIComponent(locale)}`;
        if (userId) url += `&customer_id=${encodeURIComponent(userId)}`;
        break;
      case "recent":
        if (!userId) {
          return new Response(JSON.stringify({ error: "userId required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        url = `${BASE}/gifs/recent/${encodeURIComponent(userId)}?page=${page}&per_page=${perPage}`;
        break;
      case "share":
        if (!slug) {
          return new Response(JSON.stringify({ error: "slug required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        url = `${BASE}/gifs/share/${encodeURIComponent(slug)}`;
        method = "POST";
        // Pass customer_id in body for Klipy to track per-user recent GIFs
        fetchOptions = {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customer_id: userId || "anonymous" }),
        };
        break;
      case "categories":
        url = `${BASE}/gifs/categories?locale=${encodeURIComponent(locale)}`;
        break;
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
