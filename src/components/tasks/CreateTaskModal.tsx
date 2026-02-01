import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { X, Loader2, Search } from "lucide-react";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { supabase } from "@/integrations/supabase/client";
import { handleError, showSuccess } from "@/lib/errorHandler";
import type { Channel } from "@/types";

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateTaskModal = ({ open, onClose, onSuccess }: CreateTaskModalProps) => {
  const { currentServer, channels, members } = useServerStore();
  const { user } = useAuthStore();

  const [taskName, setTaskName] = useState("");
  const [note, setNote] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Get all tasks channels in the server (memoized to prevent infinite loops)
  const tasksChannels = useMemo(() => channels.filter((c) => c.type === "tasks"), [channels]);

  // Filter members by search
  const filteredMembers = members.filter((m) => {
    if (!m.user) return false;
    if (!assigneeSearch) return true;
    const search = assigneeSearch.toLowerCase();
    const displayName = (m.user.display_name || m.user.username || "").toLowerCase();
    const username = (m.user.username || "").toLowerCase();
    return displayName.includes(search) || username.includes(search);
  });

  // Get permission check for selected channel
  const { hasPermission } = useMemberPermissions(selectedChannelId);
  const canCreateTasks = selectedChannelId ? hasPermission("create_tasks") : false;
  const canAssign = selectedChannelId ? hasPermission("assign_tasks") : false;

  // Reset form when modal closes and set default channel when opening
  useEffect(() => {
    if (!open) {
      // Reset form when closing
      setTaskName("");
      setNote("");
      setAssignees([]);
      setAssigneeSearch("");
      setSelectedChannelId("");
    } else if (open && tasksChannels.length > 0) {
      // Set default channel when opening (only if not already set)
      setSelectedChannelId((prev) => prev || tasksChannels[0].id);
    }
  }, [open, tasksChannels]);

  const handleSave = async () => {
    if (!user || !taskName.trim()) {
      handleError(new Error("Task name is required"));
      return;
    }

    if (!selectedChannelId) {
      handleError(new Error("Please select a channel"));
      return;
    }

    if (!canCreateTasks) {
      handleError(new Error("You don't have permission to create tasks in this channel"));
      return;
    }

    setIsSaving(true);
    try {
      // Create task (always creates with 'open' status)
      const { error } = await supabase.rpc("create_task", {
        _channel_id: selectedChannelId,
        _user_id: user.id,
        _title: taskName.trim(),
        _description: note.trim() || null,
        _priority: null,
        _due_date: null,
        _assignee_ids: canAssign ? assignees : [],
      });

      if (error) throw error;

      if (error) throw error;

      showSuccess("Task created");
      onSuccess();
      onClose();
    } catch (error) {
      handleError(error, "Failed to create task");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAssignee = (userId: string) => {
    if (!canAssign) return;
    setAssignees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Task Name */}
          <div>
            <Input
              placeholder="Task name"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              className="h-11"
            />
          </div>

          {/* Add a note */}
          <div>
            <Textarea
              placeholder="Add a note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>

          {/* Channel Selector */}
          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">Channel</Label>
            <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select a channel" />
              </SelectTrigger>
              <SelectContent>
                {tasksChannels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    #{channel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assignees */}
          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">Assignees</Label>
            
            {/* Selected Assignees */}
            {assignees.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {assignees.map((userId) => {
                  const member = members.find((m) => m.user_id === userId);
                  const assigneeUser = member?.user;
                  if (!assigneeUser) return null;
                  return (
                    <Badge
                      key={userId}
                      variant="secondary"
                      className="flex items-center gap-1.5 px-2 py-1"
                    >
                      <Avatar className="w-4 h-4">
                        <AvatarImage src={assigneeUser.avatar_url} />
                        <AvatarFallback
                          style={{ backgroundColor: assigneeUser.banner_color || "#5865F2" }}
                          className="text-[8px]"
                        >
                          {assigneeUser.username?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      {assigneeUser.display_name || assigneeUser.username}
                      {canAssign && (
                        <button
                          onClick={() => toggleAssignee(userId)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Assignee Search */}
            {canAssign && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search members..."
                  value={assigneeSearch}
                  onChange={(e) => setAssigneeSearch(e.target.value)}
                  className="pl-9 h-10"
                />
              </div>
            )}

            {/* Assignee List */}
            {canAssign && assigneeSearch && filteredMembers.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                {filteredMembers
                  .filter((m) => !assignees.includes(m.user_id))
                  .map((member) => {
                    if (!member.user) return null;
                    return (
                      <button
                        key={member.id}
                        onClick={() => toggleAssignee(member.user_id)}
                        className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent text-left"
                      >
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={member.user.avatar_url} />
                          <AvatarFallback
                            style={{ backgroundColor: member.user.banner_color || "#5865F2" }}
                            className="text-xs"
                          >
                            {member.user.username?.[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">
                          {member.user.display_name || member.user.username}
                        </span>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !taskName.trim() || !selectedChannelId}
            className="bg-primary text-primary-foreground"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Add task"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
