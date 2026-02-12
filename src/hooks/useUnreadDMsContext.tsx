import { createContext, useContext } from 'react';

interface UnreadDMsContextValue {
  getUnreadCount: (conversationId: string) => number;
  markAsRead: (conversationId: string) => Promise<void>;
  incrementUnread: (conversationId: string) => void;
  totalUnread: number;
  hasUnread: boolean;
  refetch: (opts?: { force?: boolean }) => Promise<void>;
}

export const UnreadDMsContext = createContext<UnreadDMsContextValue | null>(null);

export const useUnreadDMsContext = (): UnreadDMsContextValue => {
  const ctx = useContext(UnreadDMsContext);
  if (!ctx) {
    // Fallback no-ops if used outside provider (shouldn't happen in practice)
    return {
      getUnreadCount: () => 0,
      markAsRead: async () => {},
      incrementUnread: () => {},
      totalUnread: 0,
      hasUnread: false,
      refetch: async () => {},
    };
  }
  return ctx;
};
