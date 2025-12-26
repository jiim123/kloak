import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { ServerSidebar } from './ServerSidebar';
import { ChannelSidebar } from './ChannelSidebar';
import { DMSidebar } from '@/components/dm/DMSidebar';

interface MobileSidebarProps {
  isDMView: boolean;
  showFriends: boolean;
  onShowFriendsChange: (show: boolean) => void;
}

export const MobileSidebar = ({ isDMView, showFriends, onShowFriendsChange }: MobileSidebarProps) => {
  const { isMobileSidebarOpen, setMobileSidebarOpen, closeMobileSidebars } = useUIStore();
  const { currentChannel } = useServerStore();

  // Close sidebar when a channel is selected
  useEffect(() => {
    if (currentChannel) {
      closeMobileSidebars();
    }
  }, [currentChannel, closeMobileSidebars]);

  // Handle friends change with sidebar close
  const handleShowFriendsChange = (show: boolean) => {
    onShowFriendsChange(show);
    if (show) {
      closeMobileSidebars();
    }
  };

  return (
    <Sheet open={isMobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
      <SheetContent side="left" className="p-0 w-[calc(72px+240px)] max-w-[85vw] flex">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        
        {/* Server sidebar - always visible */}
        <div className="w-[72px] flex-shrink-0 bg-layout-sidebar h-full">
          <ServerSidebar />
        </div>
        
        {/* Channel/DM sidebar */}
        <div className="flex-1 min-w-0 bg-layout-sidebar-secondary h-full overflow-hidden">
          {isDMView ? (
            <DMSidebar 
              showFriends={showFriends} 
              onShowFriendsChange={handleShowFriendsChange} 
            />
          ) : (
            <ChannelSidebar />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
