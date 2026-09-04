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
  /** Living room seat assignments keyed by `channelId:userId` → seatId */
  seatAssignments: Record<string, string>;
  joinedChannelId: string | null;
  joinedChannel: Channel | null;
  connection: { channelId: string | null; status: "idle" | "joining" | "joined" | "error"; error: string | null };
  controls: { muted: boolean; deafened: boolean };
  setPresence: (channelId: string, userIds: string[]) => void;
  setParticipantMeta: (channelId: string, meta: Record<string, VoiceParticipantMeta>) => void;
  clearPresence: (channelId: string) => void;
  /** Set or clear a user's seat assignment. Pass `null` to clear. */
  setSeatAssignment: (channelId: string, userId: string, seatId: string | null) => void;
  /** Bulk-set seat assignments for a channel (from broadcast sync). */
  setBulkSeatAssignments: (channelId: string, assignments: Record<string, string>) => void;
  /** Clear all seat assignments for a channel. */
  clearSeatAssignments: (channelId: string) => void;
  setJoinedChannelId: (channelId: string | null) => void;
  setJoinedChannel: (channel: Channel | null) => void;
  setConnection: (next: Partial<VoicePresenceState["connection"]> & { channelId: string | null }) => void;
  setControls: (next: Partial<VoicePresenceState["controls"]>) => void;
};

export const useVoiceStore = create<VoicePresenceState>((set) => ({
  presenceByChannel: {},
  participantMeta: {},
  seatAssignments: {},
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
  setSeatAssignment: (channelId, userId, seatId) =>
    set((state) => {
      const key = `${channelId}:${userId}`;
      const next = { ...state.seatAssignments };
      if (seatId === null) {
        delete next[key];
      } else {
        next[key] = seatId;
      }
      return { seatAssignments: next };
    }),
  setBulkSeatAssignments: (channelId, assignments) =>
    set((state) => {
      const next = { ...state.seatAssignments };
      // Clear old entries for this channel
      for (const k of Object.keys(next)) {
        if (k.startsWith(channelId + ":")) delete next[k];
      }
      // Set new entries
      for (const [userId, seatId] of Object.entries(assignments)) {
        next[`${channelId}:${userId}`] = seatId;
      }
      return { seatAssignments: next };
    }),
  clearSeatAssignments: (channelId) =>
    set((state) => {
      const next = { ...state.seatAssignments };
      for (const k of Object.keys(next)) {
        if (k.startsWith(channelId + ":")) delete next[k];
      }
      return { seatAssignments: next };
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

