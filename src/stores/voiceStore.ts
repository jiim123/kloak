import { create } from "zustand";
import type { Channel } from "@/types";

type VoicePresenceState = {
  presenceByChannel: Record<string, string[]>;
  joinedChannelId: string | null;
  joinedChannel: Channel | null;
  connection: { channelId: string | null; status: "idle" | "joining" | "joined" | "error"; error: string | null };
  controls: { muted: boolean; deafened: boolean };
  setPresence: (channelId: string, userIds: string[]) => void;
  clearPresence: (channelId: string) => void;
  setJoinedChannelId: (channelId: string | null) => void;
  setJoinedChannel: (channel: Channel | null) => void;
  setConnection: (next: Partial<VoicePresenceState["connection"]> & { channelId: string | null }) => void;
  setControls: (next: Partial<VoicePresenceState["controls"]>) => void;
};

export const useVoiceStore = create<VoicePresenceState>((set) => ({
  presenceByChannel: {},
  joinedChannelId: null,
  joinedChannel: null,
  connection: { channelId: null, status: "idle", error: null },
  controls: { muted: false, deafened: false },
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
  setJoinedChannel: (channel) => set({ joinedChannel: channel }),
  setConnection: (next) =>
    set((state) => ({
      connection: {
        ...state.connection,
        ...next,
      },
    })),
  setControls: (next) =>
    set((state) => ({
      controls: {
        ...state.controls,
        ...next,
      },
    })),
}));

