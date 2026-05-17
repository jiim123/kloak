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
import { useUIStore } from "@/stores/uiStore";
import { requestNotificationPermission } from "@/hooks/useRealtimeNotifications";
import { openUserProfileModal } from "@/lib/userProfilePopover";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";

export interface NotificationBellProps {
  variant?: "default" | "sidebar";
}

type NotificationTheme = "amber" | "emerald" | "red" | "blue" | "violet" | "default";

const themeClasses = {
  amber: { bg: "bg-amber-500/10", text: "text-amber-500", bgUnread: "bg-amber-500/5" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-500", bgUnread: "bg-emerald-500/5" },
  red: { bg: "bg-red-500/10", text: "text-red-500", bgUnread: "bg-red-500/5" },
  blue: { bg: "bg-blue-500/10", text: "text-blue-500", bgUnread: "bg-blue-500/5" },
  violet: { bg: "bg-violet-500/10", text: "text-violet-500", bgUnread: "bg-violet-500/5" },
  default: { bg: "bg-primary/10", text: "text-primary", bgUnread: "bg-primary/5" },
};

const getNotificationTheme = (notification: Notification): NotificationTheme => {
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
  const title = notification.title?.toLowerCase() || "";
  if (title.includes("kicked") || title.includes("banned")) {
    return <AlertTriangle className="h-4 w-4" />;
  }

  switch (notification.type) {
    case "mention":
      return <AtSign className="h-4 w-4" />;
    case "dm":
      return <MessageCircle className="h-4 w-4" />;
    case "friend_request":
      return <UserPlus className="h-4 w-4" />;
    case "server_invite":
      return <Mail className="h-4 w-4" />;
    default:
      return <Bell className="h-4 w-4" />;
  }
};

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
  const { notifications, markAsRead, markAllAsRead, clearAllNotifications, deleteNotification } = useNotificationStore();
  const {
    enableMentionNotifications,
    enableDMNotifications,
    enableFriendRequestNotifications,
    enableServerInviteNotifications,
  } = useUIStore();
  const { pendingRequests, acceptRequest, declineRequest, fetchFriends } = useFriendStore();
  const [isOpen, setIsOpen] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const hasFriendRequestNotifications = notifications.some((n) => n.type === "friend_request");
    if (!hasFriendRequestNotifications) return;

    const hasMissingPending = notifications
      .filter((n) => n.type === "friend_request")
      .some((n) => {
        const username = extractUsernameFromBody(n.body);
        if (!username) return false;
        return !pendingRequests.some((r) => r.username?.toLowerCase() === username.toLowerCase());
      });

    if (hasMissingPending) {
      fetchFriends(user.id, { force: true });
    }
  }, [notifications, pendingRequests, user, fetchFriends]);

  const filteredNotifications = notifications.filter((n) => {
    switch (n.type) {
      case "mention":
        return enableMentionNotifications;
      case "dm":
        return enableDMNotifications;
      case "friend_request":
        return enableFriendRequestNotifications;
      case "server_invite":
        return enableServerInviteNotifications;
      default:
        return true;
    }
  });
  const filteredUnreadCount = filteredNotifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    if (isOpen && filteredUnreadCount > 0) {
      requestNotificationPermission();
    }
  }, [isOpen, filteredUnreadCount]);

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
    if (!link) {
      setIsOpen(false);
      return;
    }

    const url = new URL(link, window.location.origin);
    const serverId = url.searchParams.get("server");
    const channelId = url.searchParams.get("channel");
    const messageId = url.searchParams.get("message");
    const conversationId = url.searchParams.get("conversation");

    if (notificationType === "mention" && serverId && channelId) {
      setIsOpen(false);
      const path = `/app/servers/${serverId}/channels/${channelId}`;
      const params = messageId ? `?message=${messageId}` : "";
      setTimeout(() => navigate(path + params), 50);
      return;
    }

    if (conversationId) {
      setIsOpen(false);
      useServerStore.getState().setCurrentServer(null);
      setTimeout(() => {
        navigate(`/app?conversation=${conversationId}`);
      }, 100);
      return;
    }

    navigate(link);
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
    <Button variant="ghost" size="icon" className="relative h-8 w-8">
      <Bell className="h-4 w-4" />
      {filteredUnreadCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center p-0 text-[10px]"
        >
          {filteredUnreadCount > 99 ? "99+" : filteredUnreadCount}
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
        className="flex h-10 w-10 items-center justify-center bg-secondary hover:bg-primary/20 hover:text-neutral-200"
      >
        <Bell className="h-4 w-4" />
      </motion.div>
      {filteredUnreadCount > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -bottom-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] bg-destructive px-1 text-xs font-medium text-destructive-foreground shadow-lg"
        >
          {filteredUnreadCount > 99 ? "99+" : filteredUnreadCount}
        </motion.span>
      )}
    </MotionButton>
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>{variant === "sidebar" ? renderSidebarTrigger() : renderDefaultTrigger()}</PopoverTrigger>

      <PopoverContent
        className="w-96 overflow-hidden rounded-[4px] border border-[#4a4f5a] bg-[#333842] p-0 text-[#f4f5f7] shadow-2xl"
        align="end"
        sideOffset={8}
      >
        <div className="flex items-center justify-between border-b border-[#2b3039] bg-[#2f343d] px-4 py-3">
          <h3 className="text-base font-medium leading-none tracking-tight">Notifications</h3>
          <div className="flex items-center gap-1">
            {filteredUnreadCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-[3px] text-[#b8bec8] transition-colors hover:bg-[#3b4049] hover:text-white"
                onClick={handleMarkAllAsRead}
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
              </Button>
            )}
            {filteredNotifications.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-[3px] text-[#b8bec8] transition-colors hover:bg-[#3b4049] hover:text-white"
                onClick={handleClearAll}
                title="Clear all"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[420px] overflow-x-hidden overflow-y-auto">
          {filteredNotifications.length > 0 ? (
            <div className="p-2">
              {filteredNotifications.map((notification, index) => {
                const isProcessing = processingIds.has(notification.id);
                const showFriendActions = isFriendRequestPending(notification);
                const isUnread = !notification.is_read;
                const theme = getNotificationTheme(notification);
                const colors = themeClasses[theme];

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "group relative flex flex-col gap-2 border border-transparent px-3 py-3 transition-colors animate-notification-enter",
                      isUnread && cn(colors.bgUnread, "border-white/5"),
                      !showFriendActions && "cursor-pointer hover:border-[#454b56] hover:bg-[#363b45]"
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
                      <div
                        className={cn(
                          "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[4px]",
                          isUnread ? cn(colors.bg, colors.text) : "bg-[#3a404a] text-[#9ea4af]"
                        )}
                      >
                        {getNotificationIcon(notification)}
                      </div>

                      <div className="min-w-0 flex-1 overflow-hidden pt-0.5">
                        <p className={cn("line-clamp-2 break-words text-sm text-[#f3f4f7]", isUnread && "font-medium")}>
                          {notification.type === "mention" &&
                            (() => {
                              if (!notification.link) return null;
                              try {
                                const url = new URL(notification.link, window.location.origin);
                                const serverId = url.searchParams.get("server");
                                if (!serverId) return null;
                                const serverName = useServerStore.getState().servers.find((s) => s.id === serverId)?.name;
                                return serverName ? (
                                  <span className="mr-1.5 text-xs font-normal text-[#9ea4af]">{serverName} /</span>
                                ) : null;
                              } catch {
                                return null;
                              }
                            })()}
                          {notification.title}
                        </p>
                        {notification.body && (
                          <p className="mt-1 line-clamp-1 break-all text-xs text-[#b8bec8]">
                            {notification.type === "friend_request" ? (
                              (() => {
                                const username = extractUsernameFromBody(notification.body);
                                if (username) {
                                  const request = pendingRequests.find(
                                    (r) => r.username?.toLowerCase() === username.toLowerCase()
                                  );
                                  return (
                                    <>
                                      <span
                                        className="cursor-pointer font-medium text-white hover:underline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (request?.id) {
                                            setIsOpen(false);
                                            setTimeout(() => {
                                              const { openModal } = useUIStore.getState();
                                              openUserProfileModal(openModal, request.id);
                                            }, 150);
                                          }
                                        }}
                                      >
                                        {username}
                                      </span>
                                      {" sent you a friend request"}
                                    </>
                                  );
                                }
                                return notification.body;
                              })()
                            ) : (
                              notification.body
                            )}
                          </p>
                        )}
                        <p className="mt-1.5 text-xs text-[#8f96a2]">
                          {notification.created_at &&
                            formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                      </div>

                      {!showFriendActions && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0 rounded-[3px] text-[#9ea4af] transition-all hover:bg-[#3b4049] hover:text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {showFriendActions && (
                      <div className="ml-[52px] flex gap-2">
                        <Button
                          size="sm"
                          className="h-9 flex-1 rounded-[3px] bg-[#d7dbe3] text-xs font-medium text-[#363b44] hover:bg-white"
                          disabled={isProcessing}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcceptFriendRequest(notification);
                          }}
                        >
                          <Check className="mr-1.5 h-3.5 w-3.5" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 flex-1 rounded-[3px] border-[#4a4f5a] bg-transparent text-xs text-[#e2e4e9] hover:bg-[#30333d]"
                          disabled={isProcessing}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeclineFriendRequest(notification);
                          }}
                        >
                          <X className="mr-1.5 h-3.5 w-3.5" />
                          Decline
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[4px] bg-[#2f343d]">
                <Bell className="h-7 w-7 text-[#666d78]" />
              </div>
              <p className="text-sm font-medium text-[#f3f4f7]">No notifications yet</p>
              <p className="mt-1 text-xs text-[#9ea4af]">We&apos;ll let you know when something arrives.</p>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
