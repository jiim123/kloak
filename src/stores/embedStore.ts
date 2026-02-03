import { create } from 'zustand';

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
  hiddenEmbedMessages: Set<string>; // messageIds where embeds are hidden
  addEmbed: (embed: ActiveEmbed) => void;
  removeEmbed: (id: string) => void;
  getEmbedForMessage: (messageId: string, url: string) => ActiveEmbed | undefined;
  clearEmbedsForChannel: (channelId: string) => void;
  hideEmbedsForMessage: (messageId: string) => void;
  showEmbedsForMessage: (messageId: string) => void;
  isMessageEmbedHidden: (messageId: string) => boolean;
}

export const useEmbedStore = create<EmbedStore>((set, get) => ({
  activeEmbeds: [],
  hiddenEmbedMessages: new Set(),
  
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
    const newSet = new Set(get().hiddenEmbedMessages);
    newSet.add(messageId);
    set({ hiddenEmbedMessages: newSet });
  },
  
  showEmbedsForMessage: (messageId) => {
    const newSet = new Set(get().hiddenEmbedMessages);
    newSet.delete(messageId);
    set({ hiddenEmbedMessages: newSet });
  },
  
  isMessageEmbedHidden: (messageId) => {
    return get().hiddenEmbedMessages.has(messageId);
  },
}));
