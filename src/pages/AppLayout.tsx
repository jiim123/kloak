import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, initializeAuth } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { ServerSidebar } from '@/components/layout/ServerSidebar';
import { ChannelSidebar } from '@/components/layout/ChannelSidebar';
import { ChatArea } from '@/components/layout/ChatArea';
import { MembersSidebar } from '@/components/layout/MembersSidebar';
import { DMSidebar, FriendsList, DMChatArea } from '@/components/dm';
import { 
  CreateServerModal, 
  JoinServerModal, 
  InviteModal, 
  ServerSettingsModal,
  CreateChannelModal,
  EditChannelModal,
  UserSettingsModal,
  UserProfilePopup,
  PinnedMessagesPanel,
  SearchModal,
  QuickSwitcherModal,
  KeyboardShortcutsModal
} from '@/components/modals';
import { cn } from '@/lib/utils';
import { useDMStore } from '@/stores/dmStore';
import { useRealtimeFriendships, useRealtimeUsers, useRealtimeServer, useRealtimeNotifications } from '@/hooks';

const AppLayout = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuthStore();
  const { isMemberSidebarOpen } = useUIStore();
  const { currentServer } = useServerStore();
  const { currentConversation } = useDMStore();
  
  // Track if showing friends list in DM view
  const [showFriends, setShowFriends] = useState(true);

  // Real-time updates
  useRealtimeFriendships(user?.id || null);
  useRealtimeUsers();
  useRealtimeServer(currentServer?.id || null);
  useRealtimeNotifications(user?.id || null);

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth?mode=login');
    }
  }, [user, isLoading, navigate]);

  // Reset to friends view when switching to DM
  useEffect(() => {
    if (!currentServer && !currentConversation) {
      setShowFriends(true);
    }
  }, [currentServer, currentConversation]);

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

  // DM View (no server selected)
  const isDMView = currentServer === null;

  return (
    <>
      <div className="h-screen flex overflow-hidden">
        {/* Server list sidebar - 72px fixed */}
        <div className="w-[72px] flex-shrink-0 bg-layout-sidebar">
          <ServerSidebar />
        </div>
        
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
            showFriends ? (
              <FriendsList onOpenDM={() => setShowFriends(false)} />
            ) : (
              <DMChatArea />
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
      </div>

      {/* Modals */}
      <CreateServerModal />
      <JoinServerModal />
      <InviteModal />
      <ServerSettingsModal />
      <CreateChannelModal />
      <EditChannelModal />
      <UserSettingsModal />
      <UserProfilePopup />
      <PinnedMessagesPanel />
      <SearchModal />
      <QuickSwitcherModal />
      <KeyboardShortcutsModal />
    </>
  );
};

export default AppLayout;