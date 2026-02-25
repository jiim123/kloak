const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cleanup-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CLEANUP_ATTACHMENTS_TOKEN = Deno.env.get("CLEANUP_ATTACHMENTS_TOKEN") || "";

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

  try {
    if (!CLEANUP_ATTACHMENTS_TOKEN) {
      console.error("CLEANUP_ATTACHMENTS_TOKEN is not configured");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const providedToken = req.headers.get("x-cleanup-token") ?? "";
    if (providedToken !== CLEANUP_ATTACHMENTS_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Retention cleanup has been disabled. Attachments are kept until explicitly deleted.
    return new Response(
      JSON.stringify({
        message: "Attachment retention cleanup is disabled",
        deleted: 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
