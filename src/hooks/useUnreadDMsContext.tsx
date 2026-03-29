import { createContext, useContext } from 'react';

interface DMUnreadInfo {
  conversationId: string;
  unreadCount: number;
  lastReadAt: string | null;
}

interface UnreadDMsContextValue {
  getUnreadCount: (conversationId: string) => number;
  markAsRead: (conversationId: string) => Promise<void>;
  incrementUnread: (conversationId: string) => void;
  totalUnread: number;
  hasUnread: boolean;
  refetch: (opts?: { force?: boolean }) => Promise<void>;
  unreadState: Record<string, DMUnreadInfo>;
}

export const UnreadDMsContext = createContext<UnreadDMsContextValue | null>(null);

export const useUnreadDMsContext = (): UnreadDMsContextValue => {
  const ctx = useContext(UnreadDMsContext);
  if (!ctx) {
    return {
      getUnreadCount: () => 0,
      markAsRead: async () => {},
      incrementUnread: () => {},
      totalUnread: 0,
      hasUnread: false,
      refetch: async () => {},
      unreadState: {},
    };
  }
  return ctx;
};
