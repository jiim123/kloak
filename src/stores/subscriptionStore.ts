import { create } from "zustand";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type {
  SubscriptionPlanId,
  SubscriptionStatus,
  UserSubscription,
} from "@/types";

interface SubscriptionState {
  subscription: UserSubscription | null;
  isLoading: boolean;
  error: string | null;

  /** Fetch the current user's subscription from the database */
  fetchSubscription: (userId: string) => Promise<void>;

  /** Create a Pocketsflow checkout session and redirect the user */
  startCheckout: (
    planId: SubscriptionPlanId,
    userId: string,
    userEmail: string,
  ) => Promise<string | null>;

  /** Clear subscription state (e.g. on logout) */
  clear: () => void;

  /** Derived helpers */
  isSubscribed: () => boolean;
  isPro: () => boolean;
  isPlus: () => boolean;
  activePlanId: () => SubscriptionPlanId | null;
}

export const useSubscriptionStore = create<SubscriptionState>()((set, get) => ({
  subscription: null,
  isLoading: false,
  error: null,

  fetchSubscription: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.rpc("get_my_subscription", {
        _user_id: userId,
      });

      if (error) {
        console.error("[subscriptionStore] fetchSubscription error:", error);
        set({ subscription: null, isLoading: false, error: error.message });
        return;
      }

      set({ subscription: data as UserSubscription | null, isLoading: false });
    } catch (err) {
      console.error("[subscriptionStore] fetchSubscription exception:", err);
      set({ subscription: null, isLoading: false, error: "Failed to load subscription" });
    }
  },

  startCheckout: async (planId, userId, userEmail) => {
    const pocketsflowApiKey = import.meta.env.VITE_POCKETSFLOW_API_KEY;
    console.log("[subscriptionStore] startCheckout called", { planId, hasApiKey: !!pocketsflowApiKey });

    if (!pocketsflowApiKey) {
      toast.error("Payment system not configured", {
        description: "Add VITE_POCKETSFLOW_API_KEY to your .env file.",
      });
      return null;
    }

    // Pocketsflow product ID for Kloak Prime
    const productId = import.meta.env.VITE_POCKETSFLOW_PRODUCT_KLOAK_PRIME;
    console.log("[subscriptionStore] Product ID", { productId });

    if (!productId) {
      toast.error("Subscription plan not configured", {
        description: "Missing VITE_POCKETSFLOW_PRODUCT_KLOAK_PRIME in your .env file. Create the product on Pocketsflow first.",
      });
      return null;
    }

    const successUrl = `${window.location.origin}/app?subscription=success`;
    const cancelUrl = `${window.location.origin}/app?subscription=cancelled`;

    try {
      const response = await fetch("https://api.pocketsflow.com/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${pocketsflowApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          successUrl,
          cancelUrl,
          customerEmail: userEmail,
          metadata: {
            user_id: userId,
            plan_id: planId,
          },
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error("[subscriptionStore] Checkout session creation failed:", errBody);
        toast.error("Failed to create checkout session", {
          description: errBody.slice(0, 200),
        });
        return null;
      }

      const data = await response.json();
      console.log("[subscriptionStore] Checkout session created", data);
      return data.url as string;
    } catch (err) {
      console.error("[subscriptionStore] startCheckout error:", err);
      toast.error("Network error creating checkout session");
      return null;
    }
  },

  clear: () => set({ subscription: null, isLoading: false, error: null }),

  isSubscribed: () => {
    const { subscription } = get();
    return subscription !== null && (subscription.status === "active" || subscription.status === "trialing");
  },

  isPro: () => {
    const { subscription } = get();
    return (
      subscription !== null &&
      (subscription.status === "active" || subscription.status === "trialing")
    );
  },

  activePlanId: () => {
    const { subscription } = get();
    if (!subscription || (subscription.status !== "active" && subscription.status !== "trialing")) {
      return null;
    }
    return subscription.plan_id;
  },
}));
