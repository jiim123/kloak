// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AccessToken, RoomServiceClient } from "https://esm.sh/livekit-server-sdk@2.13.0";
import { createServiceClient, enforceRateLimit, getAuthContext } from "../_shared/edgeSecurity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-key-hash, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

function normalizeLiveKitApiUrl(url: string): string {
  const u = url.trim();
  if (!u) return u;
  if (u.startsWith("https://") || u.startsWith("http://")) return u;
  if (u.startsWith("wss://")) return "https://" + u.slice("wss://".length);
  if (u.startsWith("ws://")) return "http://" + u.slice("ws://".length);
  if (!u.includes("://")) return `https://${u}`;
  return u;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LIVEKIT_URL = normalizeLiveKitUrl(Deno.env.get("LIVEKIT_URL") || "");
    const LIVEKIT_API_URL = normalizeLiveKitApiUrl(Deno.env.get("LIVEKIT_URL") || "");
    const LIVEKIT_API_KEY = (Deno.env.get("LIVEKIT_API_KEY") || "").trim();
    const LIVEKIT_API_SECRET = (Deno.env.get("LIVEKIT_API_SECRET") || "").trim();

    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return jsonResponse({ error: "LiveKit is not configured" }, 500);
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

    const supabase = createServiceClient();
    const auth = await getAuthContext(supabase, req);
    if (!auth.requestUserId) {
      return jsonResponse({ error: "Missing or invalid x-key-hash header" }, 401);
    }

    // Rate limit: 10 token requests per minute per user
    let rateOk = false;
    try {
      rateOk = await enforceRateLimit(supabase, auth.scopeBase, "edge_livekit_token", 10, 60);
    } catch (rateError) {
      const msg = rateError instanceof Error ? rateError.message : "Rate-limit backend unavailable";
      return jsonResponse({ error: msg }, 503);
    }
    if (!rateOk) {
      return jsonResponse({ error: "Rate limited: too many token requests" }, 429);
    }

    const requestUserId = auth.requestUserId;

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

    let channelRow: { id: string; type: string; voice_user_limit?: number | null } | null = null;
    let channelMetaLoaded = true;

    const metaResult = await supabase.rpc("get_voice_channel_meta_for_token", {
      _channel_id: room,
      _user_id: requestUserId,
    });

    if (metaResult.error) {
      // Rolling-deploy fallback: if RPC isn't deployed yet, keep service available
      // (no limit enforcement for this request).
      if (metaResult.error.code === "PGRST202") {
        channelMetaLoaded = false;
        channelRow = { id: room, type: "voice", voice_user_limit: 0 };
      } else {
        console.error("[get-livekit-token] voice channel meta RPC failed", {
          code: metaResult.error.code,
          message: metaResult.error.message,
          details: metaResult.error.details,
          hint: metaResult.error.hint,
        });
        // Do not hard-fail token issuance on metadata read issues.
        // This prevents join outages while still logging the root cause.
        channelMetaLoaded = false;
        channelRow = { id: room, type: "voice", voice_user_limit: 0 };
      }
    } else {
      channelRow = (metaResult.data as { id: string; type: string; voice_user_limit?: number | null } | null) ?? null;
    }

    if (!channelRow) {
      return jsonResponse({ error: "Voice channel not found" }, 404);
    }

    if (channelMetaLoaded && channelRow.type !== "voice") {
      return jsonResponse({ error: "Not a voice channel" }, 400);
    }

    try {
      const { error: voiceAchievementError } = await supabase.rpc("record_voice_joined_from_token", {
        _user_id: requestUserId,
        _channel_id: room,
      });
      if (voiceAchievementError) {
        console.error("[get-livekit-token] Failed to record voice achievement", voiceAchievementError);
      }
    } catch (voiceAchievementError) {
      console.error("[get-livekit-token] Failed to record voice achievement", voiceAchievementError);
    }

    const voiceUserLimit = Number(channelRow.voice_user_limit ?? 0);
    if (Number.isFinite(voiceUserLimit) && voiceUserLimit > 0) {
      try {
        const roomService = new RoomServiceClient(LIVEKIT_API_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
        const participants = await roomService.listParticipants(room);
        const identities = new Set(
          (participants || [])
            .map((p) => (typeof p.identity === "string" ? p.identity : ""))
            .filter((id) => id.length > 0),
        );

        // Allow reconnects for users already present in the room.
        if (!identities.has(identity) && identities.size >= voiceUserLimit) {
          return jsonResponse({ error: "Voice channel is full" }, 403);
        }
      } catch (lkError) {
        console.error("[get-livekit-token] Failed to check room capacity", lkError);
        return jsonResponse({ error: "Unable to verify voice channel capacity" }, 503);
      }
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

