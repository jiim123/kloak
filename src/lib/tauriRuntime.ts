export function isTauri(): boolean {
  if (typeof window === "undefined") return false;

  // Tauri v2 uses `__TAURI_INTERNALS__` for bundled JS/TS usage.
  // `window.__TAURI__` exists only when `app.withGlobalTauri` is enabled.
  return (
    "__TAURI_INTERNALS__" in window ||
    "__TAURI__" in window
  );
}

