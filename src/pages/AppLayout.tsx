import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, useLocation, useParams, Outlet } from 'react-router-dom';
import { useAuthStore, initializeAuth } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { getLastChannel } from '@/lib/storage';
import { ServerSidebar } from '@/components/layout/ServerSidebar';
import { HomeLanding } from '@/components/home/HomeLanding';
import { ExploreServers } from '@/components/home/ExploreServers';
import { ChannelSidebar } from '@/components/layout/ChannelSidebar';
import { ChatArea } from '@/components/layout/ChatArea';
import { MembersSidebar } from '@/components/layout/MembersSidebar';
import { ServerOverviewView } from '@/components/layout/ServerOverviewView';
import { ServerMembersView } from '@/components/layout/ServerMembersView';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { MobileSidebar } from '@/components/layout/MobileSidebar';
import { MobileMembersSidebar } from '@/components/layout/MobileMembersSidebar';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { DMSidebar, FriendsList, DMChatArea } from '@/components/dm';
import { ServerSettingsPage, ChannelSettingsPage } from '@/components/settings';
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
  PermissionDebugPanel,
  ImportDiscordTemplateModal,
  ImportEmojiPackModal
} from '@/components/modals';
import { PersistentEmbedContainer } from '@/components/chat/PersistentEmbedContainer';
import { DesktopTitleBar } from '@/components/layout/DesktopTitleBar';
import { VoicePersistentHost } from '@/components/voice/VoicePersistentHost';
import { cn } from '@/lib/utils';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useDMStore } from '@/stores/dmStore';
import { useFriendStore } from '@/stores/friendStore';
import { supabase } from '@/integrations/supabase/client';
import { usePresence, useRealtimeFriendships, useRealtimeUsers, useRealtimeServer, useRealtimeNotifications, useRealtimeDMs, useUnreadDMs, useRealtimeMessages, useRealtimeReactions, useTauriNotificationActions, useRealtimeOwnMembership } from '@/hooks';
import { useMemberPermissions } from '@/hooks/useMemberPermissions';
import { useIsMobile } from '@/hooks/use-mobile';
import { useBackgroundSync } from '@/hooks/useBackgroundSync';
import { usePreferencesSync } from '@/hooks/usePreferencesSync';
import type { User } from '@/types';
import { PresenceDebugOverlay } from '@/components/debug/PresenceDebugOverlay';
import { SEO } from '@/components/seo';

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isLoading } = useAuthStore();
  const { isMemberSidebarOpen, isServerSettingsOpen, closeMobileSidebars, activeModal } = useUIStore();
  const { 
    currentServer, 
    currentChannel, 
    setCurrentChannel, 
    setCurrentServer, 
    fetchChannels, 
    fetchMembers, 
    fetchRolePermissions, 
    fetchRoles,
    servers,
    channels
  } = useServerStore();
  const { conversations, currentConversation, setCurrentConversation, fetchConversations } = useDMStore();
  const { fetchFriends } = useFriendStore();
  const isMobile = useIsMobile();
  const { hasPermission } = useMemberPermissions();

  // Determine current view based on route
  const currentPath = location.pathname.replace('/app', '') || '/';
  const showFriends = currentPath === '/friends';
  const showExplore = currentPath === '/explore';
  const isServerOverviewView = !!params.serverId && currentPath === `/servers/${params.serverId}/overview`;
  const isServerMembersView = !!params.serverId && currentPath === `/servers/${params.serverId}/members`;

  const currentMembership = useMemo(() => {
    if (!currentServer) return null;
    return servers.find((s) => s.id === currentServer.id) ?? null;
  }, [servers, currentServer]);

  const isOwner = currentMembership?.role === 'owner';
  const canViewMembersPage = isOwner || hasPermission('manage_server');
  const isServerMembersViewAllowed = isServerMembersView && canViewMembersPage;
  const isServerSpecialView = isServerOverviewView || isServerMembersViewAllowed;
  
  // Extract serverId and channelId from URL params
  const urlServerId = params.serverId;
  const urlChannelId = params.channelId;

  // Handle native notification click deep-links in Tauri.
  useTauriNotificationActions();

  // Handle conversation query parameter for DM notification redirects
  useEffect(() => {
    const conversationId = searchParams.get('conversation');
    if (conversationId && user) {
      // Clear the query param
      setSearchParams({}, { replace: true });
      
      // Clear current server to switch to DM view
      setCurrentServer(null);
      
      // Find the conversation in the list or fetch it
      const existingConversation = conversations.find(c => c.id === conversationId);
      
      if (existingConversation) {
        setCurrentConversation(existingConversation);
        navigate('/app', { replace: true });
      } else {
        // Fetch conversations first, then find and set the target
        fetchConversations(user.id).then(() => {
          // After fetching, find the conversation
          const conv = useDMStore.getState().conversations.find(c => c.id === conversationId);
          if (conv) {
            setCurrentConversation(conv);
            navigate('/app', { replace: true });
          } else {
            // Conversation not found in list, try to fetch participants to build it
            supabase
              .from('dm_participants')
              .select('user_id')
              .eq('conversation_id', conversationId)
              .neq('user_id', user.id)
              .single()
              .then(async ({ data: participant }) => {
                if (participant) {
                  // Fetch the other user's details
                  const { data: otherUserData } = await supabase.rpc('get_user_by_id', {
                    _user_id: participant.user_id
                  });
                  
                  if (otherUserData) {
                    const conversation = {
                      id: conversationId,
                      created_at: new Date().toISOString(),
                      other_user: otherUserData as unknown as User
                    };
                    setCurrentConversation(conversation);
                    navigate('/app', { replace: true });
                  }
                }
              });
          }
        });
      }
    }
  }, [searchParams, user, conversations, setSearchParams, setCurrentServer, setCurrentConversation, fetchConversations, navigate]);

  // Real-time updates
  useRealtimeFriendships(user?.id || null);
  useRealtimeUsers();
  useRealtimeServer(currentServer?.id || null);
  useRealtimeNotifications(user?.id || null);
  usePresence();

  useEffect(() => {
    if (!user?.id) return;
    fetchFriends(user.id).finally(() => {
      const serverId = useServerStore.getState().currentServer?.id;
      if (serverId) {
        useServerStore.getState().fetchMembers(serverId);
      }
    });
  }, [user?.id, fetchFriends]);
  
  // Listen for own membership changes (kicks/bans)
  useRealtimeOwnMembership();

  // Real-time channel messages and reactions - at app level for stability
  useRealtimeMessages(currentChannel?.id || null);
  useRealtimeReactions(currentChannel?.id || null);

  // Real-time DMs at app level so messages are received even when not viewing DMs
  const { incrementUnread } = useUnreadDMs(user?.id || null);
  useRealtimeDMs({
    userId: user?.id || null,
    currentConversationId: currentConversation?.id || null,
    onNewMessage: (message, conversationId) => {
      // Increment unread if not viewing that conversation
      if (conversationId !== currentConversation?.id) {
        incrementUnread(conversationId);
      }
    },
  });

  // Background sync (handles offline queue, reconnection, periodic refresh)
  useBackgroundSync();

  // Sync preferences (theme, etc.) with database
  usePreferencesSync();

  // Sync URL params with store state - read from URL and update store
  useEffect(() => {
    if (!user || !servers.length) return;
    
    // If URL has serverId, set it in the store
    if (urlServerId) {
      const server = servers.find(s => s.id === urlServerId);
      if (server && server.id !== currentServer?.id) {
        setCurrentServer(server);
      } else if (!server) {
        // Server not found in user's servers, redirect to home
        navigate('/app', { replace: true });
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
      const channel = channels.find(c => c.id === urlChannelId && c.server_id === currentServer.id);
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
        const lastChannel = lastChannelId ? channels.find(c => c.id === lastChannelId) : null;
        const targetChannel = lastChannel || channels[0];
        if (targetChannel) {
          navigate(`/app/servers/${currentServer.id}/channels/${targetChannel.id}`, { replace: true });
        }
      }
    }
  }, [urlChannelId, channels, currentChannel, currentServer, urlServerId, setCurrentChannel, navigate, isServerSpecialView]);

  // When visiting server special views, clear current channel selection (so sidebar highlights correctly)
  useEffect(() => {
    if (!currentServer) return;
    if (!isServerSpecialView) return;
    if (currentChannel) {
      setCurrentChannel(null);
    }
  }, [isServerSpecialView, currentServer, currentChannel, setCurrentChannel]);

  // Fetch channels, members, roles, and permissions when server changes
  useEffect(() => {
    if (currentServer?.id) {
      fetchChannels(currentServer.id);
      fetchMembers(currentServer.id);
      fetchRoles(currentServer.id);
      fetchRolePermissions(currentServer.id);
    }
  }, [currentServer?.id, fetchChannels, fetchMembers, fetchRoles, fetchRolePermissions]);

  // Clear DM conversation when switching to a server
  useEffect(() => {
    if (currentServer && currentConversation) {
      setCurrentConversation(null);
    }
  }, [currentServer]);  // eslint-disable-line react-hooks-exhaustive-deps

  // Initialize auth and wait for it to complete before checking user
  useEffect(() => {
    let cancelled = false;
    
    (async () => {
      await initializeAuth();
      if (cancelled) return;
      // Force a re-render after auth init completes
      const state = useAuthStore.getState();
      if (!state.isLoading && !state.user) {
        navigate('/auth?mode=login');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Only redirect if we've finished loading and still no user
  useEffect(() => {
    if (!isLoading && !user) {
      // Small delay to ensure auth state is loaded from localStorage
      const timer = setTimeout(() => {
        const state = useAuthStore.getState();
        if (!state.user && !state.isLoading) {
          navigate('/auth?mode=login');
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, isLoading, navigate]);

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
      navigate('/app/friends');
    }
  };

  // DM View (no server selected)
  const isDMView = currentServer === null;

  // Show loading state - AFTER all hooks
  // Only full-screen block when we truly don't have a user yet.
  if (isLoading && !user) {
    return (
      <div className="h-screen bg-layout-chat flex items-center justify-center">
        <div className="animate-pulse-subtle text-primary">
          Loading...
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const desktopTitle =
    isDMView
      ? currentConversation
        ? (currentConversation.other_user?.display_name ||
            currentConversation.other_user?.username ||
            "Direct Messages")
        : "Direct Messages"
      : isServerOverviewView
        ? `${currentServer?.name || "Server"} • Overview`
        : isServerMembersViewAllowed
          ? `${currentServer?.name || "Server"} • Members`
          : currentChannel
        ? `# ${currentChannel.name}`
        : currentServer
          ? currentServer.name
          : "Kloak";

  return (
    <>
      <SEO title={desktopTitle} noIndex />
      <div className="h-screen flex flex-col overflow-hidden">
        <DesktopTitleBar title={desktopTitle} />

        {/* Connection Status Banner */}
        <ConnectionStatus />

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Mobile header - hide when in DM conversation (DMHeader handles it) */}
          {!(isDMView && currentConversation) && (
            <MobileHeader
              isDMView={isDMView}
              showFriends={showFriends}
              showExplore={showExplore}
            />
          )}

          {/* Desktop layout */}
          <div className="hidden md:flex flex-1 overflow-hidden">
            {/* Server list sidebar - 72px fixed */}
            <div className="w-[72px] flex-shrink-0 bg-layout-sidebar">
              <ServerSidebar />
            </div>

            {/* Full-screen settings pages - take full space except server icons */}
            {isServerSettingsOpen ? (
              <div className="flex-1 min-w-0">
                <ServerSettingsPage />
              </div>
            ) : activeModal === 'user-settings' ? (
              <div className="flex-1 min-w-0">
                <UserSettingsPage />
              </div>
            ) : activeModal === 'edit-channel' ? (
              <div className="flex-1 min-w-0">
                <ChannelSettingsPage />
              </div>
            ) : (
              <ResizablePanelGroup direction="horizontal" className="flex-1">
                {/* Secondary sidebar - resizable, default 240px (~15% of typical viewport) */}
                <ResizablePanel 
                  defaultSize={15} 
                  minSize={10} 
                  maxSize={30}
                  className="bg-layout-sidebar-secondary"
                >
                  <div className="h-full">
                    {isDMView ? (
                      <DMSidebar
                        showFriends={showFriends}
                        onShowFriendsChange={(show: boolean) => navigate(show ? '/app/friends' : '/app')}
                        showExplore={showExplore}
                        onShowExploreChange={(show: boolean) => navigate(show ? '/app/explore' : '/app')}
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
                    {isDMView ? (
                      currentConversation ? (
                        <DMChatArea />
                      ) : (
                        <>
                          <div className={showFriends ? 'block h-full' : 'hidden'}>
                            <FriendsList onOpenDM={() => navigate('/app')} />
                          </div>
                          <div className={showExplore ? 'block h-full' : 'hidden'}>
                            <ExploreServers />
                          </div>
                          <div className={!showFriends && !showExplore ? 'block h-full' : 'hidden'}>
                            <HomeLanding />
                          </div>
                        </>
                      )
                    ) : (
                      isServerOverviewView ? (
                        <ServerOverviewView />
                      ) : isServerMembersViewAllowed ? (
                        <ServerMembersView />
                      ) : (
                        <ChatArea />
                      )
                    )}
                  </div>
                </ResizablePanel>

                {/* Members sidebar - collapsible, only in server view */}
                {!isDMView && !isServerSpecialView && isMemberSidebarOpen && (
                  <>
                    <ResizableHandle className="w-1 bg-transparent hover:bg-primary/20 transition-colors" />
                    <ResizablePanel defaultSize={15} minSize={10} maxSize={25} className="bg-layout-members">
                      <MembersSidebar />
                    </ResizablePanel>
                  </>
                )}
              </ResizablePanelGroup>
            )}
          </div>

          {/* Mobile layout */}
          <div className="flex-1 md:hidden overflow-hidden bg-layout-chat relative">
            <VoicePersistentHost />
            {isDMView ? (
              currentConversation ? (
                <DMChatArea />
              ) : (
                <>
                  <div className={showFriends ? 'block h-full' : 'hidden'}>
                    <FriendsList onOpenDM={() => navigate('/app')} />
                  </div>
                  <div className={showExplore ? 'block h-full' : 'hidden'}>
                    <ExploreServers />
                  </div>
                  <div className={!showFriends && !showExplore ? 'block h-full' : 'hidden'}>
                    <HomeLanding />
                  </div>
                </>
              )
            ) : (
              isServerOverviewView ? (
                <ServerOverviewView />
              ) : isServerMembersViewAllowed ? (
                <ServerMembersView />
              ) : (
                <ChatArea />
              )
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sidebars */}
      <MobileSidebar
        isDMView={isDMView}
        showFriends={showFriends}
        onShowFriendsChange={(show: boolean) => navigate(show ? '/app/friends' : '/app')}
        showExplore={showExplore}
        onShowExploreChange={(show: boolean) => navigate(show ? '/app/explore' : '/app')}
      />
      <MobileMembersSidebar />

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
      <PermissionDebugPanel />
      <ImportDiscordTemplateModal />
      <ImportEmojiPackModal />

      {/* Persistent embed container for Twitch/Kick streams */}
      <PersistentEmbedContainer />

      {/* Dev-only presence diagnostics overlay (toggle via localStorage) */}
      <PresenceDebugOverlay />

      {/* Nested route placeholder (AppLayout is the /app layout route) */}
      <Outlet />
    </>
  );
};

export default AppLayout;
