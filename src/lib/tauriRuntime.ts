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

export function isElectron(): boolean {
  if (typeof window === "undefined") return false;

  const w = window as unknown as {
    __ELECTRON__?: boolean;
    electron?: {
      isElectron?: boolean;
    };
    electronAPI?: {
      isElectron?: boolean | (() => boolean);
    };
    process?: {
      versions?: Record<string, string>;
    };
  };

  // Preferred explicit signal from Electron preload.
  // Example preload contract:
  // - window.__ELECTRON__ = true
  // - window.electronAPI.isElectron = true
  if (w.__ELECTRON__ === true) return true;
  if (w.electron?.isElectron === true) return true;
  if (w.electronAPI?.isElectron === true) return true;
  if (typeof w.electronAPI?.isElectron === "function") {
    try {
      if (w.electronAPI.isElectron()) return true;
    } catch {
      // ignore and continue with fallback checks
    }
  }

  if (w.process?.versions?.electron) return true;

  const uaData = (navigator as Navigator & {
    userAgentData?: {
      brands?: Array<{ brand: string }>;
    };
  }).userAgentData;
  if (uaData?.brands?.some(({ brand }) => /\belectron\b/i.test(brand))) return true;

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  return /\belectron\b/i.test(ua);
}

export function getAuthEntryPath(): "/auth" | "/desktop-auth" {
  return isTauri() || isElectron() ? "/desktop-auth" : "/auth";
}

/**
 * Maximizes the Tauri window after login
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
