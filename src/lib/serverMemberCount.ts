const MEMBER_COUNT_CACHE_TTL_MS = 3 * 60_000;
const MEMBER_COUNT_STORAGE_PREFIX = "kloak:member-count:";

export const readCachedMemberCount = (serverId: string, userId: string): number | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${MEMBER_COUNT_STORAGE_PREFIX}${serverId}:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { count?: number; cachedAt?: number };
    if (typeof parsed.count !== "number" || typeof parsed.cachedAt !== "number") return null;
    if (Date.now() - parsed.cachedAt >= MEMBER_COUNT_CACHE_TTL_MS) return null;
    return parsed.count;
  } catch {
    return null;
  }
};

export const persistMemberCount = (serverId: string, userId: string, count: number) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      `${MEMBER_COUNT_STORAGE_PREFIX}${serverId}:${userId}`,
      JSON.stringify({ count, cachedAt: Date.now() }),
    );
  } catch {
    // ignore storage failures
  }
};
