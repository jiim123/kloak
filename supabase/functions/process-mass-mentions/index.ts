import { createServiceClient } from "../_shared/edgeSecurity.ts";

const WORKER_TOKEN = Deno.env.get("MASS_MENTION_WORKER_TOKEN") || "";

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
      console.error("MASS_MENTION_WORKER_TOKEN is not configured");
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
    const batchSize = Number.isFinite(body.batchSize) ? Number(body.batchSize) : 500;
    const maxJobs = Number.isFinite(body.maxJobs) ? Number(body.maxJobs) : 5;
    const maxIterations = Math.max(1, Math.min(Number.isFinite(body.maxIterations) ? Number(body.maxIterations) : 4, 20));
    const supabase = createServiceClient();

    let totalJobsProcessed = 0;
    let totalJobsCompleted = 0;
    let totalRecipientsProcessed = 0;
    const iterations: unknown[] = [];

    for (let i = 0; i < maxIterations; i += 1) {
      const { data, error } = await supabase.rpc("process_mass_mention_jobs", {
        _batch_size: batchSize,
        _max_jobs: maxJobs,
      });

      if (error) {
        console.error("process_mass_mention_jobs failed:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = (data ?? {}) as {
        jobs_processed?: number;
        jobs_completed?: number;
        recipients_processed?: number;
        error?: string;
      };

      if (result.error) {
        console.error("process_mass_mention_jobs returned error:", result.error);
        return new Response(JSON.stringify({ error: result.error, partial: result }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      iterations.push(result);
      totalJobsProcessed += Number(result.jobs_processed ?? 0);
      totalJobsCompleted += Number(result.jobs_completed ?? 0);
      totalRecipientsProcessed += Number(result.recipients_processed ?? 0);

      if (!result.jobs_processed || !result.recipients_processed) {
        break;
      }
    }

    return new Response(
      JSON.stringify({
        jobsProcessed: totalJobsProcessed,
        jobsCompleted: totalJobsCompleted,
        recipientsProcessed: totalRecipientsProcessed,
        iterations,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Mass mention worker error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
