import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, initializeAuth } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { ServerSidebar } from '@/components/layout/ServerSidebar';
import { ChannelSidebar } from '@/components/layout/ChannelSidebar';
import { ChatArea } from '@/components/layout/ChatArea';
import { MembersSidebar } from '@/components/layout/MembersSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { MobileSidebar } from '@/components/layout/MobileSidebar';
import { MobileMembersSidebar } from '@/components/layout/MobileMembersSidebar';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
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
  KeyboardShortcutsModal,
  ConfirmActionModal,
  ChangeNicknameModal
} from '@/components/modals';
import { cn } from '@/lib/utils';
import { useDMStore } from '@/stores/dmStore';
import { useRealtimeFriendships, useRealtimeUsers, useRealtimeServer, useRealtimeNotifications } from '@/hooks';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOfflineSync } from '@/hooks/useOfflineSync';

const AppLayout = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuthStore();
  const { isMemberSidebarOpen, closeMobileSidebars } = useUIStore();
  const { currentServer, currentChannel, setCurrentChannel } = useServerStore();
  const { currentConversation, setCurrentConversation } = useDMStore();
  const isMobile = useIsMobile();
  
  // Track if showing friends list in DM view
  const [showFriends, setShowFriends] = useState(true);

  // Real-time updates
  useRealtimeFriendships(user?.id || null);
  useRealtimeUsers();
  useRealtimeServer(currentServer?.id || null);
  useRealtimeNotifications(user?.id || null);
  
  // Offline message sync
  useOfflineSync();

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

  return (
    <>
      {/* Offline Banner */}
      <OfflineBanner />
      
      <div className="h-screen flex flex-col md:flex-row overflow-hidden">
        {/* Mobile header */}
        <MobileHeader 
          isDMView={isDMView} 
          showFriends={showFriends}
          onBack={handleMobileBack}
        />

        {/* Desktop layout */}
        <div className="hidden md:flex flex-1 overflow-hidden">
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
      <ServerSettingsModal />
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
    </>
  );
};

export default AppLayout;
