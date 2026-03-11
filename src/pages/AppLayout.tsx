import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams, useLocation, useParams, Outlet } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { useAuthStore, initializeAuth } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { getCachedServerChannelMap, useServerStore } from "@/stores/serverStore";
import { useVoiceStore } from "@/stores/voiceStore";
import { useVoiceSettingsStore } from "@/stores/voiceSettingsStore";
import { fetchAndCacheUser } from "@/stores/userCacheStore";
import { getLastChannel } from "@/lib/storage";
import { ServerSidebar } from "@/components/layout/ServerSidebar";
import { HomeLanding } from "@/components/home/HomeLanding";
import { ExploreServers } from "@/components/home/ExploreServers";
import { ChannelSidebar } from "@/components/layout/ChannelSidebar";
import { ChatArea } from "@/components/layout/ChatArea";
import { MembersSidebar } from "@/components/layout/MembersSidebar";
import { ServerOverviewView } from "@/components/layout/ServerOverviewView";

import { MobileHeader } from "@/components/layout/MobileHeader";
import { MobileSidebar } from "@/components/layout/MobileSidebar";
import { ConnectionStatus } from "@/components/ui/ConnectionStatus";
import KloakDrawLoader from "@/components/ui/KloakDrawLoader";
import { DMSidebar, FriendsList, DMChatArea } from "@/components/dm";
import { ServerSettingsPage, ChannelSettingsPage } from "@/components/settings";
import {
  CreateServerModal,
  JoinServerModal,
  InviteModal,
  CreateChannelModal,
  EditChannelModal,
  ServerSettingsModal,
  UserSettingsModal,
  UserSettingsPage,
  UserProfilePopup,
  PinnedMessagesPanel,
  SearchModal,
  QuickSwitcherModal,
  KeyboardShortcutsModal,
  ConfirmActionModal,
  ChangeNicknameModal,
  ExternalLinkWarningModal,
  PermissionDebugPanel,
  ImportDiscordTemplateModal,
  ImportEmojiPackModal,
} from "@/components/modals";
import { PersistentEmbedContainer } from "@/components/chat/PersistentEmbedContainer";
import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { VoicePersistentHost } from "@/components/voice/VoicePersistentHost";
import { cn } from "@/lib/utils";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
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
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBackgroundSync } from "@/hooks/useBackgroundSync";
import { usePreferencesSync } from "@/hooks/usePreferencesSync";
import type { User } from "@/types";
import { PresenceDebugOverlay } from "@/components/debug/PresenceDebugOverlay";
import { SEO } from "@/components/seo";
import { getAuthEntryPath, resizeWindowForApp } from "@/lib/tauriRuntime";
import { MAINTENANCE_MODE } from "@/lib/maintenance";
import { AlphaNoticeBanner } from "@/components/layout/AlphaNoticeBanner";

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isLoading } = useAuthStore();
  const { loadSettings: loadVoiceSettings } = useVoiceSettingsStore();
  const { isMemberSidebarOpen, isServerSettingsOpen, closeMobileSidebars, activeModal } = useUIStore();
  const {
    currentServer,
    currentChannel,
    setCurrentChannel,
    setCurrentServer,
    fetchChannels,
    fetchMembers,
    fetchRolePermissions,
    servers,
    channels,
  } = useServerStore();
  const { conversations, currentConversation, setCurrentConversation, fetchConversations } = useDMStore();
  const { fetchFriends } = useFriendStore();
  const isMobileRaw = useIsMobile();
  const joinedVoiceChannelId = useVoiceStore((s) => s.joinedChannelId);
  const authEntryPath = getAuthEntryPath();
  const [lockedLayoutIsMobile, setLockedLayoutIsMobile] = useState<boolean | null>(null);
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
  const showFriends = currentPath === "/friends";
  const showExplore = currentPath === "/explore";
  const isServerOverviewView = !!params.serverId && currentPath === `/servers/${params.serverId}/overview`;
  

  const currentMembership = useMemo(() => {
    if (!currentServer) return null;
    return servers.find((s) => s.id === currentServer.id) ?? null;
  }, [servers, currentServer]);

  const isOwner = !!user && !!currentServer && currentServer.owner_id === user.id;
  const isServerSpecialView = isServerOverviewView;

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
    fetchFriends(user.id).finally(() => {
      const serverId = useServerStore.getState().currentServer?.id;
      // Avoid eagerly fetching the full member list on app load.
      // Members can be large; load only when the members UI is actually open.
      const ui = useUIStore.getState();
      if (serverId && ui.isMemberSidebarOpen) useServerStore.getState().fetchMembers(serverId);
    });
  }, [user?.id, fetchFriends]);

  // Listen for own membership changes (kicks/bans)
  useRealtimeOwnMembership();

  // Real-time channel messages and reactions - at app level for stability
  useRealtimeMessages(currentChannel?.id || null);

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
    fetchChannels(currentServer.id);
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

  // Close mobile sidebars when navigating
  useEffect(() => {
    if (currentChannel || currentConversation) {
      closeMobileSidebars();
    }
  }, [currentChannel, currentConversation, closeMobileSidebars]);

  // Handle mobile back navigation
  const handleMobileBack = () => {
    if (currentConversation) {
      setCurrentConversation(null);
      navigate("/app/friends");
    }
  };

  // DM View (no server selected)
  const isDMView = currentServer === null;

  const serverIdsKey = useMemo(() => {
    if (!servers || servers.length === 0) return "";
    return [...servers.map((s) => s.id)].sort().join(",");
  }, [servers]);
  const serverChannels = useMemo(() => {
    if (!serverIdsKey) return {};

    const serverIds = serverIdsKey.split(",").filter(Boolean);
    const channelsByServer = getCachedServerChannelMap(serverIds, user?.id ?? null);

    if (currentServer?.id) {
      const currentServerChannels = channels
        .filter((channel) => channel.server_id === currentServer.id)
        .map((channel) => channel.id);

      if (currentServerChannels.length > 0) {
        channelsByServer[currentServer.id] = currentServerChannels;
      }
    }

    return channelsByServer;
  }, [serverIdsKey, user?.id, currentServer?.id, channels]);

  const allChannelIds = useMemo(() => {
    const ids = Object.values(serverChannels).flat();
    // Stable ordering prevents unnecessary unread refetches.
    ids.sort();
    // Deduplicate (defensive).
    return ids.filter((id, idx) => id && (idx === 0 || id !== ids[idx - 1]));
  }, [serverChannels]);

  // Centralized unread state for all channels (avoid multiple `get_all_channel_unread_counts` calls).
  const unreadChannels = useUnread(allChannelIds);

  const unreadDMsContextValue = useMemo(
    () => ({
      getUnreadCount: unreadDMs.getUnreadCount,
      markAsRead: unreadDMs.markAsRead,
      incrementUnread: unreadDMs.incrementUnread,
      totalUnread: unreadDMs.totalUnread,
      hasUnread: unreadDMs.hasUnread,
      refetch: unreadDMs.refetch,
    }),
    [
      unreadDMs.getUnreadCount,
      unreadDMs.markAsRead,
      unreadDMs.incrementUnread,
      unreadDMs.totalUnread,
      unreadDMs.hasUnread,
      unreadDMs.refetch,
    ],
  );

  const unreadChannelsContextValue = useMemo(
    () => ({ ...unreadChannels, serverChannels, allChannelIds }),
    [unreadChannels, serverChannels, allChannelIds],
  );

  // Show loading state - AFTER all hooks
  // Only full-screen block when we truly don't have a user yet.
  if (isLoading && !user) {
    return (
      <div className="h-screen bg-layout-chat flex items-center justify-center">
        <KloakDrawLoader />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const desktopTitle = isDMView
    ? currentConversation
      ? currentConversation.other_user?.display_name || currentConversation.other_user?.username || "Direct Messages"
      : "Direct Messages"
    : isServerOverviewView
      ? `${currentServer?.name || "Server"} • Overview`
      : currentChannel
          ? `# ${currentChannel.name}`
          : currentServer
          ? currentServer.name
            : "Kloak";
  const isFullscreenSettingsOverlayOpen =
    !isMobile && (isServerSettingsOpen || activeModal === "user-settings" || activeModal === "edit-channel");

  return (
    <MotionConfig reducedMotion="always">
      <UnreadDMsContext.Provider value={unreadDMsContextValue}>
        <UnreadChannelsContext.Provider value={unreadChannelsContextValue}>
        <SEO title={desktopTitle} noIndex />
        <div className="h-screen flex flex-col overflow-hidden app-layout-font app-no-motion">
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

                {/* Mobile header - hide when in DM conversation (DMHeader handles it) */}
                {!(isDMView && currentConversation) && (
                  <MobileHeader isDMView={isDMView} showFriends={showFriends} showExplore={showExplore} />
                )}

                {/* Mobile layout */}
                <div className="flex-1 overflow-hidden bg-layout-chat relative w-full">
                  <VoicePersistentHost />
                  {/* Keep all views mounted, toggle visibility with CSS to prevent remount sluggishness */}
                  {currentConversation && (
                    <div className={isDMView && currentConversation ? "block h-full" : "hidden"}>
                      <DMChatArea />
                    </div>
                  )}
                  {isDMView && !currentConversation && (
                    <>
                      <div className={showFriends ? "block h-full" : "hidden"}>
                        <FriendsList onOpenDM={() => navigate("/app")} />
                      </div>
                      <div className={showExplore ? "block h-full" : "hidden"}>
                        <ExploreServers />
                      </div>
                      <div className={!showFriends && !showExplore ? "block h-full" : "hidden"}>
                        <HomeLanding />
                      </div>
                    </>
                  )}
                  {currentServer && (
                    <>
                      {isServerOverviewView && <ServerOverviewView />}
                      <div
                        className={
                          !isServerOverviewView && !isDMView ? "block h-full" : "hidden"
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
              <div className="flex flex-col flex-1 overflow-hidden">
                {/* Alpha notice banner */}
                {!isFullscreenSettingsOverlayOpen && <AlphaNoticeBanner />}

                <div className="flex flex-1 overflow-hidden relative">
                  {/* Server list on left - hidden during full-screen settings */}
                  {!isFullscreenSettingsOverlayOpen && (
                    <div className="w-[68px] shrink-0 bg-layout-sidebar">
                      <ServerSidebar />
                    </div>
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
                    <ResizablePanelGroup direction="horizontal" className="flex-1">
                      {/* Secondary sidebar - resizable */}
                      <ResizablePanel defaultSize={20} minSize={10} maxSize={30} className="bg-layout-sidebar-secondary">
                        <div className="h-full">
                          {isDMView ? (
                            <DMSidebar
                              showFriends={showFriends}
                              onShowFriendsChange={(show: boolean) => navigate(show ? "/app/friends" : "/app")}
                              showExplore={showExplore}
                              onShowExploreChange={(show: boolean) => navigate(show ? "/app/explore" : "/app")}
                            />
                          ) : (
                            <ChannelSidebar />
                          )}
                        </div>
                      </ResizablePanel>

                      <ResizableHandle className="w-1 bg-transparent hover:bg-primary/20 transition-colors" />

                      {/* Main area - flexible */}
                      <ResizablePanel defaultSize={isMemberSidebarOpen && !isDMView && !isServerSpecialView ? 70 : 85}>
                        <div className="h-full bg-layout-chat relative overflow-hidden">
                          <VoicePersistentHost />
                          {/* Keep all views mounted, toggle visibility with CSS to prevent remount sluggishness */}
                          {currentConversation && (
                            <div className={isDMView && currentConversation ? "block h-full" : "hidden"}>
                              <DMChatArea />
                            </div>
                          )}
                          {isDMView && !currentConversation && (
                            <>
                              <div className={showFriends ? "block h-full" : "hidden"}>
                                <FriendsList onOpenDM={() => navigate("/app")} />
                              </div>
                              <div className={showExplore ? "block h-full" : "hidden"}>
                                <ExploreServers />
                              </div>
                              <div className={!showFriends && !showExplore ? "block h-full" : "hidden"}>
                                <HomeLanding />
                              </div>
                            </>
                          )}
                          {currentServer && (
                            <>
                              {isServerOverviewView && <ServerOverviewView />}
                              <div
                                className={
                                  !isServerOverviewView && !isDMView
                                    ? "block h-full"
                                    : "hidden"
                                }
                              >
                                <ChatArea />
                              </div>
                            </>
                          )}
                        </div>
                      </ResizablePanel>

                      {/* Members sidebar - collapsible, desktop only (mobile uses Sheet drawer) */}
                      {!isDMView && !isServerSpecialView && isMemberSidebarOpen && (
                        <>
                          <ResizableHandle className="w-1 bg-transparent hover:bg-primary/20 transition-colors" />
                          <ResizablePanel defaultSize={15} minSize={10} maxSize={25} className="bg-layout-members">
                            <MembersSidebar />
                          </ResizablePanel>
                        </>
                      )}
                    </ResizablePanelGroup>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Sidebars */}
        {isMobile && (
          <MobileSidebar
            isDMView={isDMView}
            showFriends={showFriends}
            onShowFriendsChange={(show: boolean) => navigate(show ? "/app/friends" : "/app")}
            showExplore={showExplore}
            onShowExploreChange={(show: boolean) => navigate(show ? "/app/explore" : "/app")}
          />
        )}
        {/* Mobile members drawer — always mounted so Sheet close animation works */}
        {!isDMView && !isServerSpecialView && isMobile && <MembersSidebar />}

        {/* Modals */}
        <CreateServerModal />
        <JoinServerModal />
        <InviteModal />
        <CreateChannelModal />
        <EditChannelModal />
        <ServerSettingsModal />
        <UserSettingsModal />
        <UserProfilePopup />
        <PinnedMessagesPanel />
        <SearchModal />
        <QuickSwitcherModal />
        <KeyboardShortcutsModal />
        <ConfirmActionModal />
        <ChangeNicknameModal />
        <ExternalLinkWarningModal />
        <PermissionDebugPanel />
        <ImportDiscordTemplateModal />
        <ImportEmojiPackModal />

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
