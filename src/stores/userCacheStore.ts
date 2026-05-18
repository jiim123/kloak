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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isValidUuid = (id: string): boolean => UUID_RE.test(id);

const MAX_CACHE_SIZE = 1000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedEntry {
  user: User;
  cachedAt: number;
}

/**
 * Fields that affect visual rendering (avatar, name, decoration).
 * Changes to these fields require a new object reference so React re-renders.
 * Status/last_seen changes do NOT need to re-render message components.
 */
const VISUAL_FIELDS: ReadonlySet<string> = new Set([
  'username', 'display_name', 'avatar_url', 'banner_url',
  'avatar_decoration', 'profile_effect', 'bio', 'tagline', 'banner_color',
  'custom_status',
]);

/** Version counter per user — incremented only on visual field changes */
const userVersions = new Map<string, number>();

function getUserVersion(id: string): number {
  return userVersions.get(id) ?? 0;
}

function bumpUserVersion(id: string): void {
  userVersions.set(id, (userVersions.get(id) ?? 0) + 1);
}

/**
 * Batched version bump — collapses multiple patchUser calls within the same
 * microtask into a single Zustand setState (and therefore a single React re-render).
 */
let pendingVersionBump = false;
const scheduleBatchedVersionBump = () => {
  if (pendingVersionBump) return;
  pendingVersionBump = true;
  queueMicrotask(() => {
    pendingVersionBump = false;
    const s = useUserCacheStore.getState();
    useUserCacheStore.setState({ _version: s._version + 1 });
  });
};

interface UserCacheState {
  /** Internal cache map - keyed by user ID. Mutated in place for status-only updates. */
  _cache: Map<string, CachedEntry>;
  
  /** Version counter that increments on visual-field changes to trigger selectors */
  _version: number;

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

/** Check if a patch contains any visual field changes compared to existing user */
function hasVisualChanges(incoming: Partial<User>, existing?: User): boolean {
  for (const key of Object.keys(incoming)) {
    if (key === 'id') continue;
    if (!VISUAL_FIELDS.has(key)) continue;
    // If no existing user, any visual field is a change
    if (!existing) return true;
    // Compare actual values
    if ((incoming as any)[key] !== (existing as any)[key]) return true;
  }
  return false;
}

export const useUserCacheStore = create<UserCacheState>((set, get) => ({
  _cache: new Map(),
  _version: 0,

  getUser: (id: string) => {
    const entry = get()._cache.get(id);
    if (!entry) return undefined;
    // Always return — even if stale. Background refresh handles TTL.
    return entry.user;
  },

  upsertUser: (user: User) => {
    const state = get();
    const existing = state._cache.get(user.id);
    
    // Skip if identical object reference
    if (existing?.user === user) return;
    
    const isVisualChange = hasVisualChanges(user, existing?.user);
    
    if (isVisualChange || !existing) {
      // New user or visual change: store the new object reference
      state._cache.set(user.id, { user, cachedAt: Date.now() });
      evictOldest(state._cache);
      bumpUserVersion(user.id);
      set({ _version: state._version + 1 });
    } else {
      // Existing user, no visual change: mutate in place to preserve
      // the same object reference for stable useMessageUser selectors
      Object.assign(existing.user, user);
      existing.cachedAt = Date.now();
    }
  },

  upsertUsers: (users: User[]) => {
    if (users.length === 0) return;
    const state = get();
    const now = Date.now();
    let anyVisualChange = false;
    
    for (const user of users) {
      const existing = state._cache.get(user.id);
      if (existing?.user === user) continue;
      const isVisual = hasVisualChanges(user, existing?.user);
      if (isVisual || !existing) {
        state._cache.set(user.id, { user, cachedAt: now });
        bumpUserVersion(user.id);
        anyVisualChange = true;
      } else {
        // Non-visual: mutate in place to preserve object reference
        Object.assign(existing.user, user);
        existing.cachedAt = now;
      }
    }
    
    evictOldest(state._cache);
    
    if (anyVisualChange) {
      set({ _version: state._version + 1 });
    }
  },

  patchUser: (id: string, patch: Partial<User>) => {
    const state = get();
    const existing = state._cache.get(id);
    if (!existing) return;
    
    const isVisual = hasVisualChanges(patch, existing.user);
    
    // Mutate cache immediately so reads are up-to-date
    const patchedUser = { ...existing.user, ...patch };
    state._cache.set(id, { user: patchedUser, cachedAt: Date.now() });
    
    if (isVisual) {
      bumpUserVersion(id);
    }
    
    // Batch the version bump — multiple patchUser calls within the same
    // microtask (e.g. Presence sync with 50 users) produce a single re-render.
    scheduleBatchedVersionBump();
  },

  invalidate: (id: string) => {
    const state = get();
    if (!state._cache.has(id)) return;
    state._cache.delete(id);
    bumpUserVersion(id);
    set({ _version: state._version + 1 });
  },

  clear: () => {
    userVersions.clear();
    set({ _cache: new Map(), _version: 0 });
  },
}));

/**
 * Batch-fetch queue: collects missing user IDs over a 16ms window
 * and fires a single `get_users_by_ids` RPC instead of N individual calls.
 */
const pendingBatchIds = new Set<string>();
let batchTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleBatchFetch(userId: string) {
  pendingBatchIds.add(userId);
  if (batchTimer) return;
  batchTimer = setTimeout(async () => {
    const ids = [...pendingBatchIds];
    pendingBatchIds.clear();
    batchTimer = null;
    if (ids.length === 0) return;
    try {
      const { data } = await supabase.rpc('get_users_by_ids', { _user_ids: ids });
      if (Array.isArray(data) && data.length > 0) {
        bulkSetUsersInCache(data as unknown as User[]);
      }
    } catch (err) {
      console.error('[userCacheStore] batch fetch failed, falling back to individual:', err);
      // Fallback: fetch individually for deployments without the RPC
      for (const id of ids) {
        fetchAndCacheUser(id).catch(() => {});
      }
    }
  }, 16);
}

/**
 * Hook to subscribe to a specific user from the cache.
 * Uses per-user versioning so status-only updates to OTHER users
 * don't cause this component to re-render.
 * 
 * If the user is not in cache, triggers a background batch fetch automatically.
 */
export function useMessageUser(userId: string | undefined | null): User | undefined {
  const user = useUserCacheStore((state) => {
    if (!userId) return undefined;
    void state._version; // subscribe to version changes
    return state._cache.get(userId)?.user;
  });

  // Auto-fetch missing users via batched RPC
  if (userId && !user && !pendingBatchIds.has(userId) && isValidUuid(userId)) {
    // Skip if already in-flight from a previous batch or individual fetch
    if (!inflightFetches.has(userId)) {
      scheduleBatchFetch(userId);
    }
  }

  return user;
}

/**
 * Non-reactive cache lookup (for use outside React components).
 */
export function getUserFromCache(userId: string): User | null {
  if (!userId || !isValidUuid(userId)) return null;
  return useUserCacheStore.getState().getUser(userId) ?? null;
}

/**
 * Returns the age of a cached user entry in milliseconds, or null when absent.
 */
export function getUserCacheAge(userId: string): number | null {
  const entry = useUserCacheStore.getState()._cache.get(userId);
  if (!entry) return null;
  return Date.now() - entry.cachedAt;
}

/**
 * Upsert a single user (non-reactive helper for use outside components).
 */
export function setUserInCache(userId: string, user: User): void {
  useUserCacheStore.getState().upsertUser(user);
}

/**
 * Bulk upsert users (non-reactive helper for use outside components).
 */
export function bulkSetUsersInCache(users: User[]): void {
  useUserCacheStore.getState().upsertUsers(users);
}

/**
 * In-flight request deduplication for fetching users not in cache.
 */
const inflightFetches = new Map<string, Promise<User | null>>();

export async function fetchAndCacheUser(userId: string): Promise<User | null> {
  if (!userId || !isValidUuid(userId)) return null;
  const cached = useUserCacheStore.getState().getUser(userId);
  if (cached) return cached;

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

/** Alias for backward compatibility */
export const getOrFetchUser = fetchAndCacheUser;
