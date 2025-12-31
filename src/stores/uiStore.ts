import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// All available themes
export const THEMES = [
  { id: 'default', name: 'Default', description: 'Orange/Amber brand dark theme' },
  { id: 'nostalgia', name: 'Nostalgia', description: 'Warm, muted, vintage feel' },
  { id: 'lofi', name: 'Lo-fi', description: 'Bold, retro, high contrast anime aesthetic' },
  { id: 'cappuccino', name: 'Cappuccino', description: 'Warm, cozy coffee house aesthetic' },
  { id: 'hokori', name: 'Hokori', description: 'Stark, Japanese-inspired, dramatic minimalism' },
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
  
  // Mobile sidebar states
  isMobileSidebarOpen: boolean;
  isMobileChannelSidebarOpen: boolean;

  // Theme actions
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;

  // Sidebar actions
  toggleMemberSidebar: () => void;
  setMemberSidebarOpen: (open: boolean) => void;
  
  // Mobile sidebar actions
  setMobileSidebarOpen: (open: boolean) => void;
  setMobileChannelSidebarOpen: (open: boolean) => void;
  closeMobileSidebars: () => void;

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
      theme: 'default',
      isMemberSidebarOpen: true,
      isSettingsOpen: false,
      activeModal: null,
      modalData: null,
      linkPreviewsEnabled: true,
      linkPreviewNoticeDismissed: false,
      isMobileSidebarOpen: false,
      isMobileChannelSidebarOpen: false,

      toggleTheme: () => {
        const currentTheme = get().theme;
        const newTheme = currentTheme === 'default' ? 'nostalgia' : 'default';
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

      setMobileSidebarOpen: (open) => {
        set({ isMobileSidebarOpen: open });
      },

      setMobileChannelSidebarOpen: (open) => {
        set({ isMobileChannelSidebarOpen: open });
      },

      closeMobileSidebars: () => {
        set({ isMobileSidebarOpen: false, isMobileChannelSidebarOpen: false });
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