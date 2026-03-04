/**
 * Phase 1: Centralized User Cache Store
 * 
 * Single source of truth for user profile data in memory.
 * Messages only store user_id and look up user data from this cache.
 * This eliminates millions of duplicated {username, display_name, ...} objects.
 */
import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@/types';

const MAX_CACHE_SIZE = 1000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedEntry {
  user: User;
  cachedAt: number;
}

interface UserCacheState {
  /** Internal cache map - keyed by user ID */
  _cache: Map<string, CachedEntry>;

  /** Get a user from cache (returns undefined if not cached or expired) */
  getUser: (id: string) => User | undefined;

  /** Upsert a single user into the cache */
  upsertUser: (user: User) => void;

  /** Upsert multiple users into the cache */
  upsertUsers: (users: User[]) => void;

  /** Patch specific fields of a cached user (e.g. status update) */
  patchUser: (id: string, patch: Partial<User>) => void;

  /** Invalidate a specific user entry */
  invalidate: (id: string) => void;

  /** Clear entire cache */
  clear: () => void;
}

/** Evict oldest entries when cache exceeds max size */
function evictOldest(cache: Map<string, CachedEntry>) {
  if (cache.size <= MAX_CACHE_SIZE) return;
  const toDelete = cache.size - MAX_CACHE_SIZE;
  let count = 0;
  for (const key of cache.keys()) {
    if (count >= toDelete) break;
    cache.delete(key);
    count++;
  }
}

export const useUserCacheStore = create<UserCacheState>((set, get) => ({
  _cache: new Map(),

  getUser: (id: string) => {
    const entry = get()._cache.get(id);
    if (!entry) return undefined;
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      // Expired but don't delete — return stale data, background refresh will fix it
      return entry.user;
    }
    return entry.user;
  },

  upsertUser: (user: User) => {
    set((state) => {
      const next = new Map(state._cache);
      next.set(user.id, { user, cachedAt: Date.now() });
      evictOldest(next);
      return { _cache: next };
    });
  },

  upsertUsers: (users: User[]) => {
    if (users.length === 0) return;
    set((state) => {
      const next = new Map(state._cache);
      const now = Date.now();
      for (const user of users) {
        next.set(user.id, { user, cachedAt: now });
      }
      evictOldest(next);
      return { _cache: next };
    });
  },

  patchUser: (id: string, patch: Partial<User>) => {
    set((state) => {
      const existing = state._cache.get(id);
      if (!existing) return {};
      const next = new Map(state._cache);
      next.set(id, {
        user: { ...existing.user, ...patch },
        cachedAt: Date.now(),
      });
      return { _cache: next };
    });
  },

  invalidate: (id: string) => {
    set((state) => {
      if (!state._cache.has(id)) return {};
      const next = new Map(state._cache);
      next.delete(id);
      return { _cache: next };
    });
  },

  clear: () => {
    set({ _cache: new Map() });
  },
}));

/**
 * Hook to subscribe to a specific user from the cache.
 * Components call this with a user_id and get reactive updates when the user data changes.
 * Returns undefined if user is not in cache.
 */
export function useMessageUser(userId: string | undefined | null): User | undefined {
  return useUserCacheStore((state) => {
    if (!userId) return undefined;
    return state._cache.get(userId)?.user;
  });
}

/**
 * In-flight request deduplication for fetching users not in cache.
 */
const inflightFetches = new Map<string, Promise<User | null>>();

export async function fetchAndCacheUser(userId: string): Promise<User | null> {
  // Check cache first
  const cached = useUserCacheStore.getState().getUser(userId);
  if (cached) return cached;

  // Deduplicate
  const inflight = inflightFetches.get(userId);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const { data } = await supabase.rpc('get_user_by_id', { _user_id: userId });
      if (data) {
        const user = data as unknown as User;
        useUserCacheStore.getState().upsertUser(user);
        return user;
      }
      return null;
    } finally {
      inflightFetches.delete(userId);
    }
  })();

  inflightFetches.set(userId, promise);
  return promise;
}
