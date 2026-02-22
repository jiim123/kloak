import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const HCAPTCHA_VERIFY_URL = "https://hcaptcha.com/siteverify";

interface RegisterBody {
  username: string;
  key_hash: string;
  hcaptcha_response: string;
  banner_color?: string;
}

interface HCaptchaVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const secret = Deno.env.get("HCAPTCHA_SECRET_KEY");
  if (!secret) {
    console.error("HCAPTCHA_SECRET_KEY is not set");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = (await req.json()) as RegisterBody;
    const { username, key_hash, hcaptcha_response, banner_color } = body;

    if (!username || typeof username !== "string" || !key_hash || typeof key_hash !== "string") {
      return new Response(
        JSON.stringify({ error: "Username and key_hash are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!hcaptcha_response || typeof hcaptcha_response !== "string") {
      return new Response(
        JSON.stringify({ error: "Captcha verification is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let verifyRes: Response;
    try {
      verifyRes = await fetch(HCAPTCHA_VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          response: hcaptcha_response,
          secret,
        }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("hCaptcha network failure:", msg);
      return new Response(
        JSON.stringify({ error: `hCaptcha verification network failure: ${msg}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const verifyJson = (await verifyRes.json()) as HCaptchaVerifyResponse;
    if (!verifyJson.success) {
      console.warn("hCaptcha verification failed:", verifyJson["error-codes"]);
      return new Response(
        JSON.stringify({ error: "Captcha verification failed. Please try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseInternalUrl = Deno.env.get("SUPABASE_INTERNAL_URL");
    const supabaseExternalUrl = Deno.env.get("SUPABASE_URL");
    const candidateUrls = uniqueNonEmpty([supabaseInternalUrl, supabaseExternalUrl]);
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (candidateUrls.length === 0 || !serviceRoleKey) {
      console.error("Missing SUPABASE_INTERNAL_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const realIp = req.headers.get("x-real-ip")?.trim() ?? "";
    const forwardedFor = req.headers.get("x-forwarded-for")?.trim() ?? "";
    const clientIp = req.headers.get("cf-connecting-ip")?.trim() ?? "";
    const rpcHeaders: Record<string, string> = {};
    if (realIp) rpcHeaders["x-real-ip"] = realIp;
    if (forwardedFor) rpcHeaders["x-forwarded-for"] = forwardedFor;
    if (clientIp) rpcHeaders["cf-connecting-ip"] = clientIp;

    const normalizedUsername = username.toLowerCase().trim();
    let data: Record<string, unknown> | null = null;
    let error: { message?: string } | null = null;
    const networkErrors: string[] = [];
    for (const candidateUrl of candidateUrls) {
      const supabase = createClient(candidateUrl, serviceRoleKey, {
        global: { headers: rpcHeaders },
      });

      try {
        const rpcResult = await supabase.rpc("register_user", {
          _username: normalizedUsername,
          _key_hash: key_hash,
          _banner_color: banner_color ?? "#5865F2",
        });
        data = (rpcResult.data as Record<string, unknown> | null) ?? null;
        error = rpcResult.error;
        // Stop at first reachable endpoint, regardless of business error.
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        networkErrors.push(`${candidateUrl}: ${msg}`);
      }
    }

    if (networkErrors.length === candidateUrls.length) {
      console.error("register_user rpc network failures:", networkErrors);
      return new Response(
        JSON.stringify({ error: `register_user rpc network failure: ${networkErrors.join(" | ")}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (error) {
      if (error.message.includes("Username already taken")) {
        return new Response(
          JSON.stringify({ error: "Username already taken" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (error.message.includes("reserved")) {
        return new Response(
          JSON.stringify({ error: "This username is reserved" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw error;
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: "Registration failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("register-with-captcha error:", err);
    const message = err instanceof Error ? err.message : "Registration failed";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
