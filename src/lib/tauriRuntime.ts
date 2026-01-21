export function isTauri(): boolean {
  if (typeof window === "undefined") return false;

  // Tauri v2 uses `__TAURI_INTERNALS__` for bundled JS/TS usage.
  // `window.__TAURI__` exists only when `app.withGlobalTauri` is enabled.
  const w = window as unknown as Record<string, unknown>;
  if ("__TAURI_INTERNALS__" in w || "__TAURI__" in w) return true;

  // More resilient heuristic (helps in dev / certain bundling modes).
  // In Tauri Desktop the user agent typically contains "Tauri".
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/\btauri\b/i.test(ua)) return true;

  // In production, Tauri uses a custom protocol (e.g. tauri://localhost).
  const protocol = window.location?.protocol;
  if (protocol === "tauri:") return true;

  // Check URL param (set by Tauri window config)
  const params = new URLSearchParams(window.location?.search || "");
  if (params.get("tauriWindow")) return true;

  return false;
}

/**
 * Resizes the Tauri window to app size after login
 */
export async function resizeWindowForApp(): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("resize_window_for_app");
  } catch {
    // Ignore in browser / non-tauri environments
  }
}

/**
 * Returns the current Tauri window label if available, otherwise null.
 */
export async function getTauriWindowLabel(): Promise<string | null> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return getCurrentWindow().label;
  } catch {
    return null;
  }
}

/**
 * Check if running in Tauri window based on URL param
 */
export function isTauriWindow(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location?.search || "");
  return params.get("tauriWindow") === "main";
}
