/**
 * Centralized user profile cache.
 * User data is accessed constantly (message authors, member lists, typing indicators)
 * but changes rarely — this avoids redundant fetches.
 */

import { supabase } from '@/integrations/supabase/client';
import type { User } from '@/types';

interface CachedUser {
  user: User;
  cached_at: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const userCache = new Map<string, CachedUser>();

/** In-flight request deduplication */
const inflightRequests = new Map<string, Promise<User | null>>();

export function getUserFromCache(userId: string): User | null {
  const cached = userCache.get(userId);
  if (!cached) return null;
  if (Date.now() - cached.cached_at > CACHE_TTL) {
    userCache.delete(userId);
    return null;
  }
  return cached.user;
}

export function setUserInCache(userId: string, user: User): void {
  userCache.set(userId, { user, cached_at: Date.now() });
}

export function bulkSetUsersInCache(users: User[]): void {
  const now = Date.now();
  users.forEach((user) => {
    userCache.set(user.id, { user, cached_at: now });
  });
}

export function invalidateUser(userId: string): void {
  userCache.delete(userId);
}

/**
 * Get user from cache or fetch from DB. Deduplicates concurrent requests for the same user.
 */
export async function getOrFetchUser(userId: string): Promise<User | null> {
  // Check cache first
  const cached = getUserFromCache(userId);
  if (cached) return cached;

  // Deduplicate concurrent requests
  const inflight = inflightRequests.get(userId);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const { data } = await supabase.rpc('get_user_by_id', { _user_id: userId });
      if (data) {
        const user = data as unknown as User;
        setUserInCache(userId, user);
        return user;
      }
      return null;
    } finally {
      inflightRequests.delete(userId);
    }
  })();

  inflightRequests.set(userId, promise);
  return promise;
}

/**
 * Generic request deduplication utility.
 * Prevents the same query from being fired multiple times simultaneously.
 */
const genericInflight = new Map<string, Promise<any>>();

export async function deduplicatedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const existing = genericInflight.get(key);
  if (existing) return existing;

  const promise = fetcher().finally(() => {
    genericInflight.delete(key);
  });

  genericInflight.set(key, promise);
  return promise;
}
