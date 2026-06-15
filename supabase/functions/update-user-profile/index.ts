import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createServiceClient, enforceRateLimit, getAuthContext } from "../_shared/edgeSecurity.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-key-hash, x-mfa-session, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const supabase = createServiceClient();
    const auth = await getAuthContext(supabase, req);
    if (!auth.requestUserId) {
      return jsonResponse({ error: "Invalid credentials" }, 401);
    }

    let rateOk = false;
    try {
      rateOk = await enforceRateLimit(supabase, auth.scopeBase, "edge_update_profile", 30, 60);
    } catch (rateError) {
      const rateMessage =
        rateError instanceof Error ? rateError.message : "Rate-limit backend unavailable";
      return jsonResponse({ error: rateMessage }, 503);
    }
    if (!rateOk) {
      return jsonResponse({ error: "Rate limited: too many profile updates" }, 429);
    }

    const body = await req.json().catch(() => null);
    const updatesCandidate =
      body && typeof body === "object" && !Array.isArray(body) && "updates" in body
        ? (body as Record<string, unknown>).updates
        : body;

    if (!updatesCandidate || typeof updatesCandidate !== "object" || Array.isArray(updatesCandidate)) {
      return jsonResponse({ error: "Invalid updates payload" }, 400);
    }

    const updates = updatesCandidate as Record<string, unknown>;

    // Call service-only RPC while forwarding x-key-hash for DB identity checks.
    const rpcClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: {
          "x-key-hash": keyHash,
        },
      },
    });

    const { data, error } = await rpcClient.rpc("update_user_profile", {
      _user_id: auth.requestUserId,
      _updates: updates,
    });

    if (error) {
      const message = error.message || "Profile update failed";
      const status = /unauthorized|identity mismatch/i.test(message) ? 403 : 400;
      return jsonResponse({ error: message }, status);
    }

    if (!data || typeof data !== "object") {
      return jsonResponse({ error: "Profile update failed" }, 500);
    }

    return jsonResponse(data as Record<string, unknown>, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Profile update failed";
    return jsonResponse({ error: message }, 500);
  }
});
