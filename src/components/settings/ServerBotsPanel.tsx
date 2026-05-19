import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Check,
  ChevronRight,
  Loader2,
  MessageSquare,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Wand2,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { Channel, CustomServerRole } from "@/types";

type BotTriggerType = "member_joined" | "message_created";
type BotActionType = "send_channel_message";

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
  is_enabled: boolean;
  is_default: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  flows: ServerBotFlow[];
};

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
  eyebrow: string;
  description: string;
  icon: LucideIcon;
};

type ActionOption = {
  id: BotActionType;
  label: string;
  description: string;
  icon: LucideIcon;
};

const TRIGGER_OPTIONS: TriggerOption[] = [
  {
    id: "member_joined",
    label: "Member joined",
    eyebrow: "MEMBERSHIP",
    description: "When a new member joins the server",
    icon: UserPlus,
  },
  {
    id: "message_created",
    label: "Member sent message to channel",
    eyebrow: "CHAT",
    description: "When someone sends a message in any text channel",
    icon: MessageSquare,
  },
];

const ACTION_OPTIONS: ActionOption[] = [
  {
    id: "send_channel_message",
    label: "Send message to channel",
    description: "Post a simple system message in a selected channel",
    icon: MessageSquare,
  },
];

const DEFAULT_ACTION_CONTENT: Record<BotTriggerType, string> = {
  member_joined: "Welcome {user} to {server}.",
  message_created: "Thanks for keeping {channel} active, {user}.",
};

const ALL_CHANNELS_VALUE = "all";
const ANY_ROLE_VALUE = "any";

const BOT_MODAL_CONTENT_CLASS =
  "max-h-[90vh] max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-[4px] border border-[#4a4f5a] bg-[#333842] p-0 text-[#f4f5f7] shadow-2xl sm:max-w-[448px]";
const BOT_FLOW_MODAL_CONTENT_CLASS =
  "max-h-[90vh] max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-[4px] border border-[#4a4f5a] bg-[#333842] p-0 text-[#f4f5f7] shadow-2xl sm:max-w-[640px]";
const BOT_MODAL_INPUT_CLASS =
  "mt-2 h-9 rounded-none border-0 border-b border-white/80 bg-transparent px-0 text-sm text-[#f3f4f7] shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0";
const BOT_MODAL_PRIMARY_BUTTON_CLASS =
  "h-9 rounded-[3px] bg-[#d7dbe3] px-5 font-medium text-[#363b44] hover:bg-white disabled:bg-[#454b55] disabled:text-[#858b96] disabled:opacity-100";
const BOT_MODAL_CANCEL_BUTTON_CLASS =
  "h-9 rounded-[3px] px-4 text-[#b9bec8] hover:bg-transparent hover:text-white";
const BOT_MODAL_LABEL_CLASS = "text-xs font-medium uppercase tracking-wide text-[#c4c8d0]";

const getTriggerOption = (id: BotTriggerType) => TRIGGER_OPTIONS.find((option) => option.id === id) ?? TRIGGER_OPTIONS[0];
const getActionOption = (id: BotActionType) => ACTION_OPTIONS.find((option) => option.id === id) ?? ACTION_OPTIONS[0];
const serverBotsRpc: ServerBotsRpc = (fn, args) => supabase.rpc(fn, args) as Promise<{ data: unknown; error: { message?: string } | null }>;
const getErrorMessage = (error: unknown, fallback: string) =>
  error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : fallback;

const BotAvatar = ({ muted = false }: { name: string; muted?: boolean }) => (
  <Avatar className="h-9 w-9 rounded-full">
    <AvatarFallback
      className={cn(
        "rounded-full border border-border bg-primary/20 text-primary",
        muted && "bg-secondary text-muted-foreground",
      )}
    >
      <Bot className="h-5 w-5" />
    </AvatarFallback>
  </Avatar>
);

const FlowIcon = ({ type }: { type: BotTriggerType | BotActionType }) => {
  const option = type === "send_channel_message" ? getActionOption(type) : getTriggerOption(type);
  const Icon = option.icon;
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-secondary/60 text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
    </div>
  );
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
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isFlowOpen, setIsFlowOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isTriggerDetailsOpen, setIsTriggerDetailsOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"trigger" | "action">("trigger");
  const [triggerSearch, setTriggerSearch] = useState("");
  const [draftTrigger, setDraftTrigger] = useState<BotTriggerType>("member_joined");
  const [draftAction, setDraftAction] = useState<BotActionType>("send_channel_message");
  const [draftTriggerChannelId, setDraftTriggerChannelId] = useState(ALL_CHANNELS_VALUE);
  const [draftTriggerRoleId, setDraftTriggerRoleId] = useState(ANY_ROLE_VALUE);
  const [draftChannelId, setDraftChannelId] = useState("");
  const [draftContent, setDraftContent] = useState(DEFAULT_ACTION_CONTENT.member_joined);
  const [draftCooldown, setDraftCooldown] = useState("10");

  const selectedBot = useMemo(
    () => bots.find((bot) => bot.id === selectedBotId) ?? null,
    [bots, selectedBotId],
  );

  const textChannels = useMemo(
    () => channels.filter((channel) => channel.type === "text" || channel.type === "announcement"),
    [channels],
  );
  const selectableRoles = useMemo(() => roles.filter((role) => role.name !== "@everyone"), [roles]);

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
    if (!draftChannelId && textChannels[0]) {
      setDraftChannelId(textChannels[0].id);
    }
  }, [draftChannelId, textChannels]);

  const createBot = async (name = createName) => {
    if (!canManageBots) return toast.error("You do not have permission to manage bots");
    const cleanName = name.trim();
    if (!cleanName) return toast.error("Bot name is required");

    setIsSaving(true);
    try {
      const { error } = await serverBotsRpc("create_server_bot", {
        _server_id: serverId,
        _user_id: userId,
        _name: cleanName,
      });
      if (error) throw error;
      toast.success("Bot created");
      setIsCreateOpen(false);
      setCreateName("Test Bot");
      await loadBots();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to create bot"));
    } finally {
      setIsSaving(false);
    }
  };

  const updateBot = async (bot: ServerBot, updates: { name?: string; is_enabled?: boolean }) => {
    if (!canManageBots) return toast.error("You do not have permission to manage bots");
    const previous = bots;
    setBots((current) =>
      current.map((item) =>
        item.id === bot.id
          ? {
              ...item,
              name: updates.name ?? item.name,
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
      });
      if (error) throw error;
      await loadBots();
    } catch (error: unknown) {
      setBots(previous);
      toast.error(getErrorMessage(error, "Failed to update bot"));
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
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to delete bot"));
    } finally {
      setIsSaving(false);
    }
  };

  const openFlowBuilder = () => {
    setDraftTrigger("member_joined");
    setDraftAction("send_channel_message");
    setDraftTriggerChannelId(ALL_CHANNELS_VALUE);
    setDraftTriggerRoleId(ANY_ROLE_VALUE);
    setDraftChannelId(textChannels[0]?.id ?? "");
    setDraftContent(DEFAULT_ACTION_CONTENT.member_joined);
    setDraftCooldown("10");
    setIsFlowOpen(true);
  };

  const saveFlow = async () => {
    if (!selectedBot) return;
    if (!draftChannelId) return toast.error("Choose a channel for the action");
    if (!draftContent.trim()) return toast.error("Add a message for the action");

    setIsSaving(true);
    try {
      const { error } = await serverBotsRpc("upsert_server_bot_flow", {
        _bot_id: selectedBot.id,
        _user_id: userId,
        _flow_id: null,
        _trigger_type: draftTrigger,
        _trigger_config: {
          channel_id: draftTrigger === "message_created" && draftTriggerChannelId !== ALL_CHANNELS_VALUE ? draftTriggerChannelId : null,
          role_id: draftTriggerRoleId !== ANY_ROLE_VALUE ? draftTriggerRoleId : null,
        },
        _action_type: draftAction,
        _action_config: {
          channel_id: draftChannelId,
          content: draftContent.trim(),
        },
        _is_enabled: true,
        _cooldown_seconds: Number.parseInt(draftCooldown, 10) || 10,
      });
      if (error) throw error;
      toast.success("Flow added");
      setIsFlowOpen(false);
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

  const selectTrigger = (trigger: BotTriggerType) => {
    setDraftTrigger(trigger);
    setDraftContent(DEFAULT_ACTION_CONTENT[trigger]);
    setIsPickerOpen(false);
    setIsTriggerDetailsOpen(true);
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
          <BotAvatar name={selectedBot.name} />
          <div className="w-full max-w-md space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Name</Label>
            <div className="flex items-center gap-2">
              <Input
                value={selectedBot.name}
                maxLength={32}
                onChange={(event) => {
                  const nextName = event.target.value;
                  setBots((current) =>
                    current.map((bot) => (bot.id === selectedBot.id ? { ...bot, name: nextName } : bot)),
                  );
                }}
                onBlur={(event) => updateBot(selectedBot, { name: event.target.value })}
                className="h-8 border-0 bg-transparent px-0 py-0 text-sm text-foreground shadow-none focus-visible:ring-0"
              />
              <Check className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between border-t border-border pt-5">
          <h3 className="text-sm font-medium text-foreground">Flows</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={openFlowBuilder}
            disabled={!textChannels.length}
            className="h-8 rounded-[3px] px-4 text-xs"
          >
            Add
          </Button>
        </div>

        {selectedBot.flows.length > 0 ? (
          <div className="max-w-2xl">
            {selectedBot.flows.map((flow) => {
              const trigger = getTriggerOption(flow.trigger_type);
              const action = getActionOption(flow.action_type);
              const channelName = textChannels.find((channel) => channel.id === flow.action_config.channel_id)?.name;
              return (
                <div key={flow.id} className="flex items-center gap-3 border-b border-border/50 py-3 last:border-b-0">
                  <FlowIcon type={flow.trigger_type} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {trigger.label} {"->"} {action.label}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {channelName ? `#${channelName}` : "No channel"} / {flow.action_config.content}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 rounded-[3px] p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="text-destructive" onClick={() => deleteFlow(flow)}>
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
              onClick={openFlowBuilder}
              disabled={!textChannels.length}
              className="mt-4 h-8 rounded-[3px] px-4 text-xs"
            >
              Add a flow
            </Button>
          </div>
        )}

        <Dialog open={isFlowOpen} onOpenChange={setIsFlowOpen}>
          <DialogContent className={BOT_FLOW_MODAL_CONTENT_CLASS}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                saveFlow();
              }}
              className="flex max-h-[82vh] flex-col overflow-hidden"
            >
              <div className="border-b border-[#2b3039] bg-[#2f343d] px-5 py-3">
                <div className="text-base font-medium leading-none tracking-tight">Add a flow</div>
              </div>

              <div className="space-y-4 overflow-y-auto px-6 py-4">
                <div className="grid grid-cols-[1fr_auto] items-center border border-[#4a4f5a] bg-[#2f343d]">
                  <button
                    type="button"
                    className="flex items-center gap-3 px-3 py-3 text-left"
                    onClick={() => {
                      setPickerMode("trigger");
                      setTriggerSearch("");
                      setIsPickerOpen(true);
                    }}
                  >
                    <FlowIcon type={draftTrigger} />
                    <div>
                      <p className="text-sm font-medium leading-none text-[#f3f4f7]">Trigger</p>
                      <p className="mt-1.5 text-xs leading-5 text-[#c4c8d0]">{getTriggerOption(draftTrigger).label}</p>
                    </div>
                  </button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPickerMode("trigger");
                      setTriggerSearch("");
                      setIsPickerOpen(true);
                    }}
                    className="mr-3 h-8 rounded-[3px] border-[#42464f] px-4 text-xs text-[#e2e4e9] hover:bg-[#30333d]"
                  >
                    Add
                  </Button>
                </div>

                <div className="grid grid-cols-[1fr_auto] items-center border border-[#4a4f5a] bg-[#2f343d]">
                  <button
                    type="button"
                    className="flex items-center gap-3 px-3 py-3 text-left"
                    onClick={() => {
                      setPickerMode("action");
                      setIsPickerOpen(true);
                    }}
                  >
                    <FlowIcon type={draftAction} />
                    <div>
                      <p className="text-sm font-medium leading-none text-[#f3f4f7]">Action</p>
                      <p className="mt-1.5 text-xs leading-5 text-[#c4c8d0]">{getActionOption(draftAction).label}</p>
                    </div>
                  </button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPickerMode("action");
                      setIsPickerOpen(true);
                    }}
                    className="mr-3 h-8 rounded-[3px] border-[#42464f] px-4 text-xs text-[#e2e4e9] hover:bg-[#30333d]"
                  >
                    Add
                  </Button>
                </div>

                <div>
                  <Label className={BOT_MODAL_LABEL_CLASS}>Channel</Label>
                  <Select value={draftChannelId} onValueChange={setDraftChannelId}>
                    <SelectTrigger className="mt-2 h-9 rounded-none border-0 border-b border-white/80 bg-transparent px-0 text-sm text-[#f3f4f7] shadow-none focus:ring-0 focus:ring-offset-0">
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent>
                      {textChannels.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>
                          #{channel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className={BOT_MODAL_LABEL_CLASS}>Message</Label>
                  <Input
                    value={draftContent}
                    onChange={(event) => setDraftContent(event.target.value)}
                    maxLength={500}
                    className={BOT_MODAL_INPUT_CLASS}
                  />
                </div>

                <div>
                  <Label className={BOT_MODAL_LABEL_CLASS}>Cooldown</Label>
                  <Input
                    value={draftCooldown}
                    onChange={(event) => setDraftCooldown(event.target.value.replace(/\D/g, "").slice(0, 4))}
                    className={BOT_MODAL_INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-[#2c3139] bg-[#30353f] px-5 py-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsFlowOpen(false)}
                  className={BOT_MODAL_CANCEL_BUTTON_CLASS}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving || !textChannels.length}
                  className={BOT_MODAL_PRIMARY_BUTTON_CLASS}
                >
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save flow
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isTriggerDetailsOpen} onOpenChange={setIsTriggerDetailsOpen}>
          <DialogContent className={BOT_FLOW_MODAL_CONTENT_CLASS}>
            <div className="border-b border-[#2b3039] bg-[#2f343d] px-5 py-3">
              <div className="text-base font-medium leading-none tracking-tight">Trigger details</div>
            </div>

            <div className="space-y-4 overflow-y-auto px-6 py-4">
              <div>
                <Label className={BOT_MODAL_LABEL_CLASS}>Type</Label>
                <Select
                  value={draftTrigger}
                  onValueChange={(value) => {
                    const nextTrigger = value as BotTriggerType;
                    setDraftTrigger(nextTrigger);
                    setDraftContent(DEFAULT_ACTION_CONTENT[nextTrigger]);
                    if (nextTrigger !== "message_created") setDraftTriggerChannelId(ALL_CHANNELS_VALUE);
                  }}
                >
                  <SelectTrigger className="mt-2 h-9 rounded-none border-0 border-b border-white/80 bg-transparent px-0 text-sm text-[#f3f4f7] shadow-none focus:ring-0 focus:ring-offset-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_OPTIONS.map((trigger) => (
                      <SelectItem key={trigger.id} value={trigger.id}>
                        {trigger.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {draftTrigger === "message_created" && (
                <div>
                  <Label className={BOT_MODAL_LABEL_CLASS}>Channel</Label>
                  <Select value={draftTriggerChannelId} onValueChange={setDraftTriggerChannelId}>
                    <SelectTrigger className="mt-2 h-9 rounded-none border-0 border-b border-white/80 bg-transparent px-0 text-sm text-[#f3f4f7] shadow-none focus:ring-0 focus:ring-offset-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_CHANNELS_VALUE}>All channels</SelectItem>
                      {textChannels.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>
                          #{channel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label className={BOT_MODAL_LABEL_CLASS}>Performed by</Label>
                <Select value={draftTriggerRoleId} onValueChange={setDraftTriggerRoleId}>
                  <SelectTrigger className="mt-2 h-9 rounded-none border-0 border-b border-white/80 bg-transparent px-0 text-sm text-[#f3f4f7] shadow-none focus:ring-0 focus:ring-offset-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_ROLE_VALUE}>Any member or role</SelectItem>
                    {selectableRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#2c3139] bg-[#30353f] px-5 py-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsTriggerDetailsOpen(false)}
                className={BOT_MODAL_CANCEL_BUTTON_CLASS}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => setIsTriggerDetailsOpen(false)}
                className={BOT_MODAL_PRIMARY_BUTTON_CLASS}
              >
                Next
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
          <DialogContent className={BOT_FLOW_MODAL_CONTENT_CLASS}>
            <div className="border-b border-[#2b3039] bg-[#2f343d] px-5 py-3">
              <div className="text-base font-medium leading-none tracking-tight">Select a {pickerMode}</div>
            </div>
            {pickerMode === "trigger" ? (
              <div className="overflow-y-auto px-6 py-4">
                <div className="mb-4 flex h-9 items-center gap-2 border border-[#4a4f5a] bg-[#2f343d] px-3">
                  <Search className="h-4 w-4 text-[#9ea4af]" />
                  <Input
                    value={triggerSearch}
                    onChange={(event) => setTriggerSearch(event.target.value)}
                    placeholder={`Search ${TRIGGER_OPTIONS.length} triggers`}
                    className="h-8 border-0 bg-transparent px-0 text-sm text-[#f3f4f7] shadow-none placeholder:text-[#767b85] focus-visible:ring-0"
                  />
                </div>
                <ScrollArea className="max-h-[380px]">
                  <div className="space-y-2">
                    {filteredTriggers.map((trigger) => {
                      const Icon = trigger.icon;
                      return (
                        <button
                          key={trigger.id}
                          type="button"
                          onClick={() => selectTrigger(trigger.id)}
                          className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border border-[#4a4f5a] bg-[#2f343d] px-3 py-2 text-left hover:bg-[#30333d]"
                        >
                          <Icon className="h-5 w-5 text-[#9ea4af]" />
                          <span className="min-w-0">
                            <span className="mb-1 inline-flex rounded-[2px] bg-[#42464f] px-1.5 py-0.5 text-[9px] font-bold text-[#d7dbe3]">
                              {trigger.eyebrow}
                            </span>
                            <span className="block truncate text-sm font-medium text-[#f3f4f7]">{trigger.label}</span>
                            <span className="block truncate text-xs text-[#c4c8d0]">{trigger.description}</span>
                          </span>
                          <span className="rounded-[3px] border border-[#42464f] px-3 py-1 text-xs font-medium text-[#e2e4e9]">
                            Select
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto px-6 py-4">
                {ACTION_OPTIONS.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => {
                        setDraftAction(action.id);
                        setIsPickerOpen(false);
                      }}
                      className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border border-[#4a4f5a] bg-[#2f343d] px-3 py-2 text-left hover:bg-[#30333d]"
                    >
                      <Icon className="h-5 w-5 text-[#9ea4af]" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-[#f3f4f7]">{action.label}</span>
                        <span className="block truncate text-xs text-[#c4c8d0]">{action.description}</span>
                      </span>
                      <span className="rounded-[3px] border border-[#42464f] px-3 py-1 text-xs font-medium text-[#e2e4e9]">
                        Select
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex items-center justify-end gap-3 border-t border-[#2c3139] bg-[#30353f] px-5 py-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsPickerOpen(false)}
                className={BOT_MODAL_CANCEL_BUTTON_CLASS}
              >
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="max-w-3xl text-foreground">
      <h2 className="mb-4 text-xl font-medium">Bots</h2>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setIsCreateOpen(true)}
        className="mb-3 h-8 rounded-[3px] px-4 text-xs"
      >
        Create a bot
      </Button>
      <p className="mb-5 max-w-xl text-sm text-muted-foreground">
        Bots help you automate things. They respond to activity happening within your server.
      </p>

      <div className="mb-5 border-t border-border" />

      {isLoading ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : bots.length > 0 ? (
        <div className="mb-7">
          {bots.map((bot) => (
            <div key={bot.id} className="flex items-center gap-3 border-b border-border/50 py-3 last:border-b-0">
              <BotAvatar name={bot.name} />
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
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setSelectedBotId(bot.id);
                      setView("detail");
                    }}
                  >
                    <ChevronRight className="mr-2 h-4 w-4" />
                    Open
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => deleteBot(bot)}>
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

      <p className="mt-5 text-xs text-muted-foreground">
        Want to code your own Guilded bots? Check out our Guilded API for bots.{" "}
        <span className="font-medium text-foreground">Apply for API early access</span>
      </p>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className={BOT_MODAL_CONTENT_CLASS}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              createBot();
            }}
            className="flex max-h-[82vh] flex-col overflow-hidden"
          >
            <div className="border-b border-[#2b3039] bg-[#2f343d] px-5 py-3">
              <div className="text-base font-medium leading-none tracking-tight">Create bot</div>
            </div>

            <div className="overflow-y-auto px-6 py-4">
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

            <div className="flex items-center justify-end gap-3 border-t border-[#2c3139] bg-[#30353f] px-5 py-3">
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
    </div>
  );
};
