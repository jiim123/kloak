import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const baseCorsHeaders: Record<string, string> = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};

const LOCAL_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://klbetadis.lovable.app",
  "https://id-preview--67ba8495-ca58-4eeb-80ed-94fbf23fb179.lovable.app",
];

interface AvailabilityBody {
  username: string;
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
    console.warn("[check-username-availability] No origin allowlist configured; using local dev defaults.");
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
    if (hops.length > 0) return hops[hops.length - 1].slice(0, 128);
  }

  const realIp = req.headers.get("x-real-ip")?.trim() ?? "";
  if (realIp) return realIp.slice(0, 128);

  const cfIp = req.headers.get("cf-connecting-ip")?.trim() ?? "";
  if (cfIp) return cfIp.slice(0, 128);

  return null;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[check-username-availability] Missing SUPABASE_URL or service role key.");
    return jsonResponse(500, { error: "Server configuration error" }, requestOrigin);
  }

  try {
    const body = (await req.json()) as AvailabilityBody;
    if (!body.username || typeof body.username !== "string") {
      return jsonResponse(400, { error: "Username is required" }, requestOrigin);
    }

    const normalizedUsername = body.username.toLowerCase().trim();
    const canonicalIp = getCanonicalClientIp(req);
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const clientScope = canonicalIp
      ? `ip:${(await sha256Hex(canonicalIp)).slice(0, 32)}`
      : `un:${(await sha256Hex(normalizedUsername)).slice(0, 32)}`;
    const usernameScope = `un:${(await sha256Hex(normalizedUsername)).slice(0, 32)}`;
    const rateLimitChecks = [
      {
        scope: clientScope,
        action: "edge_username_availability_client",
        maxAttempts: 20,
        windowSeconds: 60,
      },
      {
        scope: clientScope,
        action: "edge_username_availability_hourly",
        maxAttempts: 120,
        windowSeconds: 3600,
      },
      {
        scope: usernameScope,
        action: "edge_username_availability_username",
        maxAttempts: 8,
        windowSeconds: 600,
      },
    ];

    for (const check of rateLimitChecks) {
      const { data: allowed, error } = await supabase.rpc("check_rate_limit", {
        _ip_hash: check.scope,
        _action: check.action,
        _max_attempts: check.maxAttempts,
        _window_seconds: check.windowSeconds,
      });

      if (error) {
        console.error("[check-username-availability] check_rate_limit failed", {
          action: check.action,
          error: error.message,
        });
        return jsonResponse(503, { error: "Availability check temporarily unavailable" }, requestOrigin);
      }

      if (!allowed) {
        return jsonResponse(429, { error: "Too many username checks. Please wait and try again." }, requestOrigin);
      }
    }

    const { data, error } = await supabase.rpc("check_username_available", {
      _username: normalizedUsername,
    });

    if (error) {
      console.error("[check-username-availability] check_username_available failed", { error: error.message });
      return jsonResponse(503, { error: "Availability check temporarily unavailable" }, requestOrigin);
    }

    return jsonResponse(200, { available: data === true }, requestOrigin);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Availability check failed";
    console.error("[check-username-availability] Unhandled error:", message);
    return jsonResponse(500, { error: "Availability check failed" }, requestOrigin);
  }
});
