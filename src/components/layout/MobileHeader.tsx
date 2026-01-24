import { Menu, Hash, Users, Volume2 } from 'lucide-react';
import { useServerStore } from '@/stores/serverStore';
import { useUIStore } from '@/stores/uiStore';
import { useDMStore } from '@/stores/dmStore';

interface MobileHeaderProps {
  isDMView: boolean;
  showFriends: boolean;
  showExplore: boolean;
}

export const MobileHeader = ({ isDMView, showFriends, showExplore }: MobileHeaderProps) => {
  const { currentServer, currentChannel } = useServerStore();
  const { currentConversation } = useDMStore();
  const { setMobileSidebarOpen, toggleMemberSidebar } = useUIStore();

  const getTitle = () => {
    if (isDMView) {
      if (showFriends) return 'Friends';
      if (showExplore) return 'Explore';
      if (currentConversation?.other_user) {
        return currentConversation.other_user.display_name || currentConversation.other_user.username;
      }
      return 'Home';
    }
    
    if (currentChannel) {
      return currentChannel.name;
    }
    
    return currentServer?.name || 'Kloak';
  };

  const getChannelIcon = () => {
    if (isDMView) return null;
    if (!currentChannel) return null;
    
    if (currentChannel.type === 'voice') {
      return <Volume2 className="w-4 h-4 text-muted-foreground" />;
    }
    return <Hash className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className="sticky top-0 z-40 px-4 pt-4 pb-2 md:hidden bg-background">
      <div className="flex items-center gap-2">
        {/* Section 1: Sidebar Toggle */}
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="p-2 rounded-2xl bg-secondary text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Section 2: Current Channel/View */}
        <div className="flex-1 flex items-center gap-2 min-w-0 p-2 bg-secondary rounded-2xl">
          {getChannelIcon()}
          <span className="font-medium text-foreground truncate text-[15px]">
            {getTitle()}
          </span>
        </div>

        {/* Section 3: Members Toggle (only for server view) */}
        {!isDMView && currentServer && (
          <button
            onClick={toggleMemberSidebar}
            className="p-2 rounded-2xl bg-secondary text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
          >
            <Users className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};
