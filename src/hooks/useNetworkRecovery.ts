import { useEffect, useRef } from "react";
import { isSupabaseRealtimeConnected, recoverSupabaseConnection } from "@/integrations/supabase/client";
import { isKloakSocketEnabled, kloakSocket } from "@/lib/kloakSocket";
import { useAuthStore } from "@/stores/authStore";
import { useMessageStore } from "@/stores/messageStore";
import { useServerStore } from "@/stores/serverStore";
import { useSyncStore } from "@/stores/syncStore";

const MIN_BACKGROUND_MS = 15_000;
const RECOVERY_THROTTLE_MS = 8_000;
const ACTIVE_CHANNEL_REFRESH_LIMIT = 20;

export function useNetworkRecovery() {
  const hiddenAtRef = useRef<number | null>(null);
  const lastRecoveryAtRef = useRef(0);

  useEffect(() => {
    const recover = (reason: string, options: { force?: boolean; onlyIfDisconnected?: boolean } = {}) => {
      if (!navigator.onLine) return;

      const force = options.force ?? false;
      const usingKloakSocket = isKloakSocketEnabled();
      if (options.onlyIfDisconnected) {
        if (usingKloakSocket && kloakSocket.isOpen) return;
        if (!usingKloakSocket && isSupabaseRealtimeConnected()) return;
      }

      const now = Date.now();
      if (!force && now - lastRecoveryAtRef.current < RECOVERY_THROTTLE_MS) return;
      lastRecoveryAtRef.current = now;

      const userId = useAuthStore.getState().user?.id;
      if (!userId) return;

      if (usingKloakSocket) {
        void kloakSocket.connect().catch(() => undefined);
        if (force && !kloakSocket.isOpen) {
          useSyncStore.getState().setConnectionStatus("reconnecting");
        }
      } else {
        recoverSupabaseConnection(reason);
        if (force) {
          useSyncStore.getState().setConnectionStatus("reconnecting");
        }
      }

      const serverStore = useServerStore.getState();
      const currentServerId = serverStore.currentServer?.id ?? null;
      const currentChannelId = serverStore.currentChannel?.id ?? null;

      if (currentServerId) {
        void serverStore.fetchChannels(currentServerId, { force: true }).catch(() => undefined);
        void serverStore.fetchMembers(currentServerId, { force: true }).catch(() => undefined);
      }

      if (currentChannelId) {
        const hasMessages =
          (useMessageStore.getState().messagesByChannel[currentChannelId]?.messages.length ?? 0) > 0;
        void useMessageStore
          .getState()
          .fetchMessages(currentChannelId, ACTIVE_CHANNEL_REFRESH_LIMIT, undefined, true, hasMessages)
          .catch(() => undefined);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }

      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (!hiddenAt || Date.now() - hiddenAt < MIN_BACKGROUND_MS) return;
      recover("visibility-resume", { force: true, onlyIfDisconnected: true });
    };

    const handleFocus = () => {
      recover("window-focus", { onlyIfDisconnected: true });
    };

    const handleOnline = () => {
      recover("online", { force: true });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
    };
  }, []);
}
