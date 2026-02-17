/**
 * Global cross-server emoji resolver.
 * Fetches and caches emojis from ALL servers the user is a member of,
 * enabling cross-server emoji rendering in messages.
 *
 * Duplicate emoji names across servers are tracked so consumers can
 * disambiguate using the :name~ServerName: syntax.
 */
import { fetchServerEmojis, type ServerEmoji } from './serverEmojis';
import { useServerStore } from '@/stores/serverStore';

export interface ResolvedEmoji {
  name: string;
  url: string;
  serverId: string;
  serverName: string;
  serverIcon: string | null;
  isPublished: boolean;
}

type GlobalCache = {
  /** emoji name → resolved info (first match wins) */
  map: Map<string, ResolvedEmoji>;
  /** "name~ServerName" → resolved info for disambiguation */
  qualifiedMap: Map<string, ResolvedEmoji>;
  /** emoji names that exist in more than one server */
  duplicateNames: Set<string>;
  /** server IDs that were included in this build */
  serverIds: string[];
  builtAt: number;
  inFlight?: Promise<Map<string, ResolvedEmoji>>;
};

const CACHE_TTL_MS = 120_000; // 2 minutes
let globalCache: GlobalCache | null = null;

/**
 * Build (or return cached) global emoji map from all user servers.
 * Returns a Map<emojiName, ResolvedEmoji>.
 */
export async function getGlobalEmojiMap(opts?: { force?: boolean }): Promise<Map<string, ResolvedEmoji>> {
  const force = opts?.force ?? false;
  const servers = useServerStore.getState().servers;
  const serverIds = servers.map((s) => s.id).sort();

  // Check cache validity
  if (
    !force &&
    globalCache &&
    Date.now() - globalCache.builtAt < CACHE_TTL_MS &&
    globalCache.serverIds.join(',') === serverIds.join(',')
  ) {
    return globalCache.map;
  }

  // Deduplicate in-flight
  if (!force && globalCache?.inFlight) {
    return globalCache.inFlight;
  }

  const inFlight = (async () => {
    const map = new Map<string, ResolvedEmoji>();
    const qualifiedMap = new Map<string, ResolvedEmoji>();
    const duplicateNames = new Set<string>();
    /** Temporary: all emojis per name to detect duplicates */
    const allByName = new Map<string, ResolvedEmoji[]>();

    // Fetch emojis from all servers in parallel
    const results = await Promise.allSettled(
      servers.map(async (server) => {
        const emojis = await fetchServerEmojis(server.id);
        return { server, emojis };
      })
    );

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const { server, emojis } = result.value;
      for (const emoji of emojis) {
        const resolved: ResolvedEmoji = {
          name: emoji.name,
          url: emoji.url,
          serverId: server.id,
          serverName: server.name,
          serverIcon: server.icon_url,
          isPublished: server.is_published,
        };

        // Track all emojis by name
        const existing = allByName.get(emoji.name);
        if (existing) {
          existing.push(resolved);
        } else {
          allByName.set(emoji.name, [resolved]);
        }

        // First match wins for unqualified lookup
        if (!map.has(emoji.name)) {
          map.set(emoji.name, resolved);
        }

        // Always add qualified name: "emojiName~ServerName"
        const qualifiedKey = `${emoji.name}~${server.name}`;
        qualifiedMap.set(qualifiedKey, resolved);
      }
    }

    // Mark duplicates
    for (const [name, entries] of allByName) {
      if (entries.length > 1) {
        duplicateNames.add(name);
      }
    }

    globalCache = { map, qualifiedMap, duplicateNames, serverIds, builtAt: Date.now() };
    return map;
  })();

  // Store in-flight promise
  globalCache = {
    map: globalCache?.map ?? new Map(),
    qualifiedMap: globalCache?.qualifiedMap ?? new Map(),
    duplicateNames: globalCache?.duplicateNames ?? new Set(),
    serverIds,
    builtAt: globalCache?.builtAt ?? 0,
    inFlight,
  };

  try {
    return await inFlight;
  } catch (e) {
    console.error('[globalEmojiResolver] Failed to build global emoji map:', e);
    return globalCache?.map ?? new Map();
  } finally {
    if (globalCache?.inFlight === inFlight) {
      delete globalCache.inFlight;
    }
  }
}

/** Get the set of emoji names that are duplicated across servers. */
export function getGlobalEmojiDuplicates(): Set<string> {
  return globalCache?.duplicateNames ?? new Set();
}

/** Resolve a qualified emoji name like "xander~MyServer". */
export function resolveQualifiedEmoji(qualifiedName: string): ResolvedEmoji | undefined {
  return globalCache?.qualifiedMap.get(qualifiedName);
}

/** Invalidate the global cache (e.g. after uploading a new emoji). */
export function invalidateGlobalEmojiCache() {
  globalCache = null;
}

// ---------------------------------------------------------------------------
// Fallback resolver: fetch emoji URL from DB when viewer isn't in the server
// ---------------------------------------------------------------------------
import { supabase } from '@/integrations/supabase/client';

type FallbackCacheEntry = { value: string | null; cachedAt: number };

// Cache fallback emoji resolutions for a while; this is only used when the viewer isn't in the server.
const FALLBACK_CACHE_TTL_MS = 10 * 60_000; // 10 minutes
const fallbackCache = new Map<string, FallbackCacheEntry>();

// Micro-batched, cross-call request coalescing:
// many message components may ask for different subsets of names at the same time.
// Instead of firing 5-20 near-identical requests with slightly different `in(name, ...)` sets,
// we queue names for a short window and resolve them with a single query.
type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void };
const fallbackInflightByName = new Map<string, Deferred<string | null>>();
const pendingFallbackNames = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function getCachedFallback(name: string): string | null | undefined {
  const entry = fallbackCache.get(name);
  if (!entry) return undefined;
  if (Date.now() - entry.cachedAt > FALLBACK_CACHE_TTL_MS) {
    fallbackCache.delete(name);
    return undefined;
  }
  return entry.value;
}

function scheduleFallbackFlush() {
  if (flushTimer) return;

  // 25ms groups together multiple component effects/renders from the same frame / route switch.
  flushTimer = setTimeout(async () => {
    flushTimer = null;

    const names = Array.from(pendingFallbackNames);
    pendingFallbackNames.clear();
    if (names.length === 0) return;

    try {
      const { data, error } = await supabase.from('server_emojis').select('name,file_path').in('name', names);

      if (error || !data) {
        // Do not cache failures; just resolve current inflight as null.
        for (const name of names) {
          const d = fallbackInflightByName.get(name);
          if (!d) continue;
          d.resolve(null);
          fallbackInflightByName.delete(name);
        }
        return;
      }

      // Choose first match per name (names may exist in multiple servers).
      const firstFilePathByName = new Map<string, string>();
      for (const row of data as Array<{ name: string; file_path: string }>) {
        if (!row?.name || !row?.file_path) continue;
        if (!firstFilePathByName.has(row.name)) {
          firstFilePathByName.set(row.name, row.file_path);
        }
      }

      for (const name of names) {
        const filePath = firstFilePathByName.get(name);
        let value: string | null = null;
        if (filePath) {
          const { data: urlData } = supabase.storage.from('server-emojis').getPublicUrl(filePath);
          value = urlData.publicUrl;
        }

        fallbackCache.set(name, { value, cachedAt: Date.now() });

        const d = fallbackInflightByName.get(name);
        if (d) {
          d.resolve(value);
          fallbackInflightByName.delete(name);
        }
      }
    } catch (e) {
      // Do not cache failures; resolve current inflight as null to keep rendering stable.
      for (const name of names) {
        const d = fallbackInflightByName.get(name);
        if (!d) continue;
        d.resolve(null);
        fallbackInflightByName.delete(name);
      }
    }
  }, 25);
}

function getOrQueueFallbackName(name: string): Promise<string | null> {
  const cached = getCachedFallback(name);
  if (cached !== undefined) return Promise.resolve(cached);

  const existing = fallbackInflightByName.get(name);
  if (existing) return existing.promise;

  let resolve!: (v: string | null) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<string | null>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  const deferred: Deferred<string | null> = { promise, resolve, reject };
  fallbackInflightByName.set(name, deferred);
  pendingFallbackNames.add(name);
  scheduleFallbackFlush();
  return promise;
}

/**
 * Look up a custom emoji by name across ALL servers (not just user's).
 * Returns the public URL or null. Results are cached for the session.
 */
export async function resolveEmojisByNameFallback(names: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const unique = Array.from(new Set(names)).filter(Boolean);

  const promises = unique.map(async (name) => {
    const url = await getOrQueueFallbackName(name);
    return [name, url] as const;
  });

  const resolved = await Promise.all(promises);
  for (const [name, url] of resolved) out.set(name, url);
  return out;
}

export async function resolveEmojiByNameFallback(name: string): Promise<string | null> {
  const cached = getCachedFallback(name);
  if (cached !== undefined) return cached;
  return await getOrQueueFallbackName(name);
}
