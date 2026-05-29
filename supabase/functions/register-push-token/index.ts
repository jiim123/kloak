import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createServiceClient, enforceRateLimit, getAuthContext } from "../_shared/edgeSecurity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-key-hash, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PushPlatform = "ios" | "android";

interface RegisterPushTokenRequest {
  action?: "register" | "unregister";
  token?: string;
  platform?: PushPlatform;
  device_id?: string | null;
  app_version?: string | null;
}

const isExpoPushToken = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length >= 20 &&
  value.length <= 512 &&
  (/^ExponentPushToken\[[A-Za-z0-9_-]+\]$/.test(value) || /^ExpoPushToken\[[A-Za-z0-9_-]+\]$/.test(value));

const cleanText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
};

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
    const auth = await getAuthContext(supabase, req);
    if (!auth.requestUserId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const rateOk = await enforceRateLimit(supabase, auth.scopeBase, "edge_push_token", 20, 3600);
    if (!rateOk) {
      return new Response(JSON.stringify({ error: "Rate limited. Please try again later." }), {
        status: 429,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = (await req.json()) as RegisterPushTokenRequest;
    const action = body.action ?? "register";

    if (!isExpoPushToken(body.token)) {
      return new Response(JSON.stringify({ error: "Invalid Expo push token" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (action === "unregister") {
      const { error } = await supabase
        .from("push_tokens")
        .update({ enabled: false })
        .eq("user_id", auth.requestUserId)
        .eq("token", body.token);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (body.platform !== "ios" && body.platform !== "android") {
      return new Response(JSON.stringify({ error: "Invalid platform" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { error } = await supabase.from("push_tokens").upsert(
      {
        user_id: auth.requestUserId,
        token: body.token,
        platform: body.platform,
        device_id: cleanText(body.device_id, 128),
        app_version: cleanText(body.app_version, 64),
        enabled: true,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("register-push-token error:", error);
    return new Response(JSON.stringify({ error: "Failed to register push token" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
