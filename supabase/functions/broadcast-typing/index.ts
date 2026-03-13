import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createServiceClient, enforceRateLimit, getAuthContext } from "../_shared/edgeSecurity.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const CHANNEL_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AUTH_CACHE_TTL_MS = 60_000;
const ACCESS_CACHE_TTL_MS = 15_000;
const authCache = new Map<string, { userId: string; expiresAt: number }>();
const accessCache = new Map<string, { allowed: boolean; expiresAt: number }>();
const serviceClient = createServiceClient();

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
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Supabase service credentials not configured" }, 500);
    }

    const keyHash = req.headers.get("x-key-hash")?.trim();
    if (!keyHash) {
      return jsonResponse({ error: "Missing x-key-hash header" }, 401);
    }

    const now = Date.now();
    const cachedAuth = authCache.get(keyHash);
    let requestUserId = cachedAuth && cachedAuth.expiresAt > now ? cachedAuth.userId : null;
    if (!requestUserId) {
      const auth = await getAuthContext(serviceClient, req);
      if (!auth.requestUserId) {
        return jsonResponse({ error: "Invalid credentials" }, 401);
      }
      requestUserId = auth.requestUserId;
      authCache.set(keyHash, { userId: requestUserId, expiresAt: now + AUTH_CACHE_TTL_MS });
    }

    const body = await req.json().catch(() => null);
    if (body === null) {
      console.warn("broadcast-typing: failed to parse request body as JSON");
    }
    const channelId = typeof body?.channel_id === "string" ? body.channel_id.trim() : "";
    if (!CHANNEL_ID_RE.test(channelId)) {
      return jsonResponse({ error: "Invalid channel_id" }, 400);
    }

    const event = body?.event === "stop_typing" ? "stop_typing" : "typing";
    if (event === "typing") {
      const rateScope = `user:${requestUserId}:typing:${channelId}`;
      let rateOk = false;
      try {
        rateOk = await enforceRateLimit(serviceClient, rateScope, "edge_typing", 120, 60);
      } catch (rateError) {
        const rateMessage =
          rateError instanceof Error ? rateError.message : "Rate-limit backend unavailable";
        return jsonResponse({ error: rateMessage }, 503);
      }
      if (!rateOk) {
        return jsonResponse({ error: "Rate limited: too many typing updates" }, 429);
      }
    }

    const accessKey = `${requestUserId}:${channelId}`;
    const cachedAccess = accessCache.get(accessKey);
    let canAccess = cachedAccess && cachedAccess.expiresAt > now ? cachedAccess.allowed : null;
    if (canAccess === null) {
      // can_access_channel is identity-bound in this project, so forward x-key-hash.
      const rpcClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { "x-key-hash": keyHash } },
      });
      const { data, error: canAccessError } = await rpcClient.rpc("can_access_channel", {
        _channel_id: channelId,
        _user_id: requestUserId,
      });
      if (canAccessError) {
        return jsonResponse({ error: "Failed to verify channel access" }, 400);
      }
      canAccess = !!data;
      accessCache.set(accessKey, {
        allowed: canAccess,
        expiresAt: now + ACCESS_CACHE_TTL_MS,
      });
    }
    if (!canAccess) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const broadcastResponse = await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `typing:${channelId}`,
            event,
            payload: { user_id: requestUserId },
            private: false,
          },
        ],
      }),
    });

    if (!broadcastResponse.ok) {
      const details = await broadcastResponse.text().catch(() => "");
      return jsonResponse(
        {
          error: "Failed to publish typing event",
          details: details.slice(0, 500),
        },
        502,
      );
    }

    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Typing broadcast failed";
    return jsonResponse({ error: message }, 500);
  }
});
