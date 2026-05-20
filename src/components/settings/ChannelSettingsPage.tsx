import { useState, useEffect } from "react";
import { useUIStore } from "@/stores/uiStore";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import {
  Hash,
  Trash2,
  FolderOpen,
  Settings,
  Shield,
  Loader2,
  Clock,
  Lock,
  AlertTriangle,
  Users,
  Link2,
  Eye,
  Plus,
  X,
  Info,
  Paperclip,
  MessageSquareOff,
  BarChartHorizontal,
  Timer,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ChannelPermissionsEditor } from "@/components/modals/ChannelPermissionsEditor";
import { CategoryPermissionsEditor } from "@/components/modals/CategoryPermissionsEditor";
import { ChannelMembersEditor } from "@/components/modals/ChannelMembersEditor";
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

const normalizeDomain = (domain: string) =>
  domain
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, "")
    .replace(/\/.*$/, "");

const sameStringArray = (a: string[], b: string[]) =>
  a.length === b.length && a.every((item, index) => item === b[index]);

const SettingsRow = ({
  icon: Icon,
  label,
  description,
  children,
  disabled,
  className,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) => (
  <div className={cn("flex min-h-[72px] items-center gap-4 py-4", disabled && "opacity-60", className)}>
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] bg-secondary">
      <Icon className="h-[18px] w-[18px] text-muted-foreground" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold leading-5 text-foreground">{label}</p>
      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

// Toggle row component for switches
const ToggleCard = ({
  icon,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) => (
  <SettingsRow icon={icon} label={label} description={description} disabled={disabled}>
    <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
  </SettingsRow>
);

// Settings group box wrapper — matches ServerSettingsPage pattern
const SettingsSection = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-2">
    <div className="space-y-1">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {description && <p className="text-xs leading-5 text-muted-foreground">{description}</p>}
    </div>
    <div className="divide-y divide-border">{children}</div>
  </section>
);

const NAV_ITEM_CLASS =
  "w-full h-9 flex items-center gap-2.5 justify-start px-[30px] py-0 text-left text-sm font-medium leading-none transition-colors";

export const ChannelSettingsPage = () => {
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
    fetchCategoryPermissions,
  } = useServerStore();
  const { user } = useAuthStore();

  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [chatNotice, setChatNotice] = useState("");
  const [voiceUserLimit, setVoiceUserLimit] = useState("0");
  const [isNsfw, setIsNsfw] = useState(false);
  const [slowmodeSeconds, setSlowmodeSeconds] = useState("0");
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [blockLinks, setBlockLinks] = useState(false);
  const [allowedLinkDomains, setAllowedLinkDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [ghostMode, setGhostMode] = useState(false);
  const [blockAttachments, setBlockAttachments] = useState(false);
  const [disableReactions, setDisableReactions] = useState(false);
  const [disablePolls, setDisablePolls] = useState(false);
  const [autoDeleteSeconds, setAutoDeleteSeconds] = useState<string>("null");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const channelId = modalData?.channelId as string | undefined;
  const categoryId = modalData?.categoryId as string | undefined;
  const isCategory = modalData?.isCategory === true;

  const channel = channels.find((c) => c.id === channelId);
  const category = categories.find((c) => c.id === categoryId);

  const hasValidTarget = isCategory ? !!category : !!channel;
  const targetName = isCategory ? category?.name : channel?.name;

  // Navigation items - categories use the same full-screen settings shell as channels
  const navItems = isCategory
    ? [
        { id: "overview", label: "Overview", icon: FolderOpen },
        { id: "settings", label: "Settings", icon: Settings },
        { id: "permissions", label: "Permissions", icon: Shield },
      ]
    : [
        { id: "overview", label: "Overview", icon: Hash },
        { id: "settings", label: "Settings", icon: Settings },
        ...(channel?.is_private ? [{ id: "members", label: "Members", icon: Users }] : []),
        { id: "permissions", label: "Permissions", icon: Shield },
      ];

  useEffect(() => {
    if (isCategory && category) {
      setName(category.name);
      setTopic("");
      setChatNotice("");
      setVoiceUserLimit("0");
      setIsNsfw(false);
      setSlowmodeSeconds("0");
      setIsReadOnly(false);
      setBlockLinks(false);
      setAllowedLinkDomains([]);
      setGhostMode(false);
      setBlockAttachments(false);
      setDisableReactions(false);
      setDisablePolls(false);
      setAutoDeleteSeconds("null");

      if (category.id) {
        fetchCategoryPermissions(category.id).catch((error) => {
          console.error("Failed to fetch category permissions:", error);
        });
      }
    } else if (channel) {
      setName(channel.name);
      setTopic(channel.topic || "");
      setChatNotice(channel.chat_notice || "");
      setVoiceUserLimit(String(channel.voice_user_limit ?? 0));
      setIsNsfw(channel.is_nsfw);
      setSlowmodeSeconds(String(channel.slowmode_seconds));
      setIsReadOnly(channel.is_read_only || false);
      setBlockLinks(channel.block_links || false);
      setAllowedLinkDomains(channel.allowed_link_domains || []);
      setGhostMode(channel.ghost_mode || false);
      setBlockAttachments(channel.block_attachments || false);
      setDisableReactions(channel.disable_reactions || false);
      setDisablePolls(channel.disable_polls || false);
      setAutoDeleteSeconds(channel.auto_delete_seconds != null ? String(channel.auto_delete_seconds) : "null");

      if (channel.id) {
        fetchChannelPermissions(channel.id).catch((error) => {
          console.error("Failed to fetch channel permissions:", error);
        });
      }
    }
  }, [channel, category, isCategory, fetchChannelPermissions, fetchCategoryPermissions]);

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

    if ((activeTab === "overview" || isCategory) && !name.trim()) {
      setError(isCategory ? "Category name is required" : "Channel name is required");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      if (!user) throw new Error("Not authenticated");

      if (isCategory && categoryId) {
        await updateCategory(categoryId, { name: name.trim() }, user.id);
      } else if (channelId) {
        const updates: Partial<Channel> = {};

        if (activeTab === "overview") {
          updates.name = formatChannelName(name.trim());

          const trimmedTopic = topic.trim();
          updates.topic = trimmedTopic || null;
          if (channel?.type !== "voice") {
            const trimmedChatNotice = chatNotice.trim();
            if (trimmedChatNotice.length > 300) {
              throw new Error("Before you chat notice must be 300 characters or fewer");
            }
            updates.chat_notice = trimmedChatNotice || null;
          }

          if (channel?.type === "voice") {
            const parsedLimit = Math.max(0, Number.parseInt(voiceUserLimit, 10) || 0);
            updates.voice_user_limit = parsedLimit;
          }
        }

        if (activeTab === "settings") {
          updates.is_nsfw = isNsfw;
          updates.slowmode_seconds = parseInt(slowmodeSeconds, 10) || 0;
          updates.is_read_only = isReadOnly;
          updates.block_links = blockLinks;
          updates.allowed_link_domains = allowedLinkDomains;
          updates.ghost_mode = ghostMode;
          updates.block_attachments = blockAttachments;
          updates.disable_reactions = disableReactions;
          updates.disable_polls = disablePolls;
          updates.auto_delete_seconds = autoDeleteSeconds === "null" ? null : parseInt(autoDeleteSeconds, 10);
        }

        await updateChannel(channelId, updates, user.id);
      }
      toast.success(`${isCategory ? "Category" : "Channel"} updated`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to update ${isCategory ? "category" : "channel"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetActiveTabChanges = () => {
    setError("");
    setNewDomain("");

    if (isCategory && category) {
      if (activeTab === "overview") {
        setName(category.name);
      }
      return;
    }

    if (!channel) return;

    if (activeTab === "overview") {
      setName(channel.name);
      setTopic(channel.topic || "");
      setChatNotice(channel.chat_notice || "");
      setVoiceUserLimit(String(channel.voice_user_limit ?? 0));
      return;
    }

    if (activeTab === "settings") {
      setIsNsfw(channel.is_nsfw);
      setSlowmodeSeconds(String(channel.slowmode_seconds));
      setIsReadOnly(channel.is_read_only || false);
      setBlockLinks(channel.block_links || false);
      setAllowedLinkDomains(channel.allowed_link_domains || []);
      setGhostMode(channel.ghost_mode || false);
      setBlockAttachments(channel.block_attachments || false);
      setDisableReactions(channel.disable_reactions || false);
      setDisablePolls(channel.disable_polls || false);
      setAutoDeleteSeconds(channel.auto_delete_seconds != null ? String(channel.auto_delete_seconds) : "null");
    }
  };

  const channelOverviewDirty = !!channel && (
    formatChannelName(name.trim()) !== channel.name ||
    topic.trim() !== (channel.topic || "") ||
    (channel.type !== "voice" && chatNotice.trim() !== (channel.chat_notice || "")) ||
    (channel.type === "voice" && Math.max(0, Number.parseInt(voiceUserLimit, 10) || 0) !== (channel.voice_user_limit ?? 0))
  );

  const channelSettingsDirty = !!channel && (
    isNsfw !== channel.is_nsfw ||
    Number.parseInt(slowmodeSeconds, 10) !== channel.slowmode_seconds ||
    isReadOnly !== (channel.is_read_only || false) ||
    blockLinks !== (channel.block_links || false) ||
    !sameStringArray(allowedLinkDomains, channel.allowed_link_domains || []) ||
    ghostMode !== (channel.ghost_mode || false) ||
    blockAttachments !== (channel.block_attachments || false) ||
    disableReactions !== (channel.disable_reactions || false) ||
    disablePolls !== (channel.disable_polls || false) ||
    autoDeleteSeconds !== (channel.auto_delete_seconds != null ? String(channel.auto_delete_seconds) : "null")
  );

  const categoryOverviewDirty = !!category && name.trim() !== category.name;

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


  // Channel Overview Tab Content
  const channelOverviewContent = (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Channel Name</Label>
        <Input
          id="channel-name"
          value={name}
          onChange={(e) => setName(formatChannelName(e.target.value))}
          placeholder="channel-name"
          className="h-10 rounded-xl border-border/50 bg-secondary/30 text-sm"
          maxLength={50}
        />
      </div>

      <div className="space-y-3">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Channel Topic
          <span className="text-muted-foreground/70 font-normal normal-case ml-1">(optional)</span>
        </Label>
        <Textarea
          id="channel-topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Let everyone know what this channel is for..."
          className="rounded-xl border-border/50 bg-secondary/30 min-h-[100px] resize-none"
          maxLength={120}
        />
        <p className="text-xs text-muted-foreground text-right">{topic.length}/120</p>
      </div>

      {channel?.type !== "voice" && (
        <div className="space-y-3">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Before You Chat Notice
          <span className="text-muted-foreground/70 font-normal normal-case ml-1">(optional)</span>
        </Label>
        <div className="p-3 rounded-xl border border-border/50 bg-secondary/20 flex items-start gap-2.5">
          <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Displays when the user is about to start their first chat in this channel, making it a good opportunity to
            share channel rules or guidelines.
          </p>
        </div>
        <Textarea
          id="channel-chat-notice"
          value={chatNotice}
          onChange={(e) => setChatNotice(e.target.value)}
          placeholder="Before you chat..."
          className="rounded-xl border-border/50 bg-secondary/30 min-h-[92px] resize-none"
          maxLength={300}
        />
        <p className="text-xs text-muted-foreground text-right">{chatNotice.length}/300</p>
      </div>
      )}

      {channel?.type === "voice" && (
        <div className="space-y-3">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Voice User Limit
          </Label>
          <div className="p-3 rounded-xl border border-border/50 bg-secondary/20 flex items-start gap-2.5">
            <Users className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Set the maximum number of users who can join this voice channel at once. Use{" "}
              <span className="font-medium text-foreground">0</span> for unlimited.
            </p>
          </div>
          <Input
            id="voice-user-limit"
            type="number"
            min={0}
            value={voiceUserLimit}
            onChange={(e) => {
              const next = e.target.value;
              if (next === "") {
                setVoiceUserLimit("0");
                return;
              }
              const parsed = Number.parseInt(next, 10);
              setVoiceUserLimit(String(Number.isNaN(parsed) ? 0 : Math.max(0, parsed)));
            }}
            className="h-11 rounded-xl border-border/50 bg-secondary/30"
          />
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );


  // Channel Settings Tab Content
  const channelSettingsContent = (
    <div className="space-y-8">
      <SettingsSection
        title="Channel Behavior"
        description="Control how members can post and how this channel appears."
      >
        <SettingsRow
          icon={Clock}
          label="Slowmode"
          description="Members can only send one message within the selected interval."
        >
          <Select value={slowmodeSeconds} onValueChange={setSlowmodeSeconds}>
            <SelectTrigger className="h-9 w-[220px] rounded-[4px] border-border bg-secondary/40 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-[4px] border-border/50">
              {SLOWMODE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>

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
          description={
            channel?.ghost_mode
              ? "Ghost Mode is permanent and cannot be disabled"
              : "Hide usernames and avatars (admins/owners still visible)"
          }
          checked={ghostMode}
          onCheckedChange={setGhostMode}
          disabled={channel?.ghost_mode}
        />
      </SettingsSection>

      <SettingsSection
        title="Content & Media Restrictions"
        description="Limit media, links, reactions, and polls for regular members."
      >
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
          <div className="ml-[52px] space-y-3 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Whitelisted Domains</p>
                <p className="text-xs text-muted-foreground mt-0.5">Allow links from these domains for all users</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value.toLowerCase())}
                placeholder="e.g. github.com"
                className="h-9 rounded-[4px] border-border bg-secondary/40 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const domain = normalizeDomain(newDomain);
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
                className="h-9 rounded-[4px] px-3"
                onClick={() => {
                  const domain = normalizeDomain(newDomain);
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
                    className="inline-flex items-center gap-1 rounded-[4px] bg-secondary px-2 py-1 text-xs font-medium text-foreground"
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

        <ToggleCard
          icon={Paperclip}
          label="Block Attachments"
          description="Prevent members from uploading files and images. Admins and owners can still post attachments."
          checked={blockAttachments}
          onCheckedChange={setBlockAttachments}
        />

        <ToggleCard
          icon={MessageSquareOff}
          label="Disable Reactions"
          description="Prevent members from adding emoji reactions to messages. Admins and owners can still react."
          checked={disableReactions}
          onCheckedChange={setDisableReactions}
        />

        <ToggleCard
          icon={BarChartHorizontal}
          label="Disable Polls"
          description="Prevent members from creating polls in this channel. Admins and owners can still create polls."
          checked={disablePolls}
          onCheckedChange={setDisablePolls}
        />
      </SettingsSection>

      <SettingsSection
        title="Message Retention"
        description="Choose whether messages should be removed automatically."
      >
        <SettingsRow
          icon={Timer}
          label="Auto-delete messages"
          description="Pinned and system messages are preserved."
        >
          <Select value={autoDeleteSeconds} onValueChange={setAutoDeleteSeconds}>
            <SelectTrigger className="h-9 w-[220px] rounded-[4px] border-border bg-secondary/40 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-[4px] border-border/50">
              <SelectItem value="null">Disabled</SelectItem>
              <SelectItem value="3600">After 1 hour</SelectItem>
              <SelectItem value="86400">After 24 hours</SelectItem>
              <SelectItem value="604800">After 7 days</SelectItem>
              <SelectItem value="2592000">After 30 days</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
      </SettingsSection>
    </div>
  );

  // Permissions Tab Content
  const channelPermissionsContent = (
    <div className="h-full">
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
  const channelMembersContent = (
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

  // Render channel content based on active tab
  const renderChannelContent = () => {
    switch (activeTab) {
      case "overview":
        return channelOverviewContent;
      case "settings":
        return channelSettingsContent;
      case "members":
        return channelMembersContent;
      case "permissions":
        return channelPermissionsContent;
      default:
        return null;
    }
  };

  // Category Overview Content
  const categoryOverviewContent = (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Category Name</Label>
        <Input
          id="category-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Category name"
          className="h-10 rounded-xl border-border/50 bg-secondary/30 text-sm"
          maxLength={50}
        />
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );

  // Category Permissions Content
  const categoryPermissionsContent = (
    <div className="h-full">
      {categoryId && currentServer ? (
        <CategoryPermissionsEditor categoryId={categoryId} serverId={currentServer.id} onClose={handleClose} />
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

  // Category Settings Content
  const categorySettingsContent = (
    <div className="space-y-8">
      <SettingsSection title="Category Behavior">
        <SettingsRow
          icon={Settings}
          label="Category-level settings"
          description="Permissions configured here apply to channels in this category unless a channel has its own override."
        >
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 rounded-[4px] px-4"
            onClick={() => setActiveTab("permissions")}
          >
            Open Permissions
          </Button>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Danger Zone">
        <SettingsRow
          icon={Trash2}
          label="Delete Category"
          description="Deleting a category moves all channels in it to uncategorized."
          className="text-destructive"
        >
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-9 rounded-[3px] px-4"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </SettingsRow>
      </SettingsSection>
    </div>
  );

  // Render category content based on active tab
  const renderCategoryContent = () => {
    switch (activeTab) {
      case "overview":
        return categoryOverviewContent;
      case "settings":
        return categorySettingsContent;
      case "permissions":
        return categoryPermissionsContent;
      default:
        return null;
    }
  };

  const showSaveButton = isCategory
    ? activeTab === "overview" && categoryOverviewDirty
    : (activeTab === "overview" && channelOverviewDirty) || (activeTab === "settings" && channelSettingsDirty);

  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Don't render if no valid target
  if (!hasValidTarget) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="server-settings-reference h-full flex bg-background text-foreground">
        {/* Sidebar Navigation */}
        <div className="w-[250px] flex-shrink-0 bg-layout-sidebar flex flex-col overflow-hidden">
          {/* Channel/Category Name Header */}
          <div className="px-[30px] pt-[32px] pb-[12px]">
            <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground truncate">
              {isCategory ? "Category settings" : "Channel settings"}
            </h2>
            <p className="text-[11px] text-muted-foreground mt-1 truncate">
              {isCategory ? category?.name : `#${channel?.name}`}
            </p>
          </div>

          {/* Nav Items */}
          <ScrollArea className="flex-1 pb-6">
            <nav className="flex flex-col items-start w-full bg-transparent p-0 gap-0">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      NAV_ITEM_CLASS,
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}

              {/* Delete - at bottom, separated */}
              <Separator className="my-5 bg-secondary" />
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className={cn(NAV_ITEM_CLASS, "text-destructive hover:bg-secondary/70 hover:text-destructive")}
              >
                <Trash2 className="w-4 h-4" />
                Delete {isCategory ? "Category" : "Channel"}
              </button>
            </nav>
          </ScrollArea>

          {showSaveButton && (
            <div className="px-4 pb-4 pt-2 border-t border-border space-y-2">
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || ((activeTab === "overview" || isCategory) && !name.trim())}
                className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save changes
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetActiveTabChanges}
                className="w-full h-7 bg-transparent text-xs text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden relative flex flex-col bg-background">
          {/* Close Button (ESC) */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="absolute top-[48px] right-[46px] z-10 h-10 w-10 bg-transparent text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
            aria-label="Close channel settings"
          >
            <X className="w-7 h-7" />
          </Button>

          {activeTab === "permissions" ? (
            /* Permissions tab renders full-bleed with its own master/detail layout */
            <div className="flex-1 min-h-0 pr-16">
              {isCategory ? categoryPermissionsContent : channelPermissionsContent}
            </div>
          ) : (
            /* Other tabs: titled scrollable content */
            <div className="flex-1 overflow-y-auto">
              <div className="px-[40px] py-[32px] pr-[84px]">
                <h2 className="text-[20px] leading-7 font-bold mb-1 text-foreground">
                  {navItems.find((n) => n.id === activeTab)?.label}
                </h2>
                <p className="text-sm text-muted-foreground mb-6">
                  {activeTab === "overview" && (isCategory ? "Basic category information" : "Basic channel information")}
                  {activeTab === "settings" &&
                    (isCategory ? "Category configuration options" : "Channel configuration options")}
                  {activeTab === "members" && "Manage who can access this private channel"}
                </p>

                <div className="max-w-3xl">
                  {/* Tab Content */}
                  {isCategory ? renderCategoryContent() : renderChannelContent()}

                </div>
              </div>
            </div>
          )}
        </div>
      </div>

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
