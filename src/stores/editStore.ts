import { create } from "zustand";

export interface EditingMessage {
  id: string;
  /** channelId for server messages, conversationId for DMs */
  channelId: string;
  content: string;
  isDM: boolean;
}

interface EditState {
  editingMessage: EditingMessage | null;
  startEditing: (msg: EditingMessage) => void;
  cancelEditing: () => void;
}

export const useEditStore = create<EditState>((set) => ({
  editingMessage: null,
  startEditing: (msg) => set({ editingMessage: msg }),
  cancelEditing: () => set({ editingMessage: null }),
}));
