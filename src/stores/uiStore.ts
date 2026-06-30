import { create } from "zustand";
import { persist } from "zustand/middleware";

// All available themes
export const THEMES = [
  { id: "default", name: "Gray", description: "Original gray dark theme" },
  { id: "amoled", name: "Dark", description: "Pure black theme for OLED displays" },
  { id: "forest", name: "Forest", description: "Pine green sidebars with mossy chat surfaces" },
  { id: "rose", name: "Rose", description: "Deep wine panels with bright candy-pink highlights" },
  { id: "midnight", name: "Midnight", description: "Blue-black chat with royal navy panels" },
  { id: "ocean", name: "Ocean", description: "Deep teal chat with bright aqua highlights" },
  { id: "grape", name: "Grape", description: "Purple-black chat with saturated violet panels" },
  { id: "sunset", name: "Sunset", description: "Warm red-brown panels with orange highlights" },
  { id: "cyber", name: "Cyber", description: "Black and charcoal surfaces with neon green highlights" },
] as const;

export type Theme = (typeof THEMES)[number]["id"];
export type DmPrivacy = "everyone" | "shared_servers" | "friends" | "no_one";

export type ModalType =
  | "create-server"
  | "join-server"
  | "server-settings"
  | "create-channel"
  | "edit-channel"
  | "user-settings"
  | "userProfile"
  | "invite"
  | "delete-message"
  | "leave-server"
  | "kick-member"
  | "ban-member"
  | "quickSwitcher"
  | "shortcuts"
  | "pinned-messages"
  | "search"
  | "changeNickname"
  | "confirmAction"
  | "external-link-warning"
  | "permission-debug"
  | "import-discord-template"
  | "import-emoji-pack"
  | "set-status"
  | "channel-info"
  | null;

interface ModalData {
  serverId?: string;
  channelId?: string;
  userId?: string;
  messageId?: string;
  inviteCode?: string;
  anchorRect?: {
    top: number;
    left: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
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

  // Per-type notification visibility
  enableMentionNotifications: boolean;
  enableDMNotifications: boolean;
  enableFriendRequestNotifications: boolean;
  enableServerInviteNotifications: boolean;

  // Message display preferences
  compactMode: boolean;
  showTimestamps: boolean;
  animateEmojis: boolean;
  dmPrivacy: DmPrivacy;

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

  // Per-type notification visibility actions
  setEnableMentionNotifications: (enabled: boolean) => void;
  setEnableDMNotifications: (enabled: boolean) => void;
  setEnableFriendRequestNotifications: (enabled: boolean) => void;
  setEnableServerInviteNotifications: (enabled: boolean) => void;

  // Message display preference actions
  setCompactMode: (enabled: boolean) => void;
  setShowTimestamps: (enabled: boolean) => void;
  setAnimateEmojis: (enabled: boolean) => void;
  setDmPrivacy: (value: DmPrivacy) => void;
}

export const applyTheme = (theme: Theme) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // Remove all theme classes
  THEMES.forEach((t) => root.classList.remove(t.id));
  root.classList.remove("custom-theme");
  root.removeAttribute("data-custom-theme");

  // Add the new theme class
  root.classList.add(theme);

  // Also set data-theme attribute for potential CSS usage
  root.setAttribute("data-theme", theme);
};

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: "amoled",
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

      // Per-type notification visibility
      enableMentionNotifications: true,
      enableDMNotifications: true,
      enableFriendRequestNotifications: true,
      enableServerInviteNotifications: true,

      // Message display preferences
      compactMode: false,
      showTimestamps: true,
      animateEmojis: true,
      dmPrivacy: "friends",

      toggleTheme: () => {
        const currentTheme = get().theme;
        const newTheme = currentTheme === "amoled" ? "default" : "amoled";
        applyTheme(newTheme);
        set({ theme: newTheme });
      },

      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },

      cycleTheme: () => {
        const currentTheme = get().theme;
        const currentIndex = THEMES.findIndex((t) => t.id === currentTheme);
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
        if (modal === "user-settings") {
          set({
            activeModal: modal,
            modalData: data,
            isServerSettingsOpen: false,
            isSettingsOpen: false,
            isMobileSidebarOpen: false,
            isMobileChannelSidebarOpen: false,
          });
        } else if (modal === "edit-channel" || modal === "create-channel") {
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
        set({
          isSettingsOpen: false,
          isServerSettingsOpen: false,
          activeModal: "user-settings",
          isMobileSidebarOpen: false,
          isMobileChannelSidebarOpen: false,
        });
      },

      closeSettings: () => {
        set({ isSettingsOpen: false, activeModal: null });
      },

      openServerSettings: () => {
        // Close user settings when opening server settings to prevent stacking
        set({
          isServerSettingsOpen: false,
          isSettingsOpen: false,
          activeModal: "server-settings",
          isMobileSidebarOpen: false,
          isMobileChannelSidebarOpen: false,
        });
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

      // Per-type notification visibility actions
      setEnableMentionNotifications: (enabled) => {
        set({ enableMentionNotifications: enabled });
      },
      setEnableDMNotifications: (enabled) => {
        set({ enableDMNotifications: enabled });
      },
      setEnableFriendRequestNotifications: (enabled) => {
        set({ enableFriendRequestNotifications: enabled });
      },
      setEnableServerInviteNotifications: (enabled) => {
        set({ enableServerInviteNotifications: enabled });
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
      setDmPrivacy: (value) => {
        set({ dmPrivacy: value });
      },
    }),
    {
      name: "kloak-ui",
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
        enableMentionNotifications: state.enableMentionNotifications,
        enableDMNotifications: state.enableDMNotifications,
        enableFriendRequestNotifications: state.enableFriendRequestNotifications,
        enableServerInviteNotifications: state.enableServerInviteNotifications,
        compactMode: state.compactMode,
        showTimestamps: state.showTimestamps,
        animateEmojis: state.animateEmojis,
        dmPrivacy: state.dmPrivacy,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Reset removed themes to Dark
          const validThemes = THEMES.map((t) => t.id) as readonly string[];
          if (!validThemes.includes(state.theme)) {
            state.theme = "amoled";
          }
          applyTheme(state.theme);
        }
      },
    },
  ),
);

// Initialize theme on load
export const initializeTheme = () => {
  const { theme } = useUIStore.getState();
  applyTheme(theme);
};
