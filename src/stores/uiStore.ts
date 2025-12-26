import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// All available themes
export const THEMES = [
  { id: 'dark', name: 'Dark', description: 'Classic dark theme' },
  { id: 'light', name: 'Light', description: 'Clean light theme' },
  { id: 'midnight', name: 'Midnight', description: 'Deep blue night vibes' },
  { id: 'forest', name: 'Forest', description: 'Natural green tones' },
  { id: 'sunset', name: 'Sunset', description: 'Warm orange and amber' },
  { id: 'ocean', name: 'Ocean', description: 'Cool cyan depths' },
  { id: 'lavender', name: 'Lavender', description: 'Soft purple hues' },
] as const;

export type Theme = typeof THEMES[number]['id'];

export type ModalType = 
  | 'create-server'
  | 'join-server'
  | 'server-settings'
  | 'create-channel'
  | 'edit-channel'
  | 'user-settings'
  | 'userProfile'
  | 'invite'
  | 'delete-message'
  | 'leave-server'
  | 'kick-member'
  | 'ban-member'
  | 'quickSwitcher'
  | 'shortcuts'
  | 'pinned-messages'
  | 'search'
  | 'changeNickname'
  | 'confirmAction'
  | null;

interface ModalData {
  serverId?: string;
  channelId?: string;
  userId?: string;
  messageId?: string;
  inviteCode?: string;
  [key: string]: unknown;
}

interface UIState {
  theme: Theme;
  isMemberSidebarOpen: boolean;
  isSettingsOpen: boolean;
  activeModal: ModalType;
  modalData: ModalData | null;
  linkPreviewsEnabled: boolean;
  linkPreviewNoticeDismissed: boolean;

  // Theme actions
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;

  // Sidebar actions
  toggleMemberSidebar: () => void;
  setMemberSidebarOpen: (open: boolean) => void;

  // Modal actions
  openModal: (modal: ModalType, data?: ModalData) => void;
  closeModal: () => void;

  // Settings actions
  openSettings: () => void;
  closeSettings: () => void;

  // Link preview actions
  setLinkPreviewsEnabled: (enabled: boolean) => void;
  dismissLinkPreviewNotice: () => void;
}

export const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  
  // Remove all theme classes
  THEMES.forEach(t => root.classList.remove(t.id));
  
  // Add the new theme class
  root.classList.add(theme);
  
  // Also set data-theme attribute for potential CSS usage
  root.setAttribute('data-theme', theme);
};

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      isMemberSidebarOpen: true,
      isSettingsOpen: false,
      activeModal: null,
      modalData: null,
      linkPreviewsEnabled: true,
      linkPreviewNoticeDismissed: false,

      toggleTheme: () => {
        const currentTheme = get().theme;
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
        set({ theme: newTheme });
      },

      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },

      cycleTheme: () => {
        const currentTheme = get().theme;
        const currentIndex = THEMES.findIndex(t => t.id === currentTheme);
        const nextIndex = (currentIndex + 1) % THEMES.length;
        const newTheme = THEMES[nextIndex].id;
        applyTheme(newTheme);
        set({ theme: newTheme });
      },

      toggleMemberSidebar: () => {
        set((state) => ({ isMemberSidebarOpen: !state.isMemberSidebarOpen }));
      },

      setMemberSidebarOpen: (open) => {
        set({ isMemberSidebarOpen: open });
      },

      openModal: (modal, data = null) => {
        set({ activeModal: modal, modalData: data });
      },

      closeModal: () => {
        set({ activeModal: null, modalData: null });
      },

      openSettings: () => {
        set({ isSettingsOpen: true });
      },

      closeSettings: () => {
        set({ isSettingsOpen: false });
      },

      setLinkPreviewsEnabled: (enabled) => {
        set({ linkPreviewsEnabled: enabled });
      },

      dismissLinkPreviewNotice: () => {
        set({ linkPreviewNoticeDismissed: true });
      },
    }),
    {
      name: 'nomo-ui',
      partialize: (state) => ({
        theme: state.theme,
        isMemberSidebarOpen: state.isMemberSidebarOpen,
        linkPreviewsEnabled: state.linkPreviewsEnabled,
        linkPreviewNoticeDismissed: state.linkPreviewNoticeDismissed,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.theme);
        }
      },
    }
  )
);

// Initialize theme on load
export const initializeTheme = () => {
  const { theme } = useUIStore.getState();
  applyTheme(theme);
};