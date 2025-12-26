import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';
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

const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
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
        const newTheme = get().theme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
        set({ theme: newTheme });
      },

      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
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
