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

const fallbackCache = new Map<string, string | null>();
const fallbackBatchInFlight = new Map<string, Promise<Map<string, string | null>>>();

/**
 * Look up a custom emoji by name across ALL servers (not just user's).
 * Returns the public URL or null. Results are cached for the session.
 */
export async function resolveEmojisByNameFallback(names: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const unique = Array.from(new Set(names)).filter(Boolean);
  const missing: string[] = [];

  for (const name of unique) {
    const cached = fallbackCache.get(name);
    if (cached !== undefined) {
      out.set(name, cached);
    } else {
      missing.push(name);
    }
  }

  if (missing.length === 0) return out;

  const batchKey = missing.slice().sort().join(',');
  const existing = fallbackBatchInFlight.get(batchKey);
  if (existing) {
    const map = await existing;
    for (const [k, v] of map) out.set(k, v);
    return out;
  }

  const promise = (async () => {
    const resolved = new Map<string, string | null>();
    try {
      const { data, error } = await supabase
        .from('server_emojis')
        .select('name,file_path')
        .in('name', missing);

      if (error || !data) {
        for (const name of missing) {
          fallbackCache.set(name, null);
          resolved.set(name, null);
        }
        return resolved;
      }

      // Choose first match per name (names may exist in multiple servers).
      const firstFilePathByName = new Map<string, string>();
      for (const row of data as Array<{ name: string; file_path: string }>) {
        if (!row?.name || !row?.file_path) continue;
        if (!firstFilePathByName.has(row.name)) {
          firstFilePathByName.set(row.name, row.file_path);
        }
      }

      for (const name of missing) {
        const filePath = firstFilePathByName.get(name);
        if (!filePath) {
          fallbackCache.set(name, null);
          resolved.set(name, null);
          continue;
        }

        const { data: urlData } = supabase.storage.from('server-emojis').getPublicUrl(filePath);
        const url = urlData.publicUrl;
        fallbackCache.set(name, url);
        resolved.set(name, url);
      }

      return resolved;
    } catch {
      for (const name of missing) {
        fallbackCache.set(name, null);
        resolved.set(name, null);
      }
      return resolved;
    } finally {
      fallbackBatchInFlight.delete(batchKey);
    }
  })();

  fallbackBatchInFlight.set(batchKey, promise);
  const map = await promise;
  for (const [k, v] of map) out.set(k, v);
  return out;
}

export async function resolveEmojiByNameFallback(name: string): Promise<string | null> {
  const cached = fallbackCache.get(name);
  if (cached !== undefined) return cached;

  const map = await resolveEmojisByNameFallback([name]);
  return map.get(name) ?? null;
}
