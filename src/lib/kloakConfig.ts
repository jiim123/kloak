/**
 * Shared kloak-ws enabled flag.
 *
 * Lives in its own module (no imports) so both the socket client and the
 * user cache store can import it without creating a circular dependency
 * (userCacheStore → kloakSocket → authStore → userCacheStore).
 */
export function isKloakSocketEnabled() {
  if (typeof window === "undefined") return false;
  try {
    const override = window.localStorage.getItem("kloak:use-kloak-ws");
    if (override === "1") return true;
    if (override === "0") return false;
    return import.meta.env.VITE_KLOAK_WS_ENABLED === "true";
  } catch {
    return import.meta.env.VITE_KLOAK_WS_ENABLED === "true";
  }
}