import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createServiceClient, enforceRateLimit, getAuthContext } from "../_shared/edgeSecurity.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { query, limit = 20, offset = 0 } = await req.json();
    const apiKey = Deno.env.get("GIPHY_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GIPHY API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createServiceClient();
    const auth = await getAuthContext(supabase, req);
    if (!auth.requestUserId) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const rateOk = await enforceRateLimit(supabase, auth.scopeBase, "edge_giphy_search", 90, 60);
    if (!rateOk) {
      return new Response(JSON.stringify({ error: "Rate limited: too many GIF lookups" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeLimit = Number.isFinite(Number(limit))
      ? Math.max(1, Math.min(Number(limit), 50))
      : 20;
    const safeOffset = Number.isFinite(Number(offset))
      ? Math.max(0, Math.min(Number(offset), 1000))
      : 0;
    const safeQuery = typeof query === "string" ? query.trim().slice(0, 200) : "";

    const endpoint = safeQuery
      ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(safeQuery)}&limit=${safeLimit}&offset=${safeOffset}&rating=pg-13&lang=en`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=${safeLimit}&offset=${safeOffset}&rating=pg-13`;

    const response = await fetch(endpoint, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch GIFs" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const gifs =
      data.data?.map((gif: any) => ({
        id: gif.id,
        title: gif.title,
        url: gif.images.fixed_height.url,
        preview: gif.images.fixed_height_small.url,
        width: parseInt(gif.images.fixed_height.width),
        height: parseInt(gif.images.fixed_height.height),
        mp4: gif.images.fixed_height.mp4,
      })) || [];

    return new Response(JSON.stringify({ gifs, pagination: data.pagination }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("GIPHY search error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("GIPHY internal error:", message);
    return new Response(JSON.stringify({ error: "Failed to fetch GIFs" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
