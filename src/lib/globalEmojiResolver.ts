/**
 * Global cross-server emoji resolver.
 * Fetches and caches emojis from ALL servers the user is a member of,
 * enabling cross-server emoji rendering in messages.
 *
 * Duplicate emoji names across servers are tracked so consumers can
 * disambiguate using the :name~ServerName: syntax.
 */
import { supabase } from '@/integrations/supabase/client';
import { getCdnUrl } from '@/lib/bunny-upload';
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
const GLOBAL_EMOJI_STORAGE_KEY = 'kloak:global-emoji-map:v1';
let globalCache: GlobalCache | null = null;

const readPersistedGlobalEmojiCache = (serverIds: string[]): GlobalCache | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(GLOBAL_EMOJI_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      map?: Array<[string, ResolvedEmoji]>;
      qualifiedMap?: Array<[string, ResolvedEmoji]>;
      duplicateNames?: string[];
      serverIds?: string[];
      builtAt?: number;
    };
    if (!Array.isArray(parsed?.serverIds) || typeof parsed?.builtAt !== 'number') return null;
    if (parsed.serverIds.join(',') !== serverIds.join(',')) return null;
    if (Date.now() - parsed.builtAt >= CACHE_TTL_MS) return null;
    return {
      map: new Map(parsed.map ?? []),
      qualifiedMap: new Map(parsed.qualifiedMap ?? []),
      duplicateNames: new Set(parsed.duplicateNames ?? []),
      serverIds: parsed.serverIds,
      builtAt: parsed.builtAt,
    };
  } catch {
    return null;
  }
};

const persistGlobalEmojiCache = (cache: GlobalCache) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      GLOBAL_EMOJI_STORAGE_KEY,
      JSON.stringify({
        map: Array.from(cache.map.entries()),
        qualifiedMap: Array.from(cache.qualifiedMap.entries()),
        duplicateNames: Array.from(cache.duplicateNames.values()),
        serverIds: cache.serverIds,
        builtAt: cache.builtAt,
      }),
    );
  } catch {
    // ignore storage failures
  }
};

/**
 * Build (or return cached) global emoji map from all user servers.
 * Returns a Map<emojiName, ResolvedEmoji>.
 */
export async function getGlobalEmojiMap(opts?: { force?: boolean }): Promise<Map<string, ResolvedEmoji>> {
  const force = opts?.force ?? false;
  const servers = useServerStore.getState().servers;
  const serverIds = servers.map((s) => s.id).sort();

  if (!globalCache) {
    globalCache = readPersistedGlobalEmojiCache(serverIds);
  }

  // Always deduplicate in-flight builds (even when forced).
  // Multiple components may ask for a force-refresh at once; coalesce them.
  if (globalCache?.inFlight) {
    return globalCache.inFlight;
  }

  // Check cache validity
  if (
    !force &&
    globalCache &&
    Date.now() - globalCache.builtAt < CACHE_TTL_MS &&
    globalCache.serverIds.join(',') === serverIds.join(',')
  ) {
    return globalCache.map;
  }

  const inFlight = (async () => {
    const map = new Map<string, ResolvedEmoji>();
    const qualifiedMap = new Map<string, ResolvedEmoji>();
    const duplicateNames = new Set<string>();
    /** Temporary: all emojis per name to detect duplicates */
    const allByName = new Map<string, ResolvedEmoji[]>();

    const serverById = new Map(servers.map((s) => [s.id, s] as const));

    // Important perf win:
    // A single `in(server_id, ...)` query replaces N-per-server requests.
    if (serverIds.length > 0) {
      const { data, error } = await supabase
        .from('server_emojis')
        .select('server_id,name,file_path')
        .in('server_id', serverIds)
        .order('created_at', { ascending: true });

      if (error) throw error;

      for (const row of data ?? []) {
        const server = serverById.get(row.server_id);
        if (!server) continue;

        const resolved: ResolvedEmoji = {
          name: row.name,
          url: getCdnUrl('server-emojis', row.file_path),
          serverId: server.id,
          serverName: server.name,
          serverIcon: server.icon_url,
          isPublished: server.is_published,
        };

        // Track all emojis by name
        const existing = allByName.get(row.name);
        if (existing) {
          existing.push(resolved);
        } else {
          allByName.set(row.name, [resolved]);
        }

        // First match wins for unqualified lookup
        if (!map.has(row.name)) {
          map.set(row.name, resolved);
        }

        // Always add qualified name: "emojiName~ServerName"
        const qualifiedKey = `${row.name}~${server.name}`;
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
    persistGlobalEmojiCache(globalCache);
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
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(GLOBAL_EMOJI_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
  }
}

// ---------------------------------------------------------------------------
// Fallback resolver: fetch emoji URL from DB when viewer isn't in the server
// ---------------------------------------------------------------------------
type FallbackCacheEntry = { value: string | null; cachedAt: number };

// Cache fallback emoji resolutions for a while; this is only used when the viewer isn't in the server.
const FALLBACK_CACHE_TTL_MS = 10 * 60_000; // 10 minutes
const fallbackCache = new Map<string, FallbackCacheEntry>();

// Qualified fallback cache: "name~ServerName" → url|null
const qualifiedFallbackCache = new Map<string, FallbackCacheEntry>();

// Micro-batched, cross-call request coalescing:
// many message components may ask for different subsets of names at the same time.
// Instead of firing 5-20 near-identical requests with slightly different `in(name, ...)` sets,
// we queue names for a short window and resolve them with a single query.
type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void };
const fallbackInflightByName = new Map<string, Deferred<string | null>>();
const pendingFallbackNames = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

type EmojiRenderVariantRow = {
  name: string;
  server_name: string;
  file_path: string;
  created_at: string;
};

function getCachedFallback(name: string): string | null | undefined {
  const entry = fallbackCache.get(name);
  if (!entry) return undefined;
  if (Date.now() - entry.cachedAt > FALLBACK_CACHE_TTL_MS) {
    fallbackCache.delete(name);
    return undefined;
  }
  return entry.value;
}

function getCachedQualifiedFallback(key: string): string | null | undefined {
  const entry = qualifiedFallbackCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.cachedAt > FALLBACK_CACHE_TTL_MS) {
    qualifiedFallbackCache.delete(key);
    return undefined;
  }
  return entry.value;
}

async function fetchEmojiRenderVariantsByNames(names: string[]): Promise<EmojiRenderVariantRow[] | null> {
  if (names.length === 0) return [];
  const { data, error } = await (supabase.from as any)('emoji_render_variants')
    .select('name,server_name,file_path,created_at')
    .in('name', names)
    .order('created_at', { ascending: true });
  if (error || !data) return null;
  return data as EmojiRenderVariantRow[];
}

async function fetchEmojiRenderVariantsByQualifiedKeys(keys: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const parsed = keys
    .map((key) => {
      const idx = key.indexOf('~');
      if (idx <= 0 || idx >= key.length - 1) return null;
      return {
        key,
        name: key.slice(0, idx),
        serverName: key.slice(idx + 1),
      };
    })
    .filter(Boolean) as Array<{ key: string; name: string; serverName: string }>;

  if (parsed.length === 0) return out;

  const names = Array.from(new Set(parsed.map((item) => item.name)));
  const rows = await fetchEmojiRenderVariantsByNames(names);
  if (!rows) return out;

  const rowsByQualified = new Map<string, string>();
  for (const row of rows) {
    const qualifiedKey = `${row.name}~${row.server_name}`;
    if (!rowsByQualified.has(qualifiedKey)) {
      rowsByQualified.set(qualifiedKey, row.file_path);
    }
  }

  for (const item of parsed) {
    const filePath = rowsByQualified.get(item.key);
    if (filePath) out.set(item.key, filePath);
  }

  return out;
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
      const rows = await fetchEmojiRenderVariantsByNames(names);

      if (!rows) {
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
      for (const row of rows) {
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

/**
 * Resolve a qualified custom emoji like ":name~Server Name:" by looking up the matching server name.
 * This is only used when the viewer can't resolve it from their own server list / global cache.
 *
 * Note: server names are not guaranteed unique. This best-effort resolver returns the first match.
 */
export async function resolveQualifiedEmojisByNameFallback(keys: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const unique = Array.from(new Set(keys)).filter(Boolean);
  if (unique.length === 0) return out;

  const unresolved: string[] = [];
  for (const key of unique) {
    const cached = getCachedQualifiedFallback(key);
    if (cached !== undefined) {
      out.set(key, cached);
    } else {
      unresolved.push(key);
    }
  }

  if (unresolved.length === 0) return out;

  try {
    const fileByKey = await fetchEmojiRenderVariantsByQualifiedKeys(unresolved);

    if (fileByKey.size === 0) {
      for (const key of unresolved) {
        qualifiedFallbackCache.set(key, { value: null, cachedAt: Date.now() });
        out.set(key, null);
      }
      return out;
    }

    for (const key of unresolved) {
      const filePath = fileByKey.get(key);
      let value: string | null = null;
      if (filePath) {
        const { data: urlData } = supabase.storage.from('server-emojis').getPublicUrl(filePath);
        value = urlData.publicUrl || null;
      }
      qualifiedFallbackCache.set(key, { value, cachedAt: Date.now() });
      out.set(key, value);
    }
  } catch {
    for (const key of unresolved) {
      qualifiedFallbackCache.set(key, { value: null, cachedAt: Date.now() });
      out.set(key, null);
    }
  }

  return out;
}

export async function resolveQualifiedEmojiByNameFallback(name: string, serverName: string): Promise<string | null> {
  const key = `${name}~${serverName}`;
  const results = await resolveQualifiedEmojisByNameFallback([key]);
  return results.get(key) ?? null;
}

const CUSTOM_EMOJI_TOKEN_PATTERN = /:([a-z0-9_]{2,12})(?:~([^:]{1,64}))?:/g;

/**
 * Convert visible custom emoji text tokens into transport-safe inline tokens
 * right before sending message content:
 *   :name:            -> :ce[name|file_path]:
 *   :name~ServerName: -> :ce[name|file_path]:
 *
 * Unresolvable tokens are kept as-is.
 */
export async function encodeCustomEmojisForTransport(content: string): Promise<string> {
  if (!content || content.indexOf(":") === -1) return content;

  const names = new Set<string>();
  const qualified = new Set<string>();

  let m: RegExpExecArray | null;
  CUSTOM_EMOJI_TOKEN_PATTERN.lastIndex = 0;
  while ((m = CUSTOM_EMOJI_TOKEN_PATTERN.exec(content)) !== null) {
    const name = m[1];
    const server = m[2];
    if (server) {
      qualified.add(`${name}~${server}`);
    } else {
      names.add(name);
    }
  }

  if (names.size === 0 && qualified.size === 0) return content;

  try {
    const filePathByKey = new Map<string, string>();
    const rows = await fetchEmojiRenderVariantsByNames(Array.from(names));
    if (rows) {
      for (const row of rows) {
        if (!row?.name || !row?.file_path) continue;
        if (!filePathByKey.has(row.name)) {
          filePathByKey.set(row.name, row.file_path);
        }
      }
    }
    const qualifiedRows = await fetchEmojiRenderVariantsByQualifiedKeys(Array.from(qualified));
    for (const [key, filePath] of qualifiedRows) {
      if (!filePathByKey.has(key)) {
        filePathByKey.set(key, filePath);
      }
    }

    return content.replace(CUSTOM_EMOJI_TOKEN_PATTERN, (full, name: string, server?: string) => {
      const key = server ? `${name}~${server}` : name;
      const filePath = filePathByKey.get(key);
      if (!filePath) return full;
      return `:ce[${name}|${filePath}]:`;
    });
  } catch {
    return content;
  }
}

