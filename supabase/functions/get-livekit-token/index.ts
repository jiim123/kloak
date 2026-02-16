// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AccessToken } from "npm:livekit-server-sdk@2.13.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-key-hash, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalizeLiveKitUrl(url: string): string {
  const u = url.trim();
  if (!u) return u;
  if (u.startsWith("wss://") || u.startsWith("ws://")) return u;
  if (u.startsWith("https://")) return "wss://" + u.slice("https://".length);
  if (u.startsWith("http://")) return "ws://" + u.slice("http://".length);
  // If they passed just a hostname, assume wss
  if (!u.includes("://")) return `wss://${u}`;
  return u;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LIVEKIT_URL = normalizeLiveKitUrl(Deno.env.get("LIVEKIT_URL") || "");
    const LIVEKIT_API_KEY = (Deno.env.get("LIVEKIT_API_KEY") || "").trim();
    const LIVEKIT_API_SECRET = (Deno.env.get("LIVEKIT_API_SECRET") || "").trim();

    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return new Response(JSON.stringify({ error: "LiveKit is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const room = typeof body?.room === "string" ? body.room : null;
    const identity = typeof body?.identity === "string" ? body.identity : null;
    const name = typeof body?.name === "string" ? body.name : undefined;

    if (!room || !identity) {
      return new Response(JSON.stringify({ error: "room and identity are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // NOTE: This function currently does not verify that `identity` is allowed to join `room`.
    // If you want to enforce server/channel membership, we can add a DB check here.
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity, name });
    at.addGrant({
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    return new Response(JSON.stringify({ token, url: LIVEKIT_URL }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

