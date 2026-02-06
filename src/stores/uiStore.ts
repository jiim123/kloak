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
  | 'permission-debug'
  | 'import-discord-template'
  | 'import-emoji-pack'
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
  isServerSettingsOpen: boolean;
  activeModal: ModalType;
  modalData: ModalData | null;
  linkPreviewsEnabled: boolean;
  linkPreviewNoticeDismissed: boolean;

  // Mobile sidebar states
  isMobileSidebarOpen: boolean;
  isMobileChannelSidebarOpen: boolean;

  // Notification preferences
  desktopNotificationsEnabled: boolean;
  browserNotificationsEnabled: boolean;
  notificationSoundEnabled: boolean;
  notificationSoundServerMentions: boolean;
  notificationSoundUserMentions: boolean;
  notificationSoundReplies: boolean;
  notificationVolume: number;
  showMessagePreview: boolean;
  showPreviewServerMentions: boolean;
  showPreviewUserMentions: boolean;
  showPreviewReplies: boolean;

  // Message display preferences
  compactMode: boolean;
  showTimestamps: boolean;
  animateEmojis: boolean;

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
  openServerSettings: () => void;
  openServerSettingsPage: () => void;
  closeServerSettings: () => void;

  // Link preview actions
  setLinkPreviewsEnabled: (enabled: boolean) => void;
  dismissLinkPreviewNotice: () => void;

  // Notification preference actions
  setDesktopNotificationsEnabled: (enabled: boolean) => void;
  setBrowserNotificationsEnabled: (enabled: boolean) => void;
  setNotificationSoundEnabled: (enabled: boolean) => void;
  setNotificationSoundServerMentions: (enabled: boolean) => void;
  setNotificationSoundUserMentions: (enabled: boolean) => void;
  setNotificationSoundReplies: (enabled: boolean) => void;
  setNotificationVolume: (volume: number) => void;
  setShowMessagePreview: (enabled: boolean) => void;
  setShowPreviewServerMentions: (enabled: boolean) => void;
  setShowPreviewUserMentions: (enabled: boolean) => void;
  setShowPreviewReplies: (enabled: boolean) => void;

  // Message display preference actions
  setCompactMode: (enabled: boolean) => void;
  setShowTimestamps: (enabled: boolean) => void;
  setAnimateEmojis: (enabled: boolean) => void;
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
      isServerSettingsOpen: false,
      activeModal: null,
      modalData: null,
      linkPreviewsEnabled: true,
      linkPreviewNoticeDismissed: false,
      isMobileSidebarOpen: false,
      isMobileChannelSidebarOpen: false,

      // Notification preferences
      desktopNotificationsEnabled: true,
      browserNotificationsEnabled: true,
      notificationSoundEnabled: true,
      notificationSoundServerMentions: true,
      notificationSoundUserMentions: true,
      notificationSoundReplies: true,
      notificationVolume: 50,
      showMessagePreview: true,
      showPreviewServerMentions: true,
      showPreviewUserMentions: true,
      showPreviewReplies: true,

      // Message display preferences
      compactMode: false,
      showTimestamps: true,
      animateEmojis: true,

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
        // Close server settings and mobile sidebars when opening user-settings to prevent stacking
        if (modal === 'user-settings') {
          set({ activeModal: modal, modalData: data, isServerSettingsOpen: false, isSettingsOpen: true, isMobileSidebarOpen: false, isMobileChannelSidebarOpen: false });
        } else if (modal === 'edit-channel' || modal === 'create-channel') {
          // Close mobile sidebars when opening channel modals so they appear on top
          set({ activeModal: modal, modalData: data, isMobileSidebarOpen: false, isMobileChannelSidebarOpen: false });
        } else {
          set({ activeModal: modal, modalData: data });
        }
      },

      closeModal: () => {
        set({ activeModal: null, modalData: null });
      },

      openSettings: () => {
        // Close server settings and mobile sidebars when opening user settings to prevent stacking
        set({ isSettingsOpen: true, isServerSettingsOpen: false, activeModal: 'user-settings', isMobileSidebarOpen: false, isMobileChannelSidebarOpen: false });
      },

      closeSettings: () => {
        set({ isSettingsOpen: false, activeModal: null });
      },

      openServerSettings: () => {
        // Close user settings when opening server settings to prevent stacking
        // Set activeModal to 'server-settings' so the modal works on mobile
        set({ isServerSettingsOpen: true, isSettingsOpen: false, activeModal: 'server-settings' });
      },

      openServerSettingsPage: () => {
        // Desktop-only: open the server settings page without triggering the modal
        set({ isServerSettingsOpen: true, isSettingsOpen: false, activeModal: null });
      },

      closeServerSettings: () => {
        set({ isServerSettingsOpen: false, activeModal: null });
      },

      setLinkPreviewsEnabled: (enabled) => {
        set({ linkPreviewsEnabled: enabled });
      },

      dismissLinkPreviewNotice: () => {
        set({ linkPreviewNoticeDismissed: true });
      },

      // Notification preference actions
      setDesktopNotificationsEnabled: (enabled) => {
        set({ desktopNotificationsEnabled: enabled });
      },

      setBrowserNotificationsEnabled: (enabled) => {
        set({ browserNotificationsEnabled: enabled });
      },

      setNotificationSoundEnabled: (enabled) => {
        set({ notificationSoundEnabled: enabled });
      },

      setNotificationSoundServerMentions: (enabled) => {
        set({ notificationSoundServerMentions: enabled });
      },

      setNotificationSoundUserMentions: (enabled) => {
        set({ notificationSoundUserMentions: enabled });
      },

      setNotificationSoundReplies: (enabled) => {
        set({ notificationSoundReplies: enabled });
      },

      setNotificationVolume: (volume) => {
        set({ notificationVolume: Math.max(0, Math.min(100, volume)) });
      },

      setShowMessagePreview: (enabled) => {
        set({ showMessagePreview: enabled });
      },

      setShowPreviewServerMentions: (enabled) => {
        set({ showPreviewServerMentions: enabled });
      },

      setShowPreviewUserMentions: (enabled) => {
        set({ showPreviewUserMentions: enabled });
      },

      setShowPreviewReplies: (enabled) => {
        set({ showPreviewReplies: enabled });
      },

      // Message display preference actions
      setCompactMode: (enabled) => {
        set({ compactMode: enabled });
      },

      setShowTimestamps: (enabled) => {
        set({ showTimestamps: enabled });
      },

      setAnimateEmojis: (enabled) => {
        set({ animateEmojis: enabled });
      },
    }),
    {
      name: 'kloak-ui',
      partialize: (state) => ({
        theme: state.theme,
        isMemberSidebarOpen: state.isMemberSidebarOpen,
        linkPreviewsEnabled: state.linkPreviewsEnabled,
        linkPreviewNoticeDismissed: state.linkPreviewNoticeDismissed,
        desktopNotificationsEnabled: state.desktopNotificationsEnabled,
        browserNotificationsEnabled: state.browserNotificationsEnabled,
        notificationSoundEnabled: state.notificationSoundEnabled,
        notificationSoundServerMentions: state.notificationSoundServerMentions,
        notificationSoundUserMentions: state.notificationSoundUserMentions,
        notificationSoundReplies: state.notificationSoundReplies,
        notificationVolume: state.notificationVolume,
        showMessagePreview: state.showMessagePreview,
        showPreviewServerMentions: state.showPreviewServerMentions,
        showPreviewUserMentions: state.showPreviewUserMentions,
        showPreviewReplies: state.showPreviewReplies,
        compactMode: state.compactMode,
        showTimestamps: state.showTimestamps,
        animateEmojis: state.animateEmojis,
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
