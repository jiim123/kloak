import { ChartBar, ChatTeardropSlash, CircleNotch, Clock, Eye, FolderOpen, Gear, Hash, Info, Link as LinkIcon, Lock, Paperclip, Plus, Shield, Timer, Trash, User as UserIcon, Users, Warning, X } from "@phosphor-icons/react";
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

// Toggle card component for switches
const ToggleCard = ({
 icon: Icon,
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
 <div
 className={cn(
 "flex items-center gap-4 p-4 rounded-xl bg-secondary/30 border border-border/50",
 disabled && "opacity-60",
 )}
 >
 <div className="w-10 h-10 rounded-xl bg-secondary/80 flex items-center justify-center flex-shrink-0">
 <Icon className="w-5 h-5 text-muted-foreground" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium">{label}</p>
 <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
 </div>
 <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
 </div>
);

// Gear group box wrapper — matches ServerSettingsPage pattern
const SettingsGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
 <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
 <Label className="text-sm font-medium">{title}</Label>
 {children}
 </div>
);

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

 // Navigation items - categories don't have a separate settings tab
 const navItems = isCategory
 ? [
 { id: "overview", label: "Overview", icon: FolderOpen },
 { id: "permissions", label: "Permissions", icon: Shield },
 ]
 : [
 { id: "overview", label: "Overview", icon: Hash },
 ...(channel?.type !== "voice" ? [{ id: "settings", label: "Gear", icon: Gear }] : []),
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

 if (!name.trim()) {
 setError(isCategory ? "Category name is required" : "Channel name is required");
 return;
 }

 setIsSubmitting(true);
 setError("");

 try {
 if (!user) throw new Error("Not authenticated");

 if (isCategory && categoryId) {
 await updateCategory(categoryId, { name: name.trim() }, user.id);
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
 block_attachments: blockAttachments,
 disable_reactions: disableReactions,
 disable_polls: disablePolls,
 auto_delete_seconds: autoDeleteSeconds === "null" ? null : parseInt(autoDeleteSeconds, 10),
 };

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


 // Channel Overview Tab Content
 const channelOverviewContent = (
 <div className="space-y-6">
 <div className="space-y-3">
 <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Channel Name</Label>
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


 // Channel Gear Tab Content
 const channelSettingsContent = (
 <div className="space-y-5">
 {/* Channel Behavior */}
 <SettingsGroup title="Channel Behavior">
 {/* Slowmode */}
 <div className="space-y-2">
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

 <ToggleCard
 icon={Lock}
 label="Read-Only Channel"
 description="Only admins and moderators can send messages"
 checked={isReadOnly}
 onCheckedChange={setIsReadOnly}
 />

 <ToggleCard
 icon={Warning}
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
 </SettingsGroup>

 {/* Content & Media Restrictions */}
 <SettingsGroup title="Content & Media Restrictions">
 <ToggleCard
 icon={Link}
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
 <p className="text-xs text-muted-foreground mt-0.5">Allow links from these domains for all users</p>
 </div>
 </div>

 <div className="flex gap-2">
 <Input
 value={newDomain}
 onChange={(e) => setNewDomain(e.target.value.toLowerCase())}
 placeholder="e.g. github.com"
 className="h-9 rounded-lg border-border/50 bg-secondary/30 text-sm"
 onKeyDown={(e) => {
 if (e.key === "Enter") {
 e.preventDefault();
 const domain = newDomain
 .toLowerCase()
 .replace(/^(https?:\/\/)?(www\.)?/, "")
 .replace(/\/.*$/, "");
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
 const domain = newDomain
 .toLowerCase()
 .replace(/^(https?:\/\/)?(www\.)?/, "")
 .replace(/\/.*$/, "");
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

 <ToggleCard
 icon={Paperclip}
 label="Block Attachments"
 description="Prevent members from uploading files and images. Admins and owners can still post attachments."
 checked={blockAttachments}
 onCheckedChange={setBlockAttachments}
 />

 <ToggleCard
 icon={ChatTeardropSlash}
 label="Disable Reactions"
 description="Prevent members from adding emoji reactions to messages. Admins and owners can still react."
 checked={disableReactions}
 onCheckedChange={setDisableReactions}
 />

 <ToggleCard
 icon={ChartBar}
 label="Disable Polls"
 description="Prevent members from creating polls in this channel. Admins and owners can still create polls."
 checked={disablePolls}
 onCheckedChange={setDisablePolls}
 />
 </SettingsGroup>

 {/* Message Retention */}
 <SettingsGroup title="Message Retention">
 <div className="space-y-2">
 <Select value={autoDeleteSeconds} onValueChange={setAutoDeleteSeconds}>
 <SelectTrigger className="h-11 rounded-xl border-border/50 bg-secondary/30">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
 <Timer className="w-4 h-4 text-muted-foreground" />
 </div>
 <SelectValue />
 </div>
 </SelectTrigger>
 <SelectContent className="rounded-xl border-border/50">
 <SelectItem value="null" className="rounded-lg">Disabled</SelectItem>
 <SelectItem value="3600" className="rounded-lg">After 1 hour</SelectItem>
 <SelectItem value="86400" className="rounded-lg">After 24 hours</SelectItem>
 <SelectItem value="604800" className="rounded-lg">After 7 days</SelectItem>
 <SelectItem value="2592000" className="rounded-lg">After 30 days</SelectItem>
 </SelectContent>
 </Select>
 <p className="text-xs text-muted-foreground">
 Automatically delete messages after a set time period. Pinned and system messages are preserved.
 </p>
 </div>
 </SettingsGroup>
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
 <CircleNotch className="w-6 h-6 text-muted-foreground animate-spin" />
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
 <CircleNotch className="w-6 h-6 text-muted-foreground animate-spin" />
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
 <div className="relative">
 <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-secondary/80 flex items-center justify-center">
 <FolderOpen className="h-4 w-4 text-muted-foreground" />
 </div>
 <Input
 id="category-name"
 value={name}
 onChange={(e) => setName(e.target.value)}
 placeholder="Category name"
 className="h-11 pl-14 rounded-xl border-border/50 bg-secondary/30"
 maxLength={50}
 />
 </div>
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
 <CircleNotch className="w-6 h-6 text-muted-foreground animate-spin" />
 </div>
 <p className="text-sm text-muted-foreground">Loading permissions...</p>
 </div>
 )}
 </div>
 );

 // Render category content based on active tab
 const renderCategoryContent = () => {
 switch (activeTab) {
 case "overview":
 return categoryOverviewContent;
 case "permissions":
 return categoryPermissionsContent;
 default:
 return null;
 }
 };

 // Check if we need to show save button
 const showSaveButton = activeTab === "overview" || (activeTab === "settings" && !isCategory);

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
 <CircleNotch className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
 <p className="text-sm text-muted-foreground">Loading...</p>
 </div>
 </div>
 );
 }

 return (
 <>
 <div className="h-full flex bg-background">
 {/* Sidebar Navigation */}
 <div className="w-56 flex-shrink-0 border-r border-border bg-secondary/20 flex flex-col overflow-hidden">
 {/* Channel/Category Name Header */}
 <div className="px-4 pt-5 pb-3">
 <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground truncate">
 {isCategory ? category?.name : `# ${channel?.name}`}
 </h2>
 <p className="text-[10px] text-muted-foreground/60 mt-0.5">
 {isCategory ? "Category Gear" : "Channel Gear"}
 </p>
 </div>

 {/* Nav Items */}
 <ScrollArea className="flex-1 px-2 pb-4">
 <nav className="flex flex-col gap-0.5">
 {navItems.map((item) => {
 const Icon = item.icon;
 const isActive = activeTab === item.id;

 return (
 <button
 key={item.id}
 onClick={() => setActiveTab(item.id)}
 className={cn(
 "w-full flex items-center gap-2.5 text-sm font-medium px-3 py-2 rounded-md transition-colors",
 isActive
 ? "bg-secondary/60 text-foreground"
 : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
 )}
 >
 <Icon className="w-4 h-4" />
 {item.label}
 </button>
 );
 })}

 {/* Delete - at bottom, separated */}
 <Separator className="my-3" />
 <button
 type="button"
 onClick={() => setShowDeleteConfirm(true)}
 className="w-full flex items-center gap-2.5 text-sm font-medium px-3 py-2 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
 >
 <Trash className="w-4 h-4" />
 Delete {isCategory ? "Category" : "Channel"}
 </button>
 </nav>
 </ScrollArea>
 </div>

 {/* Main Content Area */}
 <div className="flex-1 overflow-hidden relative flex flex-col">
 {/* Close Button (ESC) */}
 <button
 type="button"
 onClick={handleClose}
 className="absolute top-4 right-4 z-10 flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors group"
 >
 <div className="w-9 h-9 rounded-full border border-border bg-secondary/50 flex items-center justify-center group-hover:bg-secondary group-hover:border-muted-foreground/50 transition-colors">
 <X className="w-4 h-4" />
 </div>
 <span className="text-[10px] font-medium uppercase tracking-wider">ESC</span>
 </button>

 {activeTab === "permissions" ? (
 /* Permissions tab renders full-bleed with its own master/detail layout */
 <div className="flex-1 min-h-0 pr-16">
 {isCategory ? categoryPermissionsContent : channelPermissionsContent}
 </div>
 ) : (
 /* Other tabs: titled scrollable content */
 <div className="flex-1 overflow-y-auto">
 <div className="p-6 pr-16">
 <h2 className="text-xl font-medium mb-1">{navItems.find((n) => n.id === activeTab)?.label}</h2>
 <p className="text-sm text-muted-foreground mb-6">
 {activeTab === "overview" && (isCategory ? "Basic category information" : "Basic channel information")}
 {activeTab === "settings" &&
 (isCategory ? "Category configuration options" : "Channel configuration options")}
 {activeTab === "members" && "Manage who can access this private channel"}
 </p>

 <div className="max-w-3xl">
 {/* Tab Content */}
 {isCategory ? renderCategoryContent() : renderChannelContent()}

 {/* Save Button for overview and settings (channel) */}
 {showSaveButton && (
 <div className="flex gap-3 pt-6 mt-6 border-t border-border/50">
 <Button type="button" variant="outline" onClick={handleClose} className="h-11 rounded-xl px-8">
 Cancel
 </Button>
 <Button
 onClick={handleSubmit}
 disabled={isSubmitting || !name.trim()}
 className="h-11 rounded-xl px-8"
 >
 {isSubmitting ? (
 <>
 <CircleNotch className="w-4 h-4 mr-2 animate-spin" />
 Saving...
 </>
 ) : (
 "Save Changes"
 )}
 </Button>
 </div>
 )}
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
 <Trash className="w-6 h-6 text-destructive" />
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
