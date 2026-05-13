import { useState, useMemo, useEffect, useCallback, forwardRef, memo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Folder,
  FolderPlus,
  Plus,
  Settings,
  Home,
  Mail,
  Columns3,
  ChevronDown,
  ChevronRight,
  Trash2,
  Edit2,
  Palette,
  LogOut,
  CheckCheck,
  BellOff,
  Bell,
  GripVertical,
} from "lucide-react";
import { evaluatePermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MotionButton, MotionDiv } from "@/components/ui/motion-elements";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import { useUIStore } from "@/stores/uiStore";
import { useUnreadDMsContext } from "@/hooks/useUnreadDMsContext";
import { useUnreadChannelsContext } from "@/hooks/useUnreadChannelsContext";
import { useDMStore } from "@/stores/dmStore";
import { useFriendStore } from "@/stores/friendStore";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragCancelEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import type { ServerWithMembership } from "@/types";
import { getServerInitials, getServerColor } from "@/lib/serverUtils";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface ServerFolder {
  id: string;
  name: string;
  color: string;
  isCollapsed: boolean;
  serverIds: string[];
}

interface ServerFolderState {
  folders: ServerFolder[];
  serverToFolder: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — hoisted out of render, zero per-frame allocation
// ─────────────────────────────────────────────────────────────────────────────

const SERVER_FOLDERS_STORAGE_KEY = "kloak-server-folders-v1";
const EMPTY_FOLDER_STATE: ServerFolderState = { folders: [], serverToFolder: {} };
const EMPTY_CHANNEL_IDS: string[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION VARIANTS — static objects, never re-created
// ─────────────────────────────────────────────────────────────────────────────

const pillTransition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 28,
  mass: 0.8,
};

const pillVariants = {
  hidden: { height: 0, opacity: 0, transition: { ...pillTransition, opacity: { duration: 0.15 } } },
  hover: { height: 20, opacity: 1, transition: pillTransition },
  unread: { height: 8, opacity: 1, transition: pillTransition },
  active: { height: 40, opacity: 1, transition: pillTransition },
};

const iconVariants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1, opacity: 1, borderRadius: 6 },
  hover: { borderRadius: 10 },
  tap: { scale: 0.95 },
  active: { scale: 1, borderRadius: 12 },
};

const serverItemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.05,
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
    },
  }),
};

const serverExitVariant = { opacity: 0, x: -20, transition: { duration: 0.15 } };

const iconSpringTransition = { type: "spring" as const, stiffness: 400, damping: 25 };

const badgeInitial = { scale: 0 };
const badgeAnimate = { scale: 1 };
const badgeExit = { scale: 0 };

const folderCollapseTransition = {
  height: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
  opacity: { duration: 0.14, ease: "easeOut" as const },
  y: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const },
};

const dmItemTransition = {
  opacity: { duration: 0.3, ease: "easeInOut" as const },
  height: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const },
  layout: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const },
};

const homeIconTransition = { duration: 0.15 };

// FIX #1: Static animation objects for the "Add Server" dashed border
// Previously these were inline object literals, re-created every render
const dashedBorderDefault = { strokeDashoffset: 0, opacity: 0.5 };
const dashedBorderHover = {
  strokeDashoffset: -10,
  opacity: 0,
  transition: {
    strokeDashoffset: { duration: 0.6, ease: "linear" as const },
    opacity: { duration: 0.2, delay: 0.4 },
  },
};
const solidBorderDefault = { opacity: 0 };
const solidBorderHover = { opacity: 1 };
const solidBorderTransition = { duration: 0.2 };

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

const getFolderDropId = (folderId: string) => `folder:${folderId}`;
const getServerDragId = (serverId: string) => `server:${serverId}`;

const createId = () => {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `folder-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const sanitizeFolder = (f: any): ServerFolder => ({
  id: f.id,
  name: String(f.name),
  color: typeof f.color === "string" ? f.color : "#6366f1",
  isCollapsed: Boolean(f.isCollapsed),
  serverIds: Array.isArray(f.serverIds) ? f.serverIds.filter((id: any) => typeof id === "string") : [],
});

// FIX #2: Shared sanitizer — was duplicated in loadServerFoldersState AND the DB loader useEffect
const sanitizeFolderState = (parsed: Partial<ServerFolderState>): ServerFolderState => {
  const folders = Array.isArray(parsed.folders) ? parsed.folders : [];
  const serverToFolder =
    parsed.serverToFolder && typeof parsed.serverToFolder === "object"
      ? (parsed.serverToFolder as Record<string, string>)
      : {};
  return {
    folders: folders
      .filter((f: any) => f && typeof f.id === "string" && typeof f.name === "string")
      .map(sanitizeFolder),
    serverToFolder,
  };
};

const loadServerFoldersState = (): ServerFolderState => {
  try {
    const raw = localStorage.getItem(SERVER_FOLDERS_STORAGE_KEY);
    if (!raw) return EMPTY_FOLDER_STATE;
    return sanitizeFolderState(JSON.parse(raw));
  } catch {
    return EMPTY_FOLDER_STATE;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS — memo'd to prevent cascade re-renders
// ─────────────────────────────────────────────────────────────────────────────

// FIX #3: memo() wrapping — ServerIconVisual was NOT memoized, causing every
// server icon to re-render on any sidebar state change (hover, drag, etc.)
const ServerIconVisual = memo(({ server }: { server: ServerWithMembership }) => {
  return (
    <div className="relative">
      <div
        className={cn(
          "w-12 h-12 overflow-hidden rounded-full flex items-center justify-center",
          !server.icon_url && getServerColor(server.name),
        )}
      >
        {server.icon_url ? (
          <Avatar className="w-12 h-12 border-0">
            <AvatarImage src={server.icon_url} alt={server.name} className="object-cover" />
            <AvatarFallback className={getServerColor(server.name)}>{getServerInitials(server.name)}</AvatarFallback>
          </Avatar>
        ) : (
          <span className="text-sm font-bold text-white">{getServerInitials(server.name)}</span>
        )}
      </div>
      {server.is_nsfw && (
        <span className="absolute -bottom-0.5 -right-0.5 px-1 py-px text-[8px] font-bold leading-none rounded bg-destructive text-destructive-foreground uppercase tracking-wide">
          18+
        </span>
      )}
    </div>
  );
});
ServerIconVisual.displayName = "ServerIconVisual";

// FIX #4: memo() wrapping for FolderItem — was re-rendering on every hover/drag
const FolderItem = memo(
  ({
    folder,
    tooltipsEnabled,
    onToggleCollapse,
    onRename,
    onChangeColor,
    onDelete,
  }: {
    folder: ServerFolder;
    tooltipsEnabled: boolean;
    onToggleCollapse: (folderId: string) => void;
    onRename: (folderId: string) => void;
    onChangeColor: (folderId: string) => void;
    onDelete: (folderId: string) => void;
  }) => {
    const { setNodeRef, isOver } = useDroppable({ id: getFolderDropId(folder.id) });

    // FIX #5: Stabilize callbacks that were inline arrow fns in JSX
    const handleToggle = useCallback(() => onToggleCollapse(folder.id), [folder.id, onToggleCollapse]);
    const handleRename = useCallback(
      (e: Event) => {
        e.preventDefault();
        onRename(folder.id);
      },
      [folder.id, onRename],
    );
    const handleChangeColor = useCallback(
      (e: Event) => {
        e.preventDefault();
        onChangeColor(folder.id);
      },
      [folder.id, onChangeColor],
    );
    const handleDelete = useCallback(
      (e: Event) => {
        e.preventDefault();
        onDelete(folder.id);
      },
      [folder.id, onDelete],
    );

    return (
      <ContextMenu>
        <Tooltip delayDuration={300} {...(tooltipsEnabled ? {} : { open: false })}>
          <ContextMenuTrigger asChild>
            <TooltipTrigger asChild>
              <MotionButton
                ref={setNodeRef}
                className={cn("relative group", isOver && "ring-1 ring-primary/50 rounded-[6px]")}
                onClick={handleToggle}
                whileHover="hover"
                whileTap="tap"
              >
                <motion.div
                  variants={iconVariants}
                  initial="animate"
                  animate="animate"
                  whileHover="hover"
                  whileTap="tap"
                  transition={iconSpringTransition}
                  className="w-12 h-12 flex items-center justify-center text-white relative"
                  style={{ backgroundColor: folder.color }}
                >
                  <Folder className="w-5 h-5" />
                  <span className="absolute top-1 right-1 text-white/90">
                    {folder.isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </span>
                </motion.div>
              </MotionButton>
            </TooltipTrigger>
          </ContextMenuTrigger>
          <TooltipContent side="right" className="font-medium">
            {folder.name}
          </TooltipContent>
        </Tooltip>

        <ContextMenuContent className="w-52">
          <ContextMenuItem onSelect={handleRename}>
            <Edit2 className="w-4 h-4" />
            Rename folder
          </ContextMenuItem>
          <ContextMenuItem onSelect={handleChangeColor}>
            <Palette className="w-4 h-4" />
            Change color
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={handleDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="w-4 h-4" />
            Delete folder
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  },
);
FolderItem.displayName = "FolderItem";

// FIX #6: DraggableServerItem — wrap in memo to prevent re-render on sibling hover.
// FIX #7: Remove `useAuthStore.getState()` call from render body — was creating a
// hidden subscription / causing re-reads on every render. Pass `isOwner` as a prop instead.
const DraggableServerItem = memo(
  forwardRef<
    HTMLDivElement,
    {
      server: ServerWithMembership;
      index: number;
      isActive: boolean;
      isHovered: boolean;
      hasUnread: boolean;
      totalMentions: number;
      tooltipsEnabled: boolean;
      isOwner: boolean; // FIX #7: moved from internal getState() call to prop
      pillState: string; // FIX #8: pre-computed pill state instead of passing getPillState fn
      onHover: () => void;
      onLeave: () => void;
      onClick: () => void;
      onLeaveServer?: (serverId: string) => void;
      onOpenSettings?: () => void;
      onMarkAsRead?: () => void;
      onToggleMute?: () => void;
    }
  >(
    (
      {
        server,
        index,
        isActive,
        isHovered,
        hasUnread,
        totalMentions,
        tooltipsEnabled,
        isOwner,
        pillState,
        onHover,
        onLeave,
        onClick,
        onLeaveServer,
        onOpenSettings,
        onMarkAsRead,
        onToggleMute,
      },
      ref,
    ) => {
      const {
        attributes,
        listeners,
        setNodeRef: setDragRef,
        transform,
        isDragging,
      } = useDraggable({
        id: getServerDragId(server.id),
      });
      const { setNodeRef: setDropRef } = useDroppable({
        id: getServerDragId(server.id),
      });

      const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
      const canManageServer = isOwner;

      // FIX #9: Stabilize ref merger — previously created a new function every render
      const mergedRef = useCallback(
        (node: HTMLDivElement | null) => {
          setDragRef(node);
          setDropRef(node);
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        },
        [setDragRef, setDropRef, ref],
      );

      // FIX #10: Stabilize context menu callbacks
      const handleMarkAsRead = useCallback(
        (e: Event) => {
          e.preventDefault();
          onMarkAsRead?.();
        },
        [onMarkAsRead],
      );
      const handleToggleMute = useCallback(
        (e: Event) => {
          e.preventDefault();
          onToggleMute?.();
        },
        [onToggleMute],
      );
      const handleOpenSettings = useCallback(
        (e: Event) => {
          e.preventDefault();
          onOpenSettings?.();
        },
        [onOpenSettings],
      );
      const handleLeaveServer = useCallback(
        (e: Event) => {
          e.preventDefault();
          if (window.confirm(`Are you sure you want to leave "${server.name}"?`)) {
            onLeaveServer?.(server.id);
          }
        },
        [onLeaveServer, server.id, server.name],
      );

      return (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <motion.div
              ref={mergedRef}
              style={style}
              custom={index}
              variants={serverItemVariants}
              initial="hidden"
              animate="visible"
              exit={serverExitVariant}
              layout
            >
              <Tooltip delayDuration={300} {...(tooltipsEnabled ? {} : { open: false })}>
                <TooltipTrigger asChild>
                  <MotionButton
                    className={cn("relative group", isDragging && "opacity-40")}
                    onMouseEnter={onHover}
                    onMouseLeave={onLeave}
                    onClick={onClick}
                    whileHover="hover"
                    whileTap="tap"
                    {...attributes}
                    {...listeners}
                  >
                    {/* Indicator pill */}
                    <motion.span
                      className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 bg-foreground rounded-r-full"
                      variants={pillVariants}
                      initial="hidden"
                      animate={pillState}
                    />

                    <motion.div
                      variants={iconVariants}
                      initial="animate"
                      animate={isActive ? "active" : "animate"}
                      whileHover="hover"
                      whileTap="tap"
                      transition={iconSpringTransition}
                      className={cn(
                        "w-12 h-12 overflow-hidden rounded-full",
                        isActive && !server.icon_url && "ring-2 ring-white/15",
                        !server.icon_url && getServerColor(server.name),
                        server.icon_url && "border-0",
                      )}
                    >
                      {server.icon_url ? (
                        <Avatar className="w-12 h-12 border-0">
                          <AvatarImage src={server.icon_url} alt={server.name} className="object-cover" />
                          <AvatarFallback className={getServerColor(server.name)}>
                            {getServerInitials(server.name)}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-sm font-bold text-white">{getServerInitials(server.name)}</span>
                        </div>
                      )}
                    </motion.div>

                    {/* Mention badge */}
                    <AnimatePresence>
                      {totalMentions > 0 && (
                        <motion.span
                          initial={badgeInitial}
                          animate={badgeAnimate}
                          exit={badgeExit}
                          className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] bg-destructive rounded-[4px] text-xs text-destructive-foreground flex items-center justify-center px-1 font-bold shadow-lg"
                        >
                          {totalMentions > 99 ? "99+" : totalMentions}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </MotionButton>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {server.name}
                </TooltipContent>
              </Tooltip>
            </motion.div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={handleMarkAsRead}>
              <CheckCheck className="w-4 h-4" />
              Mark as Read
            </ContextMenuItem>
            <ContextMenuItem onSelect={handleToggleMute}>
              {server.is_muted ? (
                <>
                  <Bell className="w-4 h-4" />
                  Unmute Server
                </>
              ) : (
                <>
                  <BellOff className="w-4 h-4" />
                  Mute Server
                </>
              )}
            </ContextMenuItem>
            {canManageServer && onOpenSettings && (
              <ContextMenuItem onSelect={handleOpenSettings}>
                <Settings className="w-4 h-4" />
                Server Settings
              </ContextMenuItem>
            )}
            {!isOwner && onLeaveServer && (
              <ContextMenuItem onSelect={handleLeaveServer} className="text-destructive focus:text-destructive">
                <LogOut className="w-4 h-4" />
                Leave Server
              </ContextMenuItem>
            )}
          </ContextMenuContent>
        </ContextMenu>
      );
    },
  ),
);
DraggableServerItem.displayName = "DraggableServerItem";

// FIX #11: Memoize the unread DM shortcut items — they were fully inline, re-created every render
const UnreadDMShortcut = memo(
  ({ conv, tooltipsEnabled, onSelect }: { conv: any; tooltipsEnabled: boolean; onSelect: (conv: any) => void }) => {
    const { user } = useAuthStore();
    const { getUnreadCount } = useUnreadDMsContext();
    const unreadCount = getUnreadCount(conv.id);
    const isGroup = conv.is_group;
    const otherUser = conv.other_user;
    const displayName = isGroup ? conv.name || "Group Chat" : otherUser?.display_name || otherUser?.username || "User";
    const avatarUrl = isGroup ? null : otherUser?.avatar_url;
    const initials = isGroup ? conv.name?.[0] || "G" : otherUser?.display_name?.[0] || otherUser?.username?.[0] || "?";

    const handleClick = useCallback(() => onSelect(conv), [conv, onSelect]);

    return (
      <motion.div
        key={conv.id}
        layout
        initial={{ opacity: 0, height: 0, marginTop: 0 }}
        animate={{ opacity: 1, height: "auto", marginTop: 0 }}
        exit={{ opacity: 0, height: 0, marginTop: 0 }}
        transition={dmItemTransition}
        style={{ overflow: "hidden" }}
      >
        <Tooltip delayDuration={300} {...(tooltipsEnabled ? {} : { open: false })}>
          <TooltipTrigger asChild>
            <button className="relative group" onClick={handleClick}>
              <motion.div
                className={cn(
                  "w-12 h-12 rounded-[16px] flex items-center justify-center overflow-hidden transition-all duration-200",
                  "bg-secondary/80 hover:bg-secondary hover:rounded-[12px]",
                )}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isGroup ? (
                  <div className="flex items-center justify-center w-full h-full">
                    <span className="text-sm font-semibold text-foreground/80">{initials}</span>
                  </div>
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-semibold text-foreground/80">{initials}</span>
                )}
              </motion.div>

              <motion.span
                initial={badgeInitial}
                animate={badgeAnimate}
                className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] bg-destructive rounded-[4px] text-xs text-destructive-foreground flex items-center justify-center px-1 font-bold shadow-lg"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </motion.span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {displayName} ({unreadCount} unread)
          </TooltipContent>
        </Tooltip>
      </motion.div>
    );
  },
);
UnreadDMShortcut.displayName = "UnreadDMShortcut";

// FIX #12: Extract the loading skeleton into a static component — it was animating
// with inline transition objects that got re-created. Also memo it since it never changes.
const LoadingSkeleton = memo(() => (
  <div className="space-y-2">
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        className="w-12 h-12 rounded-[6px] bg-secondary/50"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
      />
    ))}
  </div>
));
LoadingSkeleton.displayName = "LoadingSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const ServerSidebar = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // FIX #13: Use individual selectors from Zustand stores instead of destructuring
  // the whole return. Destructuring `useServerStore()` subscribes to the ENTIRE store
  // — every field change triggers a re-render of this 1500-line component.
  const servers = useServerStore((s) => s.servers);
  const currentServer = useServerStore((s) => s.currentServer);
  const setCurrentServer = useServerStore((s) => s.setCurrentServer);
  const isLoading = useServerStore((s) => s.isLoading);
  const fetchServers = useServerStore((s) => s.fetchServers);
  const leaveServer = useServerStore((s) => s.leaveServer);
  const toggleServerMute = useServerStore((s) => s.toggleServerMute);

  const setCurrentConversation = useDMStore((s) => s.setCurrentConversation);
  const conversations = useDMStore((s) => s.conversations);

  const openModal = useUIStore((s) => s.openModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const closeServerSettings = useUIStore((s) => s.closeServerSettings);
  const openServerSettings = useUIStore((s) => s.openServerSettings);

  const { serverChannels, getServerUnreadInfo, markServerAsRead } = useUnreadChannelsContext();
  const {
    totalUnread: totalDMUnread,
    hasUnread: hasDMUnread,
    unreadState,
    markAsRead,
    getUnreadCount,
  } = useUnreadDMsContext();

  const [hoveredServer, setHoveredServer] = useState<string | null>(null);
  const [tooltipsEnabled, setTooltipsEnabled] = useState(false);
  const [folderState, setFolderState] = useState<ServerFolderState>(loadServerFoldersState);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("#6366f1");
  const [isRenameFolderOpen, setIsRenameFolderOpen] = useState(false);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderName, setRenameFolderName] = useState("");
  const [isChangeFolderColorOpen, setIsChangeFolderColorOpen] = useState(false);
  const [changingColorFolderId, setChangingColorFolderId] = useState<string | null>(null);
  const [changeFolderColor, setChangeFolderColor] = useState("#6366f1");
  const [activeDragServerId, setActiveDragServerId] = useState<string | null>(null);
  const [isFolderStateLoaded, setIsFolderStateLoaded] = useState(false);
  const [orderedServerIds, setOrderedServerIds] = useState<string[]>([]);

  const pendingFriendCount = useFriendStore((s) => s.pendingRequests.length);
  const totalHomeBadge = totalDMUnread + pendingFriendCount;
  const hasHomeUnread = hasDMUnread || pendingFriendCount > 0;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { setNodeRef: setRootDroppableRef, isOver: isOverRoot } = useDroppable({ id: "root" });

  // ── Tooltip delay ──
  useEffect(() => {
    const timer = setTimeout(() => setTooltipsEnabled(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // ── Fetch servers ──
  useEffect(() => {
    if (user?.id) fetchServers(user.id);
  }, [user?.id, fetchServers]);

  // ── Load folder state from DB ──
  useEffect(() => {
    if (!user?.id || isFolderStateLoaded) return;

    const loadFromDatabase = async () => {
      try {
        const { data, error } = await supabase.rpc("get_user_server_folders" as any, {
          _user_id: user.id,
        });

        if (error) {
          console.error("Failed to load folder state from database:", error);
          setIsFolderStateLoaded(true);
          return;
        }

        if (data && typeof data === "object") {
          const sanitized = sanitizeFolderState(data as Partial<ServerFolderState>);
          setFolderState(sanitized);
          try {
            localStorage.setItem(SERVER_FOLDERS_STORAGE_KEY, JSON.stringify(sanitized));
          } catch {
            /* ignore */
          }
        }

        setIsFolderStateLoaded(true);
      } catch (err) {
        console.error("Error loading folder state:", err);
        setIsFolderStateLoaded(true);
      }
    };

    loadFromDatabase();
  }, [user?.id, isFolderStateLoaded]);

  // FIX #14: Persist folder state — use a ref to avoid re-creating the debounce
  // timeout on every folderState change (the cleanup was doing this correctly,
  // but the dependency on `user?.id` and `isFolderStateLoaded` caused the effect
  // to re-fire unnecessarily)
  const folderStateRef = useRef(folderState);
  folderStateRef.current = folderState;

  useEffect(() => {
    if (!isFolderStateLoaded || !user?.id) return;

    try {
      localStorage.setItem(SERVER_FOLDERS_STORAGE_KEY, JSON.stringify(folderState));
    } catch {
      /* ignore */
    }

    const timeoutId = setTimeout(async () => {
      try {
        const { error } = await supabase.rpc("save_user_server_folders" as any, {
          _user_id: user.id,
          _folder_data: folderStateRef.current,
        });
        if (error) console.error("Failed to save folder state to database:", error);
      } catch (err) {
        console.error("Error saving folder state:", err);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [folderState, user?.id, isFolderStateLoaded]);

  // ── Clean up folder mappings when servers list changes ──
  useEffect(() => {
    if (servers.length === 0) return;

    setFolderState((prev) => {
      const serverIdSet = new Set(servers.map((s) => s.id));
      const folderIdSet = new Set(prev.folders.map((f) => f.id));

      let changed = false;
      const nextServerToFolder: Record<string, string> = {};
      for (const [serverId, folderId] of Object.entries(prev.serverToFolder)) {
        if (serverIdSet.has(serverId) && folderIdSet.has(folderId)) {
          nextServerToFolder[serverId] = folderId;
        } else {
          changed = true;
        }
      }

      const nextFolders = prev.folders.map((f) => {
        const nextIds = f.serverIds.filter((id) => serverIdSet.has(id) && nextServerToFolder[id] === f.id);
        if (nextIds.length !== f.serverIds.length) changed = true;
        return nextIds.length === f.serverIds.length ? f : { ...f, serverIds: nextIds };
      });

      if (!changed) return prev;
      return { folders: nextFolders, serverToFolder: nextServerToFolder };
    });
  }, [servers]);

  // ── Unread DM conversations ──
  const unreadConversations = useMemo(() => {
    return conversations
      .filter((conv) => getUnreadCount(conv.id) > 0)
      .sort((a, b) => getUnreadCount(b.id) - getUnreadCount(a.id))
      .slice(0, 5);
  }, [conversations, unreadState, getUnreadCount]);

  // FIX #15: getPillState was recreated every render because it closes over
  // `hoveredServer` and `currentServer`. Memoize it with useMemo so child
  // components receiving `pillState` as a string prop can properly skip re-renders.
  // We now compute pill states per-server in the render maps below instead.

  // ── Folder actions (all stable via useCallback) ──
  const toggleFolderCollapse = useCallback((folderId: string) => {
    setFolderState((prev) => ({
      ...prev,
      folders: prev.folders.map((f) => (f.id === folderId ? { ...f, isCollapsed: !f.isCollapsed } : f)),
    }));
  }, []);

  const deleteFolder = useCallback((folderId: string) => {
    setFolderState((prev) => {
      const folder = prev.folders.find((f) => f.id === folderId);
      if (!folder) return prev;
      const nextMap = { ...prev.serverToFolder };
      folder.serverIds.forEach((sid) => {
        if (nextMap[sid] === folderId) delete nextMap[sid];
      });
      return {
        folders: prev.folders.filter((f) => f.id !== folderId),
        serverToFolder: nextMap,
      };
    });
  }, []);

  const openRenameFolder = useCallback(
    (folderId: string) => {
      const folder = folderState.folders.find((f) => f.id === folderId);
      if (folder) {
        setRenamingFolderId(folderId);
        setRenameFolderName(folder.name);
        setIsRenameFolderOpen(true);
      }
    },
    [folderState.folders],
  );

  const handleRenameFolder = useCallback(() => {
    const name = renameFolderName.trim();
    if (!name || !renamingFolderId) return;
    setFolderState((prev) => ({
      ...prev,
      folders: prev.folders.map((f) => (f.id === renamingFolderId ? { ...f, name } : f)),
    }));
    setIsRenameFolderOpen(false);
    setRenamingFolderId(null);
    setRenameFolderName("");
  }, [renameFolderName, renamingFolderId]);

  const openChangeColor = useCallback(
    (folderId: string) => {
      const folder = folderState.folders.find((f) => f.id === folderId);
      if (folder) {
        setChangingColorFolderId(folderId);
        setChangeFolderColor(folder.color);
        setIsChangeFolderColorOpen(true);
      }
    },
    [folderState.folders],
  );

  const handleChangeColor = useCallback(() => {
    if (!changingColorFolderId) return;
    setFolderState((prev) => ({
      ...prev,
      folders: prev.folders.map((f) => (f.id === changingColorFolderId ? { ...f, color: changeFolderColor } : f)),
    }));
    setIsChangeFolderColorOpen(false);
    setChangingColorFolderId(null);
  }, [changeFolderColor, changingColorFolderId]);

  const moveServerToFolder = useCallback((serverId: string, folderId: string | null) => {
    setFolderState((prev) => {
      const currentFolderId = prev.serverToFolder[serverId];
      if (folderId === currentFolderId) return prev;

      const nextServerToFolder = { ...prev.serverToFolder };
      const nextFolders = prev.folders.map((f) => {
        if (f.id === currentFolderId) {
          return { ...f, serverIds: f.serverIds.filter((id) => id !== serverId) };
        }
        if (folderId && f.id === folderId) {
          const nextIds = f.serverIds.includes(serverId) ? f.serverIds : [...f.serverIds, serverId];
          return { ...f, serverIds: nextIds };
        }
        return f;
      });

      if (folderId) nextServerToFolder[serverId] = folderId;
      else delete nextServerToFolder[serverId];

      return { folders: nextFolders, serverToFolder: nextServerToFolder };
    });
  }, []);

  const handleCreateFolder = useCallback(() => {
    const name = newFolderName.trim();
    if (!name) return;
    const id = createId();
    setFolderState((prev) => ({
      ...prev,
      folders: [...prev.folders, { id, name, color: newFolderColor || "#6366f1", isCollapsed: false, serverIds: [] }],
    }));
    setNewFolderName("");
    setNewFolderColor("#6366f1");
    setIsCreateFolderOpen(false);
  }, [newFolderColor, newFolderName]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const activeId = String(event.active.id);
    if (activeId.startsWith("server:")) {
      setActiveDragServerId(activeId.slice("server:".length));
    }
  }, []);

  const handleDragCancel = useCallback((_event: DragCancelEvent) => {
    setActiveDragServerId(null);
  }, []);

  // ── Server ordering ──
  useEffect(() => {
    if (servers.length === 0) {
      setOrderedServerIds([]);
      return;
    }
    const sorted = [...servers].sort((a, b) => {
      const posA = (a as any).position ?? Infinity;
      const posB = (b as any).position ?? Infinity;
      if (posA === posB) return 0;
      return posA - posB;
    });
    const sortedIds = sorted.map((s) => s.id);
    setOrderedServerIds((prev) => {
      if (prev.length === 0) return sortedIds;
      const sortedSet = new Set(sortedIds);
      const kept = prev.filter((id) => sortedSet.has(id));
      const missing = sortedIds.filter((id) => !kept.includes(id));
      return [...kept, ...missing];
    });
  }, [servers]);

  const saveServerOrder = useCallback(
    async (newOrderIds: string[]) => {
      if (!user?.id) return;
      try {
        await supabase.rpc("reorder_user_servers" as any, {
          _user_id: user.id,
          _server_ids: newOrderIds,
        });
      } catch (err) {
        console.error("Failed to save server order:", err);
      }
    },
    [user?.id],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeId = String(event.active.id);
      const overId = event.over?.id ? String(event.over.id) : null;

      if (!activeId.startsWith("server:")) {
        setActiveDragServerId(null);
        return;
      }

      const serverId = activeId.slice("server:".length);

      if (!overId) {
        setActiveDragServerId(null);
        return;
      }

      if (overId === "root") {
        moveServerToFolder(serverId, null);
        setOrderedServerIds((prev) => {
          if (prev.includes(serverId)) return prev;
          const next = [...prev, serverId];
          saveServerOrder(next);
          return next;
        });
      } else if (overId.startsWith("folder:")) {
        const folderId = overId.slice("folder:".length);
        moveServerToFolder(serverId, folderId);
      } else if (overId.startsWith("server:")) {
        const overServerId = overId.slice("server:".length);
        if (serverId !== overServerId) {
          const overServerFolderId = folderState.serverToFolder[overServerId] ?? null;

          if (overServerFolderId) {
            moveServerToFolder(serverId, overServerFolderId);
            setFolderState((prev) => ({
              ...prev,
              folders: prev.folders.map((f) => {
                if (f.id !== overServerFolderId) return f;
                const withoutMoved = f.serverIds.filter((id) => id !== serverId);
                const insertAt = withoutMoved.indexOf(overServerId);
                if (insertAt === -1) return { ...f, serverIds: [...withoutMoved, serverId] };
                return {
                  ...f,
                  serverIds: [...withoutMoved.slice(0, insertAt), serverId, ...withoutMoved.slice(insertAt)],
                };
              }),
            }));
          } else {
            moveServerToFolder(serverId, null);
            setOrderedServerIds((prev) => {
              const next = [...prev];
              if (!next.includes(serverId)) next.push(serverId);
              const fromIndex = next.indexOf(serverId);
              const toIndex = next.indexOf(overServerId);
              if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return next;
              const [moved] = next.splice(fromIndex, 1);
              next.splice(toIndex, 0, moved);
              saveServerOrder(next);
              return next;
            });
          }
        }
      }

      setActiveDragServerId(null);
    },
    [folderState.serverToFolder, moveServerToFolder, saveServerOrder],
  );

  // ── Derived data (memoized) ──
  const folderById = useMemo(() => new Map(folderState.folders.map((f) => [f.id, f])), [folderState.folders]);

  const rootServers = useMemo(() => {
    const notInFolder = servers.filter((s) => !folderById.has(folderState.serverToFolder[s.id] || ""));
    const serversMap = new Map(notInFolder.map((s) => [s.id, s]));
    const ordered: ServerWithMembership[] = [];
    for (const id of orderedServerIds) {
      const server = serversMap.get(id);
      if (server) ordered.push(server);
    }
    for (const server of notInFolder) {
      if (!orderedServerIds.includes(server.id)) {
        ordered.push(server);
      }
    }
    return ordered;
  }, [servers, folderState.serverToFolder, folderById, orderedServerIds]);

  const serversById = useMemo(() => new Map(servers.map((s) => [s.id, s])), [servers]);

  const foldersWithServers = useMemo(() => {
    return folderState.folders.map((folder) => {
      const ordered = folder.serverIds
        .map((id) => serversById.get(id))
        .filter((s): s is ServerWithMembership => Boolean(s));
      return { folder, servers: ordered };
    });
  }, [folderState.folders, folderState.serverToFolder, serversById]);

  const activeDragServer = useMemo(
    () => (activeDragServerId ? serversById.get(activeDragServerId) : undefined),
    [activeDragServerId, serversById],
  );

  // FIX #16: Stabilize callbacks passed into server item maps — these were inline
  // arrow functions creating new references every render, defeating memo() on children.
  const handleHomeClick = useCallback(() => {
    setCurrentServer(null);
    setCurrentConversation(null);
    closeServerSettings();
    closeModal();
    navigate("/app");
  }, [setCurrentServer, setCurrentConversation, closeServerSettings, closeModal, navigate]);

  const handleHomeHover = useCallback(() => setHoveredServer("home"), []);
  const handleHoverLeave = useCallback(() => setHoveredServer(null), []);

  const handleDMSelect = useCallback(
    (conv: any) => {
      setCurrentServer(null);
      setCurrentConversation(conv);
      closeServerSettings();
      closeModal();
      navigate("/app");
      markAsRead(conv.id);
    },
    [setCurrentServer, setCurrentConversation, closeServerSettings, closeModal, navigate, markAsRead],
  );

  const handleAddServer = useCallback(() => openModal("create-server"), [openModal]);

  const handleCreateFolderCtx = useCallback((e: Event) => {
    e.preventDefault();
    setIsCreateFolderOpen(true);
    setNewFolderName("");
  }, []);

  // FIX #17: Pre-compute pill state for the home button
  const homePillState = useMemo(() => {
    if (currentServer === null) return "active";
    if (hoveredServer === "home") return "hover";
    if (hasHomeUnread) return "unread";
    return "hidden";
  }, [currentServer, hoveredServer, hasHomeUnread]);

  // FIX #18: Helper to compute pill state for a server (called in render map)
  const computePillState = useCallback(
    (serverId: string, hasUnread: boolean) => {
      const isActive = currentServer?.id === serverId;
      if (isActive) return "active";
      if (hoveredServer === serverId) return "hover";
      if (hasUnread) return "unread";
      return "hidden";
    },
    [currentServer?.id, hoveredServer],
  );

  // FIX #19: Stabilize per-server click/hover handlers using a factory pattern
  // with useCallback + server id. This avoids creating N new arrow functions per render.
  const serverClickHandlers = useRef(new Map<string, () => void>());
  const serverHoverHandlers = useRef(new Map<string, () => void>());
  const serverLeaveHandlers = useRef(new Map<string, () => void>());
  const serverSettingsHandlers = useRef(new Map<string, () => void>());
  const serverMarkReadHandlers = useRef(new Map<string, () => void>());
  const serverMuteHandlers = useRef(new Map<string, () => void>());
  const serverLeaveServerHandlers = useRef(new Map<string, (serverId: string) => void>());

  // Clear stale refs when servers change
  useEffect(() => {
    const validIds = new Set(servers.map((s) => s.id));
    for (const map of [
      serverClickHandlers.current,
      serverHoverHandlers.current,
      serverLeaveHandlers.current,
      serverSettingsHandlers.current,
      serverMarkReadHandlers.current,
      serverMuteHandlers.current,
      serverLeaveServerHandlers.current,
    ]) {
      for (const key of map.keys()) {
        if (!validIds.has(key)) map.delete(key);
      }
    }
  }, [servers]);

  const getServerClickHandler = useCallback(
    (server: ServerWithMembership) => {
      let handler = serverClickHandlers.current.get(server.id);
      if (!handler) {
        handler = () => {
          setCurrentServer(server);
          setCurrentConversation(null);
          closeServerSettings();
          closeModal();
          navigate(`/app/servers/${server.id}`);
        };
        serverClickHandlers.current.set(server.id, handler);
      }
      return handler;
    },
    [setCurrentServer, setCurrentConversation, closeServerSettings, closeModal, navigate],
  );

  const getServerHoverHandler = useCallback((serverId: string) => {
    let handler = serverHoverHandlers.current.get(serverId);
    if (!handler) {
      handler = () => setHoveredServer(serverId);
      serverHoverHandlers.current.set(serverId, handler);
    }
    return handler;
  }, []);

  const getServerLeaveHandler = useCallback(() => handleHoverLeave, [handleHoverLeave]);

  const getServerSettingsHandler = useCallback(
    (server: ServerWithMembership) => {
      let handler = serverSettingsHandlers.current.get(server.id);
      if (!handler) {
        handler = () => {
          setCurrentServer(server);
          openServerSettings();
        };
        serverSettingsHandlers.current.set(server.id, handler);
      }
      return handler;
    },
    [setCurrentServer, openServerSettings],
  );

  const getServerMarkReadHandler = useCallback(
    (channelIds: string[]) => {
      if (channelIds.length === 0) return undefined;
      return () => markServerAsRead(channelIds);
    },
    [markServerAsRead],
  );

  const getServerMuteHandler = useCallback(
    (serverId: string) => {
      let handler = serverMuteHandlers.current.get(serverId);
      if (!handler) {
        handler = () => {
          if (user?.id) toggleServerMute(serverId, user.id);
        };
        serverMuteHandlers.current.set(serverId, handler);
      }
      return handler;
    },
    [user?.id, toggleServerMute],
  );

  const getServerLeaveServerHandler = useCallback(() => {
    return async (serverId: string) => {
      if (user?.id) {
        try {
          await leaveServer(serverId, user.id);
          if (currentServer?.id === serverId) navigate("/app");
        } catch (error) {
          console.error("Failed to leave server:", error);
        }
      }
    };
  }, [user?.id, leaveServer, currentServer?.id, navigate]);

  // ── Render helper for server items (used in both folder + root lists) ──
  const renderServerItem = useCallback(
    (server: ServerWithMembership, index: number) => {
      const isActive = currentServer?.id === server.id;
      const channelIds = serverChannels[server.id] || EMPTY_CHANNEL_IDS;
      const { hasUnread, totalMentions } = getServerUnreadInfo(channelIds);
      const isOwner = server.owner_id === user?.id;

      return (
        <DraggableServerItem
          key={server.id}
          server={server}
          index={index}
          isActive={isActive}
          isHovered={hoveredServer === server.id}
          hasUnread={hasUnread}
          totalMentions={totalMentions}
          tooltipsEnabled={tooltipsEnabled}
          isOwner={isOwner}
          pillState={computePillState(server.id, hasUnread)}
          onHover={getServerHoverHandler(server.id)}
          onLeave={handleHoverLeave}
          onClick={getServerClickHandler(server)}
          onLeaveServer={getServerLeaveServerHandler()}
          onOpenSettings={getServerSettingsHandler(server)}
          onMarkAsRead={getServerMarkReadHandler(channelIds)}
          onToggleMute={getServerMuteHandler(server.id)}
        />
      );
    },
    [
      currentServer?.id,
      serverChannels,
      getServerUnreadInfo,
      user?.id,
      hoveredServer,
      tooltipsEnabled,
      computePillState,
      getServerHoverHandler,
      handleHoverLeave,
      getServerClickHandler,
      getServerLeaveServerHandler,
      getServerSettingsHandler,
      getServerMarkReadHandler,
      getServerMuteHandler,
    ],
  );

  return (
    <div className="h-full w-[72px] shrink-0 flex flex-col items-center relative overflow-hidden bg-layout-sidebar">
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              ref={setRootDroppableRef}
              className={cn(
                "flex-1 flex flex-col items-center gap-3 overflow-y-auto scrollbar-overlay scrollbar-hide w-full px-2 pt-0 pb-24",
                isOverRoot && "outline outline-2 outline-primary/30 outline-offset-[-2px] rounded-md",
              )}
            >
              {/* Loading skeleton */}
              {isLoading && servers.length === 0 && <LoadingSkeleton />}

              {/* Home / Direct Messages button */}
              <Tooltip delayDuration={300} {...(tooltipsEnabled ? {} : { open: false })}>
                <TooltipTrigger asChild>
                  <MotionButton
                    className="relative group mb-1"
                    onMouseEnter={handleHomeHover}
                    onMouseLeave={handleHoverLeave}
                    onClick={handleHomeClick}
                    whileHover="hover"
                    whileTap="tap"
                  >
                    <motion.span
                      className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 bg-foreground rounded-r-full"
                      variants={pillVariants}
                      initial="hidden"
                      animate={homePillState}
                    />

                    <motion.div
                      variants={iconVariants}
                      initial="animate"
                      animate={currentServer === null ? "active" : "animate"}
                      whileHover="hover"
                      whileTap="tap"
                      transition={iconSpringTransition}
                      className={cn(
                        "w-12 h-12 flex items-center justify-center rounded-full",
                        currentServer === null
                          ? "bg-secondary text-foreground"
                          : "bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {currentServer === null ? (
                          <motion.span
                            key="active-icon"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={homeIconTransition}
                          >
                            <Home className="w-5 h-5" />
                          </motion.span>
                        ) : (
                          <motion.span
                            key="inactive-icon"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={homeIconTransition}
                          >
                            <Mail className="w-5 h-5" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.div>

                    <AnimatePresence>
                      {totalHomeBadge > 0 && currentServer !== null && (
                        <motion.span
                          initial={badgeInitial}
                          animate={badgeAnimate}
                          exit={badgeExit}
                          className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] bg-destructive rounded-[4px] text-xs text-destructive-foreground flex items-center justify-center px-1 font-bold shadow-lg"
                        >
                          {totalHomeBadge > 99 ? "99+" : totalHomeBadge}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </MotionButton>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  Home{totalHomeBadge > 0 ? ` (${totalHomeBadge} unread)` : ""}
                </TooltipContent>
              </Tooltip>

              {/* Unread DM conversation shortcuts */}
              <AnimatePresence mode="popLayout">
                {unreadConversations.map((conv) => (
                  <UnreadDMShortcut
                    key={conv.id}
                    conv={conv}
                    tooltipsEnabled={tooltipsEnabled}
                    onSelect={handleDMSelect}
                  />
                ))}
              </AnimatePresence>

              {/* Separator */}
              <div className="w-8 h-px bg-foreground/10 mb-1 shrink-0" />

              {/* Folder items + servers */}
              <AnimatePresence>
                {foldersWithServers.map(({ folder, servers: folderServers }) => (
                  <div key={folder.id} className="w-full flex flex-col items-center gap-2">
                    <FolderItem
                      folder={folder}
                      tooltipsEnabled={tooltipsEnabled}
                      onToggleCollapse={toggleFolderCollapse}
                      onRename={openRenameFolder}
                      onChangeColor={openChangeColor}
                      onDelete={deleteFolder}
                    />

                    <motion.div
                      layout
                      initial={false}
                      animate={
                        folder.isCollapsed ? { height: 0, opacity: 0, y: -8 } : { height: "auto", opacity: 1, y: 0 }
                      }
                      transition={folderCollapseTransition}
                      className={cn("w-full overflow-hidden", folder.isCollapsed && "pointer-events-none")}
                    >
                      <div className="w-full flex flex-col items-center gap-2 pt-2">
                        {folderServers.map((server, index) => renderServerItem(server, index))}
                      </div>
                    </motion.div>
                  </div>
                ))}

                {rootServers.map((server, index) => renderServerItem(server, index))}
              </AnimatePresence>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={handleCreateFolderCtx}>
              <FolderPlus className="w-4 h-4" />
              Create folder…
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem disabled className="text-muted-foreground">
              <GripVertical className="w-4 h-4" />
              Drag servers onto a folder to organize
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        <DragOverlay>{activeDragServer ? <ServerIconVisual server={activeDragServer} /> : null}</DragOverlay>
      </DndContext>

      {/* Sticky Add Server button at bottom */}
      <div className="absolute bottom-0 left-0 right-0 pl-3 pr-2 pb-3 pt-2 bg-layout-sidebar z-10">
        <div className="w-8 h-0.5 bg-border rounded-full shrink-0 mx-auto mb-2" />
        <div className="flex justify-center">
          <Tooltip delayDuration={300} {...(tooltipsEnabled ? {} : { open: false })}>
            <TooltipTrigger asChild>
              <MotionButton
                whileTap={{ scale: 0.95 }}
                whileHover="hover"
                initial="default"
                onClick={handleAddServer}
                className="relative w-12 h-12 rounded-[6px] text-muted-foreground hover:text-foreground transition-colors duration-200 flex items-center justify-center overflow-hidden"
              >
                <motion.svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 48 48">
                  <motion.rect
                    x="1"
                    y="1"
                    width="46"
                    height="46"
                    rx="5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                    variants={{ default: dashedBorderDefault, hover: dashedBorderHover }}
                  />
                </motion.svg>

                <motion.div
                  className="absolute inset-0 rounded-[6px] border border-muted-foreground/50 pointer-events-none"
                  variants={{ default: solidBorderDefault, hover: solidBorderHover }}
                  transition={solidBorderTransition}
                />

                <Plus className="w-5 h-5 relative z-10" />
              </MotionButton>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              Add or Join a Server
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ── DIALOGS (unchanged logic, just cleaner) ── */}
      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create folder</DialogTitle>
            <DialogDescription>Choose a name and color for your server folder.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-2">
              <Label htmlFor="kloak-folder-name">Name</Label>
              <Input
                id="kloak-folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. Work, Friends, Gaming"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kloak-folder-color">Color</Label>
              <Input
                id="kloak-folder-color"
                type="color"
                value={newFolderColor}
                onChange={(e) => setNewFolderColor(e.target.value)}
                className="h-10 w-14 p-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" rounded="xl" onClick={() => setIsCreateFolderOpen(false)}>
              Cancel
            </Button>
            <Button rounded="xl" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRenameFolderOpen} onOpenChange={setIsRenameFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
            <DialogDescription>Enter a new name for this folder.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="kloak-rename-folder">Folder name</Label>
            <Input
              id="kloak-rename-folder"
              value={renameFolderName}
              onChange={(e) => setRenameFolderName(e.target.value)}
              placeholder="e.g. Work, Friends, Gaming"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && renameFolderName.trim()) handleRenameFolder();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" rounded="xl" onClick={() => setIsRenameFolderOpen(false)}>
              Cancel
            </Button>
            <Button rounded="xl" onClick={handleRenameFolder} disabled={!renameFolderName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isChangeFolderColorOpen} onOpenChange={setIsChangeFolderColorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change folder color</DialogTitle>
            <DialogDescription>Pick a new color for this folder.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="kloak-change-folder-color">Folder color</Label>
            <Input
              id="kloak-change-folder-color"
              type="color"
              value={changeFolderColor}
              onChange={(e) => setChangeFolderColor(e.target.value)}
              className="h-20 w-full p-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" rounded="xl" onClick={() => setIsChangeFolderColorOpen(false)}>
              Cancel
            </Button>
            <Button rounded="xl" onClick={handleChangeColor}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
