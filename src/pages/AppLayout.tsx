import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore, initializeAuth } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { ServerSidebar } from '@/components/layout/ServerSidebar';
import { HomeLanding } from '@/components/home/HomeLanding';
import { ChannelSidebar } from '@/components/layout/ChannelSidebar';
import { ChatArea } from '@/components/layout/ChatArea';
import { MembersSidebar } from '@/components/layout/MembersSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { MobileSidebar } from '@/components/layout/MobileSidebar';
import { MobileMembersSidebar } from '@/components/layout/MobileMembersSidebar';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { DMSidebar, FriendsList, DMChatArea } from '@/components/dm';
import { ServerSettingsPage } from '@/components/settings/ServerSettingsPage';
import {
  CreateServerModal,
  JoinServerModal,
  InviteModal,
  CreateChannelModal,
  EditChannelModal,
  UserSettingsModal,
  UserProfilePopup,
  PinnedMessagesPanel,
  SearchModal,
  QuickSwitcherModal,
  KeyboardShortcutsModal,
  ConfirmActionModal,
  ChangeNicknameModal,
  WelcomeModal,
  PermissionDebugPanel
} from '@/components/modals';
import { PersistentEmbedContainer } from '@/components/chat/PersistentEmbedContainer';
import { DesktopTitleBar } from '@/components/layout/DesktopTitleBar';
import { cn } from '@/lib/utils';
import { useDMStore } from '@/stores/dmStore';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeFriendships, useRealtimeUsers, useRealtimeServer, useRealtimeNotifications, useRealtimeDMs, useUnreadDMs, useRealtimeMessages, useRealtimeReactions } from '@/hooks';
import { useIsMobile } from '@/hooks/use-mobile';
import { useBackgroundSync } from '@/hooks/useBackgroundSync';
import { usePreferencesSync } from '@/hooks/usePreferencesSync';
import type { User } from '@/types';

const AppLayout = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isLoading, isNewUser, setIsNewUser } = useAuthStore();
  const { isMemberSidebarOpen, isServerSettingsOpen, closeMobileSidebars } = useUIStore();
  const { currentServer, currentChannel, setCurrentChannel, setCurrentServer, fetchChannels, fetchMembers, fetchRolePermissions, fetchRoles } = useServerStore();
  const { conversations, currentConversation, setCurrentConversation, fetchConversations } = useDMStore();
  const isMobile = useIsMobile();

  // Track if showing friends list in DM view
  // Default to false so we show the Landing page by default
  const [showFriends, setShowFriends] = useState(false);

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
        setShowFriends(false);
      } else {
        // Fetch conversations first, then find and set the target
        fetchConversations(user.id).then(() => {
          // After fetching, find the conversation
          const conv = useDMStore.getState().conversations.find(c => c.id === conversationId);
          if (conv) {
            setCurrentConversation(conv);
            setShowFriends(false);
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
                    setShowFriends(false);
                  }
                }
              });
          }
        });
      }
    }
  }, [searchParams, user, conversations, setSearchParams, setCurrentServer, setCurrentConversation, fetchConversations]);

  // Real-time updates
  useRealtimeFriendships(user?.id || null);
  useRealtimeUsers();
  useRealtimeServer(currentServer?.id || null);
  useRealtimeNotifications(user?.id || null);

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
      setShowFriends(true);
    }
  };

  // DM View (no server selected)
  const isDMView = currentServer === null;

  // Show loading state - AFTER all hooks
  if (isLoading) {
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
      : currentChannel
        ? `# ${currentChannel.name}`
        : currentServer
          ? currentServer.name
          : "Kloak";

  return (
    <>
      <div className="h-screen flex flex-col overflow-hidden">
        <DesktopTitleBar title={desktopTitle} />

        {/* Connection Status Banner */}
        <ConnectionStatus />

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Mobile header */}
          <MobileHeader
            isDMView={isDMView}
            showFriends={showFriends}
          />

          {/* Desktop layout */}
          <div className="hidden md:flex flex-1 overflow-hidden">
            {/* Server list sidebar - 72px fixed */}
            <div className="w-[72px] flex-shrink-0 bg-layout-sidebar">
              <ServerSidebar />
            </div>

            {/* Server Settings Page - takes full space except server icons */}
            {isServerSettingsOpen ? (
              <div className="flex-1 min-w-0">
                <ServerSettingsPage />
              </div>
            ) : (
              <>
                {/* Secondary sidebar - 240px fixed */}
                <div className="w-60 flex-shrink-0 bg-layout-sidebar-secondary">
                  {isDMView ? (
                    <DMSidebar
                      showFriends={showFriends}
                      onShowFriendsChange={setShowFriends}
                    />
                  ) : (
                    <ChannelSidebar />
                  )}
                </div>

                {/* Main area - flexible */}
                <div className="flex-1 min-w-0 bg-layout-chat relative">
                  {isDMView ? (
                    currentConversation ? (
                      <DMChatArea />
                    ) : showFriends ? (
                      <FriendsList onOpenDM={() => setShowFriends(false)} />
                    ) : (
                      <HomeLanding />
                    )
                  ) : (
                    <ChatArea />
                  )}
                </div>

                {/* Members sidebar - 240px, collapsible, only in server view */}
                {!isDMView && (
                  <div
                    className={cn(
                      "flex-shrink-0 bg-layout-members transition-all duration-200",
                      isMemberSidebarOpen ? "w-60" : "w-0 overflow-hidden"
                    )}
                  >
                    <MembersSidebar />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Mobile layout */}
          <div className="flex-1 md:hidden overflow-hidden bg-layout-chat">
            {isDMView ? (
              showFriends ? (
                <FriendsList onOpenDM={() => setShowFriends(false)} />
              ) : (
                <DMChatArea />
              )
            ) : (
              <ChatArea />
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sidebars */}
      <MobileSidebar
        isDMView={isDMView}
        showFriends={showFriends}
        onShowFriendsChange={setShowFriends}
      />
      <MobileMembersSidebar />

      {/* Modals */}
      <CreateServerModal />
      <JoinServerModal />
      <InviteModal />
      <CreateChannelModal />
      <EditChannelModal />
      <UserSettingsModal />
      <UserProfilePopup />
      <PinnedMessagesPanel />
      <SearchModal />
      <QuickSwitcherModal />
      <KeyboardShortcutsModal />
      <ConfirmActionModal />
      <ChangeNicknameModal />
      <WelcomeModal open={isNewUser} onClose={() => setIsNewUser(false)} />
      <PermissionDebugPanel />

      {/* Persistent embed container for Twitch/Kick streams */}
      <PersistentEmbedContainer />
    </>
  );
};

export default AppLayout;
