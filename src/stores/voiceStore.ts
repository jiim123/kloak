import { create } from "zustand";
import type { Channel } from "@/types";

export type VoiceParticipantMeta = {
  isMuted: boolean;
  isDeafened: boolean;
};

type VoicePresenceState = {
  presenceByChannel: Record<string, string[]>;
  /** Per-user voice state (muted/deafened) keyed by `channelId:userId` */
  participantMeta: Record<string, VoiceParticipantMeta>;
  joinedChannelId: string | null;
  joinedChannel: Channel | null;
  connection: { channelId: string | null; status: "idle" | "joining" | "joined" | "error"; error: string | null };
  controls: { muted: boolean; deafened: boolean };
  setPresence: (channelId: string, userIds: string[]) => void;
  setParticipantMeta: (channelId: string, meta: Record<string, VoiceParticipantMeta>) => void;
  clearPresence: (channelId: string) => void;
  setJoinedChannelId: (channelId: string | null) => void;
  setJoinedChannel: (channel: Channel | null) => void;
  setConnection: (next: Partial<VoicePresenceState["connection"]> & { channelId: string | null }) => void;
  setControls: (next: Partial<VoicePresenceState["controls"]>) => void;
};

export const useVoiceStore = create<VoicePresenceState>((set) => ({
  presenceByChannel: {},
  participantMeta: {},
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
  setParticipantMeta: (channelId, meta) =>
    set((state) => {
      const next = { ...state.participantMeta };
      // Clear old entries for this channel
      for (const key of Object.keys(next)) {
        if (key.startsWith(channelId + ":")) delete next[key];
      }
      // Set new entries
      for (const [userId, m] of Object.entries(meta)) {
        next[`${channelId}:${userId}`] = m;
      }
      return { participantMeta: next };
    }),
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

