import { MagnifyingGlass, Users, X } from "@phosphor-icons/react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { Checkbox } from "@/components/ui/checkbox";

import { cn } from "@/lib/utils";
import { useFriendStore } from "@/stores/friendStore";
import { useDMStore } from "@/stores/dmStore";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import type { User } from "@/types";

interface CreateGroupModalProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
}

export const CreateGroupModal = ({ open, onOpenChange }: CreateGroupModalProps) => {
 const navigate = useNavigate();
 const { user } = useAuthStore();
 const { friends, fetchFriends } = useFriendStore();
 const { createGroupConversation } = useDMStore();
 
 const [groupName, setGroupName] = useState("");
 const [searchQuery, setSearchQuery] = useState("");
 const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
 const [isCreating, setIsCreating] = useState(false);

 // Fetch friends when modal opens
 useEffect(() => {
 if (open && user?.id) {
 fetchFriends(user.id);
 }
 }, [open, user?.id, fetchFriends]);

 // Reset state when modal closes
 useEffect(() => {
 if (!open) {
 setGroupName("");
 setSearchQuery("");
 setSelectedFriends([]);
 }
 }, [open]);

 const filteredFriends = friends.filter((friend) => {
 if (!searchQuery) return true;
 const username = friend.username?.toLowerCase() || "";
 const displayName = friend.display_name?.toLowerCase() || "";
 return username.includes(searchQuery.toLowerCase()) || displayName.includes(searchQuery.toLowerCase());
 });

 const toggleFriend = (friendId: string) => {
 setSelectedFriends((prev) =>
 prev.includes(friendId)
 ? prev.filter((id) => id !== friendId)
 : [...prev, friendId]
 );
 };

 const handleCreate = async () => {
 if (selectedFriends.length < 2) {
 toast.error("Select more friends", {
 description: "You need at least 2 friends to create a group.",
 });
 return;
 }

 if (!user?.id) return;

 setIsCreating(true);
 
 const conversation = await createGroupConversation(
 user.id,
 selectedFriends,
 groupName.trim() || undefined
 );
 
 setIsCreating(false);

 if (conversation) {
 toast.success("Group created", {
 description: `Your group "${groupName.trim() || 'New Group'}" has been created.`,
 });
 onOpenChange(false);
 navigate("/app");
 } else {
 toast.error("Failed to create group", {
 description: "Something went wrong. Please try again.",
 });
 }
 };

 const selectedFriendData = friends.filter((f) => selectedFriends.includes(f.id));

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="sm:max-w-md">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Users className="w-5 h-5" />
 Create Group
 </DialogTitle>
 </DialogHeader>

 <div className="space-y-4 mt-2">
 {/* Group Name */}
 <div className="space-y-2">
 <Label htmlFor="group-name">Group Name (Optional)</Label>
 <Input
 id="group-name"
 placeholder="My awesome group"
 value={groupName}
 onChange={(e) => setGroupName(e.target.value)}
 maxLength={50}
 />
 </div>

 {/* Selected Friends Pills */}
 {selectedFriends.length > 0 && (
 <div className="flex flex-wrap gap-2">
 {selectedFriendData.map((friend) => (
 <div
 key={friend.id}
 className="flex items-center gap-1.5 px-2 py-1 bg-secondary rounded-full text-sm"
 >
 <AvatarWithDecoration user={friend} className="w-5 h-5" freezeGifUntilHover />
 <span className="truncate max-w-[100px]">
 {friend.display_name || friend.username}
 </span>
 <button
 onClick={() => toggleFriend(friend.id)}
 className="p-0.5 hover:bg-secondary-hover rounded-full transition-colors"
 >
 <X className="w-3 h-3" />
 </button>
 </div>
 ))}
 </div>
 )}

 {/* MagnifyingGlass Friends */}
 <div className="space-y-2">
 <Label>Add Friends</Label>
 <div className="relative">
 <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
 <Input
 placeholder="MagnifyingGlass friends..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-9"
 />
 </div>
 </div>

 {/* Friends List */}
 <div className="max-h-[200px] overflow-y-auto space-y-1 border border-border rounded-lg p-2">
 {filteredFriends.length === 0 ? (
 <p className="text-sm text-muted-foreground text-center py-4">
 {searchQuery ? "No friends found" : "No friends yet"}
 </p>
 ) : (
 filteredFriends.map((friend) => (
 <label
 key={friend.id}
 className={cn(
 "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
 selectedFriends.includes(friend.id)
 ? "bg-secondary"
 : "hover:bg-secondary/50"
 )}
 >
 <Checkbox
 checked={selectedFriends.includes(friend.id)}
 onCheckedChange={() => toggleFriend(friend.id)}
 />
 <AvatarWithDecoration user={friend} className="w-8 h-8" freezeGifUntilHover />
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium truncate">
 {friend.display_name || friend.username}
 </p>
 {friend.display_name && (
 <p className="text-xs text-muted-foreground truncate">
 @{friend.username}
 </p>
 )}
 </div>
 </label>
 ))
 )}
 </div>

 {/* Actions */}
 <div className="flex justify-end gap-2 pt-2">
 <Button variant="outline" onClick={() => onOpenChange(false)}>
 Cancel
 </Button>
 <Button
 onClick={handleCreate}
 disabled={selectedFriends.length < 2 || isCreating}
 loading={isCreating}
 >
 Create Group ({selectedFriends.length})
 </Button>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 );
};
