import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createServiceClient, enforceRateLimit, getAuthContext } from "../_shared/edgeSecurity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-key-hash, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RegisterWebPushRequest {
  action?: "register" | "unregister";
  endpoint?: string;
  p256dh?: string;
  auth?: string;
  user_agent?: string | null;
}

const cleanText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
};

const isValidEndpoint = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  if (value.length < 20 || value.length > 2048) return false;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const isValidKey = (value: unknown, maxLength = 512): value is string =>
  typeof value === "string" && value.length >= 16 && value.length <= maxLength && /^[A-Za-z0-9_-]+={0,2}$/.test(value);

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const supabase = createServiceClient();
    const authContext = await getAuthContext(supabase, req);
    if (!authContext.requestUserId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const rateOk = await enforceRateLimit(supabase, authContext.scopeBase, "edge_web_push_subscription", 20, 3600);
    if (!rateOk) {
      return new Response(JSON.stringify({ error: "Rate limited. Please try again later." }), {
        status: 429,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = (await req.json()) as RegisterWebPushRequest;
    const action = body.action ?? "register";

    if (!isValidEndpoint(body.endpoint)) {
      return new Response(JSON.stringify({ error: "Invalid push endpoint" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (action === "unregister") {
      const { error } = await supabase
        .from("web_push_subscriptions")
        .update({ enabled: false })
        .eq("user_id", authContext.requestUserId)
        .eq("endpoint", body.endpoint);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!isValidKey(body.p256dh) || !isValidKey(body.auth, 256)) {
      return new Response(JSON.stringify({ error: "Invalid subscription keys" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { error } = await supabase.from("web_push_subscriptions").upsert(
      {
        user_id: authContext.requestUserId,
        endpoint: body.endpoint,
        p256dh: body.p256dh,
        auth: body.auth,
        user_agent: cleanText(body.user_agent, 512),
        enabled: true,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("register-web-push error:", error);
    return new Response(JSON.stringify({ error: "Failed to register web push subscription" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
