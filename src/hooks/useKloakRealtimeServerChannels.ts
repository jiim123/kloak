import { useEffect } from "react";
import { kloakSocket, isKloakSocketEnabled } from "@/lib/kloakSocket";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";

const CHANNEL_CHANGE_EVENTS = new Set([
  "channel.created",
  "channel.updated",
  "channel.deleted",
  "category.created",
  "category.updated",
  "category.deleted",
  "channels.reordered",
]);

/**
 * Subscribes to `server:{serverId}` on the kloak-ws socket and refetches
 * the channel list whenever another user creates, updates, deletes, or
 * reorders channels / categories on the same server.
 */
export function useKloakRealtimeServerChannels(serverId: string | null) {
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);

  useEffect(() => {
    if (!serverId || !isKloakSocketEnabled()) return;

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    void kloakSocket
      .subscribe(`server:${serverId}`, (event) => {
        // Ignore events we ourselves emitted
        if (
          event.payload &&
          typeof event.payload === "object" &&
          "actor_user_id" in event.payload &&
          (event.payload as Record<string, unknown>).actor_user_id === currentUserId
        ) {
          return;
        }

        if (!CHANNEL_CHANGE_EVENTS.has(event.event)) return;

        // Re-fetch channels to pick up the change
        void useServerStore
          .getState()
          .fetchChannels(serverId, { force: true })
          .catch(() => undefined);
      })
      .then((fn) => {
        if (cancelled) {
          fn();
          return;
        }
        unsubscribe = fn;
      })
      .catch((error) => {
        console.warn("[KloakWS] Failed to subscribe to server channel changes", { serverId, error });
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [serverId, currentUserId]);
}
