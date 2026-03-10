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

// ─── Origin allowlist ───────────────────────────────────────────────────────
const LOCAL_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://klbetadis.lovable.app",
  "https://id-preview--67ba8495-ca58-4eeb-80ed-94fbf23fb179.lovable.app",
];

function getAllowedOrigins(): string[] {
  const envKeys = ["REGISTER_ALLOWED_ORIGINS", "SUPABASE_REGISTER_ALLOWED_ORIGINS", "APP_ALLOWED_ORIGINS", "APP_ORIGIN"];
  const configured: string[] = [];
  for (const key of envKeys) {
    const raw = Deno.env.get(key);
    if (!raw) continue;
    for (const entry of raw.split(",").map((e) => e.trim()).filter(Boolean)) {
      try { const o = new URL(entry).origin; if (!configured.includes(o)) configured.push(o); } catch { /* skip */ }
    }
  }
  return configured.length > 0 ? configured : LOCAL_DEV_ORIGINS;
}

const allowedOrigins = getAllowedOrigins();

function getRequestOrigin(req: Request): string | null {
  const raw = req.headers.get("origin")?.trim();
  if (!raw) return null;
  try { return new URL(raw).origin; } catch { return null; }
}

function isOriginAllowed(origin: string | null): origin is string {
  return origin !== null && allowedOrigins.includes(origin);
}

function corsHeadersForOrigin(origin: string | null): Record<string, string> {
  if (!origin) return { ...corsHeaders };
  return { ...corsHeaders, "Access-Control-Allow-Origin": origin };
}

const MAX_BODY_BYTES = 10 * 1024; // 10 KB

Deno.serve(async (req) => {
  const requestOrigin = getRequestOrigin(req);
  const originAllowed = isOriginAllowed(requestOrigin);

  if (req.method === "OPTIONS") {
    if (!originAllowed) {
      return new Response(null, { status: 403, headers: corsHeaders });
    }
    return new Response(null, { status: 204, headers: corsHeadersForOrigin(requestOrigin) });
  }

  // Reject disallowed origins
  if (!originAllowed) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const resHeaders = { ...corsHeadersForOrigin(requestOrigin), "Content-Type": "application/json" };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: resHeaders,
    });
  }

  try {
    // ─── Content-Type validation ────────────────────────────────────────
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return new Response(JSON.stringify({ error: "Invalid content type" }), {
        status: 415, headers: resHeaders,
      });
    }

    // ─── Body size limit ────────────────────────────────────────────────
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: "Request too large" }), {
        status: 413, headers: resHeaders,
      });
    }

    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: "Request too large" }), {
        status: 413, headers: resHeaders,
      });
    }

    let body: RegisterBody;
    try {
      body = JSON.parse(rawBody) as RegisterBody;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400, headers: resHeaders,
      });
    }
    const { username, key_hash, challenge_id, solution, banner_color } = body;

    if (!username || typeof username !== "string" || !key_hash || typeof key_hash !== "string") {
      return new Response(JSON.stringify({ error: "Username and key_hash are required" }), {
        status: 400, headers: resHeaders,
      });
    }

    if (!challenge_id || !solution) {
      return new Response(JSON.stringify({ error: "Challenge ID and solution are required" }), {
        status: 400, headers: resHeaders,
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
        { status: 429, headers: resHeaders },
      );
    }

    // ─── Existing edge-level rate limit (kept for backward compat) ──────
    const sharedClient = createServiceClient();
    const clientId = getClientId(req);
    const rateScope = `client:${clientId}`;
    let rateOk = false;
    try {
      rateOk = await enforceRateLimit(sharedClient, rateScope, "edge_register_pow", 5, 300);
    } catch (rateError) {
      console.error("[register-with-pow] rate limit backend error:", rateError);
      return new Response(JSON.stringify({ error: "Service temporarily unavailable" }), {
        status: 503, headers: resHeaders,
      });
    }
    if (!rateOk) {
      return new Response(
        JSON.stringify({ error: "Too many registration attempts. Please try again later." }),
        { status: 429, headers: resHeaders },
      );
    }

    // ─── Phase 2: Username validation (runs BEFORE account creation) ────
    const usernameCheck = validateUsernameServerSide(username);
    if (!usernameCheck.valid) {
      return new Response(
        JSON.stringify({ error: usernameCheck.error || "Username is not allowed" }),
        { status: 400, headers: resHeaders },
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
        status: 400, headers: resHeaders,
      });
    }

    // Check expiry
    if (new Date(challenge.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Challenge expired" }), {
        status: 400, headers: resHeaders,
      });
    }

    // Check if already used
    if (challenge.used) {
      return new Response(JSON.stringify({ error: "Challenge already used" }), {
        status: 400, headers: resHeaders,
      });
    }

    // ─── Phase 4: Verify PoW at SERVER-DICTATED difficulty ──────────────
    const hash = await sha256Hex(challenge.nonce + solution);
    const target = "0".repeat(challenge.difficulty);
    if (!hash.startsWith(target)) {
      return new Response(JSON.stringify({ error: "Invalid proof of work solution" }), {
        status: 400, headers: resHeaders,
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
          status: 400, headers: resHeaders,
        });
      }
      if (errMsg.includes("reserved") || errMsg.includes("not allowed")) {
        return new Response(JSON.stringify({ error: "This username is not allowed" }), {
          status: 400, headers: resHeaders,
        });
      }
      throw error;
    }

    if (!data) {
      return new Response(JSON.stringify({ error: "Registration failed" }), {
        status: 500, headers: resHeaders,
      });
    }

    return new Response(JSON.stringify({ data }), { headers: resHeaders });
  } catch (err) {
    console.error("[register-with-pow] Unhandled error:", err);
    const message = err instanceof Error ? err.message : "Registration failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
