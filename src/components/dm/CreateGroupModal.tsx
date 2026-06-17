import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFriendStore } from "@/stores/friendStore";
import { useDMStore } from "@/stores/dmStore";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";

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
  const trimmedSearchQuery = searchQuery.trim().toLowerCase();

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
    if (!trimmedSearchQuery) return false;
    const username = friend.username?.toLowerCase() || "";
    const displayName = friend.display_name?.toLowerCase() || "";
    return username.includes(trimmedSearchQuery) || displayName.includes(trimmedSearchQuery);
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
      <DialogContent className="max-h-[90vh] max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl sm:max-w-[448px]">
        <div className="flex max-h-[82vh] flex-col overflow-hidden">
          <div className="border-b border-border bg-secondary/40 px-5 py-3">
            <div className="flex items-center gap-2 text-base font-medium leading-none tracking-tight">
              <Users className="h-4 w-4 text-muted-foreground" />
              Create Group
            </div>
          </div>

          <div className="space-y-5 overflow-y-auto px-6 py-4">
            <div>
              <div className="flex items-center justify-between gap-3">
                <Label
                  htmlFor="group-name"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Group name
                </Label>
                <span className="text-xs text-muted-foreground">{groupName.length}/50</span>
              </div>
              <Input
                id="group-name"
                placeholder=""
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                maxLength={50}
                className="mt-2 h-9 rounded-none border-0 border-b border-border bg-transparent px-0 text-sm text-foreground shadow-none outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Leave this blank to use a default group name based on members.
              </p>
            </div>

            {selectedFriends.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Selected friends
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedFriendData.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-2.5 py-1.5 text-sm text-foreground"
                    >
                      <AvatarWithDecoration user={friend} className="h-5 w-5" freezeGifUntilHover />
                      <span className="max-w-[140px] truncate">
                        {friend.display_name || friend.username}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleFriend(friend.id)}
                        className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Add friends
              </Label>
              <div className="relative mt-2">
                <Search className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder=""
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 rounded-none border-0 border-b border-border bg-transparent px-0 pl-7 text-sm text-foreground shadow-none outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Select at least 2 friends to start a group conversation.
              </p>
            </div>

            {trimmedSearchQuery ? (
              <div className="overflow-hidden rounded-2xl border border-border bg-secondary/40">
                <div className="border-b border-border px-3 py-2">
                  <p className="text-sm font-medium leading-none text-foreground">
                    Search results
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {filteredFriends.length} match{filteredFriends.length === 1 ? "" : "es"}
                  </p>
                </div>
                <div className="max-h-[240px] overflow-y-auto p-2">
                  {filteredFriends.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No friends found
                    </p>
                  ) : (
                    filteredFriends.map((friend) => (
                      <label
                        key={friend.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-xl border border-transparent px-2 py-2 transition-colors",
                          selectedFriends.includes(friend.id)
                            ? "border-border bg-secondary"
                            : "hover:bg-secondary/70"
                        )}
                      >
                        <Checkbox
                          checked={selectedFriends.includes(friend.id)}
                          onCheckedChange={() => toggleFriend(friend.id)}
                        />
                        <AvatarWithDecoration user={friend} className="h-8 w-8" freezeGifUntilHover />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {friend.display_name || friend.username}
                          </p>
                          {friend.display_name && (
                            <p className="truncate text-xs text-muted-foreground">
                              @{friend.username}
                            </p>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/30 px-3 py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Search for a friend to add them to this group.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border bg-secondary/30 px-5 py-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-9 rounded-full px-4 text-muted-foreground hover:bg-transparent hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={selectedFriends.length < 2 || isCreating}
              className="h-9 rounded-full bg-primary px-5 font-medium text-primary-foreground hover:bg-primary/90 disabled:bg-secondary disabled:text-muted-foreground disabled:opacity-100"
            >
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Group ({selectedFriends.length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
