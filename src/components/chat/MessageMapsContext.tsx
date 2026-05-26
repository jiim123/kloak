import { createContext, useContext, useMemo } from "react";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { getTopEmojis } from "@/lib/emojiRecents";
import type { ServerMember } from "@/types";

export interface UserInfo {
  username: string;
  display_name?: string | null;
  nickname?: string | null;
}

export interface ChannelInfo {
  name: string;
}

export interface MessageMapsContextValue {
  usersMap: Map<string, UserInfo>;
  channelsMap: Map<string, ChannelInfo>;
  memberNameById: Map<string, string>;
  messageMemberByUserId: Map<string, ServerMember>;
  membersList: ServerMember[];
  currentUserId: string | undefined;
  topEmojis: string[];
}

const EMPTY_USERS_MAP = new Map<string, UserInfo>();
const EMPTY_CHANNELS_MAP = new Map<string, ChannelInfo>();
const EMPTY_MEMBER_NAME_MAP = new Map<string, string>();
const EMPTY_MEMBER_BY_USER_ID_MAP = new Map<string, ServerMember>();
const EMPTY_MEMBERS_LIST: ServerMember[] = [];
const EMPTY_TOP_EMOJIS: string[] = [];

const EMPTY_CONTEXT_VALUE: MessageMapsContextValue = {
  usersMap: EMPTY_USERS_MAP,
  channelsMap: EMPTY_CHANNELS_MAP,
  memberNameById: EMPTY_MEMBER_NAME_MAP,
  messageMemberByUserId: EMPTY_MEMBER_BY_USER_ID_MAP,
  membersList: EMPTY_MEMBERS_LIST,
  currentUserId: undefined,
  topEmojis: EMPTY_TOP_EMOJIS,
};

const defaultValue = EMPTY_CONTEXT_VALUE;

export const MessageMapsContext = createContext<MessageMapsContextValue>(defaultValue);

/**
 * Consume pre-built maps from the nearest MessageMapsProvider.
 * Falls back to empty maps if no provider is found (e.g. DM context).
 */
export function useMessageMaps(): MessageMapsContextValue {
  return useContext(MessageMapsContext);
}

/**
 * Provider that builds usersMap, channelsMap, and memberNameById once
 * from the serverStore members/channels arrays, rather than per MessageItem.
 */
export function MessageMapsProvider({
  isDM,
  participants,
  children,
}: {
  isDM?: boolean;
  /** DM/Group participants used to build usersMap when isDM is true. */
  participants?: Array<{
    id: string;
    username: string;
    display_name?: string | null;
  }>;
  children: React.ReactNode;
}) {
  const members = useServerStore((s) => s.members);
  const channels = useServerStore((s) => s.channels);
  const userId = useAuthStore((s) => s.user?.id);

  // Computed once per provider mount, shared across all MessageItems
  const topEmojis = useMemo(() => getTopEmojis(3), []);

  const value = useMemo<MessageMapsContextValue>(() => {
    if (isDM) {
      const usersMap = new Map<string, UserInfo>();
      const memberNameById = new Map<string, string>();
      for (const p of participants || []) {
        usersMap.set(p.id, {
          username: p.username,
          display_name: p.display_name ?? null,
          nickname: null,
        });
        memberNameById.set(p.id, p.display_name || p.username || p.id);
      }
      if (userId) {
        memberNameById.set(userId, "You");
      }
      return {
        usersMap: usersMap.size > 0 ? usersMap : EMPTY_USERS_MAP,
        channelsMap: EMPTY_CHANNELS_MAP,
        memberNameById: memberNameById.size > 0 ? memberNameById : EMPTY_MEMBER_NAME_MAP,
        messageMemberByUserId: EMPTY_MEMBER_BY_USER_ID_MAP,
        membersList: EMPTY_MEMBERS_LIST,
        currentUserId: userId,
        topEmojis,
      };
    }

    // Short-circuit during channel switches to avoid context-value churn
    if (members.length === 0 && channels.length === 0) {
      return {
        ...EMPTY_CONTEXT_VALUE,
        currentUserId: userId,
        topEmojis,
      };
    }

    // Single loop builds all three member-derived maps
    const usersMap = new Map<string, UserInfo>();
    const memberNameById = new Map<string, string>();
    const messageMemberByUserId = new Map<string, ServerMember>();

    for (const m of members) {
      if (m.user) {
        usersMap.set(m.user_id, {
          username: m.user.username,
          display_name: m.user.display_name,
          nickname: m.nickname,
        });
      }
      const name =
        m.nickname ?? m.user?.display_name ?? m.user?.username ?? m.user_id;
      memberNameById.set(m.user_id, name);
      messageMemberByUserId.set(m.user_id, m);
    }

    // Set current user as "You" in memberNameById
    if (userId) {
      memberNameById.set(userId, "You");
    }

    // Build channelsMap
    const channelsMap = new Map<string, ChannelInfo>();
    for (const c of channels) {
      channelsMap.set(c.id, { name: c.name });
    }

    return {
      usersMap,
      channelsMap,
      memberNameById,
      messageMemberByUserId,
      membersList: members,
      currentUserId: userId,
      topEmojis,
    };
  }, [members, channels, userId, isDM, topEmojis, participants]);

  return (
    <MessageMapsContext.Provider value={value}>
      {children}
    </MessageMapsContext.Provider>
  );
}
