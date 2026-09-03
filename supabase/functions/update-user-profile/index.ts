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

const VALID_NAMEPLATES = new Set(["plate1", "plate2", "plate3", "plate4", "plate5"]);

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

    // Create an RPC client with x-key-hash for verify_request_identity.
    const rpcClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: {
          "x-key-hash": keyHash,
        },
      },
    });

    // Handle nameplate separately — use a dedicated lightweight RPC to avoid PostgREST schema cache issues.
    let nameplateSaved = false;
    let savedNameplateValue: string | null = null;
    if ("nameplate" in updates) {
      const raw = updates.nameplate;
      const value = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;

      if (value !== null && !VALID_NAMEPLATES.has(value)) {
        return jsonResponse({ error: "Invalid nameplate value" }, 400);
      }

      // Try the dedicated nameplate RPC. If the function doesn't exist yet (pre-migration), silently skip.
      try {
        const { error: nameplateErr } = await rpcClient.rpc("update_user_nameplate", {
          _user_id: auth.requestUserId,
          _nameplate: value,
        });

        if (nameplateErr) {
          console.warn("[nameplate] RPC update failed (function may not exist yet):", nameplateErr.message);
        } else {
          nameplateSaved = true;
          savedNameplateValue = value;
        }
      } catch (e) {
        console.warn("[nameplate] RPC update exception (function may not exist yet):", e);
      }

      // Remove nameplate from the updates so the main RPC doesn't choke on it.
      delete updates.nameplate;
    }

    // If there are remaining fields, call the SQL RPC as before.
    let rpcResult: Record<string, unknown> | null = null;
    if (Object.keys(updates).length > 0) {
      const { data, error } = await rpcClient.rpc("update_user_profile", {
        _user_id: auth.requestUserId,
        _updates: updates,
      });

      if (error) {
        const message = error.message || "Profile update failed";
        const status = /unauthorized|identity mismatch/i.test(message) ? 403 : 400;
        return jsonResponse({ error: message }, status);
      }

      if (data && typeof data === "object") {
        rpcResult = data as Record<string, unknown>;
      }
    }

    // If only nameplate was updated (or nameplate + nothing else), build a minimal response.
    if (!rpcResult) {
      // Fetch the current user row so the client has fresh data.
      try {
        const { data: row } = await supabase
          .from("users")
          .select("*")
          .eq("id", auth.requestUserId)
          .single();
        if (row) {
          rpcResult = row as Record<string, unknown>;
        }
      } catch (e) {
        console.warn("[nameplate] Failed to fetch user row:", e);
      }
    }

    // Merge nameplate into the result so the client gets the updated value.
    if (rpcResult && nameplateSaved) {
      rpcResult.nameplate = savedNameplateValue;
    }

    // If we still have no result but nameplate saved successfully, return a minimal success.
    if (!rpcResult) {
      if (nameplateSaved) {
        return jsonResponse({ ...auth.requestUserId ? { id: auth.requestUserId } : {}, nameplate: savedNameplateValue } as Record<string, unknown>, 200);
      }
      return jsonResponse({ error: "Profile update failed" }, 500);
    }

    return jsonResponse(rpcResult, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Profile update failed";
    return jsonResponse({ error: message }, 500);
  }
});
