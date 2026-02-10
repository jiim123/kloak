/**
 * Global cross-server emoji resolver.
 * Fetches and caches emojis from ALL servers the user is a member of,
 * enabling cross-server emoji rendering in messages.
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
        // Don't overwrite if already exists (first server wins)
        if (!map.has(emoji.name)) {
          map.set(emoji.name, {
            name: emoji.name,
            url: emoji.url,
            serverId: server.id,
            serverName: server.name,
            serverIcon: server.icon_url,
            isPublished: server.is_published,
          });
        }
      }
    }

    globalCache = { map, serverIds, builtAt: Date.now() };
    return map;
  })();

  // Store in-flight promise
  globalCache = {
    map: globalCache?.map ?? new Map(),
    serverIds,
    builtAt: globalCache?.builtAt ?? 0,
    inFlight,
  };

  try {
    return await inFlight;
  } catch (e) {
    console.error('[globalEmojiResolver] Failed to build global emoji map:', e);
    // Return whatever we had before
    return globalCache?.map ?? new Map();
  } finally {
    if (globalCache?.inFlight === inFlight) {
      delete globalCache.inFlight;
    }
  }
}

/** Invalidate the global cache (e.g. after uploading a new emoji). */
export function invalidateGlobalEmojiCache() {
  globalCache = null;
}
