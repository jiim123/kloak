import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Users, Settings, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFriendStore } from "@/stores/friendStore";
import { useDMStore } from "@/stores/dmStore";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import type { DMConversation, User } from "@/types";

interface GroupSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: DMConversation;
  participants: User[];
}

export const GroupSettingsModal = ({
  open,
  onOpenChange,
  conversation,
  participants,
}: GroupSettingsModalProps) => {
  const { user } = useAuthStore();
  const { friends, fetchFriends } = useFriendStore();
  const { updateGroupName, addGroupMembers, fetchConversations } = useDMStore();

  const [groupName, setGroupName] = useState(conversation.name || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingMembers, setIsAddingMembers] = useState(false);

  // Fetch friends when modal opens
  useEffect(() => {
    if (open && user?.id) {
      fetchFriends(user.id);
    }
  }, [open, user?.id, fetchFriends]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setGroupName(conversation.name || "");
      setSearchQuery("");
      setSelectedFriends([]);
    }
  }, [open, conversation.name]);

  // Filter friends who are not already participants
  const participantIds = participants.map((p) => p.id);
  const availableFriends = friends.filter((friend) => {
    if (participantIds.includes(friend.id)) return false;
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

  const handleSaveName = async () => {
    if (!user?.id) return;

    setIsSaving(true);
    const success = await updateGroupName(conversation.id, user.id, groupName.trim());
    setIsSaving(false);

    if (success) {
      toast.success(groupName.trim() ? "Group name updated" : "Group name removed");
      // Refresh conversations to update the sidebar
      fetchConversations(user.id);
    } else {
      toast.error("Failed to update group name");
    }
  };

  const handleAddMembers = async () => {
    if (!user?.id || selectedFriends.length === 0) return;

    setIsAddingMembers(true);
    const success = await addGroupMembers(conversation.id, user.id, selectedFriends);
    setIsAddingMembers(false);

    if (success) {
      toast.success(`Added ${selectedFriends.length} member(s) to the group`);
      setSelectedFriends([]);
      // Refresh conversations to update the sidebar
      fetchConversations(user.id);
      onOpenChange(false);
    } else {
      toast.error("Failed to add members");
    }
  };

  const selectedFriendData = friends.filter((f) => selectedFriends.includes(f.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Group Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="name" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="name" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Group Name
            </TabsTrigger>
            <TabsTrigger value="invite" className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Invite Members
            </TabsTrigger>
          </TabsList>

          {/* Group Name Tab */}
          <TabsContent value="name" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                placeholder="Enter a group name (optional)"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use participant names as the group title.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveName} disabled={isSaving} loading={isSaving}>
                Save Name
              </Button>
            </div>
          </TabsContent>

          {/* Invite Members Tab */}
          <TabsContent value="invite" className="space-y-4 mt-4">
            {/* Current Participants */}
            <div className="space-y-2">
              <Label>Current Members ({participants.length})</Label>
              <div className="flex flex-wrap gap-2 p-2 bg-secondary/50 rounded-lg max-h-[80px] overflow-y-auto">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center gap-1.5 px-2 py-1 bg-background rounded-full text-xs"
                  >
                    <AvatarWithDecoration user={participant} className="w-4 h-4" />
                    <span className="truncate max-w-[80px]">
                      {participant.display_name || participant.username}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Friends Pills */}
            {selectedFriends.length > 0 && (
              <div className="space-y-2">
                <Label>Selected ({selectedFriends.length})</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedFriendData.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center gap-1.5 px-2 py-1 bg-primary/20 rounded-full text-sm"
                    >
                      <AvatarWithDecoration user={friend} className="w-5 h-5" />
                      <span className="truncate max-w-[100px]">
                        {friend.display_name || friend.username}
                      </span>
                      <button
                        onClick={() => toggleFriend(friend.id)}
                        className="p-0.5 hover:bg-primary/30 rounded-full transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search Friends */}
            <div className="space-y-2">
              <Label>Add Friends</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search friends..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Friends List */}
            <div className="max-h-[150px] overflow-y-auto space-y-1 border border-border rounded-lg p-2">
              {availableFriends.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {searchQuery ? "No friends found" : "All friends are already in this group"}
                </p>
              ) : (
                availableFriends.map((friend) => (
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
                    <AvatarWithDecoration user={friend} className="w-8 h-8" />
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
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddMembers}
                disabled={selectedFriends.length === 0 || isAddingMembers}
                loading={isAddingMembers}
              >
                Add Members ({selectedFriends.length})
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
