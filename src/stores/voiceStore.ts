import { create } from "zustand";

type VoicePresenceState = {
  presenceByChannel: Record<string, string[]>;
  setPresence: (channelId: string, userIds: string[]) => void;
  clearPresence: (channelId: string) => void;
};

export const useVoiceStore = create<VoicePresenceState>((set) => ({
  presenceByChannel: {},
  setPresence: (channelId, userIds) =>
    set((state) => ({
      presenceByChannel: {
        ...state.presenceByChannel,
        [channelId]: Array.from(new Set(userIds)).sort(),
      },
    })),
  clearPresence: (channelId) =>
    set((state) => {
      if (!state.presenceByChannel[channelId]) return state;
      const next = { ...state.presenceByChannel };
      delete next[channelId];
      return { presenceByChannel: next };
    }),
}));

