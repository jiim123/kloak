import { create } from "zustand";

type VoicePresenceState = {
  presenceByChannel: Record<string, string[]>;
  joinedChannelId: string | null;
  connection: { channelId: string | null; status: "idle" | "joining" | "joined" | "error"; error: string | null };
  setPresence: (channelId: string, userIds: string[]) => void;
  clearPresence: (channelId: string) => void;
  setJoinedChannelId: (channelId: string | null) => void;
  setConnection: (next: Partial<VoicePresenceState["connection"]> & { channelId: string | null }) => void;
};

export const useVoiceStore = create<VoicePresenceState>((set) => ({
  presenceByChannel: {},
  joinedChannelId: null,
  connection: { channelId: null, status: "idle", error: null },
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
  setJoinedChannelId: (channelId) => set({ joinedChannelId: channelId }),
  setConnection: (next) =>
    set((state) => ({
      connection: {
        ...state.connection,
        ...next,
      },
    })),
}));

