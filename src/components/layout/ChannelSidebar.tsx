import { useState, useMemo, useCallback, useRef, useEffect, useLayoutEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  Hash,
  Volume2,
  Settings,
  Plus,
  LogOut,
  UserPlus,
  FolderPlus,
  Info,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import { useVoiceStore } from "@/stores/voiceStore";
import { useVoicePresenceWatchers } from "@/hooks/useVoicePresenceWatchers";
import { useUIStore } from "@/stores/uiStore";
import { useUnread } from "@/hooks/useUnread";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MotionButton } from "@/components/ui/motion-elements";
import { LoggedInUserPanel } from "@/components/layout/LoggedInUserPanel";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { Channel, ChannelCategory, ServerRole } from "@/types";

// Animation variants
const channelVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -10 },
};

// Category variants will be created dynamically based on measured height

const isAdminRole = (role: ServerRole | undefined): boolean => {
  return role === "owner" || role === "admin" || role === "moderator";
};

// Uncategorized Drop Zone
const UncategorizedDropZone = ({
  children,
  isDragOver,
  hasChannels,
}: {
  children: ReactNode;
  isDragOver: boolean;
  hasChannels: boolean;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: "uncategorized-drop",
    data: { type: "category-drop", categoryId: null },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "transition-all duration-200",
        (isOver || isDragOver) &&
          "ring-2 ring-primary/50 ring-offset-2 ring-offset-layout-sidebar-secondary rounded-md p-1 mb-2",
        !hasChannels && (isOver || isDragOver) && "min-h-[60px] flex items-center justify-center",
      )}
    >
      {children}
      {!hasChannels && (isOver || isDragOver) && (
        <div className="text-xs text-muted-foreground text-center py-2">Drop channel here to uncategorize</div>
      )}
    </div>
  );
};

// Modern Sortable Channel Item
const SortableChannel = ({
  channel,
  isActive,
  isUnread,
  mentionCount,
  isAdmin,
  voiceUserIds,
  resolveUser,
  onSelect,
  onEdit,
}: {
  channel: Channel;
  isActive: boolean;
  isUnread: boolean;
  mentionCount: number;
  isAdmin: boolean;
  voiceUserIds?: string[];
  resolveUser?: (userId: string) => { avatarUser?: any; label: string };
  onSelect: () => void;
  onEdit: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: channel.id,
    data: { type: "channel", channel },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Determine the icon to display
  const getChannelIcon = () => {
    if (channel.icon) {
      return <span className="text-base font-emoji">{channel.icon}</span>;
    }
    if (channel.type === "voice") {
      return (
        <Volume2
          className={cn(
            "w-4 h-4 flex-shrink-0 transition-colors",
            isUnread && !isActive ? "text-foreground" : "text-muted-foreground",
          )}
        />
      );
    }
    return (
      <Hash
        className={cn(
          "w-4 h-4 flex-shrink-0 transition-colors",
          isUnread && !isActive ? "text-foreground" : "text-muted-foreground",
        )}
      />
    );
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      variants={channelVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="relative"
    >
      <button
        onClick={onSelect}
        className={cn(
          "group relative w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all duration-150 select-none",
          "hover:bg-secondary/80",
          isActive && "bg-secondary text-foreground",
          !isActive && "text-muted-foreground hover:text-foreground",
          isUnread && !isActive && "text-foreground font-semibold",
        )}
      >
        {/* Active indicator */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              layoutId="channel-indicator"
              className="absolute -left-2 top-0 bottom-0 w-1 bg-primary rounded-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>

        {/* Channel icon */}
        <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">{getChannelIcon()}</div>

        {/* Channel name */}
        <span className="truncate flex-1 text-left">{channel.name}</span>

        {/* NSFW badge */}
        {channel.is_nsfw && (
          <span className="px-1 py-0.5 text-[10px] font-semibold rounded bg-destructive/20 text-destructive uppercase tracking-wide flex-shrink-0">
            NSFW
          </span>
        )}

        {/* Mention badge */}
        <AnimatePresence>
          {mentionCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="px-1.5 py-0.5 text-xs font-bold rounded-full bg-destructive text-destructive-foreground"
            >
              {mentionCount > 99 ? "99+" : mentionCount}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Admin settings */}
        {isAdmin && (
          <Settings
            className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground cursor-pointer flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          />
        )}

        {/* Drag handle for admins */}
        {isAdmin && (
          <div
            {...attributes}
            {...listeners}
            className="opacity-0 group-hover:opacity-50 hover:!opacity-100 cursor-grab active:cursor-grabbing"
          >
            <div className="w-1 h-3 flex flex-col gap-0.5 justify-center">
              <div className="w-1 h-1 rounded-full bg-muted-foreground" />
              <div className="w-1 h-1 rounded-full bg-muted-foreground" />
            </div>
          </div>
        )}
      </button>

      {channel.type === "voice" && voiceUserIds && voiceUserIds.length > 0 && resolveUser && (
        <div className="ml-7 mt-1 space-y-1">
          {voiceUserIds.map((id) => {
            const info = resolveUser(id);
            return (
              <div key={id} className="flex items-center gap-2 px-2 py-1 rounded-md text-xs text-muted-foreground">
                <AvatarWithDecoration user={info.avatarUser} size={18} />
                <span className="truncate">{info.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

// Category Content with measured height animation
const CategoryContent = ({
  channels,
  currentChannelId,
  getChannelUnread,
  isAdmin,
  onSelectChannel,
  onEditChannel,
  voicePresenceByChannel,
  resolveUser,
}: {
  channels: Channel[];
  currentChannelId: string | undefined;
  getChannelUnread: (channelId: string) => { unreadCount: number; mentionCount: number };
  isAdmin: boolean;
  onSelectChannel: (channel: Channel) => void;
  onEditChannel: (channelId: string) => void;
  voicePresenceByChannel: Record<string, string[]>;
  resolveUser: (userId: string) => { avatarUser?: any; label: string };
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>(0);

  // Measure height synchronously before paint to avoid layout thrashing
  useLayoutEffect(() => {
    if (contentRef.current) {
      const measuredHeight = contentRef.current.scrollHeight;
      if (measuredHeight > 0) {
        setHeight((prevHeight) => {
          // Only update if height changed significantly (avoid unnecessary updates)
          return Math.abs(measuredHeight - prevHeight) > 1 ? measuredHeight : prevHeight;
        });
      }
    }
  }, [channels.length, channels.map((c) => c.id).join(",")]);

  // Fallback measurement after render if height is still 0
  useEffect(() => {
    if (height === 0 && contentRef.current) {
      const measuredHeight = contentRef.current.scrollHeight;
      if (measuredHeight > 0) {
        setHeight(measuredHeight);
      }
    }
  }, [height]);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{
        height: height > 0 ? height : "auto",
        opacity: 1,
      }}
      exit={{ height: 0, opacity: 0 }}
      transition={{
        height: {
          type: "spring",
          stiffness: 300,
          damping: 30,
          mass: 0.8,
        },
        opacity: { duration: 0.15 },
      }}
      className="space-y-0.5 ml-1 overflow-hidden"
      style={{
        contain: "layout style",
        willChange: height > 0 ? "height" : undefined,
      }}
    >
      <div ref={contentRef}>
        <SortableContext items={channels.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {channels.map((channel) => {
            const { unreadCount, mentionCount } = getChannelUnread(channel.id);
            return (
              <SortableChannel
                key={channel.id}
                channel={channel}
                isActive={currentChannelId === channel.id}
                isUnread={unreadCount > 0}
                mentionCount={mentionCount}
                isAdmin={isAdmin}
                voiceUserIds={voicePresenceByChannel[channel.id]}
                resolveUser={resolveUser}
                onSelect={() => onSelectChannel(channel)}
                onEdit={() => onEditChannel(channel.id)}
              />
            );
          })}
        </SortableContext>
      </div>
    </motion.div>
  );
};

// Modern Sortable Category
const SortableCategory = ({
  category,
  channels,
  isCollapsed,
  isAdmin,
  currentChannelId,
  getChannelUnread,
  onToggle,
  onSelectChannel,
  onAddChannel,
  onEditChannel,
  isDragOver,
  voicePresenceByChannel,
  resolveUser,
}: {
  category: ChannelCategory;
  channels: Channel[];
  isCollapsed: boolean;
  isAdmin: boolean;
  currentChannelId: string | undefined;
  getChannelUnread: (channelId: string) => { unreadCount: number; mentionCount: number };
  onToggle: () => void;
  onSelectChannel: (channel: Channel) => void;
  onAddChannel: () => void;
  onEditChannel: (channelId: string) => void;
  isDragOver?: boolean;
  voicePresenceByChannel: Record<string, string[]>;
  resolveUser: (userId: string) => { avatarUser?: any; label: string };
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
    data: { type: "category", category },
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `category-drop-${category.id}`,
    data: { type: "category-drop", categoryId: category.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <motion.div
      ref={(node) => {
        setNodeRef(node);
        setDroppableRef(node);
      }}
      style={style}
      className={cn(
        "mb-4 transition-all duration-200",
        (isOver || isDragOver) &&
          "ring-2 ring-primary/50 ring-offset-2 ring-offset-layout-sidebar-secondary rounded-md",
      )}
      layout
    >
      {/* Category header */}
      <div className="group flex items-center gap-1 px-0.5 mb-1">
        <button
          className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground uppercase tracking-wider flex-1 py-1"
          onClick={onToggle}
        >
          <motion.div
            animate={{ rotate: isCollapsed ? -90 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <ChevronDown className="w-3 h-3" />
          </motion.div>
          <span className="truncate">{category.name}</span>
          {isCollapsed && <span className="ml-1 text-muted-foreground/60">({channels.length})</span>}
        </button>

        {/* Add channel button */}
        {isAdmin && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground rounded hover:bg-secondary"
                onClick={onAddChannel}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Create Channel
            </TooltipContent>
          </Tooltip>
        )}

        {/* Drag handle */}
        {isAdmin && (
          <div
            {...attributes}
            {...listeners}
            className="p-1 opacity-0 group-hover:opacity-50 hover:!opacity-100 cursor-grab active:cursor-grabbing"
          >
            <div className="w-1 h-3 flex flex-col gap-0.5 justify-center">
              <div className="w-1 h-1 rounded-full bg-muted-foreground" />
              <div className="w-1 h-1 rounded-full bg-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Channels */}
      <AnimatePresence>
        {!isCollapsed && (
          <CategoryContent
            channels={channels}
            currentChannelId={currentChannelId}
            getChannelUnread={getChannelUnread}
            isAdmin={isAdmin}
            onSelectChannel={onSelectChannel}
            onEditChannel={onEditChannel}
            voicePresenceByChannel={voicePresenceByChannel}
            resolveUser={resolveUser}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const ChannelSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const {
    currentServer,
    currentChannel,
    setCurrentChannel,
    categories,
    channels,
    members,
    servers,
    leaveServer,
    reorderCategories,
    reorderChannels,
  } = useServerStore();
  const voicePresenceByChannel = useVoiceStore((s) => s.presenceByChannel);
  const joinedVoiceChannelId = useVoiceStore((s) => s.joinedChannelId);
  const { openModal, openServerSettings } = useUIStore();

  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"channel" | "category" | null>(null);
  const [overCategoryId, setOverCategoryId] = useState<string | null>(null);

  const channelIds = useMemo(() => channels.map((c) => c.id), [channels]);
  const { getChannelUnread, markAsRead } = useUnread(channelIds);

  const voiceChannelIds = useMemo(() => channels.filter((c) => c.type === "voice").map((c) => c.id), [channels]);
  // IMPORTANT: don't watch the voice channel topic we are actively joined to, otherwise we can end up with
  // duplicate Realtime subscriptions to `voice:${channelId}` (watcher + voice join), which can cause
  // "Voice signaling connection failed" (CHANNEL_ERROR / TIMED_OUT).
  const watchedVoiceChannelIds = useMemo(
    () => voiceChannelIds.filter((id) => id !== joinedVoiceChannelId),
    [voiceChannelIds, joinedVoiceChannelId],
  );
  useVoicePresenceWatchers({ channelIds: watchedVoiceChannelIds, userId: user?.id ?? null });

  const currentMembership = useMemo(() => {
    if (!currentServer) return null;
    return servers.find((s) => s.id === currentServer.id);
  }, [servers, currentServer]);

  const memberUserById = useMemo(() => {
    const map = new Map<string, any>();
    for (const m of members) {
      map.set(m.user_id, m.user);
    }
    return map;
  }, [members]);

  const resolveUser = useCallback(
    (userId: string) => {
      const u = memberUserById.get(userId);
      const label = u?.display_name || u?.username || userId.slice(0, 8);
      return { avatarUser: u, label };
    },
    [memberUserById],
  );

  const userRole = currentMembership?.role;
  // Use permission system instead of hardcoded role checks
  const { hasPermission } = useMemberPermissions();
  const canManageChannels = hasPermission("manage_channels");
  const canManageServer = hasPermission("manage_server");
  const canManageRoles = hasPermission("manage_roles");
  const isAdmin = canManageChannels; // For channel/category management
  const canSeeServerSettings = canManageChannels || canManageServer || canManageRoles;
  const isOwner = userRole === "owner";

  const { uncategorizedChannels, sortedCategories } = useMemo(() => {
    const uncategorized = channels
      .filter((channel) => !channel.category_id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    const sorted = [...categories].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    return { uncategorizedChannels: uncategorized, sortedCategories: sorted };
  }, [channels, categories]);

  const getChannelsForCategory = useCallback(
    (categoryId: string) => {
      return channels.filter((c) => c.category_id === categoryId).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    },
    [channels],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleSelectChannel = useCallback(
    (channel: Channel) => {
      setCurrentChannel(channel);
      // Mark channel as read when selected
      markAsRead(channel.id);
      // Navigate to channel URL
      if (currentServer) {
        navigate(`/app/servers/${currentServer.id}/channels/${channel.id}`);
      }
    },
    [setCurrentChannel, markAsRead, currentServer, navigate],
  );

  const isOverviewActive = !!currentServer && location.pathname === `/app/servers/${currentServer.id}/overview`;
  const isMembersActive = !!currentServer && location.pathname === `/app/servers/${currentServer.id}/members`;

  const handleSelectOverview = () => {
    if (!currentServer) return;
    setCurrentChannel(null);
    navigate(`/app/servers/${currentServer.id}/overview`);
  };

  const handleSelectMembers = () => {
    if (!currentServer) return;
    if (!isOwner && !canManageServer) {
      toast.error("You don't have permission to view server members");
      return;
    }
    setCurrentChannel(null);
    navigate(`/app/servers/${currentServer.id}/members`);
  };

  const handleLeaveServer = async () => {
    if (!currentServer || !user || isOwner) return;
    await leaveServer(currentServer.id, user.id);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;
    setActiveId(active.id as string);
    setActiveType(data?.type || null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;

    if (!over) {
      setOverCategoryId(null);
      return;
    }

    const activeData = active.data.current;
    const overData = over.data.current;

    // If dragging a channel over a category drop zone
    if (activeData?.type === "channel" && overData?.type === "category-drop") {
      const categoryId = overData.categoryId as string | null;
      setOverCategoryId(categoryId);
      return;
    }

    // If dragging a channel over another channel, find its category
    if (activeData?.type === "channel" && overData?.type === "channel") {
      const overChannel = overData.channel as Channel;
      setOverCategoryId(overChannel.category_id || null);
      return;
    }

    // If dragging over a category header
    if (activeData?.type === "channel" && overData?.type === "category") {
      setOverCategoryId(over.id as string);
      return;
    }

    setOverCategoryId(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveType(null);
    setOverCategoryId(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type === "category" && overData?.type === "category") {
      const oldIndex = sortedCategories.findIndex((c) => c.id === active.id);
      const newIndex = sortedCategories.findIndex((c) => c.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(sortedCategories, oldIndex, newIndex);
        await reorderCategories(newOrder.map((c) => c.id));
      }
      return;
    }

    if (activeData?.type === "channel") {
      const activeChannel = activeData.channel as Channel;

      // Check if dropped on a category drop zone
      if (overData?.type === "category-drop") {
        const targetCategoryId = overData.categoryId as string | null;
        const targetChannels = targetCategoryId ? getChannelsForCategory(targetCategoryId) : uncategorizedChannels;
        const newPosition = targetChannels.length;

        // Only move if it's a different category
        if (activeChannel.category_id !== targetCategoryId) {
          await reorderChannels(activeChannel.id, targetCategoryId, newPosition);
        }
        return;
      }

      // Check if dropped on a category header
      if (overData?.type === "category") {
        const targetCategoryId = over.id as string;
        const targetChannels = getChannelsForCategory(targetCategoryId);
        const newPosition = targetChannels.length;

        // Only move if it's a different category
        if (activeChannel.category_id !== targetCategoryId) {
          await reorderChannels(activeChannel.id, targetCategoryId, newPosition);
        }
        return;
      }

      // Check if dropped on another channel
      const overChannel = overData?.channel as Channel | undefined;
      if (overChannel) {
        const targetCategoryId = overChannel.category_id;

        // If same category, reorder within category
        if (activeChannel.category_id === targetCategoryId) {
          const categoryChannels = getChannelsForCategory(activeChannel.category_id || "");
          const oldIndex = categoryChannels.findIndex((c) => c.id === active.id);
          const newIndex = categoryChannels.findIndex((c) => c.id === over.id);

          if (oldIndex !== -1 && newIndex !== -1) {
            await reorderChannels(activeChannel.id, activeChannel.category_id, newIndex);
          }
        } else {
          // Different category - move to that category at the position of the over channel
          const targetChannels = getChannelsForCategory(targetCategoryId || "");
          const newIndex = targetChannels.findIndex((c) => c.id === over.id);

          if (newIndex !== -1) {
            await reorderChannels(activeChannel.id, targetCategoryId, newIndex);
          }
        }
      }
    }
  };

  const getActiveItem = () => {
    if (!activeId) return null;

    if (activeType === "category") {
      const category = categories.find((c) => c.id === activeId);
      if (category) {
        return (
          <div className="flex items-center gap-1 px-2 py-1 bg-secondary rounded-md text-sm">
            <ChevronRight className="w-3 h-3" />
            <span className="uppercase text-xs font-semibold">{category.name}</span>
          </div>
        );
      }
    }

    if (activeType === "channel") {
      const channel = channels.find((c) => c.id === activeId);
      if (channel) {
        return (
          <div className="flex items-center gap-2 px-2 py-1.5 bg-secondary rounded-md text-sm">
            {channel.icon ? <span className="text-base font-emoji">{channel.icon}</span> : <Hash className="w-4 h-4" />}
            <span>{channel.name}</span>
          </div>
        );
      }
    }

    return null;
  };

  if (!currentServer) {
    return (
      <div className="h-full flex flex-col bg-layout-sidebar-secondary">
        <div className="flex-1 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-secondary/50 flex items-center justify-center">
              <Hash className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">Select a server</p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-layout-sidebar-secondary">
      {/* Server header with banner */}
      <div className="relative">
        {/* Server banner with smooth fade out effect */}
        {currentServer.banner_url && (
          <div className="relative h-20 sm:h-24 overflow-hidden">
            <img
              src={currentServer.banner_url}
              alt={`${currentServer.name} banner`}
              className="w-full h-full object-cover"
            />
            {/* Smooth fade out gradient overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(to bottom, transparent 0%, transparent 40%, hsl(var(--sidebar-secondary)) 100%)",
              }}
            />
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <MotionButton
              className={cn(
                "h-12 px-4 flex items-center justify-between border-b border-border/50 hover:bg-secondary/50 cursor-pointer w-full text-left transition-colors",
                currentServer.banner_url && "border-t-0",
              )}
              whileHover={{ backgroundColor: "hsl(var(--secondary) / 0.5)" }}
              whileTap={{ scale: 0.99 }}
            >
              <h2 className="font-normal text-lg text-foreground truncate">{currentServer.name}</h2>
              <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </MotionButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-56 p-1.5 rounded-xl border-border/50 bg-popover/95 backdrop-blur-xl shadow-xl"
            align="start"
            sideOffset={4}
          >
            {/* Invite People */}
            <DropdownMenuItem
              onClick={() => openModal("invite", { serverId: currentServer.id })}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-secondary/60 focus:bg-secondary/80 transition-colors"
            >
              <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-sm font-medium">Invite People</span>
            </DropdownMenuItem>

            {canSeeServerSettings && (
              <>
                <DropdownMenuSeparator className="my-1 bg-border/50" />

                {/* Server Settings */}
                <DropdownMenuItem
                  onClick={() => openServerSettings()}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-secondary/60 focus:bg-secondary/80 transition-colors"
                >
                  <div className="w-6 h-6 rounded-lg bg-secondary/80 flex items-center justify-center flex-shrink-0">
                    <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium">Server Settings</span>
                </DropdownMenuItem>

                {canManageChannels && (
                  <>
                    {/* Create Channel */}
                    <DropdownMenuItem
                      onClick={() => openModal("create-channel", { serverId: currentServer.id })}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-secondary/60 focus:bg-secondary/80 transition-colors"
                    >
                      <div className="w-6 h-6 rounded-lg bg-secondary/80 flex items-center justify-center flex-shrink-0">
                        <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-medium">Create Channel</span>
                    </DropdownMenuItem>

                    {/* Create Category */}
                    <DropdownMenuItem
                      onClick={() => openModal("create-channel", { serverId: currentServer.id, isCategory: true })}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-secondary/60 focus:bg-secondary/80 transition-colors"
                    >
                      <div className="w-6 h-6 rounded-lg bg-secondary/80 flex items-center justify-center flex-shrink-0">
                        <FolderPlus className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-medium">Create Category</span>
                    </DropdownMenuItem>
                  </>
                )}
              </>
            )}

            {!isOwner && (
              <>
                <DropdownMenuSeparator className="my-1 bg-border/50" />

                {/* Leave Server */}
                <DropdownMenuItem
                  onClick={handleLeaveServer}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer text-destructive hover:bg-destructive/10 focus:text-destructive focus:bg-destructive/10 transition-colors"
                >
                  <div className="w-6 h-6 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <LogOut className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-medium">Leave Server</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Channel list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="flex-1 overflow-y-auto scrollbar-overlay p-2 scrollbar-hide">
              {/* Default sections */}
              <div className="mb-3 space-y-0.5">
                <button
                  onClick={handleSelectOverview}
                  className={cn(
                    "group relative w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all duration-150 select-none",
                    "hover:bg-secondary/80",
                    isOverviewActive && "bg-secondary text-foreground",
                    !isOverviewActive && "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <AnimatePresence>
                    {isOverviewActive && (
                      <motion.div
                        layoutId="channel-indicator"
                        className="absolute -left-2 top-0 bottom-0 w-1 bg-primary rounded-full"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      />
                    )}
                  </AnimatePresence>
                  <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                    <Info
                      className={cn(
                        "w-4 h-4 flex-shrink-0 transition-colors translate-y-[0.5px]",
                        isOverviewActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
                      )}
                    />
                  </div>
                  <span className="truncate flex-1 text-left">Overview</span>
                </button>

                {(isOwner || canManageServer) && (
                  <button
                    onClick={handleSelectMembers}
                    className={cn(
                      "group relative w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all duration-150 select-none",
                      "hover:bg-secondary/80",
                      isMembersActive && "bg-secondary text-foreground",
                      !isMembersActive && "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <AnimatePresence>
                      {isMembersActive && (
                        <motion.div
                          layoutId="channel-indicator"
                          className="absolute -left-2 top-0 bottom-0 w-1 bg-primary rounded-full"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        />
                      )}
                    </AnimatePresence>
                    <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                      <Users
                        className={cn(
                          "w-4 h-4 flex-shrink-0 transition-colors translate-y-[0.5px]",
                          isMembersActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
                        )}
                      />
                    </div>
                    <span className="truncate flex-1 text-left">Members</span>
                  </button>
                )}
              </div>

              {/* Uncategorized channels */}
              <UncategorizedDropZone
                isDragOver={overCategoryId === null && activeType === "channel"}
                hasChannels={uncategorizedChannels.length > 0}
              >
                {uncategorizedChannels.length > 0 && (
                  <div className="mb-4 space-y-0.5">
                    <SortableContext
                      items={uncategorizedChannels.map((c) => c.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {uncategorizedChannels.map((channel) => {
                        const { unreadCount, mentionCount } = getChannelUnread(channel.id);
                        return (
                          <SortableChannel
                            key={channel.id}
                            channel={channel}
                            isActive={currentChannel?.id === channel.id}
                            isUnread={unreadCount > 0}
                            mentionCount={mentionCount}
                            isAdmin={isAdmin}
                            voiceUserIds={voicePresenceByChannel[channel.id]}
                            resolveUser={resolveUser}
                            onSelect={() => handleSelectChannel(channel)}
                            onEdit={() => openModal("edit-channel", { channelId: channel.id })}
                          />
                        );
                      })}
                    </SortableContext>
                  </div>
                )}
              </UncategorizedDropZone>

              {/* Categories */}
              <SortableContext items={sortedCategories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                {sortedCategories.map((category) => (
                  <SortableCategory
                    key={category.id}
                    category={category}
                    channels={getChannelsForCategory(category.id)}
                    isCollapsed={collapsedCategories.has(category.id)}
                    isAdmin={isAdmin}
                    currentChannelId={currentChannel?.id}
                    getChannelUnread={getChannelUnread}
                    onToggle={() => toggleCategory(category.id)}
                    onSelectChannel={handleSelectChannel}
                    onAddChannel={() => openModal("create-channel", { categoryId: category.id })}
                    onEditChannel={(channelId) => openModal("edit-channel", { channelId })}
                    isDragOver={overCategoryId === category.id && activeType === "channel"}
                    voicePresenceByChannel={voicePresenceByChannel}
                    resolveUser={resolveUser}
                  />
                ))}
              </SortableContext>

              {/* Empty state */}
              {channels.length === 0 && categories.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center mb-3">
                    <Hash className="w-6 h-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">No channels yet</p>
                  {isAdmin && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => openModal("create-channel", { serverId: currentServer.id })}
                    >
                      Create a channel
                    </Button>
                  )}
                </motion.div>
              )}
            </div>
          </ContextMenuTrigger>
          {isAdmin && (
            <ContextMenuContent>
              <ContextMenuItem
                onClick={() => openModal("create-channel", { serverId: currentServer.id, isCategory: true })}
              >
                <FolderPlus className="w-4 h-4 mr-2" />
                Create Category
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => openModal("create-channel", { serverId: currentServer.id })}>
                <Plus className="w-4 h-4 mr-2" />
                Create Channel
              </ContextMenuItem>
            </ContextMenuContent>
          )}
        </ContextMenu>

        <DragOverlay>{getActiveItem()}</DragOverlay>
      </DndContext>

      <LoggedInUserPanel />
    </div>
  );
};
