import { Menu, Hash, Users, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useServerStore } from '@/stores/serverStore';
import { useUIStore } from '@/stores/uiStore';
import { useDMStore } from '@/stores/dmStore';

interface MobileHeaderProps {
  isDMView: boolean;
  showFriends: boolean;
  onBack?: () => void;
}

export const MobileHeader = ({ isDMView, showFriends, onBack }: MobileHeaderProps) => {
  const { currentServer, currentChannel } = useServerStore();
  const { currentConversation } = useDMStore();
  const { setMobileSidebarOpen, toggleMemberSidebar } = useUIStore();

  const getTitle = () => {
    if (isDMView) {
      if (showFriends) return 'Friends';
      if (currentConversation?.other_user) {
        return currentConversation.other_user.display_name || currentConversation.other_user.username;
      }
      return 'Direct Messages';
    }
    
    if (currentChannel) {
      return currentChannel.name;
    }
    
    return currentServer?.name || 'Kloak';
  };

  const showBackButton = isDMView && !showFriends && currentConversation;

  return (
    <div className="h-12 px-2 flex items-center gap-2 border-b border-border bg-layout-sidebar-secondary md:hidden">
      {showBackButton ? (
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8"
          onClick={onBack}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8"
          onClick={() => setMobileSidebarOpen(true)}
        >
          <Menu className="w-5 h-5" />
        </Button>
      )}

      <div className="flex items-center gap-2 flex-1 min-w-0">
        {!isDMView && currentChannel && (
          <Hash className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        )}
        <h1 className="font-semibold text-foreground truncate">
          {getTitle()}
        </h1>
      </div>

      {/* Members toggle for server view */}
      {!isDMView && currentServer && (
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8"
          onClick={toggleMemberSidebar}
        >
          <Users className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
};
