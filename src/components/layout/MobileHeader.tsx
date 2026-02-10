import { Menu, Hash, Users, Volume2 } from "lucide-react";
import { useServerStore } from "@/stores/serverStore";
import { useUIStore } from "@/stores/uiStore";
import { useDMStore } from "@/stores/dmStore";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Button } from "@/components/ui/button";

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
      if (showFriends) return "Friends";
      if (showExplore) return "Explore";
      if (currentConversation?.other_user) {
        return currentConversation.other_user.display_name || currentConversation.other_user.username;
      }
      return "Home";
    }

    if (currentChannel) {
      return currentChannel.name;
    }

    return currentServer?.name || "Kloak";
  };

  const getChannelIcon = () => {
    if (isDMView) return null;
    if (!currentChannel) return null;

    if (currentChannel.type === "voice") {
      return <Volume2 className="w-5 h-5 text-muted-foreground shrink-0" />;
    }
    return <Hash className="w-5 h-5 text-muted-foreground shrink-0" />;
  };

  return (
    <header
      className="sticky top-0 z-40 md:hidden bg-background/80 backdrop-blur-lg border-b border-border/50 rounded-b-2xl"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="flex items-center justify-between gap-3 px-3 h-14">
        {/* Left: Sidebar toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="w-11 h-11 shrink-0 rounded-xl active:scale-95 transition-transform"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </Button>

        {/* Center: Current channel / view title */}
        <div className="flex-1 flex items-center justify-center gap-1.5 min-w-0 px-2">
          {getChannelIcon()}
          <h1 className="font-semibold text-foreground truncate text-base leading-tight">{getTitle()}</h1>
        </div>

        {/* Right: Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <NotificationBell />

          {!isDMView && currentServer && (
            <Button
              variant="ghost"
              size="icon"
              className="w-11 h-11 rounded-xl active:scale-95 transition-transform"
              onClick={toggleMemberSidebar}
              aria-label="Toggle member list"
            >
              <Users className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
