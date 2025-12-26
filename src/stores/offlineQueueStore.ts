import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface QueuedMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  replyToId?: string;
  createdAt: string;
}

interface OfflineQueueState {
  queuedMessages: QueuedMessage[];
  addToQueue: (message: Omit<QueuedMessage, 'id' | 'createdAt'>) => string;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  getQueuedForChannel: (channelId: string) => QueuedMessage[];
}

export const useOfflineQueueStore = create<OfflineQueueState>()(
  persist(
    (set, get) => ({
      queuedMessages: [],

      addToQueue: (message) => {
        const id = `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const queuedMessage: QueuedMessage = {
          ...message,
          id,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          queuedMessages: [...state.queuedMessages, queuedMessage],
        }));
        return id;
      },

      removeFromQueue: (id) => {
        set((state) => ({
          queuedMessages: state.queuedMessages.filter((m) => m.id !== id),
        }));
      },

      clearQueue: () => set({ queuedMessages: [] }),

      getQueuedForChannel: (channelId) => {
        return get().queuedMessages.filter((m) => m.channelId === channelId);
      },
    }),
    {
      name: 'kloak-offline-queue',
    }
  )
);
