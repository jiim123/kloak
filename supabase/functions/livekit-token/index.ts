import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AccessToken } from "npm:livekit-server-sdk@^2.11.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY");
    const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET");
    const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL");

    if (!LIVEKIT_API_KEY) {
      throw new Error("LIVEKIT_API_KEY is not configured");
    }
    if (!LIVEKIT_API_SECRET) {
      throw new Error("LIVEKIT_API_SECRET is not configured");
    }
    if (!LIVEKIT_URL) {
      throw new Error("LIVEKIT_URL is not configured");
    }

    const { roomName, participantIdentity, participantName } = await req.json();

    if (!roomName || typeof roomName !== "string") {
      return new Response(
        JSON.stringify({ error: "roomName is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!participantIdentity || typeof participantIdentity !== "string") {
      return new Response(
        JSON.stringify({ error: "participantIdentity is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create an access token with the participant's identity
    const accessToken = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantIdentity,
      name: participantName || participantIdentity,
      // Token expires in 6 hours
      ttl: "6h",
    });

    // Grant permissions for the room
    accessToken.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await accessToken.toJwt();

    return new Response(
      JSON.stringify({ token, url: LIVEKIT_URL }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating LiveKit token:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
