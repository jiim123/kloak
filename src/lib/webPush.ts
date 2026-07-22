import { supabase } from "@/integrations/supabase/client";
import { isTauri } from "@/lib/tauriRuntime";

type WebPushAction = "register" | "unregister";

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY as string | undefined)?.trim() || "";

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }

  return output;
}

function isWebPushSupported(): boolean {
  return (
    !isTauri() &&
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

async function postSubscription(action: WebPushAction, subscription: PushSubscription): Promise<void> {
  const serialized = subscription.toJSON();
  const endpoint = typeof serialized.endpoint === "string" ? serialized.endpoint : "";
  const p256dh = typeof serialized.keys?.p256dh === "string" ? serialized.keys.p256dh : "";
  const auth = typeof serialized.keys?.auth === "string" ? serialized.keys.auth : "";

  const { error } = await supabase.functions.invoke("register-web-push", {
    body: {
      action,
      endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
    },
  });

  if (error) {
    console.error("[WebPush] register-web-push failed:", error);
    throw new Error(error.message || "register-web-push failed");
  }
}

export async function registerWebPushSubscription(options: { requestPermission?: boolean } = {}): Promise<boolean> {
  if (!isWebPushSupported()) return false;
  if (!VAPID_PUBLIC_KEY) {
    throw new Error("Missing VITE_WEB_PUSH_PUBLIC_KEY");
  }

  const shouldRequestPermission = options.requestPermission ?? true;
  let permission = Notification.permission;

  if (permission === "default" && shouldRequestPermission) {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") return false;

  let registration: ServiceWorkerRegistration;
  let subscription: PushSubscription;

  try {
    registration = await navigator.serviceWorker.register("/web-push-sw.js");
    const existing = await registration.pushManager.getSubscription();
    subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }));
  } catch (error) {
    console.error("[WebPush] Browser subscription failed:", error);
    const message = error instanceof Error ? error.message : "Browser push subscription failed";
    throw new Error(message);
  }

  await postSubscription("register", subscription);
  return true;
}

export async function unregisterWebPushSubscription(): Promise<void> {
  if (!isWebPushSupported()) return;

  const registration = await navigator.serviceWorker.getRegistration("/web-push-sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  await postSubscription("unregister", subscription);
  await subscription.unsubscribe();
}

export function getWebPushSupportStatus(): "supported" | "missing-vapid-key" | "unsupported" {
  if (!isWebPushSupported()) return "unsupported";
  if (!VAPID_PUBLIC_KEY) return "missing-vapid-key";
  return "supported";
}
