import { supabase } from '@/integrations/supabase/client';
import { getCdnUrl } from '@/lib/bunny-upload';

export type ServerEmoji = {
  id: string;
  name: string;
  file_path: string;
  url: string;
};

type CacheEntry = {
  fetchedAt: number;
  items: ServerEmoji[];
  inFlight?: Promise<ServerEmoji[]>;
};

type HydrationWaiter = {
  resolve: () => void;
  timer: ReturnType<typeof setTimeout>;
};

const CACHE_TTL_MS = 60_000;
const SERVER_EMOJI_STORAGE_PREFIX = 'kloak:server-emojis:';
const cache = new Map<string, CacheEntry>();
const hydrationWaiters = new Map<string, Set<HydrationWaiter>>();

const readPersistedServerEmojis = (serverId: string): CacheEntry | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(`${SERVER_EMOJI_STORAGE_PREFIX}${serverId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (Date.now() - parsed.fetchedAt >= CACHE_TTL_MS) return null;
    return { fetchedAt: parsed.fetchedAt, items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch {
    return null;
  }
};

const persistServerEmojis = (serverId: string, entry: CacheEntry) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      `${SERVER_EMOJI_STORAGE_PREFIX}${serverId}`,
      JSON.stringify({ fetchedAt: entry.fetchedAt, items: entry.items }),
    );
  } catch {
    // ignore storage failures
  }
};

export function invalidateServerEmojis(serverId: string) {
  cache.delete(serverId);
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(`${SERVER_EMOJI_STORAGE_PREFIX}${serverId}`);
    } catch {
      // ignore storage failures
    }
  }
}

const notifyHydrated = (serverId: string) => {
  const waiters = hydrationWaiters.get(serverId);
  if (!waiters) return;
  hydrationWaiters.delete(serverId);
  for (const waiter of waiters) {
    clearTimeout(waiter.timer);
    waiter.resolve();
  }
};

const waitForHydration = (serverId: string, timeoutMs = 500): Promise<void> => {
  return new Promise((resolve) => {
    const waiter: HydrationWaiter = {
      resolve: () => resolve(),
      timer: setTimeout(() => {
        const waiters = hydrationWaiters.get(serverId);
        if (waiters) {
          waiters.delete(waiter);
          if (waiters.size === 0) hydrationWaiters.delete(serverId);
        }
        resolve();
      }, timeoutMs),
    };

    const waiters = hydrationWaiters.get(serverId) ?? new Set<HydrationWaiter>();
    waiters.add(waiter);
    hydrationWaiters.set(serverId, waiters);
  });
};

export function hydrateServerEmojis(serverId: string, items: Array<Pick<ServerEmoji, 'id' | 'name' | 'file_path'> | ServerEmoji>) {
  const nextItems = items.map((row) => {
    if ('url' in row && typeof row.url === 'string' && row.url.length > 0) {
      return row as ServerEmoji;
    }
    const { data: urlData } = supabase.storage.from('server-emojis').getPublicUrl(row.file_path);
    return {
      id: row.id,
      name: row.name,
      file_path: row.file_path,
      url: urlData.publicUrl,
    } satisfies ServerEmoji;
  });

  const entry = { fetchedAt: Date.now(), items: nextItems };
  cache.set(serverId, entry);
  persistServerEmojis(serverId, entry);
  notifyHydrated(serverId);
}

export async function fetchServerEmojis(serverId: string, opts?: { force?: boolean }): Promise<ServerEmoji[]> {
  const force = opts?.force ?? false;
  const now = Date.now();
  const existing = cache.get(serverId) ?? readPersistedServerEmojis(serverId) ?? undefined;
  if (existing && !cache.has(serverId)) {
    cache.set(serverId, existing);
  }

  // Always coalesce concurrent requests (even when forced).
  // Otherwise multiple components calling `{ force: true }` at once can create request storms.
  if (existing?.inFlight) {
    return existing.inFlight;
  }

  if (!force && existing && now - existing.fetchedAt < CACHE_TTL_MS) {
    return existing.items;
  }

  // Server bootstrap now carries emojis. Give it a short chance to hydrate the cache
  // before falling back to a direct table read.
  if (!force && !existing) {
    await waitForHydration(serverId);
    const hydrated = cache.get(serverId) ?? readPersistedServerEmojis(serverId) ?? undefined;
    if (hydrated && !cache.has(serverId)) {
      cache.set(serverId, hydrated);
    }
    if (hydrated && Date.now() - hydrated.fetchedAt < CACHE_TTL_MS) {
      return hydrated.items;
    }
  }

  const inFlight = (async () => {
    const { data, error } = await supabase
      .from('server_emojis')
      .select('id,name,file_path')
      .eq('server_id', serverId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const items = (data ?? []).map((row) => {
      const { data: urlData } = supabase.storage.from('server-emojis').getPublicUrl(row.file_path);
      return {
        id: row.id,
        name: row.name,
        file_path: row.file_path,
        url: urlData.publicUrl,
      } satisfies ServerEmoji;
    });

    const nextEntry = { fetchedAt: Date.now(), items };
    cache.set(serverId, nextEntry);
    persistServerEmojis(serverId, nextEntry);
    return items;
  })();

  // Important: do NOT treat "inFlight started" as "fresh data fetched".
  // If the request fails (transient network/auth), caching an empty list here would
  // cause the app to render :name: as plain text until TTL expires.
  cache.set(serverId, { fetchedAt: existing?.fetchedAt ?? 0, items: existing?.items ?? [], inFlight });

  try {
    return await inFlight;
  } catch (e) {
    // Don't cache failures.
    cache.delete(serverId);
    throw e;
  } finally {
    const after = cache.get(serverId);
    if (after?.inFlight === inFlight) {
      delete after.inFlight;
      cache.set(serverId, after);
    }
  }
}

