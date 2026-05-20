import { useState, useMemo, useEffect, useCallback, forwardRef, memo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Folder,
  FolderPlus,
  Settings,
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
import { MotionButton } from "@/components/ui/motion-elements";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import { useUIStore } from "@/stores/uiStore";
import { useFriendStore } from "@/stores/friendStore";
import { useUnreadDMsContext } from "@/hooks/useUnreadDMsContext";
import { useUnreadChannelsContext } from "@/hooks/useUnreadChannelsContext";
import { useDMStore } from "@/stores/dmStore";
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
const MODAL_CONTENT_CLASS =
  "max-h-[90vh] max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-[4px] border border-border bg-card p-0 text-foreground shadow-2xl sm:max-w-[448px]";

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
  animate: { scale: 1, opacity: 1, borderRadius: 12 },
  hover: { borderRadius: 10 },
  tap: { scale: 0.95 },
  active: { scale: 1, borderRadius: 10 },
};

const iconSpringTransition = { type: "spring" as const, stiffness: 400, damping: 25 };

const badgeInitial = { scale: 0 };
const badgeAnimate = { scale: 1 };
const badgeExit = { scale: 0 };

const folderCollapseTransition = {
  height: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
  opacity: { duration: 0.14, ease: "easeOut" as const },
  y: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const },
};

const bottomActionIconTransition = { duration: 0.15 };

// FIX #1: Static animation objects for the "Add Server" dashed border
// Previously these were inline object literals, re-created every render

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
          "w-11 h-11 overflow-hidden rounded-[12px] flex items-center justify-center shadow-[0_6px_18px_rgba(0,0,0,0.28)]",
          !server.icon_url ? "bg-secondary" : "bg-card",
        )}
      >
        {server.icon_url ? (
          <Avatar className="w-11 h-11 border-0 rounded-[12px]">
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
                className={cn("relative group", isOver && "ring-1 ring-primary/50 rounded-[12px]")}
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
                  className="w-10 h-10 rounded-[12px] flex items-center justify-center text-white relative border border-white/10 shadow-[0_8px_20px_rgba(0,0,0,0.28)]"
                  style={{ backgroundColor: folder.color }}
                >
                  <Folder className="w-[18px] h-[18px]" />
                  <span className="absolute top-1 right-1 text-white/90">
                    {folder.isCollapsed ? (
                      <ChevronRight className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
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
                      className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-1 bg-white rounded-r-full shadow-[0_0_10px_rgba(255,255,255,0.35)]"
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
                        "w-11 h-11 overflow-hidden rounded-[12px] shadow-[0_8px_20px_rgba(0,0,0,0.28)]",
                        isActive
                          ? "p-[2px] bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground hover:bg-secondary/80",
                        !server.icon_url && !isActive && getServerColor(server.name),
                      )}
                    >
                      <div
                        className={cn(
                          "w-full h-full overflow-hidden rounded-[9px]",
                          isActive && !server.icon_url && "bg-primary",
                        )}
                      >
                        {server.icon_url ? (
                          <Avatar className="w-full h-full border-0 rounded-[9px]">
                            <AvatarImage src={server.icon_url} alt={server.name} className="object-cover" />
                            <AvatarFallback className={getServerColor(server.name)}>
                              {getServerInitials(server.name)}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className={cn("text-sm font-bold", isActive ? "text-primary-foreground" : "text-foreground")}>
                              {getServerInitials(server.name)}
                            </span>
                          </div>
                        )}
                      </div>
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

// FIX #12: Extract the loading skeleton into a static component — it was animating
// with inline transition objects that got re-created. Also memo it since it never changes.
const LoadingSkeleton = memo(() => (
  <div className="space-y-2">
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        className="w-11 h-11 rounded-[12px] bg-white/10"
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

interface ServerSidebarProps {
  isAddServerPanelOpen?: boolean;
  onToggleAddServerPanel?: () => void;
  onNavigate?: () => void;
}

export const ServerSidebar = ({
  isAddServerPanelOpen = false,
  onToggleAddServerPanel,
  onNavigate,
}: ServerSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
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

  const openModal = useUIStore((s) => s.openModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const closeServerSettings = useUIStore((s) => s.closeServerSettings);
  const openServerSettings = useUIStore((s) => s.openServerSettings);

  const { serverChannels, serverUnreadSummary, unreadState, getServerUnreadInfo, markServerAsRead } =
    useUnreadChannelsContext();
  const {
    totalUnread: totalDMUnread,
    hasUnread: hasDMUnread,
  } = useUnreadDMsContext();
  const pendingFriendRequestCount = useFriendStore((s) => s.pendingRequests.length);

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

  const totalHomeBadge = totalDMUnread;
  const isExploreActive = location.pathname === "/app/explore";
  const isDMActive = location.pathname === "/app" && currentServer === null;
  const hasPendingFriendRequests = pendingFriendRequestCount > 0;
  const isQuickAccessActive = isAddServerPanelOpen || location.pathname === "/app/friends";

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
  const handleExploreClick = useCallback(() => {
    onNavigate?.();
    setCurrentServer(null);
    setCurrentConversation(null);
    closeServerSettings();
    closeModal();
    navigate("/app/explore");
  }, [onNavigate, setCurrentServer, setCurrentConversation, closeServerSettings, closeModal, navigate]);

  const handleExploreHover = useCallback(() => setHoveredServer("explore"), []);
  const handleDMHover = useCallback(() => setHoveredServer("dm"), []);
  const handleQuickAccessHover = useCallback(() => setHoveredServer("quick-access"), []);
  const handleHoverLeave = useCallback(() => setHoveredServer(null), []);

  const handleDMClick = useCallback(() => {
    onNavigate?.();
    setCurrentServer(null);
    setCurrentConversation(null);
    closeServerSettings();
    closeModal();
    navigate("/app");
  }, [onNavigate, setCurrentServer, setCurrentConversation, closeServerSettings, closeModal, navigate]);

  const handleAddServer = useCallback(() => {
    if (onToggleAddServerPanel) {
      onToggleAddServerPanel();
      return;
    }
    openModal("create-server");
  }, [onToggleAddServerPanel, openModal]);

  const handleCreateFolderCtx = useCallback((e: Event) => {
    e.preventDefault();
    setIsCreateFolderOpen(true);
    setNewFolderName("");
  }, []);

  // FIX #17: Pre-compute pill state for the home button
  const explorePillState = useMemo(() => {
    if (isExploreActive) return "active";
    if (hoveredServer === "explore") return "hover";
    return "hidden";
  }, [isExploreActive, hoveredServer]);
  const dmPillState = useMemo(() => {
    if (isDMActive) return "active";
    if (hoveredServer === "dm") return "hover";
    if (hasDMUnread) return "unread";
    return "hidden";
  }, [isDMActive, hoveredServer, hasDMUnread]);
  const quickAccessPillState = useMemo(() => {
    if (isQuickAccessActive) return "active";
    if (hoveredServer === "quick-access") return "hover";
    if (hasPendingFriendRequests) return "unread";
    return "hidden";
  }, [isQuickAccessActive, hoveredServer, hasPendingFriendRequests]);

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
          onNavigate?.();
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
    [onNavigate, setCurrentServer, setCurrentConversation, closeServerSettings, closeModal, navigate],
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
    (server: ServerWithMembership) => {
      const isActive = currentServer?.id === server.id;
      const channelIds = serverChannels[server.id] || EMPTY_CHANNEL_IDS;
      const channelUnreadInfo = getServerUnreadInfo(channelIds);
      const summaryUnreadInfo = serverUnreadSummary[server.id];
      const hasLocalUnreadState = channelIds.some((channelId) => unreadState[channelId]);
      const hasUnread = hasLocalUnreadState
        ? channelUnreadInfo.hasUnread
        : (summaryUnreadInfo?.hasUnread ?? channelUnreadInfo.hasUnread);
      const totalMentions = hasLocalUnreadState
        ? channelUnreadInfo.totalMentions
        : (summaryUnreadInfo?.totalMentions ?? channelUnreadInfo.totalMentions);
      const isOwner = server.owner_id === user?.id;

      return (
        <DraggableServerItem
          key={server.id}
          server={server}
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
      serverUnreadSummary,
      unreadState,
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
    <div className="h-full w-[68px] shrink-0 flex flex-col items-center relative overflow-hidden bg-layout-sidebar">
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
                "flex-1 flex flex-col items-center gap-2.5 overflow-y-auto scrollbar-overlay scrollbar-hide w-full px-3 pt-3 pb-52",
                isOverRoot && "outline outline-2 outline-primary/30 outline-offset-[-2px] rounded-xl",
              )}
            >
              {/* Loading skeleton */}
              {isLoading && servers.length === 0 && <LoadingSkeleton />}

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
                        {folderServers.map((server) => renderServerItem(server))}
                      </div>
                    </motion.div>
                  </div>
                ))}

                {rootServers.map((server) => renderServerItem(server))}
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
      <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-2 bg-layout-sidebar z-10">
        <div className="w-5 h-px bg-white/14 rounded-full shrink-0 mx-auto mb-2" />
        <div className="flex flex-col items-center gap-2">
          <Tooltip delayDuration={300} {...(tooltipsEnabled ? {} : { open: false })}>
            <TooltipTrigger asChild>
              <MotionButton
                className="relative group"
                onMouseEnter={handleExploreHover}
                onMouseLeave={handleHoverLeave}
                onClick={handleExploreClick}
                whileHover="hover"
                whileTap="tap"
              >
                <motion.span
                  className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-1 bg-white rounded-r-full shadow-[0_0_10px_rgba(255,255,255,0.35)]"
                  variants={pillVariants}
                  initial="hidden"
                  animate={explorePillState}
                />

                <motion.div
                  variants={iconVariants}
                  initial="animate"
                  animate={isExploreActive ? "active" : "animate"}
                  whileHover="hover"
                  whileTap="tap"
                  transition={iconSpringTransition}
                  className="w-11 h-11 flex items-center justify-center"
                >
                  <svg
                    viewBox="0 0 612 612"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-[36px] h-[36px]"
                    aria-hidden="true"
                  >
                    <path
                      d="M306,0C137.272,0,0,137.27,0,305.997C0,474.727,137.272,612,306,612s306-137.273,306-306.003C612,137.27,474.73,0,306,0z M306,576.657c-149.24,0-270.657-121.418-270.657-270.66C35.343,156.759,156.76,35.343,306,35.343 s270.657,121.416,270.657,270.655C576.657,455.24,455.24,576.657,306,576.657z"
                      fill={isExploreActive ? "#FFFFFF" : "#9E9EA7"}
                    />
                    <path
                      d="M474.47,144.734c-4.623-8.599-15.336-11.818-23.933-7.197L251.64,244.485c-3.053,1.642-5.556,4.144-7.197,7.198 L137.538,450.536c-3.782,7.035-2.309,15.489,3.063,20.861c1.191,1.193,2.574,2.232,4.137,3.07 c5.313,2.857,11.436,2.71,16.428,0.155l0.003,0.004l0.075-0.04c0.072-0.037,0.143-0.077,0.214-0.115l198.995-106.87 c3.054-1.64,5.556-4.142,7.2-7.197l106.477-198.361c0.233-0.401,0.455-0.806,0.655-1.222l0.144-0.267l-0.018-0.006 C477.174,155.671,477.211,149.833,474.47,144.734z M196.403,415.684l67.933-126.361l58.418,58.42L196.403,415.684z M347.76,322.764l-58.421-58.421l126.351-67.94"
                      fill={isExploreActive ? "#FFFFFF" : "#9E9EA7"}
                    />
                  </svg>
                </motion.div>

              </MotionButton>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              Explore
            </TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={300} {...(tooltipsEnabled ? {} : { open: false })}>
            <TooltipTrigger asChild>
              <MotionButton
                className="relative group"
                onMouseEnter={handleDMHover}
                onMouseLeave={handleHoverLeave}
                onClick={handleDMClick}
                whileHover="hover"
                whileTap="tap"
              >
                <motion.span
                  className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-1 bg-white rounded-r-full shadow-[0_0_10px_rgba(255,255,255,0.35)]"
                  variants={pillVariants}
                  initial="hidden"
                  animate={dmPillState}
                />

                <motion.div
                  variants={iconVariants}
                  initial="animate"
                  animate={isDMActive ? "active" : "animate"}
                  whileHover="hover"
                  whileTap="tap"
                  transition={iconSpringTransition}
                  className="w-11 h-11 flex items-center justify-center"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={currentServer === null ? "dm-active-icon" : "dm-inactive-icon"}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={bottomActionIconTransition}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-[36px] h-[36px]"
                        aria-hidden="true"
                      >
                        <path
                          d="M17 3.33782C15.5291 2.48697 13.8214 2 12 2C6.47715 2 2 6.47715 2 12C2 13.5997 2.37562 15.1116 3.04346 16.4525C3.22094 16.8088 3.28001 17.2161 3.17712 17.6006L2.58151 19.8267C2.32295 20.793 3.20701 21.677 4.17335 21.4185L6.39939 20.8229C6.78393 20.72 7.19121 20.7791 7.54753 20.9565C8.88837 21.6244 10.4003 22 12 22C17.5228 22 22 17.5228 22 12C22 10.1786 21.513 8.47087 20.6622 7"
                          stroke={isDMActive ? "#FFFFFF" : "#9E9EA7"}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                        <path
                          d="M8 12H8.009M11.991 12H12M15.991 12H16"
                          stroke={isDMActive ? "#FFFFFF" : "#9E9EA7"}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </motion.span>
                  </AnimatePresence>
                </motion.div>

                <AnimatePresence>
                  {totalHomeBadge > 0 && !isDMActive && (
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
              Direct Messages{totalHomeBadge > 0 ? ` (${totalHomeBadge} unread)` : ""}
            </TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={300} {...(tooltipsEnabled ? {} : { open: false })}>
            <TooltipTrigger asChild>
              <MotionButton
                whileTap={{ scale: 0.95 }}
                whileHover="hover"
                initial="default"
                onMouseEnter={handleQuickAccessHover}
                onMouseLeave={handleHoverLeave}
                onClick={handleAddServer}
                className="relative w-11 h-11 flex items-center justify-center"
                aria-pressed={isQuickAccessActive}
              >
                <motion.span
                  className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-1 bg-white rounded-r-full shadow-[0_0_10px_rgba(255,255,255,0.35)]"
                  variants={pillVariants}
                  initial="hidden"
                  animate={quickAccessPillState}
                />
                <svg
                  viewBox="0 0 64 64"
                  xmlns="http://www.w3.org/2000/svg"
                  className={cn("w-[36px] h-[36px]", isQuickAccessActive ? "text-foreground" : "text-muted-foreground")}
                  aria-hidden="true"
                >
                  <path d="M32,32.83a9.52,9.52,0,0,1-9.56-9.57A9.57,9.57,0,1,1,32,32.83ZM32,16.7a6.43,6.43,0,0,0-4.08,1.42,6.58,6.58,0,0,0,1.51,11.19,6.69,6.69,0,0,0,5.3-.07,6.57,6.57,0,0,0,1.65-10.86A6.5,6.5,0,0,0,32,16.7Z" fill="currentColor" />
                  <path d="M40.74,34.17a9.63,9.63,0,0,1-6.39-2.44,1.49,1.49,0,0,1,.37-2.48,6.58,6.58,0,0,0,1.66-10.87,1.5,1.5,0,0,1,.38-2.48,9.57,9.57,0,1,1,4,18.27Zm-2.63-3.55A6.56,6.56,0,1,0,40.74,18c-.24,0-.48,0-.71,0a9.57,9.57,0,0,1-1.92,12.55Z" fill="currentColor" />
                  <path d="M32,57.7c-.32,0-.65,0-1,0l-.81,0c-.41,0-.85-.07-1.29-.13a4.6,4.6,0,0,1-.6-.07l-.7-.1L27,57.2c-.38-.08-.71-.15-1-.24s-.72-.17-1.11-.29L24,56.42c-.32-.1-.63-.21-.95-.34a23.66,23.66,0,0,1-3.82-1.79L18.8,54l-.21-.13a25.73,25.73,0,0,1-2.46-1.71,1.52,1.52,0,0,1-.57-1.05c0-.17,0-.33,0-.5A16.42,16.42,0,0,1,32,34.19,16.45,16.45,0,0,1,48.45,50.65c0,.17,0,.33,0,.5a1.52,1.52,0,0,1-.57,1.05c-.27.21-.54.42-.81.61l-.39.27c-.14.11-.32.23-.49.34s-.59.39-.9.57-.59.35-.88.51c-.64.36-1.29.68-2,1-.29.13-.61.27-.93.39l-.85.32-.88.3-.67.2-.72.19-.74.19c-.83.18-1.66.32-2.46.42l-1,.1a6.71,6.71,0,0,1-.67,0l-.56,0h-.24Zm.47-3h0ZM18.55,50.27c.52.38,1.05.74,1.59,1.07l.23.14.36.21a20.28,20.28,0,0,0,3.4,1.59c.3.12.54.2.8.28a7.63,7.63,0,0,0,.73.23c.33.1.65.19,1,.26s.58.14.84.2l.68.12.62.1.43.05a11.44,11.44,0,0,0,1.19.11,7.59,7.59,0,0,0,.79,0,7.59,7.59,0,0,0,.8,0h.64c.21,0,.42,0,.63,0l.67,0c.32,0,.58,0,.84-.09A21.74,21.74,0,0,0,37,54.14c.22,0,.43-.1.64-.16l.6-.15.63-.19.77-.26.78-.3c.29-.11.53-.22.77-.33.63-.28,1.21-.56,1.77-.87l.8-.47c.25-.15.51-.31.75-.48l.37-.24.09-.07.31-.22.18-.13a13.41,13.41,0,0,0-7.56-11.73A13.46,13.46,0,0,0,18.55,50.27ZM46.94,51h0Z" fill="currentColor" />
                  <path d="M46.94,52.52a1.5,1.5,0,0,1-1.49-1.63v-.24a13.42,13.42,0,0,0-7.56-12.11,1.5,1.5,0,0,1,.44-2.83,17.53,17.53,0,0,1,2.41-.17,16.45,16.45,0,0,1,13.69,7.33,1.49,1.49,0,0,1,.07,1.55,25.9,25.9,0,0,1-6.63,7.78A1.52,1.52,0,0,1,46.94,52.52ZM43.45,38.81a16.32,16.32,0,0,1,4.77,9,23,23,0,0,0,3.18-4.07A13.48,13.48,0,0,0,43.45,38.81Z" fill="currentColor" />
                  <path d="M23.82,34a9.57,9.57,0,1,1,3.74-18.38,1.5,1.5,0,0,1,.36,2.56,6.5,6.5,0,0,0-2.48,5.13,6.57,6.57,0,0,0,4,6,1.5,1.5,0,0,1,.35,2.55A9.53,9.53,0,0,1,23.82,34Zm0-16.13a6.57,6.57,0,1,0,0,13.13,6.4,6.4,0,0,0,2.06-.33,9.6,9.6,0,0,1-1.75-12.8Z" fill="currentColor" />
                  <path d="M17.06,52.52a1.52,1.52,0,0,1-.93-.32,25.6,25.6,0,0,1-6.42-7.41,1.5,1.5,0,0,1,0-1.52,16.36,16.36,0,0,1,14.09-8,17.19,17.19,0,0,1,2.35.16,1.5,1.5,0,0,1,.41,2.86,13.49,13.49,0,0,0-8,12.32v.24a1.5,1.5,0,0,1-1.49,1.63Zm-4.28-8.44a23.2,23.2,0,0,0,3,3.79,16.5,16.5,0,0,1,4.94-9.21A13.36,13.36,0,0,0,12.78,44.08Z" fill="currentColor" />
                  <path d="M32,57.7c-.32,0-.65,0-1,0l-.81,0c-.41,0-.85-.07-1.29-.13a4.6,4.6,0,0,1-.6-.07l-.7-.1L27,57.2c-.38-.08-.71-.15-1-.24s-.72-.17-1.11-.29L24,56.42c-.32-.1-.63-.21-.95-.34a23.66,23.66,0,0,1-3.82-1.79L18.8,54l-.21-.13A25.72,25.72,0,1,1,47.87,52.2c-.27.21-.54.42-.81.61l-.39.27c-.14.11-.32.23-.49.34s-.59.39-.9.57-.59.35-.88.51c-.64.36-1.29.68-2,1-.29.13-.61.27-.93.39s-.44.17-.7.27l-.15.05-.88.3-.67.2-.72.19-.74.19c-.83.18-1.66.32-2.46.42l-1,.1a6.71,6.71,0,0,1-.67,0l-.56,0h-.24Zm.47-3h0ZM32,9.3A22.68,22.68,0,0,0,18,49.84a23.85,23.85,0,0,0,2.16,1.5l.23.14.36.21a20.28,20.28,0,0,0,3.4,1.59c.3.12.54.2.8.28a7.63,7.63,0,0,0,.73.23c.33.1.65.19,1,.26s.58.14.84.2l.68.12.62.1.43.05a11.44,11.44,0,0,0,1.19.11,7.59,7.59,0,0,0,.79,0,7.59,7.59,0,0,0,.8,0h.64c.21,0,.42,0,.63,0l.67,0c.32,0,.58,0,.84-.09A21.74,21.74,0,0,0,37,54.14c.22,0,.43-.1.64-.16l.6-.15.63-.19.77-.26.13-.05.63-.24c.31-.12.55-.23.79-.34.63-.28,1.21-.56,1.77-.87l.8-.47c.25-.15.51-.31.75-.48l.37-.24.09-.07.31-.22c.28-.2.51-.38.74-.56A22.69,22.69,0,0,0,32,9.3Z" fill="currentColor" />
                </svg>
                <AnimatePresence>
                  {hasPendingFriendRequests && (
                    <motion.span
                      initial={badgeInitial}
                      animate={badgeAnimate}
                      exit={badgeExit}
                      className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] bg-destructive rounded-[4px] text-xs text-destructive-foreground flex items-center justify-center px-1 font-bold shadow-lg"
                    >
                      {pendingFriendRequestCount > 99 ? "99+" : pendingFriendRequestCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </MotionButton>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              Quick Access{hasPendingFriendRequests ? ` (${pendingFriendRequestCount} friend request${pendingFriendRequestCount === 1 ? "" : "s"})` : ""}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ── DIALOGS (unchanged logic, just cleaner) ── */}
      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent className={MODAL_CONTENT_CLASS} hideCloseButton>
          <div className="flex max-h-[82vh] flex-col overflow-hidden">
            <div className="border-b border-border bg-secondary/40 px-5 py-3">
              <div className="text-base font-medium leading-none tracking-tight">Create Folder</div>
            </div>
            <div className="space-y-5 overflow-y-auto px-6 py-4">
              <p className="text-sm leading-6 text-muted-foreground">Choose a name and color for your server folder.</p>
              <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                <div className="space-y-2">
                  <Label htmlFor="kloak-folder-name" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Name
                  </Label>
                  <Input
                    id="kloak-folder-name"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="e.g. Work, Friends, Gaming"
                    autoFocus
                    className="h-9 rounded-[3px] border border-border bg-secondary/40 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kloak-folder-color" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Color
                  </Label>
                  <Input
                    id="kloak-folder-color"
                    type="color"
                    value={newFolderColor}
                    onChange={(e) => setNewFolderColor(e.target.value)}
                    className="h-9 w-14 rounded-[3px] border border-border bg-secondary/40 p-1"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-border bg-secondary/30 px-5 py-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCreateFolderOpen(false)}
                className="h-9 rounded-[3px] px-4 text-muted-foreground hover:bg-transparent hover:text-foreground"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="h-9 rounded-[3px] bg-primary px-5 font-medium text-primary-foreground hover:bg-primary/90"
              >
                Create
              </Button>
            </div>
          </div>
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
