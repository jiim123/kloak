import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const baseCorsHeaders: Record<string, string> = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};

const HCAPTCHA_VERIFY_URL = "https://hcaptcha.com/siteverify";
const LOCAL_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://klbetadis.lovable.app",
  "https://id-preview--67ba8495-ca58-4eeb-80ed-94fbf23fb179.lovable.app",
];

interface RegisterBody {
  username: string;
  key_hash: string;
  hcaptcha_response: string;
  banner_color?: string;
}

interface HCaptchaVerifyResponse {
  success: boolean;
  hostname?: string;
  sitekey?: string;
  "error-codes"?: string[];
}

function requestDebugId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function uniqueNonEmpty(values: Array<string | undefined | null>): string[] {
  const out: string[] = [];
  for (const value of values) {
    const trimmed = (value ?? "").trim();
    if (!trimmed) continue;
    if (!out.includes(trimmed)) out.push(trimmed);
  }
  return out;
}

function splitCsv(value: string | undefined | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function normalizeOrigin(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function getRequestOrigin(req: Request): string | null {
  const rawOrigin = req.headers.get("origin")?.trim();
  if (!rawOrigin) return null;
  return normalizeOrigin(rawOrigin);
}

function getAllowedRegistrationOrigins(): string[] {
  const configured: string[] = [];
  const rawValues = [
    Deno.env.get("REGISTER_ALLOWED_ORIGINS"),
    Deno.env.get("SUPABASE_REGISTER_ALLOWED_ORIGINS"),
    Deno.env.get("APP_ALLOWED_ORIGINS"),
    Deno.env.get("APP_ORIGIN"),
  ];

  for (const rawValue of rawValues) {
    for (const candidate of splitCsv(rawValue)) {
      const normalized = normalizeOrigin(candidate);
      if (!normalized) continue;
      if (!configured.includes(normalized)) configured.push(normalized);
    }
  }

  if (configured.length === 0) {
    console.warn("[register-with-captcha] No registration origin allowlist configured; using local dev defaults.", {
      fallbackOrigins: LOCAL_DEV_ORIGINS,
      expectedAnyOf: [
        "REGISTER_ALLOWED_ORIGINS",
        "SUPABASE_REGISTER_ALLOWED_ORIGINS",
        "APP_ALLOWED_ORIGINS",
        "APP_ORIGIN",
      ],
    });
    return LOCAL_DEV_ORIGINS;
  }

  return configured;
}

const allowedRegistrationOrigins = getAllowedRegistrationOrigins();

function isAllowedRegistrationOrigin(origin: string | null): origin is string {
  return origin !== null && allowedRegistrationOrigins.includes(origin);
}

function corsHeadersForOrigin(origin: string | null): Record<string, string> {
  if (!origin) return { ...baseCorsHeaders };
  return { ...baseCorsHeaders, "Access-Control-Allow-Origin": origin };
}

function jsonResponse(status: number, body: Record<string, unknown>, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersForOrigin(origin), "Content-Type": "application/json" },
  });
}

function getCanonicalClientIp(req: Request): string | null {
  const xForwardedFor = req.headers.get("x-forwarded-for")?.trim() ?? "";
  if (xForwardedFor) {
    const hops = xForwardedFor
      .split(",")
      .map((hop) => hop.trim())
      .filter((hop) => hop.length > 0);
    if (hops.length > 0) {
      return hops[hops.length - 1].slice(0, 128);
    }
  }

  const realIp = req.headers.get("x-real-ip")?.trim() ?? "";
  if (realIp) return realIp.slice(0, 128);

  const cfIp = req.headers.get("cf-connecting-ip")?.trim() ?? "";
  if (cfIp) return cfIp.slice(0, 128);

  return null;
}

function hostMatches(requestHost: string, verifyHost: string): boolean {
  const left = requestHost.toLowerCase();
  const right = verifyHost.toLowerCase();
  return left === right || left.endsWith(`.${right}`) || right.endsWith(`.${left}`);
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const debugId = requestDebugId();
  const requestOrigin = getRequestOrigin(req);
  const originAllowed = isAllowedRegistrationOrigin(requestOrigin);

  if (req.method === "OPTIONS") {
    if (!originAllowed) {
      return new Response(null, { status: 403, headers: baseCorsHeaders });
    }
    return new Response(null, { status: 204, headers: corsHeadersForOrigin(requestOrigin) });
  }

  if (!originAllowed) {
    return jsonResponse(403, { error: "Origin not allowed" }, null);
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" }, requestOrigin);
  }

  const secret = uniqueNonEmpty([
    Deno.env.get("SUPABASE_HCAPTCHA_SECRET_KEY"),
    Deno.env.get("HCAPTCHA_SECRET_KEY"),
    Deno.env.get("HCAPTCHA_SECRET"),
    Deno.env.get("CAPTCHA_SECRET_KEY"),
  ])[0];
  const expectedHcaptchaSiteKey = uniqueNonEmpty([
    Deno.env.get("HCAPTCHA_SITE_KEY"),
    Deno.env.get("SUPABASE_HCAPTCHA_SITE_KEY"),
    Deno.env.get("VITE_HCAPTCHA_SITE_KEY"),
  ])[0];
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey =
    uniqueNonEmpty([Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), Deno.env.get("SERVICE_ROLE_KEY")])[0] ?? "";

  if (!secret || !supabaseUrl || !serviceRoleKey) {
    console.error("[register-with-captcha] Missing runtime env", {
      debugId,
      envVisible: {
        SUPABASE_HCAPTCHA_SECRET_KEY: !!Deno.env.get("SUPABASE_HCAPTCHA_SECRET_KEY"),
        HCAPTCHA_SECRET_KEY: !!Deno.env.get("HCAPTCHA_SECRET_KEY"),
        HCAPTCHA_SECRET: !!Deno.env.get("HCAPTCHA_SECRET"),
        CAPTCHA_SECRET_KEY: !!Deno.env.get("CAPTCHA_SECRET_KEY"),
        SUPABASE_URL: !!Deno.env.get("SUPABASE_URL"),
        SUPABASE_SERVICE_ROLE_KEY: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
        SERVICE_ROLE_KEY: !!Deno.env.get("SERVICE_ROLE_KEY"),
      },
      expectedAnyOf: [
        "SUPABASE_HCAPTCHA_SECRET_KEY",
        "HCAPTCHA_SECRET_KEY",
        "HCAPTCHA_SECRET",
        "CAPTCHA_SECRET_KEY",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SERVICE_ROLE_KEY",
      ],
    });
    return jsonResponse(500, { error: "Server configuration error" }, requestOrigin);
  }

  try {
    const body = (await req.json()) as RegisterBody;
    const { username, key_hash, hcaptcha_response, banner_color } = body;

    if (!username || typeof username !== "string" || !key_hash || typeof key_hash !== "string") {
      return jsonResponse(400, { error: "Username and key_hash are required" }, requestOrigin);
    }

    if (!hcaptcha_response || typeof hcaptcha_response !== "string") {
      return jsonResponse(400, { error: "Captcha verification is required" }, requestOrigin);
    }

    const canonicalIp = getCanonicalClientIp(req);
    const normalizedUsername = username.toLowerCase().trim();
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Edge-level rate limiting to block bursts before account creation RPC.
    const clientScope = canonicalIp
      ? `ip:${(await sha256Hex(canonicalIp)).slice(0, 32)}`
      : `kh:${key_hash.toLowerCase().slice(0, 16)}`;
    const usernameScope = `un:${(await sha256Hex(normalizedUsername)).slice(0, 32)}`;
    const rateLimitChecks = [
      {
        scope: clientScope,
        action: "edge_register_with_captcha_burst",
        maxAttempts: 6,
        windowSeconds: 60,
        message: "Too many registration attempts. Please wait a minute and try again.",
      },
      {
        scope: clientScope,
        action: "edge_register_with_captcha_hourly",
        maxAttempts: 20,
        windowSeconds: 3600,
        message: "Registration temporarily limited. Please try again later.",
      },
      {
        scope: usernameScope,
        action: "edge_register_with_captcha_username",
        maxAttempts: 4,
        windowSeconds: 600,
        message: "Too many attempts for this username. Please wait and try again.",
      },
    ];
    for (const check of rateLimitChecks) {
      const { data: allowed, error: rateError } = await supabase.rpc("check_rate_limit", {
        _ip_hash: check.scope,
        _action: check.action,
        _max_attempts: check.maxAttempts,
        _window_seconds: check.windowSeconds,
      });
      if (rateError) {
        console.error("[register-with-captcha] check_rate_limit rpc failed", {
          debugId,
          scope: check.scope,
          action: check.action,
          error: rateError.message,
        });
        return jsonResponse(
          503,
          { error: "Registration protection temporarily unavailable. Please retry shortly." },
          requestOrigin,
        );
      }
      if (!allowed) {
        return jsonResponse(429, { error: check.message }, requestOrigin);
      }
    }

    let verifyRes: Response;
    try {
      const verifyBody = new URLSearchParams({
        response: hcaptcha_response,
        secret,
      });
      if (canonicalIp) verifyBody.set("remoteip", canonicalIp);
      if (expectedHcaptchaSiteKey) verifyBody.set("sitekey", expectedHcaptchaSiteKey);

      verifyRes = await fetch(HCAPTCHA_VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: verifyBody,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("hCaptcha network failure:", msg);
      return jsonResponse(502, { error: `hCaptcha verification network failure: ${msg}` }, requestOrigin);
    }

    if (!verifyRes.ok) {
      console.error("hCaptcha verify returned non-2xx", { debugId, status: verifyRes.status });
      return jsonResponse(502, { error: "Captcha verification is unavailable. Please try again." }, requestOrigin);
    }

    const verifyJson = (await verifyRes.json()) as HCaptchaVerifyResponse;
    if (!verifyJson.success) {
      const errorCodes = verifyJson["error-codes"]?.filter(Boolean) ?? [];
      console.warn("hCaptcha verification failed:", { debugId, errorCodes });
      const detail = errorCodes.length > 0 ? `: ${errorCodes.join(", ")}` : "";
      return jsonResponse(400, { error: `Captcha verification failed${detail}` }, requestOrigin);
    }

    if (requestOrigin && verifyJson.hostname) {
      const requestHost = new URL(requestOrigin).hostname;
      if (!hostMatches(requestHost, verifyJson.hostname)) {
        console.warn("Captcha hostname mismatch", {
          debugId,
          requestHost,
          captchaHostname: verifyJson.hostname,
        });
        return jsonResponse(
          400,
          { error: `Captcha hostname mismatch (request=${requestHost}, captcha=${verifyJson.hostname})` },
          requestOrigin,
        );
      }
    }

    const { data, error } = await supabase.rpc("register_user", {
      _username: normalizedUsername,
      _key_hash: key_hash,
      _banner_color: banner_color ?? "#5865F2",
    });

    if (error) {
      const errMsg = error.message ?? "";
      if (errMsg.includes("Username already taken")) {
        return jsonResponse(400, { error: "Username already taken" }, requestOrigin);
      }
      if (errMsg.includes("reserved")) {
        return jsonResponse(400, { error: "This username is reserved" }, requestOrigin);
      }
      throw error;
    }

    if (!data) {
      return jsonResponse(500, { error: "Registration failed" }, requestOrigin);
    }

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeadersForOrigin(requestOrigin), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[register-with-captcha] Unhandled error:", { debugId, err });
    const message = err instanceof Error ? err.message : "Registration failed";
    return jsonResponse(500, { error: message }, requestOrigin);
  }
});
