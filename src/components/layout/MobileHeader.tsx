import { memo, useMemo, useCallback } from "react";
import { Menu, Hash, Volume2, Users, ClipboardList, Megaphone, MessageSquare, Film, CalendarDays } from "lucide-react";
import { useServerStore } from "@/stores/serverStore";
import { useUIStore } from "@/stores/uiStore";
import { useDMStore } from "@/stores/dmStore";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Button } from "@/components/ui/button";

interface MobileHeaderProps {
  isDMView: boolean;
}

const safeAreaStyle = { paddingTop: "env(safe-area-inset-top, 0px)" } as const;

export const MobileHeader = memo(({ isDMView }: MobileHeaderProps) => {
  const { currentServer, currentChannel } = useServerStore();
  const { currentConversation } = useDMStore();
  const { setMobileSidebarOpen, isMemberSidebarOpen, setMemberSidebarOpen, openModal } = useUIStore();

  const title = useMemo(() => {
    if (isDMView) {
      if (currentConversation?.other_user) {
        return currentConversation.other_user.display_name || currentConversation.other_user.username;
      }
      return "Home";
    }

    if (currentChannel) {
      return currentChannel.name;
    }

    return currentServer?.name || "Kloak";
  }, [isDMView, currentConversation, currentChannel, currentServer]);

  const channelIcon = useMemo(() => {
    if (isDMView || !currentChannel) return null;

    if (currentChannel.type === "voice") {
      return <Volume2 className="w-5 h-5 text-muted-foreground shrink-0" />;
    }
    if (currentChannel.type === "announcement") {
      return <Megaphone className="w-5 h-5 text-muted-foreground shrink-0" />;
    }
    if (currentChannel.type === "forum") {
      return <MessageSquare className="w-5 h-5 text-muted-foreground shrink-0" />;
    }
    if (currentChannel.type === "media") {
      return <Film className="w-5 h-5 text-muted-foreground shrink-0" />;
    }
    if (currentChannel.type === "tasks") {
      return <ClipboardList className="w-5 h-5 text-muted-foreground shrink-0" />;
    }
    if (currentChannel.type === "calendar") {
      return <CalendarDays className="w-5 h-5 text-muted-foreground shrink-0" />;
    }

    return <Hash className="w-5 h-5 text-muted-foreground shrink-0" />;
  }, [isDMView, currentChannel]);

  const openSidebar = useCallback(() => setMobileSidebarOpen(true), [setMobileSidebarOpen]);
  const toggleMembers = useCallback(() => setMemberSidebarOpen(!isMemberSidebarOpen), [setMemberSidebarOpen, isMemberSidebarOpen]);

  const showMembersToggle = !isDMView && currentServer;

  return (
    <header
      className="sticky top-0 z-40 md:hidden bg-layout-members/90 backdrop-blur-sm border-b border-border/50"
      style={safeAreaStyle}
    >
      <div className="flex items-center justify-between gap-3 px-3 h-14">
        {/* Left: Sidebar toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="w-11 h-11 shrink-0 rounded-xl active:scale-95 transition-transform"
          onClick={openSidebar}
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </Button>

        {/* Center: Current channel / view title */}
        {!isDMView && currentChannel ? (
          <button
            className="flex-1 flex items-center justify-center gap-1.5 min-w-0 px-2 active:opacity-70 transition-opacity"
            onClick={() => openModal("channel-info")}
          >
            {channelIcon}
            <h1 className="font-medium text-foreground truncate text-base leading-tight">{title}</h1>
          </button>
        ) : (
          <div className="flex-1 flex items-center justify-center gap-1.5 min-w-0 px-2">
            {channelIcon}
            <h1 className="font-medium text-foreground truncate text-base leading-tight">{title}</h1>
          </div>
        )}

        {/* Right: Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {showMembersToggle && (
            <Button
              variant="ghost"
              size="icon"
              className="w-11 h-11 shrink-0 rounded-xl active:scale-95 transition-transform"
              onClick={toggleMembers}
              aria-label="Toggle members"
            >
              <Users className="w-5 h-5" />
            </Button>
          )}
          <div className="[&_button]:w-11 [&_button]:h-11 [&_button]:rounded-xl [&_button]:active:scale-95 [&_button]:transition-transform">
            <NotificationBell />
          </div>
        </div>
      </div>
    </header>
  );
});

MobileHeader.displayName = "MobileHeader";
