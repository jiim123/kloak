import { createServiceClient } from "../_shared/edgeSecurity.ts";

const WORKER_TOKEN = Deno.env.get("SERVER_BOT_WORKER_TOKEN") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-worker-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function workerTokenMatches(providedToken: string, expectedToken: string) {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(providedToken.slice(0, 512))),
    crypto.subtle.digest("SHA-256", encoder.encode(expectedToken)),
  ]);
  const provided = new Uint8Array(providedHash);
  const expected = new Uint8Array(expectedHash);
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= provided[i] ^ expected[i];
  }
  return diff === 0;
}

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

    if (!(await workerTokenMatches(req.headers.get("x-worker-token") || "", WORKER_TOKEN))) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const rawServerId = typeof body.serverId === "string" ? body.serverId.trim() : "";
    const serverId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      rawServerId,
    )
      ? rawServerId
      : "";
    const maxEvents = Math.max(1, Math.min(Number.isFinite(body.maxEvents) ? Number(body.maxEvents) : 25, 100));
    const maxActions = Math.max(1, Math.min(Number.isFinite(body.maxActions) ? Number(body.maxActions) : 50, 200));
    const maxIterations = Math.max(1, Math.min(Number.isFinite(body.maxIterations) ? Number(body.maxIterations) : 4, 20));
    const fairMaxServers = Math.max(
      1,
      Math.min(Number.isFinite(body.fairMaxServers) ? Number(body.fairMaxServers) : 10, 100),
    );
    const supabase = createServiceClient();

    let serversProcessed = 0;
    let eventsProcessed = 0;
    let eventsCompleted = 0;
    let actionsCompleted = 0;
    const iterations: unknown[] = [];

    for (let i = 0; i < maxIterations; i += 1) {
      const { data, error } = serverId
        ? await supabase.rpc("process_server_bot_events_for_server", {
            _server_id: serverId,
            _max_events: maxEvents,
            _max_actions: maxActions,
          })
        : await supabase.rpc("process_server_bot_events_fair", {
            _max_servers: fairMaxServers,
            _max_events_per_server: maxEvents,
            _max_actions_per_server: maxActions,
          });

      if (error) {
        console.error("server bot event processing failed:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = (data ?? {}) as {
        servers_processed?: number;
        events_processed?: number;
        events_completed?: number;
        actions_completed?: number;
      };

      iterations.push(result);
      serversProcessed += Number(result.servers_processed ?? (serverId ? 1 : 0));
      eventsProcessed += Number(result.events_processed ?? 0);
      eventsCompleted += Number(result.events_completed ?? 0);
      actionsCompleted += Number(result.actions_completed ?? 0);

      if (!result.events_processed) {
        break;
      }
    }

    if (serverId) {
      const { data, error } = await supabase.rpc("process_server_bot_events_fair", {
        _max_servers: fairMaxServers,
        _max_events_per_server: Math.min(maxEvents, 10),
        _max_actions_per_server: Math.min(maxActions, 50),
      });

      if (!error) {
        const result = (data ?? {}) as {
          servers_processed?: number;
          events_processed?: number;
          events_completed?: number;
          actions_completed?: number;
        };
        iterations.push({ fair_fallback: result });
        serversProcessed += Number(result.servers_processed ?? 0);
        eventsProcessed += Number(result.events_processed ?? 0);
        eventsCompleted += Number(result.events_completed ?? 0);
        actionsCompleted += Number(result.actions_completed ?? 0);
      } else {
        console.error("fair server bot fallback failed:", error);
      }
    }

    return new Response(
      JSON.stringify({
        serverId: serverId || null,
        serversProcessed,
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
