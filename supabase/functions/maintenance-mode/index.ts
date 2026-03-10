import { corsHeaders } from "../_shared/cors.ts";
import { createServiceClient, enforceRateLimit, getAuthContext } from "../_shared/edgeSecurity.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ maintenance: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    // Lightweight rate limit to prevent abuse (60 req/min per client)
    const supabase = createServiceClient();
    const auth = await getAuthContext(supabase, req);
    let rateOk = false;
    try {
      rateOk = await enforceRateLimit(supabase, auth.scopeBase, "edge_maintenance_check", 60, 60);
    } catch {
      // For maintenance check, fail open to avoid blocking app startup
      // This is acceptable since the endpoint only reads a single config row
      rateOk = true;
    }
    if (!rateOk) {
      return new Response(
        JSON.stringify({ error: "Rate limited" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "maintenance_mode")
      .maybeSingle();

    const enabled = data?.value?.enabled === true;

    if (enabled) {
      return new Response(
        JSON.stringify({ maintenance: true, message: data?.value?.message || "System maintenance in progress" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ maintenance: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch {
    return new Response(
      JSON.stringify({ maintenance: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
