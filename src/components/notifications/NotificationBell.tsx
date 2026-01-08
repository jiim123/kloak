import { useState, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Bell, Check, Trash2, MessageCircle, AtSign, UserPlus, Mail, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useNotificationStore } from '@/stores/notificationStore';
import { useFriendStore } from '@/stores/friendStore';
import { useAuthStore } from '@/stores/authStore';
import { requestNotificationPermission } from '@/hooks/useRealtimeNotifications';
import { cn } from '@/lib/utils';
import type { NotificationType, Notification } from '@/types';

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'mention':
      return <AtSign className="w-4 h-4" />;
    case 'dm':
      return <MessageCircle className="w-4 h-4" />;
    case 'friend_request':
      return <UserPlus className="w-4 h-4" />;
    case 'server_invite':
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

export const NotificationBell = () => {
  const { user } = useAuthStore();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotificationStore();
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

  const handleNotificationClick = (notificationId: string, link: string | null) => {
    markAsRead(notificationId);
    if (link) {
      window.location.href = link;
    }
    setIsOpen(false);
  };

  const handleAcceptFriendRequest = async (notification: Notification) => {
    if (!user) return;
    
    const username = extractUsernameFromBody(notification.body);
    if (!username) return;

    // Find the pending request by username
    const request = pendingRequests.find(
      (r) => r.username?.toLowerCase() === username.toLowerCase()
    );
    
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

    // Find the pending request by username
    const request = pendingRequests.find(
      (r) => r.username?.toLowerCase() === username.toLowerCase()
    );
    
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

  // Check if a friend request notification is still pending
  const isFriendRequestPending = (notification: Notification): boolean => {
    if (notification.type !== 'friend_request') return false;
    const username = extractUsernameFromBody(notification.body);
    if (!username) return false;
    return pendingRequests.some(
      (r) => r.username?.toLowerCase() === username.toLowerCase()
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative w-8 h-8">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-[10px]"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs"
              onClick={handleMarkAllAsRead}
            >
              <Check className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-96">
          {notifications.length > 0 ? (
            <div className="divide-y divide-border">
              {notifications.map((notification) => {
                const isProcessing = processingIds.has(notification.id);
                const showFriendActions = isFriendRequestPending(notification);

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "group flex flex-col gap-2 px-4 py-3 transition-colors",
                      !notification.is_read && "bg-accent/30",
                      !showFriendActions && "cursor-pointer hover:bg-accent/50"
                    )}
                    onClick={() => !showFriendActions && handleNotificationClick(notification.id, notification.link)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                        !notification.is_read ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm line-clamp-2",
                          !notification.is_read && "font-medium"
                        )}>
                          {notification.title}
                        </p>
                        {notification.body && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {notification.body}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {notification.created_at && formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      {!showFriendActions && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-6 h-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>

                    {/* Friend request actions */}
                    {showFriendActions && (
                      <div className="flex gap-2 ml-11">
                        <Button
                          size="sm"
                          className="h-7 text-xs flex-1"
                          disabled={isProcessing}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcceptFriendRequest(notification);
                          }}
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs flex-1"
                          disabled={isProcessing}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeclineFriendRequest(notification);
                          }}
                        >
                          <X className="w-3 h-3 mr-1" />
                          Decline
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="w-10 h-10 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No notifications</p>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
