import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { createServiceClient, enforceRateLimit, getClientId } from "../_shared/edgeSecurity.ts";
import {
  hashIp,
  getClientIpRaw,
  checkRegistrationRateLimit,
  validateUsernameServerSide,
} from "../_shared/registrationSecurity.ts";

interface RegisterBody {
  username: string;
  key_hash: string;
  challenge_id: string;
  solution: string;
  banner_color?: string;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as RegisterBody;
    const { username, key_hash, challenge_id, solution, banner_color } = body;

    if (!username || typeof username !== "string" || !key_hash || typeof key_hash !== "string") {
      return new Response(JSON.stringify({ error: "Username and key_hash are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!challenge_id || !solution) {
      return new Response(JSON.stringify({ error: "Challenge ID and solution are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ─── Phase 3: IP-based rate limiting (runs FIRST) ───────────────────
    const rawIp = getClientIpRaw(req);
    const ipHash = await hashIp(rawIp);
    const rateResult = await checkRegistrationRateLimit(supabase, ipHash);

    if (!rateResult.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many registration attempts. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── Existing edge-level rate limit (kept for backward compat) ──────
    const sharedClient = createServiceClient();
    const clientId = getClientId(req);
    const rateScope = `client:${clientId}`;
    let rateOk = false;
    try {
      rateOk = await enforceRateLimit(sharedClient, rateScope, "edge_register_pow", 5, 300);
    } catch {
      rateOk = true;
    }
    if (!rateOk) {
      return new Response(
        JSON.stringify({ error: "Too many registration attempts. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── Phase 2: Username validation (runs BEFORE account creation) ────
    const usernameCheck = validateUsernameServerSide(username);
    if (!usernameCheck.valid) {
      return new Response(
        JSON.stringify({ error: usernameCheck.error || "Username is not allowed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── Fetch and verify the PoW challenge ─────────────────────────────
    const { data: challenge, error: challengeError } = await supabase
      .from("pow_challenges")
      .select("*")
      .eq("id", challenge_id)
      .single();

    if (challengeError || !challenge) {
      return new Response(JSON.stringify({ error: "Invalid challenge" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiry
    if (new Date(challenge.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Challenge expired" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already used
    if (challenge.used) {
      return new Response(JSON.stringify({ error: "Challenge already used" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Phase 4: Verify PoW at SERVER-DICTATED difficulty ──────────────
    // The difficulty stored in the challenge is what the server assigned.
    // We verify against that, NOT any client-reported value.
    const hash = await sha256Hex(challenge.nonce + solution);
    const target = "0".repeat(challenge.difficulty);
    if (!hash.startsWith(target)) {
      return new Response(JSON.stringify({ error: "Invalid proof of work solution" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark challenge as used
    await supabase
      .from("pow_challenges")
      .update({ used: true })
      .eq("id", challenge_id);

    // Register the user via RPC
    const normalizedUsername = username.toLowerCase().trim();
    const { data, error } = await supabase.rpc("register_user", {
      _username: normalizedUsername,
      _key_hash: key_hash,
      _banner_color: banner_color ?? "#5865F2",
    });

    if (error) {
      const errMsg = error.message ?? "";
      if (errMsg.includes("Username already taken")) {
        return new Response(JSON.stringify({ error: "Username already taken" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (errMsg.includes("reserved") || errMsg.includes("not allowed")) {
        return new Response(JSON.stringify({ error: "This username is not allowed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw error;
    }

    if (!data) {
      return new Response(JSON.stringify({ error: "Registration failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[register-with-pow] Unhandled error:", err);
    const message = err instanceof Error ? err.message : "Registration failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
