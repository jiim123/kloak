import { corsHeaders } from "../_shared/cors.ts";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      error: "PoW registration has been disabled. Use register-with-captcha.",
      code: "pow_registration_disabled",
    }),
    { status: 410, headers: jsonHeaders },
  );
});
