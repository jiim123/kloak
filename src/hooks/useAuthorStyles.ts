import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import type { CustomServerRole, ServerRole } from "@/types";

const AUTHOR_STYLE_FETCH_CHUNK = 100;
const AUTHOR_STYLE_CACHE_TTL_MS = 5 * 60_000;
const AUTHOR_STYLE_STORAGE_PREFIX = "kloak:author-styles:";

type CachedAuthorStyleEntry = {
  cachedAt: number;
  style: AuthorStyle | null;
};

const authorStyleCacheByServer = new Map<string, Map<string, CachedAuthorStyleEntry>>();
const inflightAuthorStyleFetches = new Map<string, Promise<Record<string, AuthorStyle>>>();

export interface AuthorStyle {
  user_id: string;
  role?: ServerRole | null;
  nickname?: string | null;
  roles?: CustomServerRole[];
}

const normalizeTargetUserIds = (ids: Array<string | null | undefined>): string[] => {
  const unique = new Set<string>();
  for (const id of ids) {
    if (!id) continue;
    if (id === "anonymous") continue;
    if (id.startsWith("ghost_")) continue;
    unique.add(id);
  }
  return Array.from(unique);
};

const parseRows = (payload: unknown): AuthorStyle[] => {
  let rows: unknown = payload;
  if (typeof rows === "string") {
    try {
      rows = JSON.parse(rows);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(rows)) return [];
  return rows.filter((row): row is AuthorStyle => !!row && typeof row === "object" && "user_id" in row);
};

const getAuthorStyleServerCache = (serverId: string) => {
  let cache = authorStyleCacheByServer.get(serverId);
  if (!cache) {
    cache = new Map<string, CachedAuthorStyleEntry>();
    authorStyleCacheByServer.set(serverId, cache);
  }
  return cache;
};

const readPersistedAuthorStyles = (serverId: string): Map<string, CachedAuthorStyleEntry> | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${AUTHOR_STYLE_STORAGE_PREFIX}${serverId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, CachedAuthorStyleEntry>;
    const now = Date.now();
    const next = new Map<string, CachedAuthorStyleEntry>();
    for (const [userId, entry] of Object.entries(parsed || {})) {
      if (!entry) continue;
      if (now - entry.cachedAt >= AUTHOR_STYLE_CACHE_TTL_MS) continue;
      next.set(userId, entry);
    }
    return next;
  } catch {
    return null;
  }
};

const persistAuthorStyleServerCache = (serverId: string, cache: Map<string, CachedAuthorStyleEntry>) => {
  if (typeof window === "undefined") return;
  try {
    const next: Record<string, CachedAuthorStyleEntry> = {};
    for (const [userId, entry] of cache.entries()) {
      next[userId] = entry;
    }
    window.sessionStorage.setItem(`${AUTHOR_STYLE_STORAGE_PREFIX}${serverId}`, JSON.stringify(next));
  } catch {
    // ignore storage failures
  }
};

const getCachedAuthorStyles = (serverId: string, userIds: string[]): Record<string, AuthorStyle> => {
  let cache = authorStyleCacheByServer.get(serverId);
  if (!cache) {
    const persisted = readPersistedAuthorStyles(serverId);
    if (!persisted) return {};
    authorStyleCacheByServer.set(serverId, persisted);
    cache = persisted;
  }

  const now = Date.now();
  const next: Record<string, AuthorStyle> = {};
  for (const userId of userIds) {
    const entry = cache.get(userId);
    if (!entry) continue;
    if (now - entry.cachedAt >= AUTHOR_STYLE_CACHE_TTL_MS) {
      cache.delete(userId);
      continue;
    }
    if (entry.style) {
      next[userId] = entry.style;
    }
  }
  return next;
};

const hasCachedAuthorStyleEntry = (serverId: string, userId: string): boolean => {
  let cache = authorStyleCacheByServer.get(serverId);
  if (!cache) {
    const persisted = readPersistedAuthorStyles(serverId);
    if (!persisted) return false;
    authorStyleCacheByServer.set(serverId, persisted);
    cache = persisted;
  }

  const entry = cache.get(userId);
  if (!entry) return false;
  if (Date.now() - entry.cachedAt >= AUTHOR_STYLE_CACHE_TTL_MS) {
    cache.delete(userId);
    persistAuthorStyleServerCache(serverId, cache);
    return false;
  }
  return true;
};

const cacheAuthorStyles = (serverId: string, styles: Record<string, AuthorStyle>) => {
  const cache = getAuthorStyleServerCache(serverId);
  const now = Date.now();
  for (const style of Object.values(styles)) {
    cache.set(style.user_id, { style, cachedAt: now });
  }
  persistAuthorStyleServerCache(serverId, cache);
};

const cacheMissingAuthorStyles = (serverId: string, userIds: string[]) => {
  if (userIds.length === 0) return;
  const cache = getAuthorStyleServerCache(serverId);
  const now = Date.now();
  for (const userId of userIds) {
    if (cache.has(userId)) continue;
    cache.set(userId, { style: null, cachedAt: now });
  }
  persistAuthorStyleServerCache(serverId, cache);
};

export const useAuthorStyles = (serverId: string | null | undefined, targetUserIds: Array<string | null | undefined>) => {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const members = useServerStore((s) => s.members);
  const roles = useServerStore((s) => s.roles);
  const [styleMap, setStyleMap] = useState<Record<string, AuthorStyle>>({});

  const rawNormalized = useMemo(() => normalizeTargetUserIds(targetUserIds), [targetUserIds]);
  const normalizedIdsRef = useRef(rawNormalized);
  const normalizedIds = useMemo(() => {
    const prev = normalizedIdsRef.current;
    if (prev.length === rawNormalized.length && prev.every((id, i) => id === rawNormalized[i])) {
      return prev;
    }
    normalizedIdsRef.current = rawNormalized;
    return rawNormalized;
  }, [rawNormalized]);
  const cachedStyleMap = useMemo(
    () => (serverId && normalizedIds.length > 0 ? getCachedAuthorStyles(serverId, normalizedIds) : {}),
    [serverId, normalizedIds],
  );

  useEffect(() => {
    setStyleMap((prev) => {
      if (!serverId || normalizedIds.length === 0) return {};
      const allowedIds = new Set(normalizedIds);
      let changed = false;
      const next: Record<string, AuthorStyle> = {};
      for (const [id, style] of Object.entries(prev)) {
        if (!allowedIds.has(id)) {
          changed = true;
          continue;
        }
        next[id] = style;
      }
      return changed ? next : prev;
    });
  }, [serverId, normalizedIds]);

  const liveStyleMap = useMemo(() => {
    if (!serverId || normalizedIds.length === 0) return {};

    const roleById = new Map(roles.map((role) => [role.id, role]));
    const memberByUserId = new Map(
      members.filter((member) => member.server_id === serverId).map((member) => [member.user_id, member]),
    );

    const next: Record<string, AuthorStyle> = {};
    for (const id of normalizedIds) {
      const member = memberByUserId.get(id);
      if (!member) continue;
      next[id] = {
        user_id: id,
        role: member.role ?? null,
        nickname: member.nickname ?? null,
        roles: (member.roles ?? []).map((role) => roleById.get(role.id) ?? role),
      };
    }

    return next;
  }, [members, normalizedIds, roles, serverId]);

  const missingIds = useMemo(
    () =>
      normalizedIds.filter(
        (id) =>
          !liveStyleMap[id] &&
          !styleMap[id] &&
          !cachedStyleMap[id] &&
          !!serverId &&
          !hasCachedAuthorStyleEntry(serverId, id),
      ),
    [cachedStyleMap, liveStyleMap, normalizedIds, serverId, styleMap],
  );

  useEffect(() => {
    if (!serverId || !userId || missingIds.length === 0) return;

    let cancelled = false;

    const fetchStyles = async () => {
      const fetchKey = `${serverId}:${missingIds.slice().sort().join(",")}`;
      const existingFetch = inflightAuthorStyleFetches.get(fetchKey);
      const fetchPromise = existingFetch ?? (async () => {
        const next: Record<string, AuthorStyle> = {};

        for (let i = 0; i < missingIds.length; i += AUTHOR_STYLE_FETCH_CHUNK) {
          const chunk = missingIds.slice(i, i + AUTHOR_STYLE_FETCH_CHUNK);
          const { data, error } = await (supabase.rpc as unknown as (
            fn: string,
            args: Record<string, unknown>,
          ) => Promise<{ data: unknown; error: unknown }>)("get_message_author_styles_secure", {
            _server_id: serverId,
            _user_id: userId,
            _target_user_ids: chunk,
          });

          if (error) {
            console.error("Failed to fetch author styles:", error);
            return {};
          }

          const rows = parseRows(data);
          for (const row of rows) {
            next[row.user_id] = {
              user_id: row.user_id,
              role: row.role ?? null,
              nickname: row.nickname ?? null,
              roles: Array.isArray(row.roles) ? row.roles : [],
            };
          }
        }

        if (Object.keys(next).length > 0) {
          cacheAuthorStyles(serverId, next);
        }
        const resolvedIds = new Set(Object.keys(next));
        const unresolvedIds = missingIds.filter((id) => !resolvedIds.has(id));
        cacheMissingAuthorStyles(serverId, unresolvedIds);

        return next;
      })();

      if (!existingFetch) {
        inflightAuthorStyleFetches.set(fetchKey, fetchPromise);
      }

      const next = await fetchPromise;

      if (!existingFetch) {
        inflightAuthorStyleFetches.delete(fetchKey);
      }

      if (cancelled || Object.keys(next).length === 0) return;
      setStyleMap((prev) => ({ ...prev, ...next }));
    };

    void fetchStyles().catch((error) => {
      console.error("Unexpected error fetching author styles:", error);
    });

    return () => {
      cancelled = true;
    };
  }, [serverId, userId, missingIds]);

  return useMemo(() => ({ ...cachedStyleMap, ...styleMap, ...liveStyleMap }), [cachedStyleMap, liveStyleMap, styleMap]);
};

