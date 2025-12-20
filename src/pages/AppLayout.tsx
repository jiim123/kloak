import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, initializeAuth } from '@/stores/authStore';
import { ServerSidebar } from '@/components/layout/ServerSidebar';
import { ChannelSidebar } from '@/components/layout/ChannelSidebar';
import { ChatArea } from '@/components/layout/ChatArea';
import { MembersSidebar } from '@/components/layout/MembersSidebar';

const AppLayout = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuthStore();

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
      <div className="h-screen bg-background flex items-center justify-center">
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
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Server list sidebar */}
      <ServerSidebar />
      
      {/* Channel sidebar */}
      <ChannelSidebar />
      
      {/* Main chat area */}
      <ChatArea />
      
      {/* Members sidebar */}
      <MembersSidebar />
    </div>
  );
};

export default AppLayout;