import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, MessageSquare, UserRoundPlus, LogOut, Ban, Users, UserCircle } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { StackedAvatars } from "@/components/ui/stacked-avatars";
import { LoggedInUserPanel } from "@/components/layout/LoggedInUserPanel";
import { VoiceConnectedBanner } from "@/components/layout/VoiceConnectedBanner";
import { CreateGroupModal } from "@/components/dm/CreateGroupModal";
import { useDMStore } from "@/stores/dmStore";
import { useFriendStore } from "@/stores/friendStore";
import { useAuthStore } from "@/stores/authStore";
import { useUnreadDMsContext } from "@/hooks/useUnreadDMsContext";
import { formatCompactTime } from "@/lib/format";
import { getEffectivePresence } from "@/lib/presence";
import { hasRecentRealtimePresence } from "@/hooks/useRealtimeUsers";
import { getUserFromCache, useUserCacheStore } from "@/stores/userCacheStore";
import { ConversationItemSkeleton } from "@/components/ui/skeletons";
import type { DMConversation, UserStatus, User } from "@/types";
import { useRateLimit } from "@/hooks/useRateLimit";
import { rateLimitToast } from "@/lib/rateLimitToast";

export const DMSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    conversations,
    currentConversation,
    fetchConversations,
    setCurrentConversation,
    closeConversation,
    leaveGroup,
    isLoading,
  } = useDMStore();
  const { getUnreadCount, markAsRead } = useUnreadDMsContext();
  // Re-render when realtime presence patches the user cache so DM status dots update live.
  useUserCacheStore((s) => s._version);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const isFriendsRoute = location.pathname === "/app/friends";
  const isProfileRoute = location.pathname === `/app/profiles/${user?.id}`;
  const pendingFriendRequestCount = useFriendStore((s) => s.pendingRequests.length);

  // Fetch conversations on mount
  useEffect(() => {
    if (user?.id) {
      fetchConversations(user.id);
    }
  }, [user?.id, fetchConversations]);

  // Removed: visibility-change handler was redundant with useRealtimeDMs subscription

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    // For groups, search by group name or participant names
    if (conv.is_group) {
      const groupName = conv.name?.toLowerCase() || "";
      const participantNames =
        conv.participants?.map((p) => (p.user?.display_name || p.user?.username || "").toLowerCase()).join(" ") || "";
      return groupName.includes(searchQuery.toLowerCase()) || participantNames.includes(searchQuery.toLowerCase());
    }
    // For 1:1 conversations
    const username = conv.other_user?.username?.toLowerCase() || "";
    const displayName = conv.other_user?.display_name?.toLowerCase() || "";
    return username.includes(searchQuery.toLowerCase()) || displayName.includes(searchQuery.toLowerCase());
  });

  const handleSelectConversation = (conversation: DMConversation) => {
    setCurrentConversation(conversation);
    navigate("/app");
    // Mark as read when selecting
    markAsRead(conversation.id);
  };

  const handleLeaveConversation = async (conversation: DMConversation) => {
    if (!user?.id) return;
    if (conversation.is_group) {
      await leaveGroup(conversation.id, user.id);
    } else {
      await closeConversation(conversation.id, user.id);
    }
  };

  const { blockUser } = useFriendStore();
  const checkBlockLimit = useRateLimit(10, 60_000);

  const handleBlockUser = async (userId: string) => {
    if (!user?.id) return;
    if (!checkBlockLimit()) { rateLimitToast("Too many block actions"); return; }
    await blockUser(user.id, userId);
  };

  const getStatusClass = (status?: string) => {
    switch (status) {
      case "online":
        return "status-online";
      case "idle":
        return "status-idle";
      case "dnd":
        return "status-dnd";
      default:
        return "status-offline";
    }
  };

  return (
    <div className="h-full flex flex-col bg-layout-sidebar overflow-hidden">
        <div className="px-2 pt-3 pb-2 border-b border-border/60">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search direct messages"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setCurrentConversation(null);
              navigate("/app/friends");
            }}
            className={cn(
              "mt-2 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-smooth",
              isFriendsRoute ? "bg-secondary text-foreground" : "text-foreground/90 hover:bg-secondary/50",
            )}
          >
            <Users className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">Friends</span>
            {pendingFriendRequestCount > 0 && (
              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-[4px] bg-destructive px-1.5 text-[11px] font-bold leading-none text-destructive-foreground">
                {pendingFriendRequestCount > 99 ? "99+" : pendingFriendRequestCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              if (!user?.id) return;
              setCurrentConversation(null);
              navigate(`/app/profiles/${user.id}`);
            }}
            className={cn(
              "mb-2 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-smooth",
              isProfileRoute ? "bg-secondary text-foreground" : "text-foreground/90 hover:bg-secondary/50",
            )}
          >
            <UserCircle className="h-4 w-4 shrink-0" />
            <span>Profile</span>
          </button>
        </div>

        <div className="px-4 py-2 flex items-center justify-between border-b border-border/60">
          <h3 className="text-xs font-semibold text-foreground/85 uppercase tracking-[0.12em]">Direct Messages</h3>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6 text-foreground/80 hover:text-foreground hover:bg-secondary/70"
            onClick={() => setShowCreateGroup(true)}
            title="Create Group"
          >
            <UserRoundPlus className="w-4 h-4" />
          </Button>
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto scrollbar-overlay px-2 space-y-0.5">
          {/* Loading state */}
          {isLoading && conversations.length === 0 && (
            <>
              <ConversationItemSkeleton />
              <ConversationItemSkeleton />
              <ConversationItemSkeleton />
            </>
          )}

          {/* Empty state */}
          {!isLoading && filteredConversations.length === 0 && (
            <div className="px-2 py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "No conversations found" : "No direct messages yet"}
              </p>
              {!searchQuery && (
                <p className="text-xs text-muted-foreground mt-1">Start a conversation with a friend!</p>
              )}
            </div>
          )}

          {/* Conversations */}
          {filteredConversations.map((conversation) => {
            const unreadCount = getUnreadCount(conversation.id);
            const hasUnread = unreadCount > 0;
            const isGroup = conversation.is_group || false;

            // Get display name for groups
            const getGroupDisplayName = () => {
              if (conversation.name) return conversation.name;
              // Fallback to participant names (exclude current user)
              const otherParticipants = conversation.participants?.filter((p) => p.user_id !== user?.id) || [];
              const names = otherParticipants
                .map((p) => p.user?.display_name || p.user?.username || "Unknown")
                .slice(0, 3);
              if (names.length === 0) return "Group";
              if (otherParticipants.length > 3) {
                return `${names.join(", ")} +${otherParticipants.length - 3}`;
              }
              return names.join(", ");
            };

            return (
              <ContextMenu key={conversation.id}>
                <ContextMenuTrigger asChild>
                  <div
                    className={cn(
                      "group flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer transition-smooth",
                      currentConversation?.id === conversation.id
                        ? "bg-secondary"
                        : "hover:bg-secondary/50",
                    )}
                    onClick={() => handleSelectConversation(conversation)}
                  >
                    {/* Avatar with status (or stacked avatars for group) */}
                    <div className="relative flex-shrink-0">
                      {isGroup ? (
                        <StackedAvatars
                          users={
                            (conversation.participants
                              ?.filter((p) => p.user_id !== user?.id)
                              .slice(0, 3)
                              .map((p) => p.user) || []) as User[]
                          }
                          size="sm"
                        />
                      ) : (
                        <>
                          <AvatarWithDecoration user={conversation.other_user} className="w-8 h-8" freezeGifUntilHover />
                          {(() => {
                            const otherId = conversation.other_user?.id;
                            const cached = otherId ? getUserFromCache(otherId) : null;
                            const status = ((cached?.status ?? conversation.other_user?.status) as UserStatus) || "offline";
                            const lastSeen = cached?.last_seen ?? conversation.other_user?.last_seen;
                            const presence = otherId && hasRecentRealtimePresence(otherId)
                              ? { status, isStale: false, isOffline: status === "offline" }
                              : getEffectivePresence(status, lastSeen, otherId);
                            return (
                              <div
                                className={cn(
                                  "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-layout-sidebar-secondary",
                                  getStatusClass(presence.status),
                                )}
                              />
                            );
                          })()}
                        </>
                      )}
                    </div>

                    {/* Name and last message */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            "text-sm truncate",
                            hasUnread ? "font-medium text-foreground" : "font-medium text-foreground",
                          )}
                        >
                          {isGroup
                            ? getGroupDisplayName()
                            : conversation.other_user?.display_name || conversation.other_user?.username || "Unknown"}
                        </span>
                        <div className="flex items-center gap-2">
                          {conversation.last_message && (
                            <span className="text-xs text-muted-foreground">
                              {formatCompactTime(conversation.last_message.created_at || "")}
                            </span>
                          )}
                        </div>
                      </div>
                      {conversation.last_message && (
                        <p className={cn("text-xs truncate", hasUnread ? "text-foreground" : "text-muted-foreground")}>
                          {conversation.last_message.content}
                        </p>
                      )}
                    </div>

                    {/* Unread badge */}
                    {hasUnread && (
                      <span className="min-w-[20px] h-5 bg-destructive rounded-full text-xs text-destructive-foreground flex items-center justify-center px-1.5 font-medium">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  {!isGroup && conversation.other_user?.id && (
                    <ContextMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => handleBlockUser(conversation.other_user!.id)}
                    >
                      <Ban className="w-4 h-4" />
                      Block User
                    </ContextMenuItem>
                  )}
                  <ContextMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => handleLeaveConversation(conversation)}
                  >
                    <LogOut className="w-4 h-4" />
                    {isGroup ? "Leave Group" : "Leave Conversation"}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>

        <VoiceConnectedBanner />
        <LoggedInUserPanel />

      {/* Create Group Modal */}
      <CreateGroupModal open={showCreateGroup} onOpenChange={setShowCreateGroup} />
    </div>
  );
};
