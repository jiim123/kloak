// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AccessToken } from "https://esm.sh/livekit-server-sdk@2.13.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-key-hash, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function createServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function resolveRequestUserId(supabase: ReturnType<typeof createServiceClient>, keyHash: string) {
  const { data, error } = await supabase
    .from("user_auth")
    .select("user_id")
    .eq("key_hash", keyHash)
    .single();

  if (error || !data?.user_id) return null;
  return data.user_id as string;
}

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
      return jsonResponse({ error: "LiveKit is not configured" }, 500);
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Supabase service credentials not configured" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const room = typeof body?.room === "string" ? body.room : null;
    const identity = typeof body?.identity === "string" ? body.identity : null;
    const name = typeof body?.name === "string" ? body.name : undefined;

    if (!room || !identity) {
      return jsonResponse({ error: "room and identity are required" }, 400);
    }

    if (!UUID_RE.test(room) || !UUID_RE.test(identity)) {
      return jsonResponse({ error: "room and identity must be UUIDs" }, 400);
    }

    const keyHash = req.headers.get("x-key-hash");
    if (!keyHash) {
      return jsonResponse({ error: "Missing x-key-hash header" }, 401);
    }

    const supabase = createServiceClient();
    const requestUserId = await resolveRequestUserId(supabase, keyHash);
    if (!requestUserId) {
      return jsonResponse({ error: "Invalid credentials" }, 401);
    }

    if (requestUserId !== identity) {
      return jsonResponse({ error: "Identity mismatch" }, 403);
    }

    const { data: canAccess, error: accessError } = await supabase.rpc("has_channel_access", {
      _channel_id: room,
      _user_id: requestUserId,
    });
    if (accessError || !canAccess) {
      return jsonResponse({ error: "Not allowed to join this voice channel" }, 403);
    }

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity, name });
    at.addGrant({
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    return jsonResponse({ token, url: LIVEKIT_URL }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});

