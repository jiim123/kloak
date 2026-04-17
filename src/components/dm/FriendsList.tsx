import { ChatTeardrop, Check, DotsThree, PaperPlaneTilt, Prohibit, Tray, UserMinus, UserPlus, Users, X } from "@phosphor-icons/react";
import { useEffect, useState, useMemo } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { motion, AnimatePresence } from "framer-motion";
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuSeparator,
 DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFriendStore } from "@/stores/friendStore";
import { useDMStore } from "@/stores/dmStore";
import { useAuthStore } from "@/stores/authStore";
import { FriendItemSkeleton } from "@/components/ui/skeletons";
import { toast } from "sonner";
import type { FriendWithUser, UserStatus } from "@/types";
import { getEffectivePresence } from "@/lib/presence";
import { useLocation } from "react-router-dom";
import { openUserProfileModal } from "@/lib/userProfilePopover";
import { useUIStore } from "@/stores/uiStore";

interface FriendsListProps {
 onOpenDM: () => void;
}

export const FriendsList = ({ onOpenDM }: FriendsListProps) => {
 const location = useLocation();
 const { user } = useAuthStore();
 const {
 friends,
 pendingRequests,
 outgoingRequests,
 blockedUsers,
 isLoading,
 error,
 fetchFriends,
 sendRequest,
 acceptRequest,
 declineRequest,
 removeFriend,
 unblockUser,
 } = useFriendStore();
 const { openConversation, setCurrentConversation } = useDMStore();
 const { openModal } = useUIStore();

 const [activeTab, setActiveTab] = useState("online");
 const [addFriendInput, setAddFriendInput] = useState("");
 const [isAddingFriend, setIsAddingFriend] = useState(false);
 const [showAddFriend, setShowAddFriend] = useState(false);
 const [searchQuery, setSearchQuery] = useState("");
 const isFriendsRoute = location.pathname === "/app/friends";

 // Fetch friends when the friends view is active.
 useEffect(() => {
 if (user?.id && isFriendsRoute) {
 fetchFriends(user.id);
 }
 }, [user?.id, isFriendsRoute, fetchFriends]);

 // Refetch friends when the tab becomes visible (user switches back to app)
 useEffect(() => {
 const handleVisibilityChange = () => {
 if (document.visibilityState === "visible" && user?.id && isFriendsRoute) {
 fetchFriends(user.id);
 }
 };

 document.addEventListener("visibilitychange", handleVisibilityChange);
 return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
 }, [user?.id, isFriendsRoute, fetchFriends]);

 const onlineFriends = friends.filter((f) => {
 const presence = getEffectivePresence((f.status as UserStatus) || "offline", f.last_seen, f.id);
 return !presence.isOffline;
 });
 const allFriends = friends;

 // Filter function for users
 const filterUser = (user: FriendWithUser, query: string) => {
 if (!query.trim()) return true;
 const q = query.toLowerCase();
 const displayName = (user.display_name || "").toLowerCase();
 const username = (user.username || "").toLowerCase();
 return displayName.includes(q) || username.includes(q);
 };

 // Filtered lists based on search query (memoized for performance)
 const filteredOnlineFriends = useMemo(
 () => onlineFriends.filter((f) => filterUser(f, searchQuery)),
 [onlineFriends, searchQuery],
 );
 const filteredAllFriends = useMemo(
 () => allFriends.filter((f) => filterUser(f, searchQuery)),
 [allFriends, searchQuery],
 );
 const filteredPendingRequests = useMemo(
 () => pendingRequests.filter((r) => filterUser(r, searchQuery)),
 [pendingRequests, searchQuery],
 );
 const filteredOutgoingRequests = useMemo(
 () => outgoingRequests.filter((r) => filterUser(r, searchQuery)),
 [outgoingRequests, searchQuery],
 );
 const filteredBlockedUsers = useMemo(
 () => blockedUsers.filter((b) => filterUser(b, searchQuery)),
 [blockedUsers, searchQuery],
 );

 const handleSendRequest = async () => {
 if (!user?.id || !addFriendInput.trim()) return;

 setIsAddingFriend(true);
 const success = await sendRequest(user.id, addFriendInput.trim());
 setIsAddingFriend(false);

 if (success) {
 toast.success("Friend request sent!");
 setAddFriendInput("");
 setShowAddFriend(false);
 } else if (error) {
 toast.error(error);
 }
 };

 const handleMessage = async (friend: FriendWithUser) => {
 if (!user?.id) return;
 const conversation = await openConversation(user.id, friend.id);
 if (conversation) {
 setCurrentConversation(conversation);
 onOpenDM();
 }
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

 const handleProfileClick = (userId: string, event: React.MouseEvent) => {
 openUserProfileModal(openModal, userId, event.currentTarget as HTMLElement);
 };

 const FriendItem = ({ friend, showActions = true }: { friend: FriendWithUser; showActions?: boolean }) => (
 <div className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 rounded-lg transition-smooth">
 {/* Avatar + Info (clickable for profile) */}
 <button
 className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
 onClick={(e) => handleProfileClick(friend.id, e)}
 >
 <div className="relative flex-shrink-0">
 <AvatarWithDecoration user={friend} className="w-10 h-10" freezeGifUntilHover />
 {(() => {
 const presence = getEffectivePresence((friend.status as UserStatus) || "offline", friend.last_seen, friend.id);
 return (
 <div
 className={cn(
 "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-layout-chat",
 getStatusClass(presence.status),
 )}
 />
 );
 })()}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <span className="font-medium text-foreground hover:underline">{friend.display_name || friend.username}</span>
 <span className="text-sm text-muted-foreground">{friend.username}</span>
 </div>
 {friend.custom_status ? (
 <p className="text-sm text-muted-foreground truncate">{friend.custom_status}</p>
 ) : (
 (() => {
 const presence = getEffectivePresence((friend.status as UserStatus) || "offline", friend.last_seen, friend.id);
 return <p className="text-sm text-muted-foreground capitalize">{presence.status || "offline"}</p>;
 })()
 )}
 </div>
 </button>

 {/* Actions */}
 {showActions && (
 <div className="flex items-center gap-2">
 <Button
 size="icon"
 variant="secondary"
 className="w-9 h-9 rounded-full"
 onClick={() => handleMessage(friend)}
 >
 <ChatTeardrop className="w-4 h-4" />
 </Button>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button size="icon" variant="secondary" className="w-9 h-9 rounded-full">
 <DotsThree className="w-4 h-4" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuItem onClick={() => handleMessage(friend)}>
 <ChatTeardrop className="w-4 h-4 mr-2" />
 Message
 </DropdownMenuItem>
 <DropdownMenuSeparator />
 <DropdownMenuItem
 onClick={() => user?.id && removeFriend(friend.friendship_id, user.id)}
 className="text-destructive focus:text-destructive"
 >
 <UserMinus className="w-4 h-4 mr-2" />
 Remove Friend
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 )}
 </div>
 );

 const PendingItem = ({ request, isOutgoing }: { request: FriendWithUser; isOutgoing: boolean }) => (
 <div className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 rounded-lg transition-smooth">
 {/* Avatar + Info (clickable for profile) */}
 <button
 className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
 onClick={(e) => handleProfileClick(request.id, e)}
 >
 <div className="relative flex-shrink-0">
 <AvatarWithDecoration user={request} className="w-10 h-10" freezeGifUntilHover />
 </div>
 <div className="flex-1 min-w-0">
 <span className="font-medium text-foreground hover:underline">{request.display_name || request.username}</span>
 <p className="text-sm text-muted-foreground">
 {isOutgoing ? "Outgoing Friend Request" : "Incoming Friend Request"}
 </p>
 </div>
 </button>

 {/* Actions */}
 <div className="flex items-center gap-2">
 {!isOutgoing && (
 <Button
 size="icon"
 variant="secondary"
 className="w-9 h-9 rounded-full bg-green-500/20 hover:bg-green-500/30 text-green-500"
 onClick={() => user?.id && acceptRequest(request.friendship_id, user.id)}
 >
 <Check className="w-4 h-4" />
 </Button>
 )}
 <Button
 size="icon"
 variant="secondary"
 className="w-9 h-9 rounded-full bg-destructive/20 hover:bg-destructive/30 text-destructive"
 onClick={() => user?.id && declineRequest(request.friendship_id, user.id)}
 >
 <X className="w-4 h-4" />
 </Button>
 </div>
 </div>
 );

 const BlockedItem = ({ blocked }: { blocked: FriendWithUser }) => (
 <div className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 rounded-lg transition-smooth">
 {/* Avatar + Info (clickable for profile) */}
 <button
 className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
 onClick={(e) => handleProfileClick(blocked.id, e)}
 >
 <div className="relative flex-shrink-0">
 <AvatarWithDecoration user={blocked} className="w-10 h-10 opacity-50" freezeGifUntilHover />
 </div>
 <div className="flex-1 min-w-0">
 <span className="font-medium text-muted-foreground hover:underline">{blocked.display_name || blocked.username}</span>
 <p className="text-sm text-muted-foreground">Blocked</p>
 </div>
 </button>

 {/* Unblock */}
 <Button size="sm" variant="outline" onClick={() => user?.id && unblockUser(user.id, blocked.id)}>
 Unblock
 </Button>
 </div>
 );

 return (
 <div className="h-full flex flex-col bg-layout-chat">
 {/* Header - hidden on mobile since we have MobileHeader */}
 <div className="h-12 px-4 hidden md:flex items-center justify-end border-b border-border shadow-sm">
 <Button
 size="sm"
 variant={showAddFriend ? "secondary" : "default"}
 onClick={() => setShowAddFriend(!showAddFriend)}
 className="gap-2"
 >
 <UserPlus className="w-4 h-4" />
 Add Friend
 </Button>
 </div>

 {/* Main content */}
 <div className="flex-1 overflow-y-auto">
 {/* Content Section */}
 <div className="flex flex-col">
 {/* Mobile add friend button */}
 <div className="md:hidden p-2 border-b border-border">
 <Button
 size="sm"
 variant={showAddFriend ? "secondary" : "default"}
 onClick={() => setShowAddFriend(!showAddFriend)}
 className="w-full gap-2"
 >
 <UserPlus className="w-4 h-4" />
 Add Friend
 </Button>
 </div>

 {/* Add Friend Form */}
 {showAddFriend && (
 <div className="p-4 border-b border-border bg-secondary/20">
 <h3 className="font-medium text-foreground mb-2">Add Friend</h3>
 <p className="text-sm text-muted-foreground mb-3">You can add a friend with their username.</p>
 <div className="flex gap-2">
 <Input
 placeholder="Enter a username"
 value={addFriendInput}
 onChange={(e) => setAddFriendInput(e.target.value)}
 onKeyDown={(e) => e.key === "Enter" && handleSendRequest()}
 className="flex-1"
 />
 <Button onClick={handleSendRequest} disabled={!addFriendInput.trim() || isAddingFriend}>
 {isAddingFriend ? "Sending..." : "Send Request"}
 </Button>
 </div>
 </div>
 )}

 {/* Tabs */}
 {(() => {
 const tabs = [
 { id: "online", label: "Online", count: searchQuery ? filteredOnlineFriends.length : onlineFriends.length, showCount: onlineFriends.length > 0 },
 { id: "all", label: "All", count: searchQuery ? filteredAllFriends.length : allFriends.length, showCount: allFriends.length > 0 },
 { id: "pending", label: "Pending", count: searchQuery ? filteredPendingRequests.length + filteredOutgoingRequests.length : pendingRequests.length + outgoingRequests.length, showCount: pendingRequests.length + outgoingRequests.length > 0, badge: true },
 { id: "blocked", label: "Blocked" },
 ];

 return (
 <div className="flex-1 flex flex-col">
 <div className="px-4 pt-4">
 <div className="inline-flex h-10 items-center gap-1 rounded-lg bg-secondary/50 p-1">
 {tabs.map((tab) => (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id)}
 className={cn(
 "relative inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
 activeTab === tab.id
 ? "text-foreground"
 : "text-muted-foreground hover:text-foreground/80"
 )}
 >
 {activeTab === tab.id && (
 <motion.div
 layoutId="friends-tab-indicator"
 className="absolute inset-0 rounded-md bg-background shadow-sm"
 transition={{ type: "spring", stiffness: 400, damping: 30 }}
 />
 )}
 <span className="relative z-10 flex items-center gap-1.5">
 {tab.label}
 {tab.showCount && !tab.badge && (
 <span className="text-xs opacity-70">— {tab.count}</span>
 )}
 {tab.badge && tab.showCount && (
 <span className="text-xs bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full">
 {tab.count}
 </span>
 )}
 </span>
 </button>
 ))}
 </div>
 </div>

 <div className="flex-1 overflow-y-auto p-4">
 <AnimatePresence mode="wait">
 <motion.div
 key={activeTab}
 initial={{ opacity: 0, y: 6 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -6 }}
 transition={{ duration: 0.15 }}
 >
 {activeTab === "online" && (
 <>
 {isLoading ? (
 <div className="space-y-1">
 <FriendItemSkeleton />
 <FriendItemSkeleton />
 <FriendItemSkeleton />
 </div>
 ) : filteredOnlineFriends.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-16 text-center">
 <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
 <Users className="w-8 h-8 text-muted-foreground" />
 </div>
 <h3 className="font-medium text-foreground mb-1">
 {searchQuery ? "No matches found" : "No one's around..."}
 </h3>
 <p className="text-sm text-muted-foreground">
 {searchQuery
 ? "Try a different search term"
 : friends.length > 0
 ? "None of your friends are online right now."
 : "Add some friends to see who's online!"}
 </p>
 </div>
 ) : (
 <div className="space-y-1">
 {filteredOnlineFriends.map((friend) => (
 <FriendItem key={friend.id} friend={friend} />
 ))}
 </div>
 )}
 </>
 )}

 {activeTab === "all" && (
 <>
 {isLoading ? (
 <div className="space-y-1">
 <FriendItemSkeleton />
 <FriendItemSkeleton />
 <FriendItemSkeleton />
 </div>
 ) : filteredAllFriends.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-16 text-center">
 <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
 <UserPlus className="w-8 h-8 text-muted-foreground" />
 </div>
 <h3 className="font-medium text-foreground mb-1">
 {searchQuery ? "No matches found" : "No friends yet"}
 </h3>
 <p className="text-sm text-muted-foreground mb-4">
 {searchQuery ? "Try a different search term" : "Add some friends to get started!"}
 </p>
 {!searchQuery && (
 <Button onClick={() => setShowAddFriend(true)} className="gap-2">
 <UserPlus className="w-4 h-4" />
 Add Friend
 </Button>
 )}
 </div>
 ) : (
 <div className="space-y-1">
 {filteredAllFriends.map((friend) => (
 <FriendItem key={friend.id} friend={friend} />
 ))}
 </div>
 )}
 </>
 )}

 {activeTab === "pending" && (
 <>
 {filteredPendingRequests.length === 0 && filteredOutgoingRequests.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-16 text-center">
 <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
 <Tray className="w-8 h-8 text-muted-foreground" />
 </div>
 <h3 className="font-medium text-foreground mb-1">
 {searchQuery ? "No matches found" : "No pending requests"}
 </h3>
 <p className="text-sm text-muted-foreground">
 {searchQuery ? "Try a different search term" : "Friend requests will appear here."}
 </p>
 </div>
 ) : (
 <div className="space-y-1">
 {filteredPendingRequests.map((request) => (
 <PendingItem key={request.id} request={request} isOutgoing={false} />
 ))}
 {filteredOutgoingRequests.map((request) => (
 <PendingItem key={request.id} request={request} isOutgoing />
 ))}
 </div>
 )}
 </>
 )}

 {activeTab === "blocked" && (
 <>
 {filteredBlockedUsers.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-16 text-center">
 <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
 <Prohibit className="w-8 h-8 text-muted-foreground" />
 </div>
 <h3 className="font-medium text-foreground mb-1">
 {searchQuery ? "No matches found" : "No blocked users"}
 </h3>
 <p className="text-sm text-muted-foreground">
 {searchQuery ? "Try a different search term" : "You haven't blocked anyone."}
 </p>
 </div>
 ) : (
 <div className="space-y-1">
 {filteredBlockedUsers.map((blocked) => (
 <BlockedItem key={blocked.id} blocked={blocked} />
 ))}
 </div>
 )}
 </>
 )}
 </motion.div>
 </AnimatePresence>
 </div>
 </div>
 );
 })()}
 </div>
 </div>
 </div>
 );
};
