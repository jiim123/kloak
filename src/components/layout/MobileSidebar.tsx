import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useUIStore } from '@/stores/uiStore';
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
  
  // Track previous pathname to detect actual navigation changes
  const prevPathnameRef = useRef(location.pathname);
  const wasOpenRef = useRef(false);

  // Close sidebar when route changes to a channel/DM (not just server switches)
  useEffect(() => {
    const currentPathname = location.pathname;
    const prevPathname = prevPathnameRef.current;
    
    // Only close if pathname actually changed AND sidebar was open
    if (currentPathname !== prevPathname && wasOpenRef.current) {
      // Keep open when navigating to a server root or home (server list navigation)
      const isNavigatingToServerRoot = /^\/app\/servers\/[^/]+\/?$/.test(currentPathname);
      const isNavigatingToHome = currentPathname === '/app' || currentPathname === '/app/';
      
      if (!isNavigatingToServerRoot && !isNavigatingToHome) {
        closeMobileSidebars();
      }
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
    <Drawer direction="left" open={isMobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
      <DrawerContent
        className="p-0 gap-0 bg-layout-sidebar shadow-lg border-r border-border/30 w-[100vw] max-w-[100vw] flex flex-row h-full"
      >
        <DrawerHeader className="sr-only">
          <DrawerTitle>Navigation</DrawerTitle>
        </DrawerHeader>
        
        {/* Server sidebar - always visible */}
        <div className="w-[72px] flex-shrink-0 bg-layout-sidebar h-full pt-3">
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
      </DrawerContent>
    </Drawer>
  );
};
