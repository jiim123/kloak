import { useState, useEffect } from "react";
import { useUIStore } from "@/stores/uiStore";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hash, Trash2, FolderOpen, Settings, Shield, Loader2, Clock, Lock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ChannelPermissionsEditor } from "./ChannelPermissionsEditor";
import { cn } from "@/lib/utils";
import type { Channel } from "@/types";

const SLOWMODE_OPTIONS = [
  { value: "0", label: "Off" },
  { value: "5", label: "5 seconds" },
  { value: "10", label: "10 seconds" },
  { value: "30", label: "30 seconds" },
  { value: "60", label: "1 minute" },
  { value: "300", label: "5 minutes" },
  { value: "900", label: "15 minutes" },
  { value: "3600", label: "1 hour" },
];

export const EditChannelModal = () => {
  const { activeModal, modalData, closeModal } = useUIStore();
  const {
    channels,
    categories,
    currentServer,
    updateChannel,
    deleteChannel,
    updateCategory,
    deleteCategory,
    fetchChannelPermissions,
  } = useServerStore();
  const { user } = useAuthStore();

  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [isNsfw, setIsNsfw] = useState(false);
  const [slowmodeSeconds, setSlowmodeSeconds] = useState("0");
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const isOpen = activeModal === "edit-channel";
  const channelId = modalData?.channelId as string | undefined;
  const categoryId = modalData?.categoryId as string | undefined;
  const isCategory = modalData?.isCategory === true;
  const showDeleteImmediately = modalData?.showDelete === true;

  const channel = channels.find((c) => c.id === channelId);
  const category = categories.find((c) => c.id === categoryId);

  const hasValidTarget = isCategory ? !!category : !!channel;
  const targetName = isCategory ? category?.name : channel?.name;

  useEffect(() => {
    if (isCategory && category) {
      setName(category.name);
      setTopic("");
      setIsNsfw(false);
      setSlowmodeSeconds("0");
      setIsReadOnly(false);
    } else if (channel) {
      setName(channel.name);
      setTopic(channel.topic || "");
      setIsNsfw(channel.is_nsfw);
      setSlowmodeSeconds(String(channel.slowmode_seconds));
      setIsReadOnly(channel.is_read_only || false);

      if (channel.id) {
        fetchChannelPermissions(channel.id).catch((error) => {
          console.error("Failed to fetch channel permissions:", error);
        });
      }
    }

    if (showDeleteImmediately && hasValidTarget) {
      setShowDeleteConfirm(true);
    }
  }, [channel, category, isCategory, showDeleteImmediately, hasValidTarget, fetchChannelPermissions]);

  const handleClose = () => {
    setError("");
    setShowDeleteConfirm(false);
    closeModal();
  };

  const formatChannelName = (value: string) => {
    return value
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  };

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault();

    if (!name.trim()) {
      setError(isCategory ? "Category name is required" : "Channel name is required");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      if (!user) throw new Error("Not authenticated");

      if (isCategory && categoryId) {
        await updateCategory(
          categoryId,
          {
            name: name.trim(),
          },
          user.id,
        );
        toast.success("Category updated");
      } else if (channelId) {
        const updates: Partial<Channel> = {
          name: formatChannelName(name.trim()),
          is_nsfw: isNsfw,
          slowmode_seconds: parseInt(slowmodeSeconds, 10) || 0,
          is_read_only: isReadOnly,
        };

        const trimmedTopic = topic.trim();
        updates.topic = trimmedTopic || null;

        await updateChannel(channelId, updates, user.id);
        toast.success("Channel updated");
      }
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to update ${isCategory ? "category" : "channel"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      if (!user) throw new Error("Not authenticated");

      if (isCategory && categoryId) {
        await deleteCategory(categoryId, user.id);
        toast.success("Category deleted");
      } else if (channelId) {
        await deleteChannel(channelId, user.id);
        toast.success("Channel deleted");
      }
      setShowDeleteConfirm(false);
      handleClose();
    } catch (err) {
      toast.error(`Failed to delete ${isCategory ? "category" : "channel"}`);
    }
  };

  // Tab navigation item component
  const TabButton = ({ value, icon: Icon, label }: { value: string; icon: React.ElementType; label: string }) => (
    <button
      type="button"
      onClick={() => setActiveTab(value)}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
        activeTab === value
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  // Toggle card component for switches
  const ToggleCard = ({
    icon: Icon,
    label,
    description,
    checked,
    onCheckedChange,
  }: {
    icon: React.ElementType;
    label: string;
    description: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }) => (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/30 border border-border/50">
      <div className="w-10 h-10 rounded-xl bg-secondary/80 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );

  return (
    <>
      <Dialog open={isOpen && hasValidTarget} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent
          className={cn(
            "overflow-hidden p-0 rounded-2xl gap-0",
            isCategory
              ? "sm:max-w-md max-w-[calc(100vw-2rem)]"
              : "sm:max-w-5xl max-w-[calc(100vw-2rem)] max-h-[90vh] sm:max-h-[85vh] flex flex-col",
          )}
        >
          {isCategory && category ? (
            // Category editing content
            <>
              {/* Header */}
              <div className="relative px-6 pt-6 pb-4">
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
                  <FolderOpen className="w-3 h-3" />
                  Edit Category
                </div>

                <h2 className="text-xl font-semibold">{category.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">Modify category settings</p>
              </div>

              {/* Content */}
              <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-6">
                <div className="space-y-3">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Category Name
                  </Label>
                  <Input
                    id="category-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Category name"
                    className="h-11 rounded-xl border-border/50 bg-secondary/30"
                    maxLength={50}
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                {/* Danger Zone */}
                <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                      <Trash2 className="w-5 h-5 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-destructive">Danger Zone</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Deleting a category will move all its channels to uncategorized.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="w-full h-10 rounded-xl"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Category
                  </Button>
                </div>

                {/* Footer */}
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={handleClose} className="flex-1 h-11 rounded-xl">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting || !name.trim()} className="flex-1 h-11 rounded-xl">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </form>
            </>
          ) : channel ? (
            // Channel editing content
            <>
              {/* Header */}
              <div className="relative px-6 pt-6 pb-4 border-b border-border/50">
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
                  <Hash className="w-3 h-3" />
                  Edit Channel
                </div>

                <h2 className="text-xl font-semibold">#{channel.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">Modify channel settings and permissions</p>
              </div>

              {/* Tabs Layout */}
              <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <div className="w-48 sm:w-56 border-r border-border/50 bg-secondary/20 p-3 space-y-1 flex-shrink-0">
                  <TabButton value="overview" icon={Hash} label="Overview" />
                  <TabButton value="settings" icon={Settings} label="Settings" />
                  <TabButton value="permissions" icon={Shield} label="Permissions" />
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto">
                  {/* Overview Tab */}
                  {activeTab === "overview" && (
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                      <div className="space-y-3">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Channel Name
                        </Label>
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-secondary/80 flex items-center justify-center">
                            <Hash className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <Input
                            id="channel-name"
                            value={name}
                            onChange={(e) => setName(formatChannelName(e.target.value))}
                            placeholder="channel-name"
                            className="h-11 pl-14 rounded-xl border-border/50 bg-secondary/30"
                            maxLength={50}
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Channel Topic
                          <span className="text-muted-foreground/70 font-normal normal-case ml-1">(optional)</span>
                        </Label>
                        <Textarea
                          id="channel-topic"
                          value={topic}
                          onChange={(e) => setTopic(e.target.value)}
                          placeholder="Let everyone know what this channel is for..."
                          className="rounded-xl border-border/50 bg-secondary/30 min-h-[100px] resize-none"
                          maxLength={1024}
                        />
                        <p className="text-xs text-muted-foreground text-right">{topic.length}/1024</p>
                      </div>

                      {error && (
                        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                          <p className="text-sm text-destructive">{error}</p>
                        </div>
                      )}

                      <div className="flex gap-3 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleClose}
                          className="flex-1 h-11 rounded-xl"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={isSubmitting || !name.trim()}
                          className="flex-1 h-11 rounded-xl"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            "Save Changes"
                          )}
                        </Button>
                      </div>
                    </form>
                  )}

                  {/* Settings Tab */}
                  {activeTab === "settings" && (
                    <div className="p-6 space-y-6">
                      {/* Slowmode */}
                      <div className="space-y-3">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Slowmode
                        </Label>
                        <Select value={slowmodeSeconds} onValueChange={setSlowmodeSeconds}>
                          <SelectTrigger className="h-11 rounded-xl border-border/50 bg-secondary/30">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border/50">
                            {SLOWMODE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value} className="rounded-lg">
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Members will only be able to send one message per this time period
                        </p>
                      </div>

                      {/* Toggles */}
                      <div className="space-y-3">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Channel Options
                        </Label>

                        <ToggleCard
                          icon={Lock}
                          label="Read-Only Channel"
                          description="Only admins and moderators can send messages"
                          checked={isReadOnly}
                          onCheckedChange={setIsReadOnly}
                        />

                        <ToggleCard
                          icon={AlertTriangle}
                          label="Age-Restricted Channel"
                          description="Mark this channel as NSFW"
                          checked={isNsfw}
                          onCheckedChange={setIsNsfw}
                        />
                      </div>

                      {/* Danger Zone */}
                      <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                            <Trash2 className="w-5 h-5 text-destructive" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-destructive">Danger Zone</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Deleting a channel is irreversible. All messages will be permanently lost.
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          className="w-full h-10 rounded-xl"
                          onClick={() => setShowDeleteConfirm(true)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Channel
                        </Button>
                      </div>

                      {/* Footer */}
                      <div className="flex gap-3 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleClose}
                          className="flex-1 h-11 rounded-xl"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSubmit}
                          disabled={isSubmitting || !name.trim()}
                          className="flex-1 h-11 rounded-xl"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            "Save Changes"
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Permissions Tab */}
                  {activeTab === "permissions" && (
                    <div className="p-6">
                      {channelId && currentServer ? (
                        <ChannelPermissionsEditor
                          channelId={channelId}
                          serverId={currentServer.id}
                          onClose={handleClose}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="w-12 h-12 rounded-xl bg-secondary/80 flex items-center justify-center mb-4">
                            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                          </div>
                          <p className="text-sm text-muted-foreground">Loading permissions...</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md rounded-2xl">
          <AlertDialogHeader>
            <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-2">
              <Trash2 className="w-6 h-6 text-destructive" />
            </div>
            <AlertDialogTitle>Delete {isCategory ? "Category" : "Channel"}</AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              Are you sure you want to delete{" "}
              <strong className="text-foreground">{isCategory ? targetName : `#${targetName}`}</strong>?
              {isCategory
                ? " All channels in this category will be moved to uncategorized."
                : " This action cannot be undone and all messages in this channel will be permanently deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 sm:gap-3">
            <AlertDialogCancel className="flex-1 m-0 rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="flex-1 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete {isCategory ? "Category" : "Channel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
