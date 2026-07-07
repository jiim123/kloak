import { useEffect, useRef } from "react";
import { recoverSupabaseConnection } from "@/integrations/supabase/client";
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
    const recover = (reason: string, force = false) => {
      if (!navigator.onLine) return;

      const now = Date.now();
      if (!force && now - lastRecoveryAtRef.current < RECOVERY_THROTTLE_MS) return;
      lastRecoveryAtRef.current = now;

      const userId = useAuthStore.getState().user?.id;
      if (!userId) return;

      recoverSupabaseConnection(reason);
      if (force) {
        useSyncStore.getState().setConnectionStatus("reconnecting");
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
      recover("visibility-resume", true);
    };

    const handleFocus = () => {
      recover("window-focus");
    };

    const handleOnline = () => {
      recover("online", true);
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
