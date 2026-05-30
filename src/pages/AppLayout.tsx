import { useEffect, useMemo, useState, useCallback, useRef, Suspense, lazy } from "react";
import { useNavigate, useSearchParams, useLocation, useParams, Outlet } from "react-router-dom";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { Link2, Plus, UserCircle, Users, X } from "lucide-react";
import { useAuthStore, initializeAuth } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { getCachedServerChannelMap, useServerStore } from "@/stores/serverStore";
import { useVoiceStore } from "@/stores/voiceStore";
import { useVoiceSettingsStore } from "@/stores/voiceSettingsStore";
import { fetchAndCacheUser } from "@/stores/userCacheStore";
import { getLastChannel } from "@/lib/storage";
import { ServerSidebar } from "@/components/layout/ServerSidebar";
import { ChannelSidebar } from "@/components/layout/ChannelSidebar";
import { ChatArea } from "@/components/layout/ChatArea";
import { MembersSidebar } from "@/components/layout/MembersSidebar";
import { ServerOverviewView } from "@/components/layout/ServerOverviewView";

import { MobileHeader } from "@/components/layout/MobileHeader";
import { MobileSidebar } from "@/components/layout/MobileSidebar";
import { ConnectionStatus } from "@/components/ui/ConnectionStatus";
import KloakDrawLoader from "@/components/ui/KloakDrawLoader";
import { DMSidebar, DMChatArea, FriendsList } from "@/components/dm";
import { ServerSettingsPage, ChannelSettingsPage } from "@/components/settings";
import { ExploreServers } from "@/components/home/ExploreServers";
import { ServerMembersPage } from "@/components/members/ServerMembersPage";

import { UserSettingsPage } from "@/components/modals/UserSettingsModal";

// Always-mounted modals (have internal form state — lazy for code splitting only)
const ServerSettingsModal = lazy(() => import("@/components/modals/ServerSettingsModal").then(m => ({ default: m.ServerSettingsModal })));
const UserSettingsModal = lazy(() => import("@/components/modals/UserSettingsModal").then(m => ({ default: m.UserSettingsModal })));

// Conditionally-rendered modals (reset state on each open)
const CreateServerModal = lazy(() => import("@/components/modals/CreateServerModal").then(m => ({ default: m.CreateServerModal })));
const JoinServerModal = lazy(() => import("@/components/modals/JoinServerModal").then(m => ({ default: m.JoinServerModal })));
const InviteModal = lazy(() => import("@/components/modals/InviteModal").then(m => ({ default: m.InviteModal })));
const CreateChannelModal = lazy(() => import("@/components/modals/CreateChannelModal").then(m => ({ default: m.CreateChannelModal })));
const EditChannelModal = lazy(() => import("@/components/modals/EditChannelModal").then(m => ({ default: m.EditChannelModal })));
const UserProfilePopup = lazy(() => import("@/components/modals/UserProfilePopup").then(m => ({ default: m.UserProfilePopup })));
const UserProfilePage = lazy(() => import("@/pages/UserProfile"));
const PinnedMessagesPanel = lazy(() => import("@/components/modals/PinnedMessagesPanel").then(m => ({ default: m.PinnedMessagesPanel })));
const SearchModal = lazy(() => import("@/components/modals/SearchModal").then(m => ({ default: m.SearchModal })));
const QuickSwitcherModal = lazy(() => import("@/components/modals/QuickSwitcherModal").then(m => ({ default: m.QuickSwitcherModal })));
const KeyboardShortcutsModal = lazy(() => import("@/components/modals/KeyboardShortcutsModal").then(m => ({ default: m.KeyboardShortcutsModal })));
const ConfirmActionModal = lazy(() => import("@/components/modals/ConfirmActionModal").then(m => ({ default: m.ConfirmActionModal })));
const ChangeNicknameModal = lazy(() => import("@/components/modals/ConfirmActionModal").then(m => ({ default: m.ChangeNicknameModal })));
const ExternalLinkWarningModal = lazy(() => import("@/components/modals/ExternalLinkWarningModal").then(m => ({ default: m.ExternalLinkWarningModal })));
const PermissionDebugPanel = lazy(() => import("@/components/modals/PermissionDebugPanel").then(m => ({ default: m.PermissionDebugPanel })));
const ImportDiscordTemplateModal = lazy(() => import("@/components/modals/ImportDiscordTemplateModal").then(m => ({ default: m.ImportDiscordTemplateModal })));
const ImportEmojiPackModal = lazy(() => import("@/components/modals/ImportEmojiPackModal").then(m => ({ default: m.ImportEmojiPackModal })));
const SetStatusModal = lazy(() => import("@/components/modals/SetStatusModal").then(m => ({ default: m.SetStatusModal })));
const ChannelInfoModal = lazy(() => import("@/components/chat/ChannelInfoModal").then(m => ({ default: m.ChannelInfoModal })));
import { PersistentEmbedContainer } from "@/components/chat/PersistentEmbedContainer";
import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { VoicePersistentHost } from "@/components/voice/VoicePersistentHost";
import { cn } from "@/lib/utils";
import { useDMStore } from "@/stores/dmStore";
import { useFriendStore } from "@/stores/friendStore";
import { supabase } from "@/integrations/supabase/client";
import {
  usePresence,
  useRealtimeFriendships,
  useRealtimeUsers,
  useRealtimeServer,
  useRealtimeNotifications,
  useRealtimeDMs,
  useUnreadDMs,
  useRealtimeMessages,
  useTauriNotificationActions,
  useRealtimeOwnMembership,
  useRealtimeServerEmojis,
} from "@/hooks";
import { UnreadDMsContext } from "@/hooks/useUnreadDMsContext";
import { UnreadChannelsContext } from "@/hooks/useUnreadChannelsContext";
import { useUnread } from "@/hooks/useUnread";
import { useServerUnreadSummary } from "@/hooks/useServerUnreadSummary";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBackgroundSync } from "@/hooks/useBackgroundSync";
import { usePreferencesSync } from "@/hooks/usePreferencesSync";
import type { Channel, User } from "@/types";
import { PresenceDebugOverlay } from "@/components/debug/PresenceDebugOverlay";
import { SEO } from "@/components/seo";
import { getAuthEntryPath, resizeWindowForApp } from "@/lib/tauriRuntime";
import { MAINTENANCE_MODE } from "@/lib/maintenance";
import { AlphaNoticeBanner } from "@/components/layout/AlphaNoticeBanner";
import { ChannelHeader } from "@/components/chat/ChannelHeader";

const addServerPanelTransition = {
  type: "spring" as const,
  stiffness: 360,
  damping: 34,
  mass: 0.9,
};

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  // Mask server/channel/DM IDs from the URL bar for privacy
  useEffect(() => {
    if (location.pathname.startsWith('/app') && location.pathname !== '/app' && !location.pathname.startsWith('/app/profiles/')) {
      window.history.replaceState(null, '', '/app');
    }
  }, [location.pathname, location.search]);
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const { loadSettings: loadVoiceSettings } = useVoiceSettingsStore();
  const isMemberSidebarOpen = useUIStore((s) => s.isMemberSidebarOpen);
  const isServerSettingsOpen = useUIStore((s) => s.isServerSettingsOpen);
  const closeMobileSidebars = useUIStore((s) => s.closeMobileSidebars);
  const activeModal = useUIStore((s) => s.activeModal);
  const openModal = useUIStore((s) => s.openModal);
  const currentServer = useServerStore((s) => s.currentServer);
  const currentChannel = useServerStore((s) => s.currentChannel);
  const setCurrentChannel = useServerStore((s) => s.setCurrentChannel);
  const setCurrentServer = useServerStore((s) => s.setCurrentServer);
  const fetchChannels = useServerStore((s) => s.fetchChannels);
  const servers = useServerStore((s) => s.servers);
  const channels = useServerStore((s) => s.channels);
  const conversations = useDMStore((s) => s.conversations);
  const currentConversation = useDMStore((s) => s.currentConversation);
  const setCurrentConversation = useDMStore((s) => s.setCurrentConversation);
  const fetchConversations = useDMStore((s) => s.fetchConversations);
  const fetchFriends = useFriendStore((s) => s.fetchFriends);
  const pendingFriendRequestCount = useFriendStore((s) => s.pendingRequests.length);
  const isMobileRaw = useIsMobile();
  const joinedVoiceChannelId = useVoiceStore((s) => s.joinedChannelId);
  const authEntryPath = getAuthEntryPath();
  const [lockedLayoutIsMobile, setLockedLayoutIsMobile] = useState<boolean | null>(null);
  const [isAddServerPanelOpen, setIsAddServerPanelOpen] = useState(false);
  const activeVoiceTextChannelId = useMemo(() => {
    if (currentChannel?.type !== "voice") return null;
    return channels.find((channel) => channel.linked_voice_channel_id === currentChannel.id)?.id ?? null;
  }, [channels, currentChannel?.id, currentChannel?.type]);
  const { hasPermission } = useMemberPermissions();

  // Keep the active layout mode stable while connected to voice.
  // This prevents VoicePersistentHost from unmounting during window state/size changes.
  useEffect(() => {
    if (joinedVoiceChannelId) {
      setLockedLayoutIsMobile((prev) => (prev === null ? isMobileRaw : prev));
      return;
    }
    setLockedLayoutIsMobile(null);
  }, [joinedVoiceChannelId, isMobileRaw]);

  const isMobile = lockedLayoutIsMobile ?? isMobileRaw;

  // Determine current view based on route
  const currentPath = location.pathname.replace("/app", "") || "/";
  const isServerOverviewView = !!params.serverId && currentPath === `/servers/${params.serverId}/overview`;
  const isServerMembersView = !!params.serverId && currentPath === `/servers/${params.serverId}/members`;
  const isProfileView = !!params.userId && currentPath === `/profiles/${params.userId}`;
  
  const isServerSpecialView = isServerOverviewView || isServerMembersView;
  const currentChannelType = currentChannel?.type;
  const canUseUnifiedHeader =
    currentChannelType !== "voice";
  const showDesktopUnifiedChannelHeader =
    !isMobile && currentServer !== null && !isServerSpecialView && !isProfileView && canUseUnifiedHeader && Boolean(currentChannel);
  const overviewHeaderChannel: Channel | null = useMemo(() => {
    if (!currentServer) return null;
    return {
      id: `overview-${currentServer.id}`,
      server_id: currentServer.id,
      category_id: null,
      linked_voice_channel_id: null,
      name: "Overview",
      topic: null,
      chat_notice: null,
      type: "text",
      position: -1,
      is_nsfw: false,
      slowmode_seconds: 0,
      is_read_only: false,
      is_private: false,
      icon: null,
      created_at: currentServer.created_at || new Date().toISOString(),
      block_links: false,
      allowed_link_domains: [],
      ghost_mode: false,
      block_attachments: false,
      disable_reactions: false,
      disable_polls: false,
      auto_delete_seconds: null,
    };
  }, [currentServer]);
  const membersHeaderChannel: Channel | null = useMemo(() => {
    if (!currentServer) return null;
    return {
      id: `members-${currentServer.id}`,
      server_id: currentServer.id,
      category_id: null,
      linked_voice_channel_id: null,
      name: "Members",
      topic: null,
      chat_notice: null,
      type: "text",
      position: -1,
      is_nsfw: false,
      slowmode_seconds: 0,
      is_read_only: false,
      is_private: false,
      icon: null,
      created_at: currentServer.created_at || new Date().toISOString(),
      block_links: false,
      allowed_link_domains: [],
      ghost_mode: false,
      block_attachments: false,
      disable_reactions: false,
      disable_polls: false,
      auto_delete_seconds: null,
    };
  }, [currentServer]);

  // Extract serverId and channelId from URL params
  const urlServerId = params.serverId;
  const urlChannelId = params.channelId;

  // Handle native notification click deep-links in Tauri.
  useTauriNotificationActions();

  // Ensure Supabase Realtime websocket is connected early (helps avoid TIMED_OUT joins in some envs).
  useEffect(() => {
    try {
      (supabase as any).realtime?.connect?.();
    } catch {
      // ignore
    }
  }, []);

  // Handle conversation query parameter for DM notification redirects
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  useEffect(() => {
    const conversationId = searchParams.get("conversation");
    if (conversationId && user) {
      // Clear the query param
      setSearchParams({}, { replace: true });

      // Clear current server to switch to DM view
      setCurrentServer(null);

      // Find the conversation in the current list (via ref to avoid dep)
      const existingConversation = conversationsRef.current.find((c) => c.id === conversationId);

      if (existingConversation) {
        setCurrentConversation(existingConversation);
        navigate("/app", { replace: true });
      } else {
        // Fetch conversations first, then find and set the target
        fetchConversations(user.id).then(() => {
          // After fetching, find the conversation
          const conv = useDMStore.getState().conversations.find((c) => c.id === conversationId);
          if (conv) {
            setCurrentConversation(conv);
            navigate("/app", { replace: true });
          } else {
            // Conversation not found in list, try to fetch participants to build it
            supabase
              .rpc("get_dm_other_participant" as any, {
                _conversation_id: conversationId,
                _user_id: user.id,
              })
              .then(async ({ data: otherParticipantId }) => {
                if (otherParticipantId) {
                  const otherUserData = await fetchAndCacheUser(otherParticipantId);

                  if (otherUserData) {
                    const conversation = {
                      id: conversationId,
                      created_at: new Date().toISOString(),
                      other_user: otherUserData as unknown as User,
                    };
                    setCurrentConversation(conversation);
                    navigate("/app", { replace: true });
                  }
                }
              });
          }
        });
      }
    }
  }, [
    searchParams,
    user,
    setSearchParams,
    setCurrentServer,
    setCurrentConversation,
    fetchConversations,
    navigate,
  ]);

  // Real-time updates
  useRealtimeFriendships(user?.id || null);
  useRealtimeUsers();
  useRealtimeServer(currentServer?.id || null);
  useRealtimeServerEmojis(currentServer?.id || null);
  useRealtimeNotifications(user?.id || null);
  usePresence();

  useEffect(() => {
    if (!user?.id) return;
    fetchFriends(user.id);
  }, [user?.id, fetchFriends]);

  // Listen for own membership changes (kicks/bans)
  useRealtimeOwnMembership();

  // Real-time channel messages and reactions - at app level for stability
  useRealtimeMessages(currentChannel?.id || null);
  useRealtimeMessages(activeVoiceTextChannelId);

  // Real-time DMs at app level so messages are received even when not viewing DMs
  const unreadDMs = useUnreadDMs(user?.id || null);
  const { incrementUnread } = unreadDMs;
  const currentConversationIdRef = useRef(currentConversation?.id);
  currentConversationIdRef.current = currentConversation?.id;

  const stableOnNewMessage = useCallback(
    (message: any, conversationId: string) => {
      if (conversationId !== currentConversationIdRef.current) {
        incrementUnread(conversationId);
      }
    },
    [incrementUnread],
  );

  useRealtimeDMs({
    userId: user?.id || null,
    currentConversationId: currentConversation?.id || null,
    onNewMessage: stableOnNewMessage,
  });

  // Background sync (handles offline queue, reconnection, periodic refresh)
  useBackgroundSync();

  // Sync preferences (theme, etc.) with database
  usePreferencesSync();

  // Sync URL params with store state - read from URL and update store
  // Also acts as a ban guard: if user navigates to a server they're banned from, redirect away
  useEffect(() => {
    if (!user || !servers.length) return;

    // If URL has serverId, set it in the store
    if (urlServerId) {
      const server = servers.find((s) => s.id === urlServerId);
      if (server && server.id !== currentServer?.id) {
        setCurrentServer(server);
      } else if (!server) {
        // Server not found in user's servers — could be banned/kicked/left
        // Check if the user is banned from this server
        supabase
          .rpc("is_server_banned_secure", {
            _server_id: urlServerId,
            _user_id: user.id,
          })
          .then(({ data }) => {
            if (data) {
              console.warn("[AppLayout] User is banned from server, redirecting");
            }
          });
        navigate("/app", { replace: true });
      }
    }
    // Don't auto-navigate when URL doesn't have serverId - let user stay on DM view
  }, [urlServerId, servers, currentServer, setCurrentServer, user, navigate]);

  // Sync channel from URL
  useEffect(() => {
    if (!currentServer || !urlServerId || currentServer.id !== urlServerId) return;

    // Wait for channels to be loaded
    if (channels.length === 0) return;

    if (urlChannelId) {
      const channel = channels.find((c) => c.id === urlChannelId && c.server_id === currentServer.id);
      if (channel && channel.id !== currentChannel?.id) {
        setCurrentChannel(channel);
      } else if (!channel) {
        // Channel not found, navigate to server without channel
        navigate(`/app/servers/${currentServer.id}`, { replace: true });
      }
    } else if (urlServerId && !urlChannelId && channels.length > 0 && !isServerSpecialView) {
      // On server page without channel, restore last visited or select first channel
      if (!currentChannel || currentChannel.server_id !== currentServer.id) {
        // Try to restore last visited channel for this server
        const lastChannelId = getLastChannel(currentServer.id);
        const lastChannel = lastChannelId ? channels.find((c) => c.id === lastChannelId) : null;
        const targetChannel = lastChannel || channels[0];
        if (targetChannel) {
          navigate(`/app/servers/${currentServer.id}/channels/${targetChannel.id}`, { replace: true });
        }
      }
    }
  }, [
    urlChannelId,
    channels,
    currentChannel,
    currentServer,
    urlServerId,
    setCurrentChannel,
    navigate,
    isServerSpecialView,
  ]);

  // When visiting server special views, clear current channel selection (so sidebar highlights correctly)
  useEffect(() => {
    if (!currentServer) return;
    if (!isServerSpecialView) return;
    if (currentChannel) {
      setCurrentChannel(null);
    }
  }, [isServerSpecialView, currentServer, currentChannel, setCurrentChannel]);

  // Fetch server bootstrap only when server changes.
  useEffect(() => {
    if (!currentServer?.id) return;
    void fetchChannels(currentServer.id);
  }, [currentServer?.id, fetchChannels]);

  // Clear DM conversation when switching to a server
  useEffect(() => {
    if (currentServer && currentConversation) {
      setCurrentConversation(null);
    }
  }, [currentServer]); // eslint-disable-line react-hooks-exhaustive-deps

  // Initialize auth and wait for it to complete before checking user
  useEffect(() => {
    let cancelled = false;

    (async () => {
      await initializeAuth();
      if (cancelled) return;
      // Force a re-render after auth init completes
      const state = useAuthStore.getState();
      if (!state.isLoading && !state.user) {
        navigate(`${authEntryPath}?mode=login`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, authEntryPath]);

  // Only redirect if we've finished loading and still no user
  useEffect(() => {
    if (!isLoading && !user) {
      // Small delay to ensure auth state is loaded from localStorage
      const timer = setTimeout(() => {
        const state = useAuthStore.getState();
        if (!state.user && !state.isLoading) {
          navigate(`${authEntryPath}?mode=login`);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, isLoading, navigate, authEntryPath]);

  // Maximize window once when user is authenticated (for Tauri)
  // Use a ref to ensure it only runs once
  const hasResizedWindow = useRef(false);
  useEffect(() => {
    if (user && !hasResizedWindow.current) {
      hasResizedWindow.current = true;
      resizeWindowForApp();
    }
  }, [user]);

  // Load voice settings when user is authenticated
  useEffect(() => {
    if (user?.id) {
      loadVoiceSettings(user.id);
    }
  }, [user?.id, loadVoiceSettings]);

  // Close mobile sidebars when selecting a DM conversation
  useEffect(() => {
    if (currentConversation) {
      closeMobileSidebars();
    }
  }, [currentConversation, closeMobileSidebars]);


  // DM View (no server selected)
  const isDMView = currentServer === null;
  const isExploreView = isDMView && currentPath === "/explore";
  const isFriendsView = isDMView && currentPath === "/friends";
  const hasPendingFriendRequests = pendingFriendRequestCount > 0;

  const serverIdsKey = useMemo(() => {
    if (!servers || servers.length === 0) return "";
    return [...servers.map((s) => s.id)].sort().join(",");
  }, [servers]);
  const serverIds = useMemo(() => {
    if (!serverIdsKey) return [];
    return serverIdsKey.split(",").filter(Boolean);
  }, [serverIdsKey]);
  const serverUnreadSummary = useServerUnreadSummary(user?.id ?? null, serverIds);
  const serverChannels = useMemo(() => {
    if (!serverIdsKey) return {};

    const channelsByServer = {
      ...serverUnreadSummary.serverChannelsFromSummary,
      ...getCachedServerChannelMap(serverIds, user?.id ?? null),
    };

    if (currentServer?.id) {
      const currentServerChannels = channels
        .filter((channel) => channel.server_id === currentServer.id)
        .map((channel) => channel.id);

      if (currentServerChannels.length > 0) {
        channelsByServer[currentServer.id] = currentServerChannels;
      }
    }

    return channelsByServer;
  }, [serverIds, serverIdsKey, serverUnreadSummary.serverChannelsFromSummary, user?.id, currentServer?.id, channels]);

  const allChannelIds = useMemo(() => {
    const ids = Object.values(serverChannels).flat();
    // Stable ordering prevents unnecessary unread refetches.
    ids.sort();
    // Deduplicate (defensive).
    return ids.filter((id, idx) => id && (idx === 0 || id !== ids[idx - 1]));
  }, [serverChannels]);

  // Centralized unread state for all channels (avoid multiple `get_all_channel_unread_counts` calls).
  const unreadChannels = useUnread(allChannelIds);

  const markChannelAsRead = useCallback(
    async (channelId: string, lastMessageId?: string) => {
      serverUnreadSummary.clearReadChannels([channelId], {
        serverChannels,
        unreadByChannel: unreadChannels.unreadState,
      });
      await unreadChannels.markAsRead(channelId, lastMessageId);
    },
    [serverChannels, serverUnreadSummary, unreadChannels],
  );

  const markServerAsRead = useCallback(
    async (channelIds: string[]) => {
      const serverIdsToClear = Object.entries(serverChannels)
        .filter(([, ids]) => ids.length > 0 && ids.every((id) => channelIds.includes(id)))
        .map(([serverId]) => serverId);

      serverUnreadSummary.clearServers(serverIdsToClear);
      serverUnreadSummary.clearReadChannels(channelIds, {
        serverChannels,
        unreadByChannel: unreadChannels.unreadState,
      });
      await unreadChannels.markServerAsRead(channelIds);
    },
    [serverChannels, serverUnreadSummary, unreadChannels],
  );

  const unreadDMsContextValue = useMemo(
    () => ({
      getUnreadCount: unreadDMs.getUnreadCount,
      markAsRead: unreadDMs.markAsRead,
      incrementUnread: unreadDMs.incrementUnread,
      totalUnread: unreadDMs.totalUnread,
      hasUnread: unreadDMs.hasUnread,
      refetch: unreadDMs.refetch,
      unreadState: unreadDMs.unreadState,
    }),
    [
      unreadDMs.getUnreadCount,
      unreadDMs.markAsRead,
      unreadDMs.incrementUnread,
      unreadDMs.totalUnread,
      unreadDMs.hasUnread,
      unreadDMs.refetch,
      unreadDMs.unreadState,
    ],
  );

  const unreadChannelsContextValue = useMemo(
    () => ({
      ...unreadChannels,
      markAsRead: markChannelAsRead,
      markServerAsRead,
      serverChannels,
      serverUnreadSummary: serverUnreadSummary.summaryByServerId,
      allChannelIds,
    }),
    [
      unreadChannels,
      markChannelAsRead,
      markServerAsRead,
      serverChannels,
      serverUnreadSummary.summaryByServerId,
      allChannelIds,
    ],
  );

  const openCreateServer = useCallback(() => {
    setIsAddServerPanelOpen(false);
    openModal("create-server", { defaultView: "create", fromAddServerPanel: true });
  }, [openModal]);

  const openJoinServer = useCallback(() => {
    setIsAddServerPanelOpen(false);
    openModal("join-server", { fromAddServerPanel: true });
  }, [openModal]);

  const openFriendsPage = useCallback(() => {
    setIsAddServerPanelOpen(false);
    setCurrentServer(null);
    setCurrentConversation(null);
    navigate("/app/friends");
  }, [navigate, setCurrentConversation, setCurrentServer]);

  const openProfilePage = useCallback(() => {
    if (!user?.id) return;
    setIsAddServerPanelOpen(false);
    setCurrentServer(null);
    setCurrentConversation(null);
    navigate(`/app/profiles/${user.id}`);
  }, [navigate, setCurrentConversation, setCurrentServer, user?.id]);

  const closeQuickAccessPanel = useCallback(() => {
    setIsAddServerPanelOpen(false);
  }, []);

  // Show loading state - AFTER all hooks
  // Only full-screen block when we truly don't have a user yet.
  if (isLoading && !user) {
    return (
      <div className="h-screen flex flex-col overflow-hidden app-layout-font">
        <div className="flex-1 flex overflow-hidden">
          {!isMobileRaw && <div className="w-[72px] shrink-0 bg-layout-sidebar" />}
          {!isMobileRaw && <div className="w-[288px] shrink-0 bg-[hsl(var(--layout-channels))]" />}
          <div className="flex-1 bg-layout-chat flex items-center justify-center">
            <KloakDrawLoader />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const desktopTitle = isProfileView
    ? "Profile"
    : isDMView
    ? currentConversation
      ? currentConversation.other_user?.display_name || currentConversation.other_user?.username || "Direct Messages"
      : "Direct Messages"
    : isServerOverviewView
      ? `${currentServer?.name || "Server"} • Overview`
      : isServerMembersView
        ? `${currentServer?.name || "Server"} - Members`
        : currentChannel
          ? `# ${currentChannel.name}`
          : currentServer
          ? currentServer.name
            : "Kloak";
  const isFullscreenSettingsOverlayOpen =
    !isMobile && (isServerSettingsOpen || activeModal === "user-settings" || activeModal === "edit-channel");

  return (
    <MotionConfig>
      <UnreadDMsContext.Provider value={unreadDMsContextValue}>
        <UnreadChannelsContext.Provider value={unreadChannelsContextValue}>
        <SEO title={desktopTitle} noIndex />
        <div className="h-screen flex flex-col overflow-hidden app-layout-font app-no-motion discord-inspired">
          <DesktopTitleBar title={desktopTitle} />

          {MAINTENANCE_MODE && (
            <div className="w-full py-2.5 px-4 bg-slate-700 border-b border-slate-600 text-center text-sm text-slate-300 shrink-0">
              We're scaling our systems to handle high traffic. You’re logged in, so you’re safe!
            </div>
          )}

          {/* Connection Status Banner */}
          <ConnectionStatus />

          <div className="flex-1 flex overflow-hidden">
            {isMobile ? (
              <div className="flex-1 flex flex-col overflow-hidden w-full">
                {/* Alpha notice banner - mobile */}
                <AlphaNoticeBanner />

                {/* Mobile header */}
                <MobileHeader isDMView={isDMView} />

                {/* Mobile layout */}
                <div className="flex-1 overflow-hidden bg-layout-chat relative w-full">
                  <VoicePersistentHost />
                  {/* Keep all views mounted, toggle visibility with CSS to prevent remount sluggishness */}
                  {isProfileView && (
                    <Suspense fallback={null}>
                      <UserProfilePage />
                    </Suspense>
                  )}
                  {currentConversation && (
                    <div className={isDMView && currentConversation && !isProfileView ? "block h-full" : "hidden"}>
                      <DMChatArea />
                    </div>
                  )}
                  {isDMView && !currentConversation && !isProfileView && (
                    isExploreView ? (
                      <div className="h-full overflow-y-auto">
                        <ExploreServers />
                      </div>
                    ) : isFriendsView ? (
                      <FriendsList onOpenDM={() => navigate("/app")} />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-layout-members px-4 text-center text-muted-foreground">
                        <p>Select a direct message or start one from the sidebar.</p>
                      </div>
                    )
                  )}
                  {currentServer && (
                    <>
                      {isServerOverviewView && <ServerOverviewView />}
                      {isServerMembersView && <ServerMembersPage />}
                      <div
                        className={
                          !isServerSpecialView && !isDMView && !isProfileView ? "block h-full" : "hidden"
                        }
                      >
                        <ChatArea />
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* Desktop layout */
              <div className="flex flex-col flex-1 overflow-hidden bg-layout-chat">
                {/* Alpha notice banner */}
                {!isFullscreenSettingsOverlayOpen && <AlphaNoticeBanner />}

                <div className="flex flex-1 overflow-hidden relative">
                  {/* Server list on left - hidden during full-screen settings */}
                  <AnimatePresence initial={false}>
                    {!isFullscreenSettingsOverlayOpen && isAddServerPanelOpen && (
                      <motion.aside
                        key="add-server-panel"
                        initial={{ width: 0, opacity: 0, x: -18 }}
                        animate={{ width: 228, opacity: 1, x: 0 }}
                        exit={{ width: 0, opacity: 0, x: -18 }}
                        transition={addServerPanelTransition}
                        className="h-full shrink-0 overflow-hidden border-r border-border/70 bg-layout-sidebar"
                      >
                        <div className="flex h-full w-[228px] flex-col">
                          <div className="flex h-[58px] shrink-0 items-center gap-3 border-b border-black/20 px-3 shadow-[0_1px_0_rgba(255,255,255,0.03)]">
                            <div className="relative h-8 w-8 shrink-0">
                              {user?.avatar_url ? (
                                <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                              ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5865F2] text-[12px] font-bold text-foreground">
                                  {(user?.display_name || user?.username || "U").slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-layout-sidebar bg-[#23A55A]" />
                            </div>
                            <div className="min-w-0 flex-1 truncate text-[14px] font-semibold text-foreground">
                              {user?.display_name || user?.username || "Profile"}
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsAddServerPanelOpen(false)}
                              className="flex h-7 w-7 items-center justify-center rounded-[4px] text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                              aria-label="Close quick access menu"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          <nav className="flex flex-col gap-1 px-1.5 py-3">
                            <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                              Profile
                            </div>
                            <button
                              type="button"
                              onClick={openProfilePage}
                              className={cn(
                                "flex h-8 w-full items-center gap-3 rounded-[2px] px-2.5 text-left text-[14px] font-semibold transition-colors",
                                isProfileView
                                  ? "bg-secondary text-foreground"
                                  : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                              )}
                            >
                              <UserCircle className="h-4 w-4 shrink-0" />
                              <span className="truncate">Profile</span>
                            </button>
                            <button
                              type="button"
                              onClick={openCreateServer}
                              className="flex h-8 w-full items-center gap-3 rounded-[2px] px-2.5 text-left text-[14px] font-medium text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                            >
                              <Plus className="h-4 w-4 shrink-0" />
                              <span className="truncate">Create Server</span>
                            </button>
                            <button
                              type="button"
                              onClick={openJoinServer}
                              className="flex h-8 w-full items-center gap-3 rounded-[2px] px-2.5 text-left text-[14px] font-medium text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                            >
                              <Link2 className="h-4 w-4 shrink-0" />
                              <span className="truncate">Join by Invite</span>
                            </button>

                            <div className="px-2 pb-1 pt-6 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                              Only visible to you
                            </div>
                            <button
                              type="button"
                              onClick={openFriendsPage}
                              className={cn(
                                "flex h-8 w-full items-center gap-3 rounded-[2px] px-2.5 text-left text-[14px] font-medium transition-colors",
                                isFriendsView
                                  ? "bg-secondary text-foreground"
                                  : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                              )}
                            >
                              <Users className="h-4 w-4 shrink-0" />
                              <span className="min-w-0 flex-1 truncate">Friends</span>
                              {hasPendingFriendRequests && (
                                <span
                                  className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-[4px] bg-destructive px-1.5 text-[11px] font-bold leading-none text-destructive-foreground"
                                  aria-label={`${pendingFriendRequestCount} pending friend request${pendingFriendRequestCount === 1 ? "" : "s"}`}
                                >
                                  {pendingFriendRequestCount > 99 ? "99+" : pendingFriendRequestCount}
                                </span>
                              )}
                            </button>
                          </nav>
                        </div>
                      </motion.aside>
                    )}
                  </AnimatePresence>

                  {!isFullscreenSettingsOverlayOpen && (
                    <ServerSidebar
                      isAddServerPanelOpen={isAddServerPanelOpen}
                      onNavigate={closeQuickAccessPanel}
                      onToggleAddServerPanel={() => setIsAddServerPanelOpen((open) => !open)}
                    />
                  )}

                  {/* Full-screen settings overlays - rendered on top, main layout stays mounted */}
                  {isServerSettingsOpen && (
                    <div className="absolute inset-0 z-50 bg-background">
                      <ServerSettingsPage />
                    </div>
                  )}
                  {activeModal === "user-settings" && (
                    <div className="absolute inset-0 z-50 bg-background">
                      <UserSettingsPage />
                    </div>
                  )}
                  {activeModal === "edit-channel" && (
                    <div className="absolute inset-0 z-50 bg-background">
                      <ChannelSettingsPage />
                    </div>
                  )}

                  {/* Main layout - ALWAYS mounted so VoicePersistentHost never unmounts */}
                  <div className={cn("flex-1 overflow-hidden", isFullscreenSettingsOverlayOpen && "invisible")}>
                    <div className="flex h-full">
                      {!isExploreView && !isFriendsView && (
                        <div className="w-[288px] shrink-0 overflow-hidden bg-layout-sidebar">
                          {isDMView ? (
                            <DMSidebar />
                          ) : (
                            <ChannelSidebar onNavigate={closeQuickAccessPanel} />
                          )}
                        </div>
                      )}

                      <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
                        {(showDesktopUnifiedChannelHeader && currentChannel) ||
                        (isServerOverviewView && overviewHeaderChannel) ||
                        (isServerMembersView && membersHeaderChannel) ? (
                          <div className="flex-shrink-0 overflow-visible">
                            <ChannelHeader
                              channel={
                                isServerOverviewView
                                  ? overviewHeaderChannel!
                                  : isServerMembersView
                                    ? membersHeaderChannel!
                                    : currentChannel!
                              }
                              showMessageActions={
                                isServerOverviewView || isServerMembersView ? false : currentChannel?.type !== "tasks"
                              }
                            />
                          </div>
                        ) : null}

                        <div className="min-h-0 flex flex-1">
                          <div className="min-w-0 flex-1 bg-layout-chat relative overflow-hidden">
                            <VoicePersistentHost />
                            {/* Keep all views mounted, toggle visibility with CSS to prevent remount sluggishness */}
                            {isProfileView && (
                              <Suspense fallback={null}>
                                <UserProfilePage />
                              </Suspense>
                            )}
                            {currentConversation && (
                              <div className={isDMView && currentConversation && !isProfileView ? "block h-full" : "hidden"}>
                                <DMChatArea />
                              </div>
                            )}
                            {isDMView && !currentConversation && !isProfileView && (
                              isExploreView ? (
                                <div className="h-full overflow-y-auto">
                                  <ExploreServers />
                                </div>
                              ) : isFriendsView ? (
                                <div className="h-full overflow-y-auto">
                                  <FriendsList onOpenDM={() => navigate("/app")} />
                                </div>
                              ) : (
                                <div className="flex h-full items-center justify-center bg-layout-members px-4 text-center text-muted-foreground">
                                  <p>Select a direct message or start one from the sidebar.</p>
                                </div>
                              )
                            )}
                            {currentServer && (
                              <>
                                {isServerOverviewView && <ServerOverviewView />}
                                {isServerMembersView && <ServerMembersPage />}
                                <div className={!isServerSpecialView && !isDMView && !isProfileView ? "block h-full" : "hidden"}>
                                  <ChatArea showHeader={!showDesktopUnifiedChannelHeader} />
                                </div>
                              </>
                            )}
                          </div>

                          {!isDMView && !isProfileView && (
                            <div
                              className={cn(
                                "shrink-0 overflow-hidden",
                                isMemberSidebarOpen ? "w-[304px]" : "w-0",
                              )}
                            >
                              <div
                                className={cn(
                                  "h-full w-[304px] transition-transform duration-200 ease-out",
                                  isMemberSidebarOpen ? "translate-x-0" : "translate-x-full",
                                )}
                              >
                                <MembersSidebar />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Sidebars */}
        {isMobile && (
          <MobileSidebar isDMView={isDMView} />
        )}
        {/* Mobile members drawer — always mounted so Sheet close animation works */}
        {!isDMView && isMobile && <MembersSidebar />}

        {/* Always-mounted modals (preserve internal form state, lazy for code splitting) */}
        <Suspense fallback={null}><ServerSettingsModal /></Suspense>
        <Suspense fallback={null}><UserSettingsModal /></Suspense>

        {/* Conditionally-rendered modals (reset state on each open) */}
        {activeModal === 'create-server' && <Suspense fallback={null}><CreateServerModal /></Suspense>}
        {activeModal === 'join-server' && <Suspense fallback={null}><JoinServerModal /></Suspense>}
        {activeModal === 'invite' && <Suspense fallback={null}><InviteModal /></Suspense>}
        {activeModal === 'create-channel' && <Suspense fallback={null}><CreateChannelModal /></Suspense>}
        {activeModal === 'edit-channel' && <Suspense fallback={null}><EditChannelModal /></Suspense>}
        {activeModal === 'userProfile' && <Suspense fallback={null}><UserProfilePopup /></Suspense>}
        {activeModal === 'pinned-messages' && <Suspense fallback={null}><PinnedMessagesPanel /></Suspense>}
        {activeModal === 'search' && <Suspense fallback={null}><SearchModal /></Suspense>}
        {activeModal === 'quickSwitcher' && <Suspense fallback={null}><QuickSwitcherModal /></Suspense>}
        {activeModal === 'shortcuts' && <Suspense fallback={null}><KeyboardShortcutsModal /></Suspense>}
        {activeModal === 'confirmAction' && <Suspense fallback={null}><ConfirmActionModal /></Suspense>}
        {activeModal === 'changeNickname' && <Suspense fallback={null}><ChangeNicknameModal /></Suspense>}
        {activeModal === 'external-link-warning' && <Suspense fallback={null}><ExternalLinkWarningModal /></Suspense>}
        {activeModal === 'permission-debug' && <Suspense fallback={null}><PermissionDebugPanel /></Suspense>}
        {activeModal === 'import-discord-template' && <Suspense fallback={null}><ImportDiscordTemplateModal /></Suspense>}
        {activeModal === 'import-emoji-pack' && <Suspense fallback={null}><ImportEmojiPackModal /></Suspense>}
        {activeModal === 'set-status' && <Suspense fallback={null}><SetStatusModal /></Suspense>}
        {activeModal === 'channel-info' && <Suspense fallback={null}><ChannelInfoModal /></Suspense>}

        {/* Persistent embed container for Twitch/Kick streams */}
        <PersistentEmbedContainer />

        {/* Dev-only presence diagnostics overlay (toggle via localStorage) */}
        <PresenceDebugOverlay />

        {/* Nested route placeholder (AppLayout is the /app layout route) */}
        <Outlet />
        </UnreadChannelsContext.Provider>
      </UnreadDMsContext.Provider>
    </MotionConfig>
  );
};

export default AppLayout;
