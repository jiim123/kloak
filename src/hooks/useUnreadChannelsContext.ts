import { createContext, useContext } from "react";
import { useUnread } from "./useUnread";
import type { ServerUnreadSummary } from "./useServerUnreadSummary";

export type UnreadChannelsApi = ReturnType<typeof useUnread>;

export interface UnreadChannelsContextValue extends UnreadChannelsApi {
  /**
   * Map of server_id -> channel_id[]
   * Used for per-server unread badges and "mark server as read".
   */
  serverChannels: Record<string, string[]>;
  /** Map of server_id -> aggregate unread/mention state fetched without opening each server. */
  serverUnreadSummary: Record<string, ServerUnreadSummary>;
  /** Flattened channel IDs used by `useUnread()` */
  allChannelIds: string[];
}

export const UnreadChannelsContext = createContext<UnreadChannelsContextValue | null>(null);

export function useUnreadChannelsContext(): UnreadChannelsContextValue {
  const ctx = useContext(UnreadChannelsContext);
  if (!ctx) {
    throw new Error("useUnreadChannelsContext must be used within an UnreadChannelsContext.Provider");
  }
  return ctx;
}

