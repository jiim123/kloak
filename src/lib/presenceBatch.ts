import { supabase } from "@/integrations/supabase/client";

export type PresenceSnapshotRow = {
  id: string;
  status: string | null;
  last_seen: string | null;
};

type CacheEntry = {
  row: PresenceSnapshotRow;
  cachedAt: number;
};

type PendingBatch = {
  ids: Set<string>;
  waiters: Array<{
    ids: string[];
    cachedRows: PresenceSnapshotRow[];
    resolve: (rows: PresenceSnapshotRow[]) => void;
    reject: (error: unknown) => void;
  }>;
  timer: ReturnType<typeof setTimeout> | null;
};

const PRESENCE_BATCH_DELAY_MS = 25;
const PRESENCE_CACHE_TTL_MS = 12_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const cacheByRequester = new Map<string, Map<string, CacheEntry>>();
const pendingByRequester = new Map<string, PendingBatch>();

const normalizeIds = (ids: string[]) =>
  Array.from(new Set(ids.filter((id): id is string => typeof id === "string" && UUID_RE.test(id))));

const getRequesterCache = (requesterId: string) => {
  let cache = cacheByRequester.get(requesterId);
  if (!cache) {
    cache = new Map<string, CacheEntry>();
    cacheByRequester.set(requesterId, cache);
  }
  return cache;
};

const flushPresenceBatch = async (requesterId: string) => {
  const batch = pendingByRequester.get(requesterId);
  if (!batch) return;
  pendingByRequester.delete(requesterId);
  batch.timer = null;

  const ids = Array.from(batch.ids);
  try {
    const { data, error } = await supabase.rpc("get_users_presence_secure", {
      _user_id: requesterId,
      _target_user_ids: ids,
    });

    if (error) throw error;

    const rows = Array.isArray(data) ? (data as PresenceSnapshotRow[]) : [];
    const rowsById = new Map<string, PresenceSnapshotRow>();
    const requesterCache = getRequesterCache(requesterId);
    const now = Date.now();

    for (const row of rows) {
      if (!row?.id) continue;
      rowsById.set(row.id, row);
      requesterCache.set(row.id, { row, cachedAt: now });
    }

    for (const waiter of batch.waiters) {
      const resolvedRows = waiter.ids
        .map((id) => rowsById.get(id) ?? requesterCache.get(id)?.row ?? null)
        .filter((row): row is PresenceSnapshotRow => !!row);
      waiter.resolve([...waiter.cachedRows, ...resolvedRows]);
    }
  } catch (error) {
    for (const waiter of batch.waiters) {
      waiter.reject(error);
    }
  }
};

export function fetchUsersPresence(
  requesterId: string,
  targetUserIds: string[],
): Promise<PresenceSnapshotRow[]> {
  const ids = normalizeIds(targetUserIds).filter((id) => id !== requesterId);
  if (ids.length === 0) return Promise.resolve([]);

  const requesterCache = getRequesterCache(requesterId);
  const now = Date.now();
  const cachedRows: PresenceSnapshotRow[] = [];
  const missingIds: string[] = [];

  for (const id of ids) {
    const cached = requesterCache.get(id);
    if (cached && now - cached.cachedAt < PRESENCE_CACHE_TTL_MS) {
      cachedRows.push(cached.row);
    } else {
      missingIds.push(id);
    }
  }

  if (missingIds.length === 0) {
    return Promise.resolve(cachedRows);
  }

  return new Promise((resolve, reject) => {
    let batch = pendingByRequester.get(requesterId);
    if (!batch) {
      batch = {
        ids: new Set<string>(),
        waiters: [],
        timer: null,
      };
      pendingByRequester.set(requesterId, batch);
    }

    missingIds.forEach((id) => batch.ids.add(id));
    batch.waiters.push({ ids: missingIds, cachedRows, resolve, reject });

    if (!batch.timer) {
      batch.timer = setTimeout(() => {
        void flushPresenceBatch(requesterId);
      }, PRESENCE_BATCH_DELAY_MS);
    }
  });
}

export function clearPresenceCache(requesterId?: string) {
  if (requesterId) {
    cacheByRequester.delete(requesterId);
    return;
  }
  cacheByRequester.clear();
}
