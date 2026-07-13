import { createServiceClient } from "../_shared/edgeSecurity.ts";

const WORKER_TOKEN = Deno.env.get("SERVER_BOT_WORKER_TOKEN") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-worker-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (!WORKER_TOKEN) {
      console.error("SERVER_BOT_WORKER_TOKEN is not configured");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((req.headers.get("x-worker-token") || "") !== WORKER_TOKEN) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const maxEvents = Math.max(1, Math.min(Number.isFinite(body.maxEvents) ? Number(body.maxEvents) : 25, 100));
    const maxActions = Math.max(1, Math.min(Number.isFinite(body.maxActions) ? Number(body.maxActions) : 50, 200));
    const maxIterations = Math.max(1, Math.min(Number.isFinite(body.maxIterations) ? Number(body.maxIterations) : 4, 20));
    const supabase = createServiceClient();

    let eventsProcessed = 0;
    let eventsCompleted = 0;
    let actionsCompleted = 0;
    const iterations: unknown[] = [];

    for (let i = 0; i < maxIterations; i += 1) {
      const { data, error } = await supabase.rpc("process_server_bot_events", {
        _max_events: maxEvents,
        _max_actions: maxActions,
      });

      if (error) {
        console.error("process_server_bot_events failed:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = (data ?? {}) as {
        events_processed?: number;
        events_completed?: number;
        actions_completed?: number;
      };

      iterations.push(result);
      eventsProcessed += Number(result.events_processed ?? 0);
      eventsCompleted += Number(result.events_completed ?? 0);
      actionsCompleted += Number(result.actions_completed ?? 0);

      if (!result.events_processed || !result.actions_completed) {
        break;
      }
    }

    return new Response(
      JSON.stringify({
        eventsProcessed,
        eventsCompleted,
        actionsCompleted,
        iterations,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Server bot worker error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
