import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ActiveEmbed {
  id: string; // unique identifier (url-based)
  url: string;
  type: 'twitch-channel' | 'twitch-video' | 'twitch-clip' | 'kick-channel' | 'kick-video';
  channelOrVideoId: string;
  messageId: string;
  channelId: string; // the chat channel this embed belongs to
}

interface EmbedStore {
  activeEmbeds: ActiveEmbed[];
  hiddenEmbedMessages: string[]; // messageIds where embeds are hidden (array for persistence)
  addEmbed: (embed: ActiveEmbed) => void;
  removeEmbed: (id: string) => void;
  getEmbedForMessage: (messageId: string, url: string) => ActiveEmbed | undefined;
  clearEmbedsForChannel: (channelId: string) => void;
  hideEmbedsForMessage: (messageId: string) => void;
  showEmbedsForMessage: (messageId: string) => void;
  isMessageEmbedHidden: (messageId: string) => boolean;
}

export const useEmbedStore = create<EmbedStore>()(
  persist(
    (set, get) => ({
      activeEmbeds: [],
      hiddenEmbedMessages: [],
      
      addEmbed: (embed) => {
        const { activeEmbeds } = get();
        // Don't add duplicates
        if (activeEmbeds.some(e => e.id === embed.id)) return;
        set({ activeEmbeds: [...activeEmbeds, embed] });
      },
      
      removeEmbed: (id) => {
        set({ activeEmbeds: get().activeEmbeds.filter(e => e.id !== id) });
      },
      
      getEmbedForMessage: (messageId, url) => {
        return get().activeEmbeds.find(e => e.messageId === messageId && e.url === url);
      },
      
      clearEmbedsForChannel: (channelId) => {
        set({ activeEmbeds: get().activeEmbeds.filter(e => e.channelId !== channelId) });
      },
      
      hideEmbedsForMessage: (messageId) => {
        const { hiddenEmbedMessages } = get();
        if (!hiddenEmbedMessages.includes(messageId)) {
          set({ hiddenEmbedMessages: [...hiddenEmbedMessages, messageId] });
        }
      },
      
      showEmbedsForMessage: (messageId) => {
        set({ hiddenEmbedMessages: get().hiddenEmbedMessages.filter(id => id !== messageId) });
      },
      
      isMessageEmbedHidden: (messageId) => {
        return get().hiddenEmbedMessages.includes(messageId);
      },
    }),
    {
      name: 'kloak-hidden-embeds',
      partialize: (state) => ({ hiddenEmbedMessages: state.hiddenEmbedMessages }),
    }
  )
);
