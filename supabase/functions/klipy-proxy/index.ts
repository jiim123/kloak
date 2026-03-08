import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const API_KEY = Deno.env.get("VITE_KLIPY_API_KEY");
  if (!API_KEY) {
    return new Response(JSON.stringify({ error: "Klipy API key not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const BASE = `https://api.klipy.com/api/v1/${API_KEY}`;

  try {
    const body = await req.json();
    const { action, query, limit = 24, userId, gifId } = body;

    let url: string;
    let method = "GET";
    let fetchBody: string | undefined;

    switch (action) {
      case "trending":
        url = `${BASE}/gifs/trending?limit=${limit}&locale=en-US`;
        break;
      case "search":
        url = `${BASE}/gifs/search?q=${encodeURIComponent(query || "")}&limit=${limit}&locale=en-US`;
        break;
      case "recent":
        url = `${BASE}/gifs/recent/${encodeURIComponent(userId || "")}?limit=${limit}`;
        break;
      case "share":
        url = `${BASE}/gifs/share`;
        method = "POST";
        fetchBody = JSON.stringify({ gif_id: gifId, customer_id: userId });
        break;
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const res = await fetch(url, {
      method,
      headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
      body: fetchBody,
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
