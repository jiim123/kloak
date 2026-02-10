import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { Bell, Check, Trash2, MessageCircle, AtSign, UserPlus, Mail, X, AlertTriangle, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MotionButton } from "@/components/ui/motion-elements";
import { useNotificationStore } from "@/stores/notificationStore";
import { useFriendStore } from "@/stores/friendStore";
import { useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import { requestNotificationPermission } from "@/hooks/useRealtimeNotifications";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";

export interface NotificationBellProps {
  variant?: "default" | "sidebar";
}

// Theme types and classes
type NotificationTheme = "amber" | "emerald" | "red" | "blue" | "violet" | "default";

const themeClasses = {
  amber: { bg: "bg-amber-500/10", text: "text-amber-500", indicator: "bg-amber-500", bgUnread: "bg-amber-500/5" },
  emerald: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-500",
    indicator: "bg-emerald-500",
    bgUnread: "bg-emerald-500/5",
  },
  red: { bg: "bg-red-500/10", text: "text-red-500", indicator: "bg-red-500", bgUnread: "bg-red-500/5" },
  blue: { bg: "bg-blue-500/10", text: "text-blue-500", indicator: "bg-blue-500", bgUnread: "bg-blue-500/5" },
  violet: { bg: "bg-violet-500/10", text: "text-violet-500", indicator: "bg-violet-500", bgUnread: "bg-violet-500/5" },
  default: { bg: "bg-primary/10", text: "text-primary", indicator: "bg-primary", bgUnread: "bg-primary/5" },
};

const getNotificationTheme = (notification: Notification): NotificationTheme => {
  // Check for warning (kick/ban) based on title
  const title = notification.title?.toLowerCase() || "";
  if (title.includes("kicked") || title.includes("banned")) {
    return "red";
  }

  switch (notification.type) {
    case "mention":
      return "amber";
    case "dm":
      return "emerald";
    case "friend_request":
      return "blue";
    case "server_invite":
      return "violet";
    default:
      return "default";
  }
};

const getNotificationIcon = (notification: Notification) => {
  // Check for warning first
  const title = notification.title?.toLowerCase() || "";
  if (title.includes("kicked") || title.includes("banned")) {
    return <AlertTriangle className="w-4 h-4" />;
  }

  switch (notification.type) {
    case "mention":
      return <AtSign className="w-4 h-4" />;
    case "dm":
      return <MessageCircle className="w-4 h-4" />;
    case "friend_request":
      return <UserPlus className="w-4 h-4" />;
    case "server_invite":
      return <Mail className="w-4 h-4" />;
    default:
      return <Bell className="w-4 h-4" />;
  }
};

// Extract username from notification body like "username sent you a friend request"
const extractUsernameFromBody = (body: string | null): string | null => {
  if (!body) return null;
  const match = body.match(/^(\S+)\s+sent you a friend request/);
  return match ? match[1] : null;
};

const sidebarIconVariants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1, opacity: 1, borderRadius: 4 },
  hover: { borderRadius: 6 },
  tap: { scale: 0.95 },
};

export const NotificationBell = ({ variant = "default" }: NotificationBellProps) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAllNotifications, deleteNotification } =
    useNotificationStore();
  const { pendingRequests, acceptRequest, declineRequest } = useFriendStore();
  const [isOpen, setIsOpen] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Request permission on first interaction
  useEffect(() => {
    if (isOpen && unreadCount > 0) {
      requestNotificationPermission();
    }
  }, [isOpen, unreadCount]);

  const handleMarkAllAsRead = () => {
    if (user) {
      markAllAsRead(user.id);
    }
  };

  const handleClearAll = () => {
    if (user) {
      clearAllNotifications(user.id);
    }
  };

  const handleNotificationClick = (notificationId: string, link: string | null, notificationType: string) => {
    markAsRead(notificationId);
    if (link) {
      // Parse the link to extract server, channel, and message IDs
      const url = new URL(link, window.location.origin);
      const serverId = url.searchParams.get("server");
      const channelId = url.searchParams.get("channel");
      const messageId = url.searchParams.get("message");
      const conversationId = url.searchParams.get("conversation");

      // For mentions, navigate to the proper server/channel route
      if (notificationType === "mention" && serverId && channelId) {
        // Clear current server state to force a fresh load
        useServerStore.getState().clearServerState();

        // Navigate with message ID for scroll-to-message
        if (messageId) {
          navigate(`/app/servers/${serverId}/channels/${channelId}?message=${messageId}`);
        } else {
          navigate(`/app/servers/${serverId}/channels/${channelId}`);
        }
      } else if (conversationId) {
        // DM navigation
        navigate(`/app?conversation=${conversationId}`);
      } else {
        // Fallback to the link as-is
        navigate(link);
      }
    }
    setIsOpen(false);
  };

  const handleAcceptFriendRequest = async (notification: Notification) => {
    if (!user) return;

    const username = extractUsernameFromBody(notification.body);
    if (!username) return;

    const request = pendingRequests.find((r) => r.username?.toLowerCase() === username.toLowerCase());

    if (!request) return;

    setProcessingIds((prev) => new Set(prev).add(notification.id));

    try {
      await acceptRequest(request.friendship_id, user.id);
      deleteNotification(notification.id);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(notification.id);
        return next;
      });
    }
  };

  const handleDeclineFriendRequest = async (notification: Notification) => {
    if (!user) return;

    const username = extractUsernameFromBody(notification.body);
    if (!username) return;

    const request = pendingRequests.find((r) => r.username?.toLowerCase() === username.toLowerCase());

    if (!request) return;

    setProcessingIds((prev) => new Set(prev).add(notification.id));

    try {
      await declineRequest(request.friendship_id, user.id);
      deleteNotification(notification.id);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(notification.id);
        return next;
      });
    }
  };

  const isFriendRequestPending = (notification: Notification): boolean => {
    if (notification.type !== "friend_request") return false;
    const username = extractUsernameFromBody(notification.body);
    if (!username) return false;
    return pendingRequests.some((r) => r.username?.toLowerCase() === username.toLowerCase());
  };

  const renderDefaultTrigger = () => (
    <Button variant="ghost" size="icon" className="relative w-8 h-8">
      <Bell className="w-4 h-4" />
      {unreadCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-[10px]"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </Badge>
      )}
    </Button>
  );

  const renderSidebarTrigger = () => (
    <MotionButton className="relative group flex-shrink-0" whileHover="hover" whileTap="tap">
      <motion.div
        variants={sidebarIconVariants}
        initial="animate"
        animate="animate"
        whileHover="hover"
        whileTap="tap"
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="w-10 h-10 flex items-center justify-center bg-secondary hover:bg-primary/20 hover:text-neutral-200"
      >
        <Bell className="w-4 h-4" />
      </motion.div>
      {unreadCount > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] bg-destructive rounded-[4px] text-xs text-destructive-foreground flex items-center justify-center px-1 font-bold shadow-lg"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </motion.span>
      )}
    </MotionButton>
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>{variant === "sidebar" ? renderSidebarTrigger() : renderDefaultTrigger()}</PopoverTrigger>

      <PopoverContent
        className="w-96 p-0 rounded-xl border-border/50 bg-popover/95 backdrop-blur-xl shadow-xl overflow-hidden"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg hover:bg-secondary/60 transition-colors"
                onClick={handleMarkAllAsRead}
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg hover:bg-secondary/60 transition-colors"
                onClick={handleClearAll}
                title="Clear all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <ScrollArea className="max-h-[420px] overflow-y-auto overflow-x-hidden">
          {notifications.length > 0 ? (
            <div className="p-2 space-y-1">
              {notifications.map((notification, index) => {
                const isProcessing = processingIds.has(notification.id);
                const showFriendActions = isFriendRequestPending(notification);
                const isUnread = !notification.is_read;
                const theme = getNotificationTheme(notification);
                const colors = themeClasses[theme];

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "group relative flex flex-col gap-2 p-3 rounded-xl transition-colors animate-notification-enter",
                      isUnread && colors.bgUnread,
                      !showFriendActions && "cursor-pointer hover:bg-secondary/60",
                    )}
                    style={{
                      animationDelay: `${index * 50}ms`,
                      animationFillMode: "both",
                    }}
                    onClick={() =>
                      !showFriendActions &&
                      handleNotificationClick(notification.id, notification.link, notification.type)
                    }
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon container */}
                      <div
                        className={cn(
                          "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
                          isUnread ? cn(colors.bg, colors.text) : "bg-secondary/80 text-muted-foreground",
                        )}
                      >
                        {getNotificationIcon(notification)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-0.5 overflow-hidden">
                        <p className={cn("text-sm line-clamp-2 break-words", isUnread && "font-medium")}>
                          {notification.title}
                        </p>
                        {notification.body && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-1 break-all">
                            {notification.body}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground/70 mt-1.5">
                          {notification.created_at &&
                            formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                      </div>

                      {/* Delete button */}
                      {!showFriendActions && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 rounded-lg hover:bg-secondary transition-all flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                      )}
                    </div>

                    {/* Friend request actions */}
                    {showFriendActions && (
                      <div className="flex gap-2 ml-[52px]">
                        <Button
                          size="sm"
                          className="h-9 text-xs flex-1 rounded-lg"
                          disabled={isProcessing}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcceptFriendRequest(notification);
                          }}
                        >
                          <Check className="w-3.5 h-3.5 mr-1.5" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 text-xs flex-1 rounded-lg"
                          disabled={isProcessing}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeclineFriendRequest(notification);
                          }}
                        >
                          <X className="w-3.5 h-3.5 mr-1.5" />
                          Decline
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-secondary/80 flex items-center justify-center mb-4">
                <Bell className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">We'll let you know when something arrives</p>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
