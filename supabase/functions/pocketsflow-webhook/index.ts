import { createServiceClient } from "../_shared/edgeSecurity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-pocketsflow-signature, x-pocketsflow-event, x-pocketsflow-timestamp",
};

// --- HMAC-SHA256 signature verification ---
async function verifySignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature) return false;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    const hex = Array.from(new Uint8Array(signed))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hex === signature;
  } catch {
    return false;
  }
}

// Map Pocketsflow subscription status to our DB status
function mapStatus(pfStatus: string): string {
  switch (pfStatus) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
      return pfStatus;
    case "paused":
      return "paused";
    default:
      return "active";
  }
}

// Map checkout metadata plan_id to our plan enum
function resolvePlanId(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) return null;
  const raw = metadata.plan_id;
  // Accept legacy plan IDs and map them to kloak_prime
  if (raw === "kloak_prime" || raw === "kloak_plus" || raw === "kloak_pro") return "kloak_prime";
  return null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const webhookSecret = Deno.env.get("POCKETSFLOW_WEBHOOK_SECRET") || "";
  if (!webhookSecret) {
    console.error("[pocketsflow-webhook] POCKETSFLOW_WEBHOOK_SECRET not set");
    return new Response(JSON.stringify({ error: "Webhook not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Read raw body for signature verification
  const rawBody = await req.text();
  const signature = req.headers.get("x-pocketsflow-signature");
  const eventType = req.headers.get("x-pocketsflow-event") || "unknown";

  const isValid = await verifySignature(rawBody, signature, webhookSecret);
  if (!isValid) {
    console.error("[pocketsflow-webhook] Invalid signature");
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[pocketsflow-webhook] Event: ${eventType}`);

  const supabase = createServiceClient();

  try {
    switch (eventType) {
      case "customer.subscription.created": {
        await handleSubscriptionActivated(supabase, payload);
        break;
      }
      case "customer.subscription.updated": {
        await handleSubscriptionUpdated(supabase, payload);
        break;
      }
      case "customer.subscription.deleted": {
        await handleSubscriptionDeleted(supabase, payload);
        break;
      }
      case "invoice.payment_failed": {
        await handlePaymentFailed(supabase, payload);
        break;
      }
      case "invoice.payment_succeeded": {
        await handlePaymentSucceeded(supabase, payload);
        break;
      }
      case "order.completed": {
        await handleOrderCompleted(supabase, payload);
        break;
      }
      default:
        console.log(`[pocketsflow-webhook] Unhandled event: ${eventType}`);
    }
  } catch (error) {
    console.error(`[pocketsflow-webhook] Error processing ${eventType}:`, error);
  }

  // Always return 200 to acknowledge receipt (Pocketsflow does not retry)
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

// --- Event Handlers ---
//
// Pocketsflow webhook payload structure (subscription events):
// {
//   "subscription": { "id": "sub_..." (offer ID), "customerId": "..." (subscriber ID) },
//   "customer": { "email": "...", "firstName": "...", "lastName": "..." },
//   "status": "active",
//   "subscriptionCustomerId": "..." (top-level copy of subscriber ID),
//   "metadata": { "user_id": "...", "plan_id": "..." },
//   "portalUrl": "https://...",
//   "webhookId": "..."
// }
//
// IMPORTANT: subscription.id is the OFFER ID (shared by all buyers).
// subscriptionCustomerId / subscription.customerId is the PER-SUBSCRIBER ID.
//
function getSubscriberId(payload: Record<string, unknown>): string | null {
  // Top-level subscriptionCustomerId is the most reliable
  const topId = payload.subscriptionCustomerId as string | undefined;
  if (topId) return topId;
  // Fallback to nested subscription.customerId
  const sub = (payload.subscription || {}) as Record<string, unknown>;
  return (sub.customerId as string) || null;
}

async function handleSubscriptionActivated(
  supabase: ReturnType<typeof createServiceClient>,
  payload: Record<string, unknown>,
) {
  const metadata = (payload.metadata || {}) as Record<string, unknown>;
  const planId = resolvePlanId(metadata);
  if (!planId) {
    console.error("[pocketsflow-webhook] No plan_id in metadata", metadata);
    return;
  }

  const userId = metadata.user_id as string | undefined;
  if (!userId) {
    console.error("[pocketsflow-webhook] No user_id in metadata", metadata);
    return;
  }

  const subscriberId = getSubscriberId(payload);
  const customer = (payload.customer || {}) as Record<string, unknown>;
  const customerEmail = customer.email as string | undefined;
  const status = payload.status as string | undefined;

  console.log(`[pocketsflow-webhook] Activating subscription for user ${userId}, subscriberId: ${subscriberId}, email: ${customerEmail}`);

  // Upsert subscription record
  const { error } = await supabase
    .from("user_subscriptions")
    .upsert(
      {
        user_id: userId,
        plan_id: planId,
        status: status ? mapStatus(status) : "active",
        pocketsflow_customer_id: customerEmail || null,
        pocketsflow_subscription_id: subscriberId || null,
        cancel_at_period_end: false,
      },
      { onConflict: "user_id,plan_id" },
    );

  if (error) {
    console.error("[pocketsflow-webhook] Failed to upsert subscription:", error);
  } else {
    console.log(`[pocketsflow-webhook] Subscription activated for user ${userId}: ${planId}`);
  }
}

async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createServiceClient>,
  payload: Record<string, unknown>,
) {
  const subscriberId = getSubscriberId(payload);
  const status = payload.status as string | undefined;
  const customer = (payload.customer || {}) as Record<string, unknown>;
  const customerEmail = customer.email as string | undefined;

  if (!subscriberId && !customerEmail) {
    console.error("[pocketsflow-webhook] Missing subscriberId and email in update");
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (status) updateData.status = mapStatus(status);
  if (payload.cancel_at_period_end !== undefined) {
    updateData.cancel_at_period_end = payload.cancel_at_period_end;
  }

  // Try subscriber ID first, fall back to email
  let query = supabase.from("user_subscriptions").update(updateData);
  if (subscriberId) {
    query = query.eq("pocketsflow_subscription_id", subscriberId);
  } else {
    query = query.eq("pocketsflow_customer_id", customerEmail);
  }

  const { error } = await query;

  if (error) {
    console.error("[pocketsflow-webhook] Failed to update subscription:", error);
  } else {
    console.log(`[pocketsflow-webhook] Subscription updated: ${JSON.stringify(updateData)}`);
  }
}

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createServiceClient>,
  payload: Record<string, unknown>,
) {
  const subscriberId = getSubscriberId(payload);
  const customer = (payload.customer || {}) as Record<string, unknown>;
  const customerEmail = customer.email as string | undefined;

  if (!subscriberId && !customerEmail) {
    console.error("[pocketsflow-webhook] Cannot identify subscription to delete");
    return;
  }

  // Try subscriber ID first, fall back to email
  let query = supabase.from("user_subscriptions").update({ status: "canceled" });
  if (subscriberId) {
    query = query.eq("pocketsflow_subscription_id", subscriberId);
  } else {
    query = query.eq("pocketsflow_customer_id", customerEmail);
  }

  const { error } = await query;

  if (error) {
    console.error("[pocketsflow-webhook] Failed to cancel subscription:", error);
  } else {
    console.log(`[pocketsflow-webhook] Subscription canceled (subscriberId: ${subscriberId}, email: ${customerEmail})`);
  }
}

async function handlePaymentFailed(
  supabase: ReturnType<typeof createServiceClient>,
  payload: Record<string, unknown>,
) {
  const subscriberId = getSubscriberId(payload);
  if (!subscriberId) {
    console.error("[pocketsflow-webhook] Payment failed: no subscriber ID");
    return;
  }

  await supabase
    .from("user_subscriptions")
    .update({ status: "past_due" })
    .eq("pocketsflow_subscription_id", subscriberId);

  console.log(`[pocketsflow-webhook] Payment failed for subscription ${subscriberId}`);
}

// order.completed fires for subscriptions too — use it as a fallback
// to create subscription records when customer.subscription.created is missed.
// Payload: { product, order, currency, customer, amount, metadata, webhookId }
async function handleOrderCompleted(
  supabase: ReturnType<typeof createServiceClient>,
  payload: Record<string, unknown>,
) {
  const metadata = (payload.metadata || {}) as Record<string, unknown>;
  const planId = resolvePlanId(metadata);

  // Only act if this order has our subscription metadata (user_id + plan_id)
  // Otherwise it's a one-time product sale — ignore it.
  const userId = metadata.user_id as string | undefined;
  if (!planId || !userId) {
    console.log("[pocketsflow-webhook] order.completed has no subscription metadata, skipping");
    return;
  }

  const customer = (payload.customer || {}) as Record<string, unknown>;
  const customerEmail = customer.email as string | undefined;
  const order = (payload.order || {}) as Record<string, unknown>;

  console.log(`[pocketsflow-webhook] order.completed with subscription metadata for user ${userId}, plan ${planId}`);
  console.log(`[pocketsflow-webhook] customerEmail: ${customerEmail}, paymentIntentId: ${order.paymentIntentId}`);

  // Try PostgREST upsert first
  const { data, error } = await supabase
    .from("user_subscriptions")
    .upsert(
      {
        user_id: userId,
        plan_id: planId,
        status: "active",
        pocketsflow_customer_id: customerEmail || null,
        pocketsflow_subscription_id: (order.paymentIntentId as string) || null,
        cancel_at_period_end: false,
      },
      { onConflict: "user_id,plan_id" },
    );

  if (error) {
    console.error("[pocketsflow-webhook] PostgREST upsert failed, trying raw SQL:", JSON.stringify(error));

    // Fallback: raw SQL insert to bypass any PostgREST/RLS issues
    const { error: sqlError } = await supabase.rpc("upsert_subscription_from_webhook", {
      _user_id: userId,
      _plan_id: planId,
      _status: "active",
      _customer_email: customerEmail || null,
      _subscription_id: (order.paymentIntentId as string) || null,
    });

    if (sqlError) {
      console.error("[pocketsflow-webhook] Raw SQL fallback also failed:", JSON.stringify(sqlError));
    } else {
      console.log(`[pocketsflow-webhook] Subscription created via SQL fallback for user ${userId}`);
    }
  } else {
    console.log(`[pocketsflow-webhook] Subscription created from order.completed for user ${userId}`, JSON.stringify(data));
  }
}

async function handlePaymentSucceeded(
  supabase: ReturnType<typeof createServiceClient>,
  payload: Record<string, unknown>,
) {
  const subscriberId = getSubscriberId(payload);
  const billingReason = payload.billingReason as string | undefined;

  if (!subscriberId) {
    console.error("[pocketsflow-webhook] Payment succeeded: no subscriber ID");
    return;
  }

  // If this is a renewal that was past_due, reactivate
  if (billingReason === "renewal") {
    await supabase
      .from("user_subscriptions")
      .update({ status: "active" })
      .eq("pocketsflow_subscription_id", subscriberId)
      .eq("status", "past_due");

    console.log(`[pocketsflow-webhook] Payment succeeded (renewal) for ${subscriberId}`);
  } else {
    console.log(`[pocketsflow-webhook] Payment succeeded (${billingReason}) for ${subscriberId}`);
  }
}
