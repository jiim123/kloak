import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
  
  // Track previous pathname to detect actual navigation changes
  const prevPathnameRef = useRef(location.pathname);
  const wasOpenRef = useRef(false);

  // Close sidebar when a channel is selected
  useEffect(() => {
    if (currentChannel && isMobileSidebarOpen) {
      closeMobileSidebars();
    }
  }, [currentChannel?.id]); // Only react to channel ID changes

  // Close sidebar when route changes (for Friends/Explore navigation)
  useEffect(() => {
    const currentPathname = location.pathname;
    const prevPathname = prevPathnameRef.current;
    
    // Only close if pathname actually changed AND sidebar was open
    if (currentPathname !== prevPathname && wasOpenRef.current) {
      closeMobileSidebars();
    }
    
    prevPathnameRef.current = currentPathname;
  }, [location.pathname, closeMobileSidebars]);

  // Track open state for the pathname effect
  useEffect(() => {
    wasOpenRef.current = isMobileSidebarOpen;
  }, [isMobileSidebarOpen]);

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
        className="p-0 gap-0 bg-layout-sidebar shadow-lg border-r border-border/30 w-[calc(72px+240px)] max-w-[85vw] flex"
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