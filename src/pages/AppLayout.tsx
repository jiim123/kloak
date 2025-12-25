import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, initializeAuth } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { ServerSidebar } from '@/components/layout/ServerSidebar';
import { ChannelSidebar } from '@/components/layout/ChannelSidebar';
import { ChatArea } from '@/components/layout/ChatArea';
import { MembersSidebar } from '@/components/layout/MembersSidebar';
import { 
  CreateServerModal, 
  JoinServerModal, 
  InviteModal, 
  ServerSettingsModal,
  CreateChannelModal,
  EditChannelModal 
} from '@/components/modals';
import { cn } from '@/lib/utils';
const AppLayout = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuthStore();
  const { isMemberSidebarOpen } = useUIStore();

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth?mode=login');
    }
  }, [user, isLoading, navigate]);

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
      <div className="h-screen flex overflow-hidden">
        {/* Server list sidebar - 72px fixed */}
        <div className="w-[72px] flex-shrink-0 bg-layout-sidebar">
          <ServerSidebar />
        </div>
        
        {/* Channel sidebar - 240px fixed */}
        <div className="w-60 flex-shrink-0 bg-layout-sidebar-secondary">
          <ChannelSidebar />
        </div>
        
        {/* Main chat area - flexible */}
        <div className="flex-1 min-w-0 bg-layout-chat">
          <ChatArea />
        </div>
        
        {/* Members sidebar - 240px, collapsible */}
        <div 
          className={cn(
            "flex-shrink-0 bg-layout-members transition-all duration-200",
            isMemberSidebarOpen ? "w-60" : "w-0 overflow-hidden"
          )}
        >
          <MembersSidebar />
        </div>
      </div>

      {/* Modals */}
      <CreateServerModal />
      <JoinServerModal />
      <InviteModal />
      <ServerSettingsModal />
      <CreateChannelModal />
      <EditChannelModal />
    </>
  );
};

export default AppLayout;