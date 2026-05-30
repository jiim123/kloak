const MEMBER_COUNT_CACHE_TTL_MS = 3 * 60_000;
const MEMBER_COUNT_STORAGE_PREFIX = "kloak:member-count:";

type HydrationWaiter = {
  resolve: () => void;
  timer: ReturnType<typeof setTimeout>;
};

const hydrationWaiters = new Map<string, Set<HydrationWaiter>>();

const getCacheKey = (serverId: string, userId: string) => `${serverId}:${userId}`;

export const readCachedMemberCount = (serverId: string, userId: string): number | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${MEMBER_COUNT_STORAGE_PREFIX}${getCacheKey(serverId, userId)}`);
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
      `${MEMBER_COUNT_STORAGE_PREFIX}${getCacheKey(serverId, userId)}`,
      JSON.stringify({ count, cachedAt: Date.now() }),
    );
    const waiters = hydrationWaiters.get(getCacheKey(serverId, userId));
    if (waiters) {
      hydrationWaiters.delete(getCacheKey(serverId, userId));
      for (const waiter of waiters) {
        clearTimeout(waiter.timer);
        waiter.resolve();
      }
    }
  } catch {
    // ignore storage failures
  }
};

export const waitForCachedMemberCount = (serverId: string, userId: string, timeoutMs = 1500): Promise<number | null> => {
  const cached = readCachedMemberCount(serverId, userId);
  if (cached !== null) return Promise.resolve(cached);

  return new Promise((resolve) => {
    const key = getCacheKey(serverId, userId);
    const waiter: HydrationWaiter = {
      resolve: () => resolve(readCachedMemberCount(serverId, userId)),
      timer: setTimeout(() => {
        const waiters = hydrationWaiters.get(key);
        if (waiters) {
          waiters.delete(waiter);
          if (waiters.size === 0) hydrationWaiters.delete(key);
        }
        resolve(readCachedMemberCount(serverId, userId));
      }, timeoutMs),
    };

    const waiters = hydrationWaiters.get(key) ?? new Set<HydrationWaiter>();
    waiters.add(waiter);
    hydrationWaiters.set(key, waiters);
  });
};
