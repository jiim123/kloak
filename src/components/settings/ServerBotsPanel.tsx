import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type ComponentType } from "react";
import {
  ArrowLeft,
  Bot,
  Calendar,
  ChevronRight,
  Image,
  ListChecks,
  ListPlus,
  Megaphone,
  Pencil,
  Loader2,
  MoreVertical,
  MessageCirclePlus,
  MessageSquareText,
  MessagesSquare,
  MessageSquareX,
  Plus,
  Search,
  Send,
  ShieldMinus,
  ShieldPlus,
  SmilePlus,
  Trash2,
  UserPlus,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmojiGifPicker } from "@/components/modals/EmojiGifPicker";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { secureUpload } from "@/lib/storageUpload";
import { useServerStore } from "@/stores/serverStore";
import type { Channel, CustomServerRole } from "@/types";

type BotTriggerType =
  | "reaction_added"
  | "member_joined"
  | "message_created"
  | "calendar_event_created"
  | "calendar_event_updated"
  | "calendar_event_deleted"
  | "forum_topic_created"
  | "forum_topic_updated"
  | "forum_topic_deleted"
  | "list_item_created"
  | "list_item_updated"
  | "list_item_deleted"
  | "media_created"
  | "media_updated"
  | "media_deleted"
  | "announcement_created"
  | "announcement_updated"
  | "announcement_deleted";
type BotActionType =
  | "send_channel_message"
  | "delete_message"
  | "add_reaction"
  | "assign_role"
  | "create_forum_topic"
  | "create_list_item"
  | "remove_role";

type ServerBotFlow = {
  id: string;
  server_id: string;
  bot_id: string;
  name: string;
  trigger_type: BotTriggerType;
  trigger_config: Record<string, unknown>;
  action_type: BotActionType;
  action_config: {
    channel_id?: string;
    content?: string;
    emoji?: string;
    role_id?: string;
  };
  is_enabled: boolean;
  cooldown_seconds: number;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
};

type ServerBot = {
  id: string;
  server_id: string;
  bot_user_id: string;
  name: string;
  icon: string;
  avatar_url: string | null;
  is_enabled: boolean;
  is_default: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  flows: ServerBotFlow[];
};

type ContentMatchType = "any" | "contains" | "exact";

type ServerBotsRpcName =
  | "get_server_bots"
  | "create_server_bot"
  | "update_server_bot"
  | "delete_server_bot"
  | "upsert_server_bot_flow"
  | "delete_server_bot_flow";

type ServerBotsRpc = (
  fn: ServerBotsRpcName,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message?: string } | null }>;

type TriggerOption = {
  id: BotTriggerType;
  label: string;
  category: "MEMBERSHIP" | "CHAT" | "CALENDAR" | "FORUM" | "LIST" | "MEDIA" | "ANNOUNCEMENT";
  description: string;
  icon: ComponentType<{ className?: string }>;
};

type ActionOption = {
  id: BotActionType;
  category: "CHAT" | "MODERATION" | "MEMBERSHIP" | "FORUM" | "LIST";
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

type FlowBuilderStep =
  | "overview"
  | "trigger-picker"
  | "trigger-details"
  | "action-picker"
  | "action-details";

const DottedPlusCircleIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" className={className}>
    <path
      d="M8 0c-.176 0-.35.006-.523.017l.064.998a7.117 7.117 0 0 1 .918 0l.064-.998A8.113 8.113 0 0 0 8 0zM6.44.152c-.346.069-.684.16-1.012.27l.321.948c.287-.098.582-.177.884-.237L6.44.153zm4.132.271a7.946 7.946 0 0 0-1.011-.27l-.194.98c.302.06.597.14.884.237l.321-.947zm1.873.925a8 8 0 0 0-.906-.524l-.443.896c.275.136.54.29.793.459l.556-.831zM4.46.824c-.314.155-.616.33-.905.524l.556.83a7.07 7.07 0 0 1 .793-.458L4.46.824zM2.725 1.985c-.262.23-.51.478-.74.74l.752.66c.202-.23.418-.446.648-.648l-.66-.752zm11.29.74a8.058 8.058 0 0 0-.74-.74l-.66.752c.23.202.447.418.648.648l.752-.66zm1.161 1.735a7.98 7.98 0 0 0-.524-.905l-.83.556c.169.253.322.518.458.793l.896-.443zM1.348 3.555c-.194.289-.37.591-.524.906l.896.443c.136-.275.29-.54.459-.793l-.831-.556zM.423 5.428a7.945 7.945 0 0 0-.27 1.011l.98.194c.06-.302.14-.597.237-.884l-.947-.321zM15.848 6.44a7.943 7.943 0 0 0-.27-1.012l-.948.321c.098.287.177.582.237.884l.98-.194zM.017 7.477a8.113 8.113 0 0 0 0 1.046l.998-.064a7.117 7.117 0 0 1 0-.918l-.998-.064zM16 8a8.1 8.1 0 0 0-.017-.523l-.998.064a7.11 7.11 0 0 1 0 .918l.998.064A8.1 8.1 0 0 0 16 8zM.152 9.56c.069.346.16.684.27 1.012l.948-.321a6.944 6.944 0 0 1-.237-.884l-.98.194zm15.425 1.012c.112-.328.202-.666.27-1.011l-.98-.194c-.06.302-.14.597-.237.884l.947.321zM.824 11.54a8 8 0 0 0 .524.905l.83-.556a6.999 6.999 0 0 1-.458-.793l-.896.443zm13.828.905c.194-.289.37-.591.524-.906l-.896-.443c-.136.275-.29.54-.459.793l.831.556zm-12.667.83c.23.262.478.51.74.74l.66-.752a7.047 7.047 0 0 1-.648-.648l-.752.66zm11.29.74c.262-.23.51-.478.74-.74l-.752-.66c-.201.23-.418.447-.648.648l.66.752zm-1.735 1.161c.314-.155.616-.33.905-.524l-.556-.83a7.07 7.07 0 0 1-.793.458l.443.896zm-7.985-.524c.289.194.591.37.906.524l.443-.896a6.998 6.998 0 0 1-.793-.459l-.556.831zm1.873.925c.328.112.666.202 1.011.27l.194-.98a6.953 6.953 0 0 1-.884-.237l-.321.947zm4.132.271a7.944 7.944 0 0 0 1.012-.27l-.321-.948a6.954 6.954 0 0 1-.884.237l.194.98zm-2.083.135a8.1 8.1 0 0 0 1.046 0l-.064-.998a7.11 7.11 0 0 1-.918 0l-.064.998zM8.5 4.5a.5.5 0 0 0-1 0v3h-3a.5.5 0 0 0 0 1h3v3a.5.5 0 0 0 1 0v-3h3a.5.5 0 0 0 0-1h-3v-3z"
    />
  </svg>
);

const getCategoryBadgeClass = (category?: string) => {
  switch (category) {
    case "CHAT":
      return "border border-sky-400/30 bg-sky-500/15 text-sky-200";
    case "MEMBERSHIP":
      return "border border-emerald-400/30 bg-emerald-500/15 text-emerald-200";
    case "CALENDAR":
      return "border border-amber-400/30 bg-amber-500/15 text-amber-200";
    case "FORUM":
      return "border border-violet-400/30 bg-violet-500/15 text-violet-200";
    case "LIST":
      return "border border-lime-400/30 bg-lime-500/15 text-lime-200";
    case "MEDIA":
      return "border border-rose-400/30 bg-rose-500/15 text-rose-200";
    case "ANNOUNCEMENT":
      return "border border-orange-400/30 bg-orange-500/15 text-orange-200";
    case "MODERATION":
      return "border border-red-400/30 bg-red-500/15 text-red-200";
    default:
      return "border border-border bg-secondary text-muted-foreground";
  }
};

const TRIGGER_OPTIONS: TriggerOption[] = [
  {
    id: "reaction_added",
    label: "Chat reaction added",
    category: "CHAT",
    description: "When a member adds a reaction to a chat message",
    icon: MessageCirclePlus,
  },
  {
    id: "member_joined",
    label: "Member joined",
    category: "MEMBERSHIP",
    description: "When a member joins via an invite, explore, or any other means",
    icon: UserPlus,
  },
  {
    id: "message_created",
    label: "Member sent message to channel",
    category: "CHAT",
    description: "When someone sends a message in any text channel",
    icon: MessageSquareText,
  },
  {
    id: "calendar_event_created",
    label: "Event created",
    category: "CALENDAR",
    description: "When an event is created in a calendar channel",
    icon: Calendar,
  },
  {
    id: "calendar_event_updated",
    label: "Event updated",
    category: "CALENDAR",
    description: "When an event is updated in a calendar channel",
    icon: Calendar,
  },
  {
    id: "calendar_event_deleted",
    label: "Event deleted",
    category: "CALENDAR",
    description: "When an event is deleted in a calendar channel",
    icon: Calendar,
  },
  {
    id: "forum_topic_created",
    label: "Forum topic created",
    category: "FORUM",
    description: "When a topic is created in a forum channel",
    icon: MessagesSquare,
  },
  {
    id: "forum_topic_updated",
    label: "Forum topic updated",
    category: "FORUM",
    description: "When a topic is updated in a forum channel",
    icon: MessagesSquare,
  },
  {
    id: "forum_topic_deleted",
    label: "Forum topic deleted",
    category: "FORUM",
    description: "When a topic is deleted in a forum channel",
    icon: MessagesSquare,
  },
  {
    id: "list_item_created",
    label: "List item created",
    category: "LIST",
    description: "When a list item's content is created in a list channel",
    icon: ListChecks,
  },
  {
    id: "list_item_updated",
    label: "List item updated",
    category: "LIST",
    description: "When a list item's content is updated in a list channel",
    icon: ListChecks,
  },
  {
    id: "list_item_deleted",
    label: "List item deleted",
    category: "LIST",
    description: "When a list item's content is deleted in a list channel",
    icon: ListChecks,
  },
  {
    id: "media_created",
    label: "Media created",
    category: "MEDIA",
    description: "When media is created in a media channel",
    icon: Image,
  },
  {
    id: "media_updated",
    label: "Media updated",
    category: "MEDIA",
    description: "When media is updated in a media channel",
    icon: Image,
  },
  {
    id: "media_deleted",
    label: "Media deleted",
    category: "MEDIA",
    description: "When media is deleted in a media channel",
    icon: Image,
  },
  {
    id: "announcement_created",
    label: "Announcement created",
    category: "ANNOUNCEMENT",
    description: "When an announcement is created in an announcement channel",
    icon: Megaphone,
  },
  {
    id: "announcement_updated",
    label: "Announcement updated",
    category: "ANNOUNCEMENT",
    description: "When an announcement is updated in an announcement channel",
    icon: Megaphone,
  },
  {
    id: "announcement_deleted",
    label: "Announcement deleted",
    category: "ANNOUNCEMENT",
    description: "When an announcement is deleted in an announcement channel",
    icon: Megaphone,
  },
];

const ACTION_OPTIONS: ActionOption[] = [
  {
    id: "send_channel_message",
    category: "CHAT",
    label: "Send a custom message",
    description: "Post a simple system message in a selected channel",
    icon: Send,
  },
  {
    id: "delete_message",
    category: "MODERATION",
    label: "Delete a message",
    description: "Delete the message that triggered this flow",
    icon: MessageSquareX,
  },
  {
    id: "add_reaction",
    category: "CHAT",
    label: "Add a reaction",
    description: "Add a reaction emoji to the message that triggered this flow",
    icon: SmilePlus,
  },
  {
    id: "assign_role",
    category: "MEMBERSHIP",
    label: "Assign role",
    description: "Assign a role to the user that triggered this flow",
    icon: ShieldPlus,
  },
  {
    id: "create_forum_topic",
    category: "FORUM",
    label: "Create a forum topic",
    description: "Create a forum topic in a forum channel",
    icon: MessagesSquare,
  },
  {
    id: "create_list_item",
    category: "LIST",
    label: "Create a list item",
    description: "Create a list item in a list channel",
    icon: ListPlus,
  },
  {
    id: "remove_role",
    category: "MEMBERSHIP",
    label: "Remove role",
    description: "Remove a role from the user that triggered this flow",
    icon: ShieldMinus,
  },
];

const DEFAULT_ACTION_CONTENT_BY_ACTION: Record<BotActionType, string> = {
  send_channel_message: "",
  delete_message: "",
  add_reaction: "",
  assign_role: "",
  create_forum_topic: "{item}",
  create_list_item: "{item}",
  remove_role: "",
};

const DEFAULT_ACTION_CONTENT_BY_TRIGGER: Record<BotTriggerType, string> = {
  reaction_added: "{user} reacted with {emoji} in {channel}.",
  member_joined: "Welcome {user} to {server}.",
  message_created: "Thanks for keeping {channel} active, {user}.",
  calendar_event_created: "New event created in {channel}: {item}.",
  calendar_event_updated: "Event updated in {channel}: {item}.",
  calendar_event_deleted: "Event deleted in {channel}: {item}.",
  forum_topic_created: "New forum topic in {channel}: {item}.",
  forum_topic_updated: "Forum topic updated in {channel}: {item}.",
  forum_topic_deleted: "Forum topic deleted in {channel}: {item}.",
  list_item_created: "New list item in {channel}: {item}.",
  list_item_updated: "List item updated in {channel}: {item}.",
  list_item_deleted: "List item deleted in {channel}: {item}.",
  media_created: "New media in {channel}: {item}.",
  media_updated: "Media updated in {channel}: {item}.",
  media_deleted: "Media deleted in {channel}: {item}.",
  announcement_created: "New announcement in {channel}: {item}.",
  announcement_updated: "Announcement updated in {channel}: {item}.",
  announcement_deleted: "Announcement deleted in {channel}: {item}.",
};

const ALL_CHANNELS_VALUE = "all";
const ANY_ROLE_VALUE = "any";
const ANY_EMOJI_VALUE = "any";
const CUSTOM_EMOJI_VALUE = "custom";
const DEFAULT_REACTION_EMOJI = "👍";

const BOT_MODAL_CONTENT_CLASS =
  "max-h-[90vh] max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-[4px] border border-border bg-card p-0 text-foreground shadow-2xl sm:max-w-[448px]";
const BOT_FLOW_MODAL_CONTENT_CLASS =
  "max-h-[90vh] max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-[4px] border border-border bg-card p-0 text-foreground shadow-2xl sm:max-w-[640px]";
const BOT_MODAL_INPUT_CLASS =
  "mt-2 h-9 rounded-none border-0 border-b border-border bg-transparent px-0 text-sm text-foreground shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0";
const BOT_MODAL_PRIMARY_BUTTON_CLASS =
  "h-9 rounded-[3px] bg-primary px-5 font-medium text-primary-foreground hover:bg-primary/90 disabled:bg-secondary disabled:text-muted-foreground disabled:opacity-100";
const BOT_MODAL_CANCEL_BUTTON_CLASS =
  "h-9 rounded-[3px] px-4 text-muted-foreground hover:bg-transparent hover:text-foreground";
const BOT_MODAL_LABEL_CLASS = "text-xs font-medium uppercase tracking-wide text-muted-foreground";
const BOT_SELECT_CONTENT_CLASS =
  "overflow-hidden rounded-md border border-[hsl(var(--menu-border))] bg-[hsl(var(--menu))] p-0 text-[hsl(var(--menu-foreground))] shadow-xl shadow-black/30";
const BOT_SELECT_ITEM_CLASS =
  "rounded-none py-2 pl-9 pr-3 text-sm !text-[hsl(var(--menu-foreground))] data-[highlighted]:bg-[hsl(var(--menu-focus))] data-[highlighted]:text-[hsl(var(--menu-foreground))] focus:bg-[hsl(var(--menu-focus))] focus:text-[hsl(var(--menu-foreground))]";

const getTriggerOption = (id: BotTriggerType) => TRIGGER_OPTIONS.find((option) => option.id === id) ?? TRIGGER_OPTIONS[0];
const getActionOption = (id: BotActionType) => ACTION_OPTIONS.find((option) => option.id === id) ?? ACTION_OPTIONS[0];
const isChannelScopedTrigger = (trigger: BotTriggerType) => trigger !== "member_joined";
const actionNeedsChannel = (action: BotActionType) =>
  action === "send_channel_message" || action === "create_forum_topic" || action === "create_list_item";
const actionNeedsMessage = (action: BotActionType) =>
  action === "send_channel_message" || action === "create_forum_topic" || action === "create_list_item";
const actionNeedsRole = (action: BotActionType) => action === "assign_role" || action === "remove_role";
const actionNeedsSourceMessage = (action: BotActionType) => action === "delete_message" || action === "add_reaction";
const triggerProvidesSourceMessage = (trigger: BotTriggerType) =>
  trigger === "reaction_added" ||
  trigger === "message_created" ||
  trigger === "forum_topic_created" ||
  trigger === "forum_topic_updated" ||
  trigger === "forum_topic_deleted" ||
  trigger === "announcement_created" ||
  trigger === "announcement_updated" ||
  trigger === "announcement_deleted";
const getActionChannelTypes = (action: BotActionType): Channel["type"][] => {
  switch (action) {
    case "send_channel_message":
      return ["text", "announcement"];
    case "create_forum_topic":
      return ["forum"];
    case "create_list_item":
      return ["tasks"];
    default:
      return [];
  }
};
const getTriggerChannelTypes = (trigger: BotTriggerType): Channel["type"][] => {
  const category = getTriggerOption(trigger).category;
  switch (category) {
    case "CHAT":
      return ["text"];
    case "CALENDAR":
      return ["calendar"];
    case "FORUM":
      return ["forum"];
    case "LIST":
      return ["tasks"];
    case "MEDIA":
      return ["media"];
    case "ANNOUNCEMENT":
      return ["announcement"];
    default:
      return [];
  }
};
const getTemplateVarsForTrigger = (trigger: BotTriggerType) => {
  const vars = [
    { token: "{user}", description: "Triggering member mention" },
    { token: "{username}", description: "Triggering member name" },
    { token: "{server}", description: "Server name" },
  ];

  if (isChannelScopedTrigger(trigger)) {
    vars.push({ token: "{channel}", description: "Trigger channel mention" });
  }

  if (getTriggerOption(trigger).category !== "CHAT" && trigger !== "member_joined") {
    vars.push({ token: "{item}", description: "Event, topic, item, media, or announcement title" });
  }

  if (trigger === "reaction_added") {
    vars.push({ token: "{emoji}", description: "Reaction emoji" });
  }

  return vars;
};
const serverBotsRpc: ServerBotsRpc = (fn, args) => (supabase.rpc as (name: string, args?: unknown) => unknown)(fn, args) as Promise<{ data: unknown; error: { message?: string } | null }>;
const getErrorMessage = (error: unknown, fallback: string) =>
  error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : fallback;

const BotAvatar = ({
  name,
  avatarUrl,
  muted = false,
  className,
  iconClassName,
}: {
  name: string;
  avatarUrl?: string | null;
  muted?: boolean;
  className?: string;
  iconClassName?: string;
}) => (
  <Avatar className={cn("h-9 w-9 rounded-full", className)}>
    <AvatarImage src={avatarUrl ?? undefined} alt={name} className="object-cover" />
    <AvatarFallback
      className={cn(
        "rounded-full border border-border bg-primary/20 text-primary",
        muted && "bg-secondary text-muted-foreground",
      )}
    >
      <Bot className={cn("h-5 w-5", iconClassName)} />
    </AvatarFallback>
  </Avatar>
);

const BotAvatarPicker = ({
  inputId,
  name,
  avatarUrl,
  onFileSelect,
}: {
  inputId: string;
  name: string;
  avatarUrl?: string | null;
  onFileSelect: (file: File) => void;
}) => (
  <div className="flex justify-center py-1">
    <Label
      htmlFor={inputId}
      className="group relative block cursor-pointer rounded-full outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-card"
    >
      <BotAvatar name={name} avatarUrl={avatarUrl} className="h-20 w-20 border border-border bg-secondary" iconClassName="h-8 w-8" />
      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-white transition group-hover:bg-black/35 group-focus-within:bg-black/35">
        <Pencil className="h-5 w-5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100" />
      </span>
      <Input
        id={inputId}
        type="file"
        accept="image/*"
        aria-label="Upload bot profile picture"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const file = event.target.files?.[0];
          if (file) onFileSelect(file);
          event.currentTarget.value = "";
        }}
        className="sr-only"
      />
    </Label>
  </div>
);

const EmojiOptionLabel = ({ label }: { value?: string; label: string; description?: string }) => <>{label}</>;

const FlowIcon = ({ type }: { type: BotTriggerType | BotActionType }) => {
  const actionOption = ACTION_OPTIONS.find((option) => option.id === type);
  const option = actionOption ?? getTriggerOption(type as BotTriggerType);
  const Icon = option.icon;
  return <Icon className="h-5 w-5 text-muted-foreground" />;
};

export const ServerBotsPanel = ({
  serverId,
  userId,
  channels,
  roles,
  canManageBots,
}: {
  serverId: string;
  userId: string;
  channels: Channel[];
  roles: CustomServerRole[];
  canManageBots: boolean;
}) => {
  const [bots, setBots] = useState<ServerBot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [view, setView] = useState<"list" | "detail">("list");
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [createName, setCreateName] = useState("Test Bot");
  const [createAvatarFile, setCreateAvatarFile] = useState<File | null>(null);
  const [createAvatarPreview, setCreateAvatarPreview] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editingProfileBotId, setEditingProfileBotId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState("");
  const [editingProfileAvatarFile, setEditingProfileAvatarFile] = useState<File | null>(null);
  const [editingProfileAvatarPreview, setEditingProfileAvatarPreview] = useState<string | null>(null);
  const [isFlowOpen, setIsFlowOpen] = useState(false);
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [editingFlowEnabled, setEditingFlowEnabled] = useState(true);
  const [flowBuilderStep, setFlowBuilderStep] = useState<FlowBuilderStep>("overview");
  const [isTriggerConfigured, setIsTriggerConfigured] = useState(false);
  const [isActionConfigured, setIsActionConfigured] = useState(false);
  const [triggerSearch, setTriggerSearch] = useState("");
  const [draftTrigger, setDraftTrigger] = useState<BotTriggerType>("member_joined");
  const [draftAction, setDraftAction] = useState<BotActionType>("send_channel_message");
  const [draftTriggerChannelId, setDraftTriggerChannelId] = useState(ALL_CHANNELS_VALUE);
  const [draftTriggerRoleId, setDraftTriggerRoleId] = useState(ANY_ROLE_VALUE);
  const [draftTriggerEmojiMode, setDraftTriggerEmojiMode] = useState(ANY_EMOJI_VALUE);
  const [draftTriggerEmoji, setDraftTriggerEmoji] = useState("");
  const [draftContentMatchType, setDraftContentMatchType] = useState<ContentMatchType>("contains");
  const [draftContentMatchValue, setDraftContentMatchValue] = useState("");
  const [draftChannelId, setDraftChannelId] = useState("");
  const [draftContent, setDraftContent] = useState(DEFAULT_ACTION_CONTENT_BY_TRIGGER.member_joined);
  const [draftActionEmojiMode, setDraftActionEmojiMode] = useState(DEFAULT_REACTION_EMOJI);
  const [draftActionEmoji, setDraftActionEmoji] = useState("👍");
  const [draftActionRoleId, setDraftActionRoleId] = useState("");
  const [draftCooldown, setDraftCooldown] = useState("10");
  const fetchMembers = useServerStore((state) => state.fetchMembers);

  const selectedBot = useMemo(
    () => bots.find((bot) => bot.id === selectedBotId) ?? null,
    [bots, selectedBotId],
  );

  const textChannels = useMemo(
    () => channels.filter((channel) => channel.type === "text" || channel.type === "announcement"),
    [channels],
  );
  const actionChannels = useMemo(() => {
    const channelTypes = getActionChannelTypes(draftAction);
    return channels.filter((channel) => channelTypes.includes(channel.type));
  }, [channels, draftAction]);
  const triggerChannels = useMemo(() => {
    const channelTypes = getTriggerChannelTypes(draftTrigger);
    return channels.filter((channel) => channelTypes.includes(channel.type));
  }, [channels, draftTrigger]);
  const templateVars = useMemo(
    () => getTemplateVarsForTrigger(draftTrigger),
    [draftTrigger],
  );
  const selectableRoles = useMemo(() => roles.filter((role) => role.name !== "@everyone"), [roles]);
  const getEmojiLabel = useCallback(
    (mode: string, customValue: string, anyLabel?: string) => {
      if (mode === ANY_EMOJI_VALUE) {
        return { value: "•", label: anyLabel ?? "Any emoji", description: "No emoji filter" };
      }
      if (mode === CUSTOM_EMOJI_VALUE) {
        return { value: customValue || "?", label: customValue || "Custom emoji", description: "Typed value" };
      }
      return {
        value: mode,
        label: mode,
        description: "Standard emoji",
      };
    },
    [],
  );
  const getEmojiModeForValue = useCallback(
    (value: string | null | undefined, emptyMode: string) => {
      if (!value) return emptyMode;
      if (emptyMode !== ANY_EMOJI_VALUE && value === DEFAULT_REACTION_EMOJI) return DEFAULT_REACTION_EMOJI;
      return CUSTOM_EMOJI_VALUE;
    },
    [],
  );

  const setTriggerEmojiSelection = (value: string) => {
    setDraftTriggerEmojiMode(value);
    if (value === ANY_EMOJI_VALUE) {
      setDraftTriggerEmoji("");
    } else if (value !== CUSTOM_EMOJI_VALUE) {
      setDraftTriggerEmoji(value);
    }
  };

  const setActionEmojiSelection = (value: string) => {
    setDraftActionEmojiMode(value);
    if (value === CUSTOM_EMOJI_VALUE) {
      setDraftActionEmoji((current) => (current === DEFAULT_REACTION_EMOJI ? "" : current));
    } else {
      setDraftActionEmoji(value);
    }
  };

  const loadBots = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await serverBotsRpc("get_server_bots", {
        _server_id: serverId,
        _user_id: userId,
      });
      if (error) throw error;
      setBots((Array.isArray(data) ? data : []) as ServerBot[]);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to load bots"));
      setBots([]);
    } finally {
      setIsLoading(false);
    }
  }, [serverId, userId]);

  useEffect(() => {
    loadBots();
  }, [loadBots]);

  useEffect(() => {
    if (!selectedBotId) return;
    if (!bots.some((bot) => bot.id === selectedBotId)) {
      setSelectedBotId(null);
      setView("list");
    }
  }, [bots, selectedBotId]);

  useEffect(() => {
    if (!actionNeedsChannel(draftAction)) {
      return;
    }

    if (!draftChannelId && actionChannels[0]) {
      setDraftChannelId(actionChannels[0].id);
      return;
    }

    if (draftChannelId && !actionChannels.some((channel) => channel.id === draftChannelId)) {
      setDraftChannelId(actionChannels[0]?.id ?? "");
    }
  }, [actionChannels, draftAction, draftChannelId]);

  useEffect(() => {
    if (!isChannelScopedTrigger(draftTrigger)) {
      return;
    }

    if (
      draftTriggerChannelId !== ALL_CHANNELS_VALUE &&
      !triggerChannels.some((channel) => channel.id === draftTriggerChannelId)
    ) {
      setDraftTriggerChannelId(ALL_CHANNELS_VALUE);
    }
  }, [draftTrigger, draftTriggerChannelId, triggerChannels]);

  const resetCreateBotForm = () => {
    setCreateName("Test Bot");
    setCreateAvatarFile(null);
    setCreateAvatarPreview(null);
  };

  const selectBotAvatarFile = (file: File, setFile: (file: File | null) => void, setPreview: (url: string | null) => void) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }
    setFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const uploadBotAvatar = async (file: File) => {
    const fileExt = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "webp";
    const filePath = `${userId}/bot-avatars/${serverId}-${Date.now()}.${fileExt}`;
    const { publicUrl } = await secureUpload("avatars", filePath, file, {
      contentType: file.type || "image/webp",
      upsert: false,
      cacheControl: "31536000",
    });
    return publicUrl;
  };

  const createBot = async (name = createName) => {
    if (!canManageBots) return toast.error("You do not have permission to manage bots");
    const cleanName = name.trim();
    if (!cleanName) return toast.error("Bot name is required");

    setIsSaving(true);
    try {
      const avatarUrl = createAvatarFile ? await uploadBotAvatar(createAvatarFile) : null;
      const { error } = await serverBotsRpc("create_server_bot", {
        _server_id: serverId,
        _user_id: userId,
        _name: cleanName,
        _avatar_url: avatarUrl,
      });
      if (error) throw error;
      toast.success("Bot created");
      setIsCreateOpen(false);
      resetCreateBotForm();
      await loadBots();
      await fetchMembers(serverId, { force: true });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to create bot"));
    } finally {
      setIsSaving(false);
    }
  };

  const updateBot = async (bot: ServerBot, updates: { name?: string; is_enabled?: boolean; avatar_url?: string | null }) => {
    if (!canManageBots) return toast.error("You do not have permission to manage bots");
    const previous = bots;
    setBots((current) =>
      current.map((item) =>
        item.id === bot.id
          ? {
              ...item,
              name: updates.name ?? item.name,
              avatar_url: updates.avatar_url ?? item.avatar_url,
              is_enabled: updates.is_enabled ?? item.is_enabled,
            }
          : item,
      ),
    );

    try {
      const { error } = await serverBotsRpc("update_server_bot", {
        _bot_id: bot.id,
        _user_id: userId,
        _name: updates.name ?? null,
        _is_enabled: updates.is_enabled ?? null,
        _avatar_url: updates.avatar_url ?? null,
      });
      if (error) throw error;
      await loadBots();
      await fetchMembers(serverId, { force: true });
    } catch (error: unknown) {
      setBots(previous);
      toast.error(getErrorMessage(error, "Failed to update bot"));
    }
  };

  const openEditBotProfile = (bot: ServerBot) => {
    setEditingProfileBotId(bot.id);
    setEditingProfileName(bot.name);
    setEditingProfileAvatarFile(null);
    setEditingProfileAvatarPreview(bot.avatar_url ?? null);
    setIsEditProfileOpen(true);
  };

  const closeEditBotProfile = () => {
    setIsEditProfileOpen(false);
    setEditingProfileBotId(null);
    setEditingProfileName("");
    setEditingProfileAvatarFile(null);
    setEditingProfileAvatarPreview(null);
  };

  const saveBotProfile = async () => {
    const bot = bots.find((item) => item.id === editingProfileBotId);
    if (!bot) return;
    const cleanName = editingProfileName.trim();
    if (!cleanName) return toast.error("Bot name is required");

    setIsSaving(true);
    try {
      const avatarUrl = editingProfileAvatarFile ? await uploadBotAvatar(editingProfileAvatarFile) : bot.avatar_url;
      const { error } = await serverBotsRpc("update_server_bot", {
        _bot_id: bot.id,
        _user_id: userId,
        _name: cleanName,
        _is_enabled: null,
        _avatar_url: avatarUrl,
      });
      if (error) throw error;
      await loadBots();
      await fetchMembers(serverId, { force: true });
      toast.success("Bot profile updated");
      closeEditBotProfile();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to update bot profile"));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteBot = async (bot: ServerBot) => {
    if (!canManageBots) return toast.error("You do not have permission to manage bots");
    setIsSaving(true);
    try {
      const { error } = await serverBotsRpc("delete_server_bot", {
        _bot_id: bot.id,
        _user_id: userId,
      });
      if (error) throw error;
      toast.success("Bot deleted");
      await loadBots();
      await fetchMembers(serverId, { force: true });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to delete bot"));
    } finally {
      setIsSaving(false);
    }
  };

  const openFlowBuilder = (flow?: ServerBotFlow) => {
    const triggerType = flow?.trigger_type ?? "member_joined";
    const actionType = flow?.action_type ?? "send_channel_message";
    const triggerConfig = flow?.trigger_config ?? {};
    const actionConfig = flow?.action_config ?? {};
    const triggerChannelId = typeof triggerConfig.channel_id === "string" ? triggerConfig.channel_id : ALL_CHANNELS_VALUE;
    const triggerRoleId = typeof triggerConfig.role_id === "string" ? triggerConfig.role_id : ANY_ROLE_VALUE;
    const triggerEmoji = typeof triggerConfig.emoji === "string" ? triggerConfig.emoji : "";
    const actionEmoji = actionConfig.emoji ?? DEFAULT_REACTION_EMOJI;
    const contentMatchType =
      triggerConfig.content_match_type === "any" ||
      triggerConfig.content_match_type === "contains" ||
      triggerConfig.content_match_type === "exact"
        ? triggerConfig.content_match_type
        : triggerType === "message_created"
          ? "contains"
          : "any";
    const contentMatchValue = typeof triggerConfig.content_match_value === "string" ? triggerConfig.content_match_value : "";

    setEditingFlowId(flow?.id ?? null);
    setEditingFlowEnabled(flow?.is_enabled ?? true);
    setDraftTrigger(triggerType);
    setDraftAction(actionType);
    setDraftTriggerChannelId(isChannelScopedTrigger(triggerType) ? triggerChannelId : ALL_CHANNELS_VALUE);
    setDraftTriggerRoleId(triggerRoleId);
    setDraftTriggerEmojiMode(getEmojiModeForValue(triggerEmoji, ANY_EMOJI_VALUE));
    setDraftTriggerEmoji(triggerEmoji);
    setDraftContentMatchType(contentMatchType);
    setDraftContentMatchValue(contentMatchValue);
    setDraftChannelId(actionConfig.channel_id ?? textChannels[0]?.id ?? "");
    setDraftContent(actionConfig.content ?? DEFAULT_ACTION_CONTENT_BY_TRIGGER[triggerType]);
    setDraftActionEmojiMode(getEmojiModeForValue(actionEmoji, DEFAULT_REACTION_EMOJI));
    setDraftActionEmoji(actionConfig.emoji ?? "👍");
    setDraftActionEmoji(actionEmoji);
    setDraftActionRoleId(actionConfig.role_id ?? "");
    setDraftCooldown(String(flow?.cooldown_seconds ?? 10));
    setIsTriggerConfigured(!!flow);
    setIsActionConfigured(!!flow);
    setTriggerSearch("");
    setFlowBuilderStep("overview");
    setIsFlowOpen(true);
  };

  const saveFlow = async () => {
    if (!selectedBot) return;
    if (!isTriggerConfigured) return toast.error("Add a trigger first");
    if (!isActionConfigured) return toast.error("Add an action first");
    if (actionNeedsChannel(draftAction) && !draftChannelId) return toast.error("Choose a channel for the action");
    if (actionNeedsMessage(draftAction) && !draftContent.trim()) return toast.error("Add text for the action");
    if (draftTrigger === "reaction_added" && draftTriggerEmojiMode === CUSTOM_EMOJI_VALUE && !draftTriggerEmoji.trim()) {
      return toast.error("Add an emoji for the trigger filter");
    }
    if (actionNeedsSourceMessage(draftAction) && !triggerProvidesSourceMessage(draftTrigger)) {
      return toast.error("Choose a trigger that includes a source message for this action");
    }
    if (draftAction === "add_reaction" && !draftActionEmoji.trim()) return toast.error("Add an emoji for the action");
    if (actionNeedsRole(draftAction) && !draftActionRoleId) return toast.error("Choose a role for the action");

    setIsSaving(true);
    try {
      const { error } = await serverBotsRpc("upsert_server_bot_flow", {
        _bot_id: selectedBot.id,
        _user_id: userId,
        _flow_id: editingFlowId,
        _trigger_type: draftTrigger,
        _trigger_config: {
          channel_id: isChannelScopedTrigger(draftTrigger) && draftTriggerChannelId !== ALL_CHANNELS_VALUE ? draftTriggerChannelId : null,
          role_id: draftTriggerRoleId !== ANY_ROLE_VALUE ? draftTriggerRoleId : null,
          content_match_type: draftTrigger === "message_created" ? draftContentMatchType : "any",
          content_match_value:
            draftTrigger === "message_created" && draftContentMatchType !== "any"
              ? draftContentMatchValue.trim()
              : null,
          emoji: draftTrigger === "reaction_added" && draftTriggerEmojiMode !== ANY_EMOJI_VALUE ? draftTriggerEmoji.trim() : null,
        },
        _action_type: draftAction,
        _action_config: {
          channel_id: actionNeedsChannel(draftAction) ? draftChannelId : null,
          content: actionNeedsMessage(draftAction) ? draftContent.trim() : null,
          emoji: draftAction === "add_reaction" ? draftActionEmoji.trim() : null,
          role_id: actionNeedsRole(draftAction) ? draftActionRoleId : null,
        },
        _is_enabled: editingFlowEnabled,
        _cooldown_seconds: Number.parseInt(draftCooldown, 10) || 10,
      });
      if (error) throw error;
      toast.success(editingFlowId ? "Flow updated" : "Flow added");
      setIsFlowOpen(false);
      setEditingFlowId(null);
      setFlowBuilderStep("overview");
      await loadBots();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to save flow"));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteFlow = async (flow: ServerBotFlow) => {
    setIsSaving(true);
    try {
      const { error } = await serverBotsRpc("delete_server_bot_flow", {
        _flow_id: flow.id,
        _user_id: userId,
      });
      if (error) throw error;
      toast.success("Flow deleted");
      await loadBots();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to delete flow"));
    } finally {
      setIsSaving(false);
    }
  };

  const updateFlowEnabled = async (flow: ServerBotFlow, isEnabled: boolean) => {
    if (!selectedBot) return;

    setIsSaving(true);
    try {
      const { error } = await serverBotsRpc("upsert_server_bot_flow", {
        _bot_id: selectedBot.id,
        _user_id: userId,
        _flow_id: flow.id,
        _trigger_type: flow.trigger_type,
        _trigger_config: flow.trigger_config,
        _action_type: flow.action_type,
        _action_config: flow.action_config,
        _is_enabled: isEnabled,
        _cooldown_seconds: flow.cooldown_seconds,
      });
      if (error) throw error;
      await loadBots();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to update flow"));
    } finally {
      setIsSaving(false);
    }
  };

  const selectTrigger = (trigger: BotTriggerType) => {
    setDraftTrigger(trigger);
    if (!isActionConfigured) {
      setDraftContent(DEFAULT_ACTION_CONTENT_BY_TRIGGER[trigger]);
    }
    if (!isChannelScopedTrigger(trigger)) setDraftTriggerChannelId(ALL_CHANNELS_VALUE);
    if (trigger !== "reaction_added") {
      setDraftTriggerEmojiMode(ANY_EMOJI_VALUE);
      setDraftTriggerEmoji("");
    }
    if (trigger !== "message_created") {
      setDraftContentMatchType("any");
      setDraftContentMatchValue("");
    } else {
      setDraftContentMatchType("contains");
    }
    setFlowBuilderStep("trigger-details");
  };

  const selectAction = (action: BotActionType) => {
    setDraftAction(action);
    if (!isActionConfigured) {
      const nextContent = DEFAULT_ACTION_CONTENT_BY_ACTION[action] || DEFAULT_ACTION_CONTENT_BY_TRIGGER[draftTrigger];
      setDraftContent(nextContent);
    }
    if (action !== "add_reaction") setDraftActionEmoji("👍");
    if (action !== "add_reaction") {
      setDraftActionEmojiMode(DEFAULT_REACTION_EMOJI);
      setDraftActionEmoji(DEFAULT_REACTION_EMOJI);
    }
    if (!actionNeedsRole(action)) setDraftActionRoleId("");
    setFlowBuilderStep("action-details");
  };

  const closeFlowBuilder = (open: boolean) => {
    setIsFlowOpen(open);
    if (!open) {
      setEditingFlowId(null);
      setEditingFlowEnabled(true);
      setFlowBuilderStep("overview");
      setTriggerSearch("");
    }
  };

  const flowDialogTitle =
    flowBuilderStep === "trigger-picker"
      ? "Select trigger"
      : flowBuilderStep === "trigger-details"
        ? "Trigger details"
        : flowBuilderStep === "action-picker"
          ? "Select action"
          : flowBuilderStep === "action-details"
            ? "Action details"
            : editingFlowId
              ? "Edit flow"
              : "Add a flow";

  const canGoBackInFlow =
    flowBuilderStep === "trigger-picker" ||
    flowBuilderStep === "trigger-details" ||
    flowBuilderStep === "action-picker" ||
    flowBuilderStep === "action-details";

  const handleFlowBack = () => {
    if (flowBuilderStep === "trigger-picker") {
      setFlowBuilderStep("overview");
      return;
    }

    if (flowBuilderStep === "trigger-details") {
      setFlowBuilderStep("trigger-picker");
      return;
    }

    if (flowBuilderStep === "action-picker") {
      setFlowBuilderStep("overview");
      return;
    }

    if (flowBuilderStep === "action-details") {
      setFlowBuilderStep("action-picker");
    }
  };

  const filteredTriggers = TRIGGER_OPTIONS.filter((option) => {
    const q = triggerSearch.trim().toLowerCase();
    if (!q) return true;
    return option.label.toLowerCase().includes(q) || option.description.toLowerCase().includes(q);
  });

  if (!canManageBots) {
    return (
      <div className="flex max-w-3xl flex-col items-center justify-center py-14 text-center">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-secondary/60">
          <Bot className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">You do not have permission to manage bots</p>
      </div>
    );
  }

  if (view === "detail" && selectedBot) {
    return (
      <div className="max-w-4xl">
        <button
          type="button"
          onClick={() => setView("list")}
          className="mb-6 flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground/80"
        >
          <ArrowLeft className="h-4 w-4" />
          Create bot
        </button>

          <div className="mb-7 flex items-center gap-4">
            <BotAvatar name={selectedBot.name} avatarUrl={selectedBot.avatar_url} className="h-16 w-16 shrink-0" iconClassName="h-7 w-7" />
            <div className="min-w-0">
              <Label className="text-[10px] font-semibold leading-none text-muted-foreground">Bot</Label>
              <div className="mt-1 truncate text-lg font-medium leading-6 text-foreground">{selectedBot.name}</div>
            </div>
          </div>

        <div className="mb-4 flex items-center justify-between border-t border-border pt-5">
          <h3 className="text-sm font-medium text-foreground">Flows</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => openFlowBuilder()}
            className="h-8 rounded-[3px] px-4 text-xs"
          >
            Add
          </Button>
        </div>

        {selectedBot.flows.length > 0 ? (
          <div className="max-w-3xl space-y-2">
            {selectedBot.flows.map((flow) => {
              const trigger = getTriggerOption(flow.trigger_type);
              const action = getActionOption(flow.action_type);
              const triggerChannelId =
                typeof flow.trigger_config.channel_id === "string" ? flow.trigger_config.channel_id : null;
              const triggerChannelName = triggerChannelId
                ? triggerChannels.find((channel) => channel.id === triggerChannelId)?.name
                : null;
              const actionChannelName = channels.find((channel) => channel.id === flow.action_config.channel_id)?.name;
              const triggerChannelLabel =
                isChannelScopedTrigger(flow.trigger_type) ? (triggerChannelName ? `#${triggerChannelName}` : "All channels") : "Any member";
              const actionDetailLabel = actionNeedsChannel(flow.action_type)
                ? actionChannelName
                  ? `to #${actionChannelName}`
                  : "No channel"
                : actionNeedsRole(flow.action_type)
                  ? "triggering user"
                  : flow.action_type === "add_reaction"
                    ? flow.action_config.emoji ?? "reaction"
                    : "triggering message";
              const triggerRoleId = typeof flow.trigger_config.role_id === "string" ? flow.trigger_config.role_id : null;
              const triggerRoleName = triggerRoleId
                ? selectableRoles.find((role) => role.id === triggerRoleId)?.name
                : null;
              const actorLabel = triggerRoleName ? triggerRoleName : "anyone";
              const triggerEmoji = typeof flow.trigger_config.emoji === "string" ? flow.trigger_config.emoji : null;
              const triggerDescription =
                isChannelScopedTrigger(flow.trigger_type)
                  ? `by ${actorLabel} in ${triggerChannelLabel}${flow.trigger_type === "reaction_added" && triggerEmoji ? ` using ${triggerEmoji}` : ""}`
                  : `by ${actorLabel}`;

              return (
                <div
                  key={flow.id}
                  className="flex items-center gap-3 rounded-[4px] border border-border bg-secondary/40 px-3 py-2"
                >
                  <div className="grid min-w-0 flex-1 grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-3">
                    <div className="flex min-w-0 items-center gap-2 rounded-[3px] border border-border bg-secondary/50 px-3 py-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] bg-secondary">
                        <FlowIcon type={flow.trigger_type} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold leading-4 text-foreground">{trigger.label}</p>
                        <p className="truncate text-[11px] leading-4 text-muted-foreground">{triggerDescription}</p>
                      </div>
                    </div>

                    <ChevronRight className="mx-auto h-4 w-4 shrink-0 rotate-90 text-muted-foreground sm:rotate-0" />

                    <div className="flex min-w-0 items-center gap-2 rounded-[3px] border border-border bg-secondary/50 px-3 py-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] bg-secondary">
                        <FlowIcon type={flow.action_type} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold leading-4 text-foreground">{action.label}</p>
                         <p className="truncate text-[11px] leading-4 text-muted-foreground">{actionDetailLabel}</p>
                      </div>
                    </div>
                  </div>

                  <Switch
                    checked={flow.is_enabled}
                    disabled={isSaving}
                    onCheckedChange={(checked) => updateFlowEnabled(flow, checked)}
                  />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 rounded-[3px] p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => openFlowBuilder(flow)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit flow
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteFlow(flow)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete flow
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-[300px] max-w-2xl flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-20 w-20 items-center justify-center text-muted-foreground/60">
              <Wand2 className="h-16 w-16" />
            </div>
            <p className="text-sm font-medium text-foreground">No flows yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Add a flow to put your bot to work</p>
            <Button
              type="button"
              size="sm"
              onClick={() => openFlowBuilder()}
              className="mt-4 h-8 rounded-[3px] px-4 text-xs"
            >
              Add a flow
            </Button>
          </div>
        )}

        <Dialog open={isFlowOpen} onOpenChange={closeFlowBuilder}>
          <DialogContent className={BOT_FLOW_MODAL_CONTENT_CLASS}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                saveFlow();
              }}
              className="flex max-h-[82vh] flex-col overflow-hidden"
            >
              <div className="border-b border-border bg-secondary/40 px-5 py-3">
                <div className="flex items-center gap-2">
                  {canGoBackInFlow && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleFlowBack}
                      className="h-8 w-8 rounded-[3px] text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <div className="text-base font-medium leading-none tracking-tight">{flowDialogTitle}</div>
                </div>
              </div>

              {flowBuilderStep === "overview" && (
                <div className="space-y-4 overflow-y-auto px-6 py-4">
                  <div className="grid grid-cols-[1fr_auto] items-center border border-border bg-card transition-colors hover:bg-secondary/70">
                    <button
                      type="button"
                      className="flex items-center gap-3 px-3 py-3 text-left"
                      onClick={() => {
                        setTriggerSearch("");
                        setFlowBuilderStep(isTriggerConfigured ? "trigger-details" : "trigger-picker");
                      }}
                    >
                      <DottedPlusCircleIcon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium leading-none text-foreground">Trigger</p>
                        {isTriggerConfigured && (
                          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{getTriggerOption(draftTrigger).label}</p>
                        )}
                      </div>
                    </button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setTriggerSearch("");
                        setFlowBuilderStep(isTriggerConfigured ? "trigger-details" : "trigger-picker");
                      }}
                      className="mr-3 h-8 rounded-[3px] border-border bg-transparent px-4 text-xs text-foreground hover:bg-secondary/70"
                    >
                      {isTriggerConfigured ? "Edit" : "Add"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-[1fr_auto] items-center border border-border bg-card transition-colors hover:bg-secondary/70">
                    <button
                      type="button"
                      className="flex items-center gap-3 px-3 py-3 text-left"
                      onClick={() => {
                        if (!isTriggerConfigured) return;
                        setFlowBuilderStep(isActionConfigured ? "action-details" : "action-picker");
                      }}
                    >
                      <DottedPlusCircleIcon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium leading-none text-foreground">Action</p>
                        {isActionConfigured && (
                          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{getActionOption(draftAction).label}</p>
                        )}
                      </div>
                    </button>
                    {isTriggerConfigured ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setFlowBuilderStep(isActionConfigured ? "action-details" : "action-picker")}
                        className="mr-3 h-8 rounded-[3px] border-border bg-transparent px-4 text-xs text-foreground hover:bg-secondary/70"
                      >
                        {isActionConfigured ? "Edit" : "Add"}
                      </Button>
                    ) : (
                      <div className="mr-3 h-8 w-[58px]" />
                    )}
                  </div>
                </div>
              )}

              {flowBuilderStep === "trigger-picker" && (
                <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
                  <div className="mb-4 flex h-9 items-center gap-2 border border-border bg-secondary/40 px-3">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={triggerSearch}
                      onChange={(event) => setTriggerSearch(event.target.value)}
                      placeholder={`Search ${TRIGGER_OPTIONS.length} triggers`}
                      className="h-8 border-0 bg-transparent px-0 text-sm text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
                    />
                  </div>
                  <ScrollArea className="h-[min(52vh,420px)] min-h-0 pr-3">
                    <div className="space-y-2">
                      {filteredTriggers.map((trigger) => {
                        const Icon = trigger.icon;
                        const isSelectedTrigger = isTriggerConfigured && draftTrigger === trigger.id;
                        return (
                          <button
                            key={trigger.id}
                            type="button"
                            onClick={() => selectTrigger(trigger.id)}
                            className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border border-border bg-secondary/40 px-3 py-2 text-left hover:bg-secondary/70"
                          >
                            <Icon className="h-6 w-6 text-muted-foreground" />
                            <span className="min-w-0">
                              <span className="mb-1 flex items-center gap-2">
                                <span
                                  className={cn(
                                    "inline-flex rounded-[3px] px-1.5 py-0.5 text-[9px] font-bold tracking-wide",
                                    getCategoryBadgeClass(trigger.category),
                                  )}
                                >
                                  {trigger.category}
                                </span>
                                <span className="truncate text-sm font-medium text-foreground">{trigger.label}</span>
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">{trigger.description}</span>
                            </span>
                            <span className="rounded-[3px] border border-border px-3 py-1 text-xs font-medium text-foreground">
                              {isSelectedTrigger ? "Selected" : "Select"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {flowBuilderStep === "trigger-details" && (
                <div className="space-y-4 overflow-y-auto px-6 py-4">
                  <div>
                    <Label className={BOT_MODAL_LABEL_CLASS}>Type</Label>
                    <div className="mt-2 border-b border-border pb-2 text-sm text-foreground">
                      {getTriggerOption(draftTrigger).label}
                    </div>
                  </div>

                  {isChannelScopedTrigger(draftTrigger) && (
                    <>
                      <div>
                        <Label className={BOT_MODAL_LABEL_CLASS}>Channel</Label>
                        <Select value={draftTriggerChannelId} onValueChange={setDraftTriggerChannelId}>
                          <SelectTrigger className="mt-2 h-9 rounded-none border-0 border-b border-border bg-transparent px-0 text-sm text-foreground shadow-none focus:ring-0 focus:ring-offset-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className={BOT_SELECT_CONTENT_CLASS}>
                            <SelectItem value={ALL_CHANNELS_VALUE} className={BOT_SELECT_ITEM_CLASS}>
                              All channels
                            </SelectItem>
                            {triggerChannels.map((channel) => (
                              <SelectItem key={channel.id} value={channel.id} className={BOT_SELECT_ITEM_CLASS}>
                                #{channel.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {draftTrigger === "message_created" && (
                        <div>
                          <Label className={BOT_MODAL_LABEL_CLASS}>Message match</Label>
                          <Select
                            value={draftContentMatchType}
                            onValueChange={(value) => setDraftContentMatchType(value as ContentMatchType)}
                          >
                            <SelectTrigger className="mt-2 h-9 rounded-none border-0 border-b border-border bg-transparent px-0 text-sm text-foreground shadow-none focus:ring-0 focus:ring-offset-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className={BOT_SELECT_CONTENT_CLASS}>
                              <SelectItem value="contains" className={BOT_SELECT_ITEM_CLASS}>
                                Contains phrase
                              </SelectItem>
                              <SelectItem value="exact" className={BOT_SELECT_ITEM_CLASS}>
                                Exact phrase
                              </SelectItem>
                              <SelectItem value="any" className={BOT_SELECT_ITEM_CLASS}>
                                Any message
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {draftTrigger === "message_created" && draftContentMatchType !== "any" && (
                        <div>
                          <Label className={BOT_MODAL_LABEL_CLASS}>Phrase</Label>
                          <Input
                            value={draftContentMatchValue}
                            onChange={(event) => setDraftContentMatchValue(event.target.value.slice(0, 120))}
                            maxLength={120}
                            className={BOT_MODAL_INPUT_CLASS}
                          />
                        </div>
                      )}

                      {draftTrigger === "reaction_added" && (
                        <div>
                          <Label className={BOT_MODAL_LABEL_CLASS}>Emoji</Label>
                          <Select value={draftTriggerEmojiMode} onValueChange={setTriggerEmojiSelection}>
                            <SelectTrigger className="mt-2 h-9 rounded-none border-0 border-b border-border bg-transparent px-0 text-sm text-foreground shadow-none focus:ring-0 focus:ring-offset-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className={BOT_SELECT_CONTENT_CLASS}>
                              <SelectItem value={ANY_EMOJI_VALUE} className={BOT_SELECT_ITEM_CLASS}>
                                <EmojiOptionLabel value="•" label="Any emoji" description="No emoji filter" />
                              </SelectItem>
                              <SelectItem value={CUSTOM_EMOJI_VALUE} className={BOT_SELECT_ITEM_CLASS}>
                                Custom emoji
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          {draftTriggerEmojiMode === CUSTOM_EMOJI_VALUE && (
                            <div className="mt-2 flex items-end gap-2">
                              <Input
                                value={draftTriggerEmoji}
                                onChange={(event) => setDraftTriggerEmoji(event.target.value.slice(0, 64))}
                                placeholder="Emoji or :name:"
                                maxLength={64}
                                className={cn(BOT_MODAL_INPUT_CLASS, "mt-0 flex-1")}
                              />
                              <EmojiGifPicker
                                serverId={serverId}
                                disableGif
                                onEmojiSelect={(emoji) => setDraftTriggerEmoji(emoji.slice(0, 64))}
                              >
                                <Button type="button" variant="outline" className="h-9 w-9 shrink-0 rounded-[3px] p-0">
                                  <SmilePlus className="h-4 w-4" />
                                </Button>
                              </EmojiGifPicker>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  <div>
                    <Label className={BOT_MODAL_LABEL_CLASS}>Performed by</Label>
                    <Select value={draftTriggerRoleId} onValueChange={setDraftTriggerRoleId}>
                      <SelectTrigger className="mt-2 h-9 rounded-none border-0 border-b border-border bg-transparent px-0 text-sm text-foreground shadow-none focus:ring-0 focus:ring-offset-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={BOT_SELECT_CONTENT_CLASS}>
                        <SelectItem value={ANY_ROLE_VALUE} className={BOT_SELECT_ITEM_CLASS}>
                          Any member or role
                        </SelectItem>
                        {selectableRoles.map((role) => (
                          <SelectItem key={role.id} value={role.id} className={BOT_SELECT_ITEM_CLASS}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {flowBuilderStep === "action-picker" && (
                <div className="space-y-2 overflow-y-auto px-6 py-4">
                  {ACTION_OPTIONS.map((action) => {
                    const Icon = action.icon;
                    const isSelectedAction = isActionConfigured && draftAction === action.id;
                    const isIncompatible =
                      isTriggerConfigured && actionNeedsSourceMessage(action.id) && !triggerProvidesSourceMessage(draftTrigger);
                    return (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => selectAction(action.id)}
                        disabled={isIncompatible}
                        className={cn(
                          "grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border border-border bg-secondary/40 px-3 py-2 text-left hover:bg-secondary/70",
                          isIncompatible && "cursor-not-allowed opacity-45 hover:bg-secondary/40",
                        )}
                      >
                        <Icon className="h-6 w-6 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="mb-1 flex items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex rounded-[3px] px-1.5 py-0.5 text-[9px] font-bold tracking-wide",
                                getCategoryBadgeClass(action.category),
                              )}
                            >
                              {action.category}
                            </span>
                            <span className="truncate text-sm font-medium text-foreground">{action.label}</span>
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {isIncompatible ? "Requires a trigger with a source message" : action.description}
                          </span>
                        </span>
                        <span className="rounded-[3px] border border-border px-3 py-1 text-xs font-medium text-foreground">
                          {isSelectedAction ? "Selected" : "Select"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {flowBuilderStep === "action-details" && (
                <div className="space-y-4 overflow-y-auto px-6 py-4">
                  <div>
                    <Label className={BOT_MODAL_LABEL_CLASS}>Type</Label>
                    <div className="mt-2 border-b border-border pb-2 text-sm text-foreground">
                      {getActionOption(draftAction).label}
                    </div>
                  </div>

                  {actionNeedsSourceMessage(draftAction) && !triggerProvidesSourceMessage(draftTrigger) && (
                    <div className="rounded-[4px] border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                      This action needs a trigger that includes a source message.
                    </div>
                  )}

                  {actionNeedsChannel(draftAction) && (
                    <div>
                      <Label className={BOT_MODAL_LABEL_CLASS}>Channel</Label>
                      <Select value={draftChannelId} onValueChange={setDraftChannelId}>
                        <SelectTrigger className="mt-2 h-9 rounded-none border-0 border-b border-border bg-transparent px-0 text-sm text-foreground shadow-none focus:ring-0 focus:ring-offset-0">
                          <SelectValue placeholder="Select channel" />
                        </SelectTrigger>
                        <SelectContent className={BOT_SELECT_CONTENT_CLASS}>
                          {actionChannels.map((channel) => (
                            <SelectItem key={channel.id} value={channel.id} className={BOT_SELECT_ITEM_CLASS}>
                              #{channel.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {actionNeedsMessage(draftAction) && (
                    <div>
                      <Label className={BOT_MODAL_LABEL_CLASS}>
                        {draftAction === "create_forum_topic" ? "Topic" : draftAction === "create_list_item" ? "Item" : "Message"}
                      </Label>
                      <Input
                        value={draftContent}
                        onChange={(event) => setDraftContent(event.target.value)}
                        maxLength={500}
                        className={BOT_MODAL_INPUT_CLASS}
                      />
                      <div className="mt-3 rounded-[4px] border border-border bg-secondary/25 px-3 py-2">
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Template variables
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {templateVars.map((item) => (
                            <span
                              key={item.token}
                              title={item.description}
                              className="inline-flex items-center rounded-[3px] border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground"
                            >
                              {item.token}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {draftAction === "add_reaction" && (
                    <div>
                      <Label className={BOT_MODAL_LABEL_CLASS}>Emoji</Label>
                      <Select value={draftActionEmojiMode} onValueChange={setActionEmojiSelection}>
                        <SelectTrigger className="mt-2 h-9 rounded-none border-0 border-b border-border bg-transparent px-0 text-sm text-foreground shadow-none focus:ring-0 focus:ring-offset-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={BOT_SELECT_CONTENT_CLASS}>
                          <SelectItem value={DEFAULT_REACTION_EMOJI} className={BOT_SELECT_ITEM_CLASS}>
                            👍
                          </SelectItem>
                          <SelectItem value={CUSTOM_EMOJI_VALUE} className={BOT_SELECT_ITEM_CLASS}>
                            <EmojiOptionLabel value="?" label="Custom emoji" description="Type Unicode or :name:" />
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {draftActionEmojiMode === CUSTOM_EMOJI_VALUE && (
                        <div className="mt-2 flex items-end gap-2">
                          <Input
                            value={draftActionEmoji}
                            onChange={(event) => setDraftActionEmoji(event.target.value.slice(0, 64))}
                            placeholder="Emoji or :name:"
                            maxLength={64}
                            className={cn(BOT_MODAL_INPUT_CLASS, "mt-0 flex-1")}
                          />
                          <EmojiGifPicker
                            serverId={serverId}
                            disableGif
                            onEmojiSelect={(emoji) => setDraftActionEmoji(emoji.slice(0, 64))}
                          >
                            <Button type="button" variant="outline" className="h-9 w-9 shrink-0 rounded-[3px] p-0">
                              <SmilePlus className="h-4 w-4" />
                            </Button>
                          </EmojiGifPicker>
                        </div>
                      )}
                    </div>
                  )}

                  {actionNeedsRole(draftAction) && (
                    <div>
                      <Label className={BOT_MODAL_LABEL_CLASS}>Role</Label>
                      <Select value={draftActionRoleId} onValueChange={setDraftActionRoleId}>
                        <SelectTrigger className="mt-2 h-9 rounded-none border-0 border-b border-border bg-transparent px-0 text-sm text-foreground shadow-none focus:ring-0 focus:ring-offset-0">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent className={BOT_SELECT_CONTENT_CLASS}>
                          {selectableRoles.map((role) => (
                            <SelectItem key={role.id} value={role.id} className={BOT_SELECT_ITEM_CLASS}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <Label className={BOT_MODAL_LABEL_CLASS}>Cooldown</Label>
                    <Input
                      value={draftCooldown}
                      onChange={(event) => setDraftCooldown(event.target.value.replace(/\D/g, "").slice(0, 4))}
                      className={BOT_MODAL_INPUT_CLASS}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-border bg-secondary/30 px-5 py-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => closeFlowBuilder(false)}
                  className={BOT_MODAL_CANCEL_BUTTON_CLASS}
                >
                  Cancel
                </Button>
                {flowBuilderStep === "overview" && (
                  <Button
                    type="submit"
                    disabled={
                      isSaving ||
                      !isTriggerConfigured ||
                      !isActionConfigured ||
                      (actionNeedsChannel(draftAction) && !draftChannelId) ||
                      (draftTrigger === "reaction_added" &&
                        draftTriggerEmojiMode === CUSTOM_EMOJI_VALUE &&
                        !draftTriggerEmoji.trim()) ||
                      (actionNeedsSourceMessage(draftAction) && !triggerProvidesSourceMessage(draftTrigger)) ||
                      (draftAction === "add_reaction" && !draftActionEmoji.trim()) ||
                      (actionNeedsRole(draftAction) && !draftActionRoleId)
                    }
                    className={BOT_MODAL_PRIMARY_BUTTON_CLASS}
                  >
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingFlowId ? "Save changes" : "Save flow"}
                  </Button>
                )}
                {flowBuilderStep === "trigger-details" && (
                  <Button
                    type="button"
                    onClick={() => {
                      if (
                        draftTrigger === "message_created" &&
                        draftContentMatchType !== "any" &&
                        !draftContentMatchValue.trim()
                      ) {
                        toast.error("Add a phrase for the message trigger");
                        return;
                      }
                      setIsTriggerConfigured(true);
                      setFlowBuilderStep("overview");
                    }}
                    className={BOT_MODAL_PRIMARY_BUTTON_CLASS}
                  >
                    Next
                  </Button>
                )}
                {flowBuilderStep === "action-details" && (
                  <Button
                    type="button"
                    onClick={() => {
                      if (actionNeedsRole(draftAction) && !draftActionRoleId) {
                        toast.error("Choose a role for the action");
                        return;
                      }
                      if (draftAction === "add_reaction" && !draftActionEmoji.trim()) {
                        toast.error("Add an emoji for the action");
                        return;
                      }
                      setIsActionConfigured(true);
                      setFlowBuilderStep("overview");
                    }}
                    className={BOT_MODAL_PRIMARY_BUTTON_CLASS}
                  >
                    Next
                  </Button>
                )}
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="max-w-3xl text-foreground">
      <div className="mb-5 border-b border-border pb-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] border border-border bg-secondary/60">
              <Bot className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-medium leading-6">Bots</h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Automate server activity with custom triggers and actions.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsCreateOpen(true)}
            className="h-8 shrink-0 rounded-[3px] px-4 text-xs"
          >
            <Plus className="mr-2 h-3.5 w-3.5" />
            Create bot
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : bots.length > 0 ? (
        <div className="mb-7">
          {bots.map((bot) => (
            <div key={bot.id} className="flex items-center gap-3 border-b border-border/50 py-3 last:border-b-0">
              <BotAvatar name={bot.name} avatarUrl={bot.avatar_url} className="h-11 w-11" iconClassName="h-5 w-5" />
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => {
                  setSelectedBotId(bot.id);
                  setView("detail");
                }}
              >
                <p className="truncate text-sm font-medium text-foreground">{bot.name}</p>
                <p className="truncate text-xs text-muted-foreground">{bot.flows.length} flow{bot.flows.length === 1 ? "" : "s"}</p>
              </button>
              <Switch checked={bot.is_enabled} onCheckedChange={(checked) => updateBot(bot, { is_enabled: checked })} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 rounded-[3px] p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onClick={() => openEditBotProfile(bot)}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit profile
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setSelectedBotId(bot.id);
                      setView("detail");
                    }}
                  >
                    <ChevronRight className="mr-2 h-4 w-4" />
                    Open
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteBot(bot)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-7 flex h-20 items-center justify-center rounded-lg border border-border bg-secondary/20 text-sm text-muted-foreground">
          No bots yet
        </div>
      )}

      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) resetCreateBotForm();
        }}
      >
        <DialogContent className={BOT_MODAL_CONTENT_CLASS}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              createBot();
            }}
            className="flex max-h-[82vh] flex-col overflow-hidden"
          >
            <div className="border-b border-border bg-secondary/40 px-5 py-3">
              <div className="text-base font-medium leading-none tracking-tight">Create bot</div>
            </div>

            <div className="space-y-5 overflow-y-auto px-6 py-4">
              <BotAvatarPicker
                inputId="bot-avatar"
                name={createName}
                avatarUrl={createAvatarPreview}
                onFileSelect={(file) => selectBotAvatarFile(file, setCreateAvatarFile, setCreateAvatarPreview)}
              />

              <div>
                <Label htmlFor="bot-name" className={BOT_MODAL_LABEL_CLASS}>
                  Bot name
                </Label>
                <Input
                  id="bot-name"
                  value={createName}
                  maxLength={32}
                  onChange={(event) => setCreateName(event.target.value)}
                  className={BOT_MODAL_INPUT_CLASS}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border bg-secondary/30 px-5 py-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCreateOpen(false)}
                className={BOT_MODAL_CANCEL_BUTTON_CLASS}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving || !createName.trim()}
                className={BOT_MODAL_PRIMARY_BUTTON_CLASS}
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditProfileOpen} onOpenChange={(open) => (open ? setIsEditProfileOpen(true) : closeEditBotProfile())}>
        <DialogContent className={BOT_MODAL_CONTENT_CLASS}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveBotProfile();
            }}
            className="flex max-h-[82vh] flex-col overflow-hidden"
          >
            <div className="border-b border-border bg-secondary/40 px-5 py-3">
              <div className="text-base font-medium leading-none tracking-tight">Edit bot profile</div>
            </div>

            <div className="space-y-5 overflow-y-auto px-6 py-4">
              <BotAvatarPicker
                inputId="edit-bot-avatar"
                name={editingProfileName}
                avatarUrl={editingProfileAvatarPreview}
                onFileSelect={(file) =>
                  selectBotAvatarFile(file, setEditingProfileAvatarFile, setEditingProfileAvatarPreview)
                }
              />

              <div>
                <Label htmlFor="edit-bot-name" className={BOT_MODAL_LABEL_CLASS}>
                  Bot name
                </Label>
                <Input
                  id="edit-bot-name"
                  value={editingProfileName}
                  maxLength={32}
                  onChange={(event) => setEditingProfileName(event.target.value)}
                  className={BOT_MODAL_INPUT_CLASS}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border bg-secondary/30 px-5 py-3">
              <Button
                type="button"
                variant="ghost"
                onClick={closeEditBotProfile}
                className={BOT_MODAL_CANCEL_BUTTON_CLASS}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving || !editingProfileName.trim()}
                className={BOT_MODAL_PRIMARY_BUTTON_CLASS}
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
