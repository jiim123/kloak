import { supabase } from '@/integrations/supabase/client';

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

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

export function invalidateServerEmojis(serverId: string) {
  cache.delete(serverId);
}

export async function fetchServerEmojis(serverId: string, opts?: { force?: boolean }): Promise<ServerEmoji[]> {
  const force = opts?.force ?? false;
  const now = Date.now();
  const existing = cache.get(serverId);

  if (!force && existing && now - existing.fetchedAt < CACHE_TTL_MS) {
    return existing.items;
  }

  if (!force && existing?.inFlight) {
    return existing.inFlight;
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

    cache.set(serverId, { fetchedAt: Date.now(), items });
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

