import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import {
  ArrowLeft,
  Bot,
  ChevronRight,
  Loader2,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  Wand2,
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  category: "MEMBERSHIP" | "CHAT";
  description: string;
  icon: ComponentType<{ className?: string }>;
};

type ActionOption = {
  id: BotActionType;
  category: "CHAT";
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

const MemberJoinedIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M20 18L14 18M17 15V21M4 21C4 17.134 7.13401 14 11 14C11.695 14 12.3663 14.1013 13 14.2899M15 7C15 9.20914 13.2091 11 11 11C8.79086 11 7 9.20914 7 7C7 4.79086 8.79086 3 11 3C13.2091 3 15 4.79086 15 7Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const MessageCreatedIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M9 12H15M12 9V15M21.0039 12C21.0039 16.9706 16.9745 21 12.0039 21C9.9675 21 3.00463 21 3.00463 21C3.00463 21 4.56382 17.2561 3.93982 16.0008C3.34076 14.7956 3.00391 13.4372 3.00391 12C3.00391 7.02944 7.03334 3 12.0039 3C16.9745 3 21.0039 7.02944 21.0039 12Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const getCategoryBadgeClass = (_category?: string) => "border border-border bg-secondary text-muted-foreground";

const TRIGGER_OPTIONS: TriggerOption[] = [
  {
    id: "member_joined",
    label: "Member joined",
    category: "MEMBERSHIP",
    description: "When a new member joins the server",
    icon: MemberJoinedIcon,
  },
  {
    id: "message_created",
    label: "Member sent message to channel",
    category: "CHAT",
    description: "When someone sends a message in any text channel",
    icon: MessageCreatedIcon,
  },
];

const ACTION_OPTIONS: ActionOption[] = [
  {
    id: "send_channel_message",
    category: "CHAT",
    label: "Send message to channel",
    description: "Post a simple system message in a selected channel",
    icon: MessageCreatedIcon,
  },
];

const DEFAULT_ACTION_CONTENT: Record<BotTriggerType, string> = {
  member_joined: "Welcome {user} to {server}.",
  message_created: "Thanks for keeping {channel} active, {user}.",
};

const ALL_CHANNELS_VALUE = "all";
const ANY_ROLE_VALUE = "any";

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
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isFlowOpen, setIsFlowOpen] = useState(false);
  const [flowBuilderStep, setFlowBuilderStep] = useState<FlowBuilderStep>("overview");
  const [isTriggerConfigured, setIsTriggerConfigured] = useState(false);
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
    setIsTriggerConfigured(false);
    setTriggerSearch("");
    setFlowBuilderStep("overview");
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
    setDraftContent(DEFAULT_ACTION_CONTENT[trigger]);
    if (trigger !== "message_created") setDraftTriggerChannelId(ALL_CHANNELS_VALUE);
    setFlowBuilderStep("trigger-details");
  };

  const selectAction = (action: BotActionType) => {
    setDraftAction(action);
    setFlowBuilderStep("action-details");
  };

  const closeFlowBuilder = (open: boolean) => {
    setIsFlowOpen(open);
    if (!open) {
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
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-primary text-primary-foreground">
            <Bot className="h-6 w-6" />
          </div>
          <div className="w-full max-w-md">
            <Label className="text-[10px] font-semibold leading-none text-muted-foreground">Name</Label>
            <div className="border-b border-border">
              <Input
                value={selectedBot.name}
                disabled
                className="h-7 cursor-default rounded-none border-0 bg-transparent px-0 py-0 text-sm text-foreground opacity-100 shadow-none outline-none disabled:cursor-default disabled:opacity-100 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
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
          <div className="max-w-3xl space-y-2">
            {selectedBot.flows.map((flow) => {
              const trigger = getTriggerOption(flow.trigger_type);
              const action = getActionOption(flow.action_type);
              const triggerChannelId =
                typeof flow.trigger_config.channel_id === "string" ? flow.trigger_config.channel_id : null;
              const triggerChannelName = triggerChannelId
                ? textChannels.find((channel) => channel.id === triggerChannelId)?.name
                : null;
              const actionChannelName = textChannels.find((channel) => channel.id === flow.action_config.channel_id)?.name;
              const triggerChannelLabel =
                flow.trigger_type === "message_created" ? (triggerChannelName ? `#${triggerChannelName}` : "All channels") : "Any member";
              const actionChannelLabel = actionChannelName ? `#${actionChannelName}` : "No channel";
              const triggerRoleId = typeof flow.trigger_config.role_id === "string" ? flow.trigger_config.role_id : null;
              const triggerRoleName = triggerRoleId
                ? selectableRoles.find((role) => role.id === triggerRoleId)?.name
                : null;
              const actorLabel = triggerRoleName ? triggerRoleName : "anyone";
              const triggerDescription =
                flow.trigger_type === "message_created"
                  ? `by ${actorLabel} in ${triggerChannelLabel}`
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
                        <p className="truncate text-[11px] leading-4 text-muted-foreground">to {actionChannelLabel}</p>
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
              onClick={openFlowBuilder}
              disabled={!textChannels.length}
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
                        setFlowBuilderStep("trigger-picker");
                      }}
                    >
                      <FlowIcon type={draftTrigger} />
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
                        setFlowBuilderStep("trigger-picker");
                      }}
                      className="mr-3 h-8 rounded-[3px] border-border bg-transparent px-4 text-xs text-foreground hover:bg-secondary/70"
                    >
                      Add
                    </Button>
                  </div>

                  <div className="grid grid-cols-[1fr_auto] items-center border border-border bg-card transition-colors hover:bg-secondary/70">
                    <button
                      type="button"
                      className="flex items-center gap-3 px-3 py-3 text-left"
                      onClick={() => {
                        if (!isTriggerConfigured) return;
                        setFlowBuilderStep("action-picker");
                      }}
                    >
                      <FlowIcon type={draftAction} />
                      <div>
                        <p className="text-sm font-medium leading-none text-foreground">Action</p>
                        {isTriggerConfigured && (
                          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{getActionOption(draftAction).label}</p>
                        )}
                      </div>
                    </button>
                    {isTriggerConfigured ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setFlowBuilderStep("action-picker")}
                        className="mr-3 h-8 rounded-[3px] border-border bg-transparent px-4 text-xs text-foreground hover:bg-secondary/70"
                      >
                        Add
                      </Button>
                    ) : (
                      <div className="mr-3 h-8 w-[58px]" />
                    )}
                  </div>
                </div>
              )}

              {flowBuilderStep === "trigger-picker" && (
                <div className="overflow-y-auto px-6 py-4">
                  <div className="mb-4 flex h-9 items-center gap-2 border border-border bg-secondary/40 px-3">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={triggerSearch}
                      onChange={(event) => setTriggerSearch(event.target.value)}
                      placeholder={`Search ${TRIGGER_OPTIONS.length} triggers`}
                      className="h-8 border-0 bg-transparent px-0 text-sm text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
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
                              Select
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

                  {draftTrigger === "message_created" && (
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
                          {textChannels.map((channel) => (
                            <SelectItem key={channel.id} value={channel.id} className={BOT_SELECT_ITEM_CLASS}>
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
                    return (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => selectAction(action.id)}
                        className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border border-border bg-secondary/40 px-3 py-2 text-left hover:bg-secondary/70"
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
                          <span className="block truncate text-xs text-muted-foreground">{action.description}</span>
                        </span>
                        <span className="rounded-[3px] border border-border px-3 py-1 text-xs font-medium text-foreground">
                          Select
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

                  <div>
                    <Label className={BOT_MODAL_LABEL_CLASS}>Channel</Label>
                    <Select value={draftChannelId} onValueChange={setDraftChannelId}>
                      <SelectTrigger className="mt-2 h-9 rounded-none border-0 border-b border-border bg-transparent px-0 text-sm text-foreground shadow-none focus:ring-0 focus:ring-offset-0">
                        <SelectValue placeholder="Select channel" />
                      </SelectTrigger>
                      <SelectContent className={BOT_SELECT_CONTENT_CLASS}>
                        {textChannels.map((channel) => (
                          <SelectItem key={channel.id} value={channel.id} className={BOT_SELECT_ITEM_CLASS}>
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
                    disabled={isSaving || !textChannels.length}
                    className={BOT_MODAL_PRIMARY_BUTTON_CLASS}
                  >
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save flow
                  </Button>
                )}
                {flowBuilderStep === "trigger-details" && (
                  <Button
                    type="button"
                    onClick={() => {
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
                    onClick={() => setFlowBuilderStep("overview")}
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
                <DropdownMenuContent align="end" className="w-56">
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

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
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
    </div>
  );
};
