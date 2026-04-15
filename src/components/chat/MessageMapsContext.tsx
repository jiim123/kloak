import { createContext, useContext, useMemo } from "react";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";

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
  currentUserId: string | undefined;
}

const EMPTY_USERS_MAP = new Map<string, UserInfo>();
const EMPTY_CHANNELS_MAP = new Map<string, ChannelInfo>();
const EMPTY_MEMBER_NAME_MAP = new Map<string, string>();

const defaultValue: MessageMapsContextValue = {
  usersMap: EMPTY_USERS_MAP,
  channelsMap: EMPTY_CHANNELS_MAP,
  memberNameById: EMPTY_MEMBER_NAME_MAP,
  currentUserId: undefined,
};

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
  children,
}: {
  isDM?: boolean;
  children: React.ReactNode;
}) {
  const members = useServerStore((s) => s.members);
  const channels = useServerStore((s) => s.channels);
  const userId = useAuthStore((s) => s.user?.id);

  const value = useMemo<MessageMapsContextValue>(() => {
    if (isDM) {
      return {
        usersMap: EMPTY_USERS_MAP,
        channelsMap: EMPTY_CHANNELS_MAP,
        memberNameById: EMPTY_MEMBER_NAME_MAP,
        currentUserId: userId,
      };
    }

    // Build usersMap from members
    const usersMap = new Map<string, UserInfo>();
    const memberNameById = new Map<string, string>();

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

    return { usersMap, channelsMap, memberNameById, currentUserId: userId };
  }, [members, channels, userId, isDM]);

  return (
    <MessageMapsContext.Provider value={value}>
      {children}
    </MessageMapsContext.Provider>
  );
}
