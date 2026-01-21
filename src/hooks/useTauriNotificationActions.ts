import { useEffect } from "react";
import { isTauri } from "@/lib/tauriRuntime";
import { useNavigate } from "react-router-dom";

/**
 * Handles window focus events to check for pending notification links.
 * When a notification is clicked, the link is stored in sessionStorage,
 * and when the window gains focus, we navigate to it.
 */
export function useTauriNotificationActions() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isTauri()) return;

    let disposed = false;
    let isHandling = false;
    let listener: { unregister(): Promise<void> } | null = null;

    (async () => {
      try {
        // NOTE: On some platforms / plugin builds, `registerActionTypes` is not available
        // (command missing). We only rely on `onAction` here.
        const { onAction } = await import("@tauri-apps/plugin-notification");
        const { getCurrentWindow } = await import("@tauri-apps/api/window");

        listener = await onAction(async (notification) => {
          if (disposed || isHandling) return;
          isHandling = true;

          const link =
            (notification as any)?.extra?.link ??
            (notification as any)?.data?.link ??
            "/app";

          try {
            const w = getCurrentWindow();
            const minimized = await w.isMinimized();
            if (minimized) await w.unminimize();
            await w.show();
            await w.setFocus();
            await w.maximize();
          } catch (err) {
            console.error("Failed to focus/maximize window:", err);
          }

          navigate(link);
          setTimeout(() => {
            isHandling = false;
          }, 500);
        });
      } catch (err) {
        console.error("Notification click listener not available:", err);
      }
    })();

    return () => {
      disposed = true;
      void listener?.unregister();
    };
  }, [navigate]);
}

