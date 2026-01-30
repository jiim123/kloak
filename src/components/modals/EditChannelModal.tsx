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
import { Hash, Trash2, FolderOpen, Settings, Shield, Loader2, Clock, Lock, AlertTriangle, X, Users, Link2, Eye, Plus } from "lucide-react";
import { toast } from "sonner";
import { ChannelPermissionsEditor } from "./ChannelPermissionsEditor";
import { ChannelMembersEditor } from "./ChannelMembersEditor";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const isMobile = useIsMobile();
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
  const [blockLinks, setBlockLinks] = useState(false);
  const [allowedLinkDomains, setAllowedLinkDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [ghostMode, setGhostMode] = useState(false);
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

  const navItems = [
    { id: "overview", label: "Overview", icon: Hash },
    { id: "settings", label: "Settings", icon: Settings },
    ...(channel?.is_private ? [{ id: "members", label: "Members", icon: Users }] : []),
    { id: "permissions", label: "Permissions", icon: Shield },
  ];

  useEffect(() => {
    if (isCategory && category) {
      setName(category.name);
      setTopic("");
      setIsNsfw(false);
      setSlowmodeSeconds("0");
      setIsReadOnly(false);
      setBlockLinks(false);
      setAllowedLinkDomains([]);
      setGhostMode(false);
    } else if (channel) {
      setName(channel.name);
      setTopic(channel.topic || "");
      setIsNsfw(channel.is_nsfw);
      setSlowmodeSeconds(String(channel.slowmode_seconds));
      setIsReadOnly(channel.is_read_only || false);
      setBlockLinks(channel.block_links || false);
      setAllowedLinkDomains(channel.allowed_link_domains || []);
      setGhostMode(channel.ghost_mode || false);

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
    setActiveTab("overview");
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
          block_links: blockLinks,
          allowed_link_domains: allowedLinkDomains,
          ghost_mode: ghostMode,
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

  // Overview Tab Content
  const overviewContent = (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Channel Name</Label>
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
  );

  // Settings Tab Content
  const settingsContent = (
    <div className="space-y-6">
      {/* Slowmode */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Slowmode</Label>
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
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Channel Options</Label>

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

        <ToggleCard
          icon={Eye}
          label="Ghost Mode"
          description="Hide usernames and avatars (admins/owners still visible)"
          checked={ghostMode}
          onCheckedChange={setGhostMode}
        />
      </div>

      {/* Link Restrictions */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Link Restrictions</Label>

        <ToggleCard
          icon={Link2}
          label="Block Links"
          description="Only admins can post URLs in this channel"
          checked={blockLinks}
          onCheckedChange={(checked) => {
            setBlockLinks(checked);
            if (!checked) {
              setAllowedLinkDomains([]);
            }
          }}
        />

        {blockLinks && (
          <div className="ml-14 space-y-3 p-4 rounded-xl bg-secondary/20 border border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Whitelisted Domains</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Allow links from these domains for all users
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value.toLowerCase().trim())}
                placeholder="e.g. github.com"
                className="h-9 rounded-lg border-border/50 bg-secondary/30 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const domain = newDomain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/.*$/, "");
                    if (domain && !allowedLinkDomains.includes(domain)) {
                      setAllowedLinkDomains([...allowedLinkDomains, domain]);
                      setNewDomain("");
                    }
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9 px-3 rounded-lg"
                onClick={() => {
                  const domain = newDomain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/.*$/, "");
                  if (domain && !allowedLinkDomains.includes(domain)) {
                    setAllowedLinkDomains([...allowedLinkDomains, domain]);
                    setNewDomain("");
                  }
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {allowedLinkDomains.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {allowedLinkDomains.map((domain) => (
                  <span
                    key={domain}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary text-xs font-medium"
                  >
                    {domain}
                    <button
                      type="button"
                      onClick={() => setAllowedLinkDomains(allowedLinkDomains.filter((d) => d !== domain))}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
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
        <Button type="button" variant="outline" onClick={handleClose} className="flex-1 h-11 rounded-xl">
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting || !name.trim()} className="flex-1 h-11 rounded-xl">
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
  );

  // Permissions Tab Content
  const permissionsContent = (
    <div>
      {channelId && currentServer ? (
        <ChannelPermissionsEditor channelId={channelId} serverId={currentServer.id} onClose={handleClose} />
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-secondary/80 flex items-center justify-center mb-4">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Loading permissions...</p>
        </div>
      )}
    </div>
  );

  // Members Tab Content (for private channels)
  const membersContent = (
    <div>
      {channelId && currentServer ? (
        <ChannelMembersEditor channelId={channelId} serverId={currentServer.id} onClose={handleClose} />
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-secondary/80 flex items-center justify-center mb-4">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Loading members...</p>
        </div>
      )}
    </div>
  );

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case "overview":
        return overviewContent;
      case "settings":
        return settingsContent;
      case "members":
        return membersContent;
      case "permissions":
        return permissionsContent;
      default:
        return null;
    }
  };

  // Category content (simpler, no tabs needed)
  const categoryContent = (
    <>
      {/* Header */}
      <div className="relative px-6 pt-6 pb-4">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
          <FolderOpen className="w-3 h-3" />
          Edit Category
        </div>

        <h2 className="text-xl font-semibold">{category?.name}</h2>
        <p className="text-sm text-muted-foreground mt-1">Modify category settings</p>
      </div>

      {/* Content */}
      <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-6">
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category Name</Label>
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
  );

  // Don't render if no valid target
  if (!isOpen || !hasValidTarget) return null;

  return (
    <>
      {/* Category Modal (simple, same for mobile/desktop) */}
      {isCategory && category && (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
          <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)] overflow-hidden p-0 rounded-2xl gap-0">
            {categoryContent}
          </DialogContent>
        </Dialog>
      )}

      {/* Channel Modal - Mobile with Dock */}
      {!isCategory && channel && isMobile && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-end p-4 pb-6">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

          {/* Dialog */}
          <div
            className="relative bg-background rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-border mb-4"
            style={{ maxHeight: "calc(100vh - 140px)" }}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{navItems.find((n) => n.id === activeTab)?.label}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">#{channel.name}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClose} className="rounded-full">
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-5" style={{ maxHeight: "calc(100vh - 240px)" }}>
              {renderContent()}
            </div>
          </div>

          {/* Dock Navigation */}
          <div className="relative flex gap-2 p-2 bg-background/95 backdrop-blur-xl rounded-2xl border border-border shadow-2xl">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "relative flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Channel Modal - Desktop with Sidebar */}
      {!isCategory && channel && !isMobile && (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
          <DialogContent className="sm:max-w-5xl max-w-[calc(100vw-2rem)] max-h-[90vh] sm:max-h-[85vh] overflow-hidden p-0 rounded-2xl gap-0 flex flex-col">
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
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto p-6">{renderContent()}</div>
            </div>
          </DialogContent>
        </Dialog>
      )}

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
