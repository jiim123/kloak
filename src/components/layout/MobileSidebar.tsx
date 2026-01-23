import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
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
  showExplore: boolean;
  onShowExploreChange: (show: boolean) => void;
}

export const MobileSidebar = ({ isDMView, showFriends, onShowFriendsChange, showExplore, onShowExploreChange }: MobileSidebarProps) => {
  const location = useLocation();
  const { isMobileSidebarOpen, setMobileSidebarOpen, closeMobileSidebars } = useUIStore();
  const { currentChannel } = useServerStore();

  // Close sidebar when a channel is selected
  useEffect(() => {
    if (currentChannel) {
      closeMobileSidebars();
    }
  }, [currentChannel, closeMobileSidebars]);

  // Close sidebar when route changes (for Friends/Explore navigation)
  // Only close if sidebar is actually open to avoid unnecessary updates
  useEffect(() => {
    if (isMobileSidebarOpen) {
      closeMobileSidebars();
    }
  }, [location.pathname]); // Intentionally not including closeMobileSidebars or isMobileSidebarOpen to avoid loops

  // Handle friends change with sidebar close
  const handleShowFriendsChange = (show: boolean) => {
    onShowFriendsChange(show);
    if (show) {
      closeMobileSidebars();
    }
  };

  const handleShowExploreChange = (show: boolean) => {
    onShowExploreChange(show);
    if (show) {
      closeMobileSidebars();
    }
  };

  return (
    <Sheet open={isMobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
      <SheetContent
        side="left"
        className="p-0 gap-0 bg-transparent shadow-none border-r-0 w-[calc(72px+240px)] max-w-[85vw] flex"
        hideCloseButton
        onInteractOutside={(event) => {
          const target = event.target as HTMLElement | null;
          if (!target) return;

          // Dropdown menus are portalled to <body>, which Radix Sheet treats as an outside click.
          // Prevent the sheet from closing so menu item clicks can run, and let handlers close it explicitly.
          if (target.closest('[data-radix-popper-content-wrapper]') || target.closest('[role="menu"]')) {
            event.preventDefault();
          }
        }}
      >
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
              showExplore={showExplore}
              onShowExploreChange={handleShowExploreChange}
            />
          ) : (
            <ChannelSidebar />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
