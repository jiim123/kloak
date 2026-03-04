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

/**
 * Fields that affect visual rendering (avatar, name, decoration).
 * Changes to these fields require a new object reference so React re-renders.
 * Status/last_seen changes do NOT need to re-render message components.
 */
const VISUAL_FIELDS: ReadonlySet<string> = new Set([
  'username', 'display_name', 'avatar_url', 'banner_url',
  'avatar_decoration', 'profile_effect', 'bio', 'banner_color',
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
    
    // Mutate the existing Map in place — no new Map allocation
    state._cache.set(user.id, { user, cachedAt: Date.now() });
    evictOldest(state._cache);
    
    // Only trigger React re-renders if visual fields actually changed values
    if (isVisualChange) {
      bumpUserVersion(user.id);
      set({ _version: state._version + 1 });
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
      state._cache.set(user.id, { user, cachedAt: now });
      if (isVisual) {
        bumpUserVersion(user.id);
        anyVisualChange = true;
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
    
    const patchedUser = { ...existing.user, ...patch };
    state._cache.set(id, { user: patchedUser, cachedAt: Date.now() });
    
    // Only trigger React re-renders for visual field changes.
    // Status/last_seen updates mutate in place without new Map reference,
    // preventing all useMessageUser selectors from re-evaluating.
    if (hasVisualChanges(patch, existing.user)) {
      bumpUserVersion(id);
      set({ _version: state._version + 1 });
    }
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
 * Hook to subscribe to a specific user from the cache.
 * Uses per-user versioning so status-only updates to OTHER users
 * don't cause this component to re-render.
 */
export function useMessageUser(userId: string | undefined | null): User | undefined {
  return useUserCacheStore((state) => {
    if (!userId) return undefined;
    // Access _version to subscribe to store changes, but the selector
    // returns the same User reference unless that user's visual fields changed.
    // Zustand uses Object.is equality — same User object = no re-render.
    void state._version; // subscribe to version changes
    return state._cache.get(userId)?.user;
  });
}

/**
 * Non-reactive cache lookup (for use outside React components).
 */
export function getUserFromCache(userId: string): User | null {
  return useUserCacheStore.getState().getUser(userId) ?? null;
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
