import webpush from "npm:web-push@3.6.7";
import { createServiceClient } from "../_shared/edgeSecurity.ts";

const WORKER_TOKEN = Deno.env.get("WEB_PUSH_WORKER_TOKEN") || "";
const VAPID_PUBLIC_KEY = Deno.env.get("WEB_PUSH_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("WEB_PUSH_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("WEB_PUSH_VAPID_SUBJECT") || "mailto:support@kloak.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-worker-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SendWebPushRequest = {
  user_id?: string;
  notification_id?: string;
  type?: string;
  title?: string;
  body?: string | null;
  link?: string | null;
};

type WebPushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

async function workerTokenMatches(providedToken: string, expectedToken: string): Promise<boolean> {
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

const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function getStatusCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === "number" ? statusCode : null;
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
    if (!WORKER_TOKEN || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.error("Web push secrets are not configured");
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

    const body = (await req.json().catch(() => ({}))) as SendWebPushRequest;
    if (!isUuid(body.user_id) || !isUuid(body.notification_id)) {
      return new Response(JSON.stringify({ error: "Invalid notification payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("web_push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", body.user_id)
      .eq("enabled", true);

    if (error) throw error;

    const subscriptions = (data ?? []) as WebPushSubscriptionRow[];
    if (!subscriptions.length) {
      return new Response(JSON.stringify({ sent: 0, disabled: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const payload = JSON.stringify({
      notificationId: body.notification_id,
      type: body.type || "notification",
      title: (body.title || "Kloak").slice(0, 120),
      body: typeof body.body === "string" && body.body.trim() ? body.body.slice(0, 180) : undefined,
      link: body.link || "/app",
    });

    let sent = 0;
    const disabledIds: string[] = [];

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            payload,
            { TTL: 60 * 60 * 24, urgency: "high" },
          );
          sent += 1;
        } catch (error) {
          const statusCode = getStatusCode(error);
          if (statusCode === 404 || statusCode === 410) {
            disabledIds.push(subscription.id);
            return;
          }

          console.error("web push send failed:", {
            subscriptionId: subscription.id,
            statusCode,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    );

    if (disabledIds.length) {
      const { error: disableError } = await supabase
        .from("web_push_subscriptions")
        .update({ enabled: false })
        .in("id", disabledIds);

      if (disableError) {
        console.error("failed to disable expired web push subscriptions:", disableError);
      }
    }

    return new Response(JSON.stringify({ sent, disabled: disabledIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("send-web-push error:", error);
    return new Response(JSON.stringify({ error: "Failed to send web push" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
