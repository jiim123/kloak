import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import type { CustomServerRole, ServerRole } from "@/types";

const AUTHOR_STYLE_FETCH_CHUNK = 100;

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

export const useAuthorStyles = (serverId: string | null | undefined, targetUserIds: Array<string | null | undefined>) => {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const members = useServerStore((s) => s.members);
  const roles = useServerStore((s) => s.roles);
  const [styleMap, setStyleMap] = useState<Record<string, AuthorStyle>>({});

  const normalizedIds = useMemo(() => normalizeTargetUserIds(targetUserIds), [targetUserIds]);

  useEffect(() => {
    setStyleMap({});
  }, [serverId]);

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
    () => normalizedIds.filter((id) => !liveStyleMap[id] && !styleMap[id]),
    [liveStyleMap, normalizedIds, styleMap],
  );

  useEffect(() => {
    if (!serverId || !userId || missingIds.length === 0) return;

    let cancelled = false;

    const fetchStyles = async () => {
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
          return;
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

  return useMemo(() => ({ ...styleMap, ...liveStyleMap }), [liveStyleMap, styleMap]);
};

