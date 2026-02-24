import { useState, useMemo, useEffect, useCallback, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Folder,
  Plus,
  Settings,
  Home,
  ChevronDown,
  Trash2,
  Edit2,
  Palette,
  LogOut,
  CheckCheck,
  BellOff,
  Bell,
} from "lucide-react";
import { evaluatePermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MotionButton, MotionDiv } from "@/components/ui/motion-elements";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import { useUIStore } from "@/stores/uiStore";
import { useUnreadDMsContext } from "@/hooks/useUnreadDMsContext";
import { useUnreadChannelsContext } from "@/hooks/useUnreadChannelsContext";
import { useDMStore } from "@/stores/dmStore";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { SupportUsButton } from "@/components/support/SupportUsButton";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCenter,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { SortableContext, useSortable, horizontalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
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
import type { ServerWithMembership, Server } from "@/types";

interface ServerChannels {
  [serverId: string]: string[];
}

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

const SERVER_FOLDERS_STORAGE_KEY = "kloak-server-folders-v1";

const loadServerFoldersState = (): ServerFolderState => {
  try {
    const raw = localStorage.getItem(SERVER_FOLDERS_STORAGE_KEY);
    if (!raw) return { folders: [], serverToFolder: {} };
    const parsed = JSON.parse(raw) as Partial<ServerFolderState>;
    const folders = Array.isArray(parsed.folders) ? parsed.folders : [];
    const serverToFolder =
      parsed.serverToFolder && typeof parsed.serverToFolder === "object"
        ? (parsed.serverToFolder as Record<string, string>)
        : {};

    const sanitizedFolders: ServerFolder[] = folders
      .filter((f: any) => f && typeof f.id === "string" && typeof f.name === "string")
      .map((f: any) => ({
        id: f.id,
        name: String(f.name),
        color: typeof f.color === "string" ? f.color : "#6366f1",
        isCollapsed: Boolean(f.isCollapsed),
        serverIds: Array.isArray(f.serverIds) ? f.serverIds.filter((id: any) => typeof id === "string") : [],
      }));

    return { folders: sanitizedFolders, serverToFolder };
  } catch {
    return { folders: [], serverToFolder: {} };
  }
};

const getFolderDropId = (folderId: string) => `folder:${folderId}`;
const getServerDragId = (serverId: string) => `server:${serverId}`;

const createId = () => {
  const cryptoAny = crypto as any;
  if (cryptoAny?.randomUUID) return cryptoAny.randomUUID() as string;
  return `folder-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

// Horizontal pill variants - animate width instead of height
const pillVariants = {
  hidden: { width: 0, opacity: 0 },
  hover: { width: 20, opacity: 1 },
  unread: { width: 8, opacity: 1 },
  active: { width: 40, opacity: 1 },
};

const iconVariants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1, opacity: 1, borderRadius: 4 },
  hover: { borderRadius: 6 },
  tap: { scale: 0.95 },
  active: { scale: 1, borderRadius: 8 },
};

const serverItemVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.05,
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
    },
  }),
};

const bustCache = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (url.startsWith("blob:")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}cb=${encodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "")}`;
};

const ServerIconVisual = ({
  server,
  getServerColor,
  getServerInitials,
}: {
  server: ServerWithMembership;
  getServerColor: (name: string) => string;
  getServerInitials: (name: string) => string;
}) => {
  return (
    <div
      className={cn(
        "w-10 h-10 overflow-hidden rounded-[4px] flex items-center justify-center",
        !server.icon_url && getServerColor(server.name),
      )}
    >
      {server.icon_url ? (
        <Avatar className="w-10 h-10 border-0 rounded-[4px]">
          <AvatarImage
            src={bustCache(server.icon_url) ?? undefined}
            alt={server.name}
            className="object-cover rounded-[4px]"
          />
          <AvatarFallback className={cn("rounded-[4px]", getServerColor(server.name))}>
            {getServerInitials(server.name)}
          </AvatarFallback>
        </Avatar>
      ) : (
        <span className="text-xs font-bold text-white">{getServerInitials(server.name)}</span>
      )}
    </div>
  );
};

// Horizontal folder with popover for contained servers
const HorizontalFolderItem = ({
  folder,
  folderServers,
  tooltipsEnabled,
  currentServer,
  hoveredServer,
  serverChannels,
  getServerUnreadInfo,
  getPillState,
  getServerColor,
  getServerInitials,
  onHoverServer,
  onLeaveServer,
  onClickServer,
  onLeaveServerAction,
  onOpenSettings,
  onMarkAsRead,
  onToggleMute,
  onRename,
  onChangeColor,
  onDelete,
}: {
  folder: ServerFolder;
  folderServers: ServerWithMembership[];
  tooltipsEnabled: boolean;
  currentServer: Server | null;
  hoveredServer: string | null;
  serverChannels: ServerChannels;
  getServerUnreadInfo: (channelIds: string[]) => { hasUnread: boolean; totalMentions: number };
  getPillState: (serverId: string | null, hasUnread: boolean) => string;
  getServerColor: (name: string) => string;
  getServerInitials: (name: string) => string;
  onHoverServer: (id: string) => void;
  onLeaveServer: () => void;
  onClickServer: (server: ServerWithMembership) => void;
  onLeaveServerAction: (serverId: string) => void;
  onOpenSettings: (server: ServerWithMembership) => void;
  onMarkAsRead: (channelIds: string[]) => void;
  onToggleMute: (serverId: string) => void;
  onRename: (folderId: string) => void;
  onChangeColor: (folderId: string) => void;
  onDelete: (folderId: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: getFolderDropId(folder.id) });

  // Check if any server in folder has unread
  const folderHasUnread = folderServers.some((server) => {
    const channelIds = serverChannels[server.id] || [];
    const { hasUnread } = getServerUnreadInfo(channelIds);
    return hasUnread;
  });

  const folderTotalMentions = folderServers.reduce((acc, server) => {
    const channelIds = serverChannels[server.id] || [];
    const { totalMentions } = getServerUnreadInfo(channelIds);
    return acc + totalMentions;
  }, 0);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <Tooltip delayDuration={300} open={tooltipsEnabled && !isOpen ? undefined : false}>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <MotionButton
                  ref={setNodeRef}
                  className={cn("relative group", isOver && "ring-1 ring-primary/50 rounded-[6px]")}
                  whileHover="hover"
                  whileTap="tap"
                >
                  {/* Bottom indicator pill */}
                  <motion.span
                    className="absolute -bottom-3 left-1/2 -translate-x-1/2 h-1 bg-foreground rounded-t-full"
                    variants={pillVariants}
                    initial="hidden"
                    animate={folderHasUnread ? "unread" : "hidden"}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />

                  <motion.div
                    variants={iconVariants}
                    initial="animate"
                    animate="animate"
                    whileHover="hover"
                    whileTap="tap"
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className="w-10 h-10 flex items-center justify-center text-white relative"
                    style={{ backgroundColor: folder.color }}
                  >
                    <Folder className="w-5 h-5" />
                    <ChevronDown className="absolute bottom-0.5 right-0.5 w-3 h-3 text-white/70" />
                  </motion.div>

                  {/* Mention badge */}
                  <AnimatePresence>
                    {folderTotalMentions > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] bg-destructive rounded-[4px] text-xs text-destructive-foreground flex items-center justify-center px-1 font-bold shadow-lg"
                      >
                        {folderTotalMentions > 99 ? "99+" : folderTotalMentions}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </MotionButton>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="font-medium">
              {folder.name}
            </TooltipContent>
          </Tooltip>

          <PopoverContent side="bottom" align="start" className="w-auto p-2 space-y-1">
            <div className="text-xs font-semibold text-muted-foreground px-2 mb-2">{folder.name}</div>
            {folderServers.map((server) => {
              const channelIds = serverChannels[server.id] || [];
              const { hasUnread, totalMentions } = getServerUnreadInfo(channelIds);
              const isActive = currentServer?.id === server.id;
              const isOwner = server.owner_id === useAuthStore.getState().user?.id;
              const canManageServer = isOwner;

              return (
                <ContextMenu key={server.id}>
                  <ContextMenuTrigger asChild>
                    <button
                      onClick={() => {
                        onClickServer(server);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-2 py-1.5 rounded-md transition-colors",
                        isActive ? "bg-primary/20" : "hover:bg-secondary",
                      )}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-[4px] overflow-hidden flex items-center justify-center flex-shrink-0",
                          !server.icon_url && getServerColor(server.name),
                        )}
                      >
                        {server.icon_url ? (
                          <Avatar className="w-8 h-8 border-0 rounded-[4px]">
                            <AvatarImage
                              src={bustCache(server.icon_url) ?? undefined}
                              alt={server.name}
                              className="object-cover rounded-[4px]"
                            />
                            <AvatarFallback className={cn("rounded-[4px]", getServerColor(server.name))}>
                              {getServerInitials(server.name)}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <span className="text-xs font-bold text-white">{getServerInitials(server.name)}</span>
                        )}
                      </div>
                      <span className={cn("text-sm truncate max-w-[150px]", hasUnread && "font-semibold")}>
                        {server.name}
                      </span>
                      {totalMentions > 0 && (
                        <span className="ml-auto min-w-[18px] h-[18px] bg-destructive rounded-[4px] text-xs text-destructive-foreground flex items-center justify-center px-1 font-bold">
                          {totalMentions > 99 ? "99+" : totalMentions}
                        </span>
                      )}
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onSelect={() => onMarkAsRead(channelIds)}>
                      <CheckCheck className="w-4 h-4 mr-2" />
                      Mark as Read
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => onToggleMute(server.id)}>
                      {server.is_muted ? (
                        <>
                          <Bell className="w-4 h-4 mr-2" />
                          Unmute Server
                        </>
                      ) : (
                        <>
                          <BellOff className="w-4 h-4 mr-2" />
                          Mute Server
                        </>
                      )}
                    </ContextMenuItem>
                    {canManageServer && (
                      <ContextMenuItem onSelect={() => onOpenSettings(server)}>
                        <Settings className="w-4 h-4 mr-2" />
                        Server Settings
                      </ContextMenuItem>
                    )}
                    {!isOwner && (
                      <ContextMenuItem
                        onSelect={() => {
                          if (window.confirm(`Are you sure you want to leave "${server.name}"?`)) {
                            onLeaveServerAction(server.id);
                          }
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Leave Server
                      </ContextMenuItem>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </PopoverContent>
        </Popover>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-52 rounded-xl border-border/50 p-1.5">
        <ContextMenuItem onSelect={() => onRename(folder.id)}>
          <Edit2 className="w-4 h-4 mr-2" />
          Rename folder
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onChangeColor(folder.id)}>
          <Palette className="w-4 h-4 mr-2" />
          Change color
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => onDelete(folder.id)} className="text-destructive focus:text-destructive">
          <Trash2 className="w-4 h-4 mr-2" />
          Delete folder
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

const HorizontalSortableServerItem = forwardRef<
  HTMLDivElement,
  {
    server: ServerWithMembership;
    index: number;
    isActive: boolean;
    isHovered: boolean;
    hasUnread: boolean;
    totalMentions: number;
    tooltipsEnabled: boolean;
    getPillState: (serverId: string | null, hasUnread: boolean) => string;
    getServerColor: (name: string) => string;
    getServerInitials: (name: string) => string;
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
      getPillState,
      getServerColor,
      getServerInitials,
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
    const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
      id: getServerDragId(server.id),
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };
    const isOwner = server.owner_id === useAuthStore.getState().user?.id;
    const canManageServer = isOwner;

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <motion.div
            ref={(node) => {
              setNodeRef(node);
              if (typeof ref === "function") {
                ref(node);
              } else if (ref) {
                ref.current = node;
              }
            }}
            style={style}
            custom={index}
            variants={serverItemVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, y: -20, transition: { duration: 0.15 } }}
            layout
            className={cn(
              "relative",
              isOver &&
                !isDragging &&
                "before:absolute before:left-[-6px] before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-8 before:bg-primary before:rounded-full",
            )}
          >
            <Tooltip delayDuration={300} open={tooltipsEnabled ? undefined : false}>
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
                  {/* Bottom indicator pill */}
                  <motion.span
                    className="absolute -bottom-3 left-1/2 -translate-x-1/2 h-1 bg-foreground rounded-t-full"
                    variants={pillVariants}
                    initial="hidden"
                    animate={getPillState(server.id, hasUnread)}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />

                  <motion.div
                    variants={iconVariants}
                    initial="animate"
                    animate={isActive ? "active" : "animate"}
                    whileHover="hover"
                    whileTap="tap"
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className={cn(
                      "w-10 h-10 overflow-hidden",
                      isActive && !server.icon_url && "ring-2 ring-primary/50",
                      !server.icon_url && getServerColor(server.name),
                      server.icon_url && "border-0",
                    )}
                  >
                    {server.icon_url ? (
                      <Avatar className="w-10 h-10 border-0 rounded-[4px]">
                        <AvatarImage
                          src={bustCache(server.icon_url) ?? undefined}
                          alt={server.name}
                          className="object-cover rounded-[4px]"
                        />
                        <AvatarFallback className={cn("rounded-[4px]", getServerColor(server.name))}>
                          {getServerInitials(server.name)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-xs font-bold text-white">{getServerInitials(server.name)}</span>
                      </div>
                    )}
                  </motion.div>

                  {/* Mention badge */}
                  <AnimatePresence>
                    {totalMentions > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] bg-destructive rounded-[4px] text-xs text-destructive-foreground flex items-center justify-center px-1 font-bold shadow-lg"
                      >
                        {totalMentions > 99 ? "99+" : totalMentions}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </MotionButton>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="font-medium">
                {server.name}
              </TooltipContent>
            </Tooltip>
          </motion.div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => onMarkAsRead?.()}>
            <CheckCheck className="w-4 h-4 mr-2" />
            Mark as Read
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => onToggleMute?.()}>
            {server.is_muted ? (
              <>
                <Bell className="w-4 h-4 mr-2" />
                Unmute Server
              </>
            ) : (
              <>
                <BellOff className="w-4 h-4 mr-2" />
                Mute Server
              </>
            )}
          </ContextMenuItem>
          {canManageServer && onOpenSettings && (
            <ContextMenuItem onSelect={() => onOpenSettings()}>
              <Settings className="w-4 h-4 mr-2" />
              Server Settings
            </ContextMenuItem>
          )}
          {!isOwner && onLeaveServer && (
            <ContextMenuItem
              onSelect={() => {
                if (window.confirm(`Are you sure you want to leave "${server.name}"?`)) {
                  onLeaveServer(server.id);
                }
              }}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Leave Server
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
    );
  },
);

HorizontalSortableServerItem.displayName = "HorizontalSortableServerItem";

export const HorizontalServerSidebar = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { servers, currentServer, setCurrentServer, isLoading, fetchServers, leaveServer, toggleServerMute } =
    useServerStore();
  const { setCurrentConversation } = useDMStore();
  const { openModal, activeModal, closeModal, closeServerSettings, openServerSettings } = useUIStore();
  const { serverChannels, getServerUnreadInfo, markServerAsRead } = useUnreadChannelsContext();
  const [hoveredServer, setHoveredServer] = useState<string | null>(null);
  const [tooltipsEnabled, setTooltipsEnabled] = useState(false);
  const [folderState, setFolderState] = useState<ServerFolderState>(() => loadServerFoldersState());
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const { setNodeRef: setRootDroppableRef, isOver: isOverRoot } = useDroppable({ id: "root" });

  // Disable tooltips initially
  useEffect(() => {
    const timer = setTimeout(() => setTooltipsEnabled(true), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchServers(user.id);
    }
  }, [user?.id, fetchServers]);

  // Subscribe to realtime server updates (icon, name, banner, etc.) for ALL servers
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("sidebar-server-updates")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "servers" }, (payload) => {
        const updated = payload.new as any;
        if (!updated?.id) return;
        // Check membership at callback time to avoid stale closure
        const currentServers = useServerStore.getState().servers;
        if (!currentServers.some((s) => s.id === updated.id)) return;
        useServerStore.setState((state) => ({
          servers: state.servers.map((s) =>
            s.id === updated.id
              ? {
                  ...s,
                  name: updated.name,
                  icon_url: updated.icon_url ?? null,
                  banner_url: updated.banner_url ?? null,
                  about: updated.about,
                  is_published: updated.is_published,
                }
              : s,
          ),
          currentServer:
            state.currentServer?.id === updated.id
              ? {
                  ...state.currentServer,
                  name: updated.name,
                  icon_url: updated.icon_url ?? null,
                  banner_url: updated.banner_url ?? null,
                  about: updated.about,
                  is_published: updated.is_published,
                }
              : state.currentServer,
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Load folder state from database
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
          const parsed = data as Partial<ServerFolderState>;
          const folders = Array.isArray(parsed.folders) ? parsed.folders : [];
          const serverToFolder =
            parsed.serverToFolder && typeof parsed.serverToFolder === "object"
              ? (parsed.serverToFolder as Record<string, string>)
              : {};

          const sanitizedFolders: ServerFolder[] = folders
            .filter((f: any) => f && typeof f.id === "string" && typeof f.name === "string")
            .map((f: any) => ({
              id: f.id,
              name: String(f.name),
              color: typeof f.color === "string" ? f.color : "#6366f1",
              isCollapsed: Boolean(f.isCollapsed),
              serverIds: Array.isArray(f.serverIds) ? f.serverIds.filter((id: any) => typeof id === "string") : [],
            }));

          setFolderState({ folders: sanitizedFolders, serverToFolder });
          try {
            localStorage.setItem(
              SERVER_FOLDERS_STORAGE_KEY,
              JSON.stringify({ folders: sanitizedFolders, serverToFolder }),
            );
          } catch {}
        }

        setIsFolderStateLoaded(true);
      } catch (err) {
        console.error("Error loading folder state:", err);
        setIsFolderStateLoaded(true);
      }
    };

    loadFromDatabase();
  }, [user?.id, isFolderStateLoaded]);

  // Persist folders state
  useEffect(() => {
    if (!isFolderStateLoaded || !user?.id) return;

    try {
      localStorage.setItem(SERVER_FOLDERS_STORAGE_KEY, JSON.stringify(folderState));
    } catch {}

    const timeoutId = setTimeout(async () => {
      try {
        await supabase.rpc("save_user_server_folders" as any, {
          _user_id: user.id,
          _folder_data: folderState,
        });
      } catch (err) {
        console.error("Error saving folder state:", err);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [folderState, user?.id, isFolderStateLoaded]);

  // Clean up folder mappings
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

  const { totalUnread: totalDMUnread, hasUnread: hasDMUnread } = useUnreadDMsContext();

  const getServerInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const getServerColor = (name: string) => {
    const colors = [
      "bg-indigo-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-red-500",
      "bg-orange-500",
      "bg-amber-500",
      "bg-emerald-500",
      "bg-teal-500",
      "bg-cyan-500",
      "bg-blue-500",
    ];
    const index = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  const getPillState = (serverId: string | null, hasUnread: boolean) => {
    if (currentServer?.id === serverId || (serverId === null && currentServer === null)) {
      return "active";
    }
    if (hoveredServer === serverId) {
      return "hover";
    }
    if (hasUnread) {
      return "unread";
    }
    return "hidden";
  };

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

  const handleDragCancel = useCallback(() => {
    setActiveDragServerId(null);
  }, []);

  // Local ordered server IDs (for drag-drop reordering)
  const [orderedServerIds, setOrderedServerIds] = useState<string[]>([]);

  // Initialize orderedServerIds from servers (sorted by position if available)
  useEffect(() => {
    if (servers.length === 0) {
      setOrderedServerIds([]);
      return;
    }
    // Sort by position if available, otherwise maintain existing order
    const sorted = [...servers].sort((a, b) => {
      const posA = (a as any).position ?? Infinity;
      const posB = (b as any).position ?? Infinity;
      if (posA === posB) return 0;
      return posA - posB;
    });
    setOrderedServerIds(sorted.map((s) => s.id));
  }, [servers]);

  // Save server order to database
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

      // Handle folder drop
      if (overId === "root") {
        moveServerToFolder(serverId, null);
        setActiveDragServerId(null);
        return;
      } else if (overId.startsWith("folder:")) {
        const folderId = overId.slice("folder:".length);
        moveServerToFolder(serverId, folderId);
        setActiveDragServerId(null);
        return;
      }

      // Handle reordering within root servers
      if (overId.startsWith("server:")) {
        const overServerId = overId.slice("server:".length);
        if (serverId !== overServerId) {
          setOrderedServerIds((prev) => {
            const oldIndex = prev.indexOf(serverId);
            const newIndex = prev.indexOf(overServerId);
            if (oldIndex === -1 || newIndex === -1) return prev;
            const newOrder = arrayMove(prev, oldIndex, newIndex);
            // Save to database
            saveServerOrder(newOrder);
            return newOrder;
          });
        }
      }

      setActiveDragServerId(null);
    },
    [moveServerToFolder, saveServerOrder],
  );

  const folderById = useMemo(() => new Map(folderState.folders.map((f) => [f.id, f])), [folderState.folders]);

  // Filter and order root servers based on orderedServerIds
  const rootServers = useMemo(() => {
    const notInFolder = servers.filter((s) => !folderById.has(folderState.serverToFolder[s.id] || ""));
    const serversMap = new Map(notInFolder.map((s) => [s.id, s]));
    // Return servers in orderedServerIds order, filtering to only those not in folders
    const ordered: ServerWithMembership[] = [];
    for (const id of orderedServerIds) {
      const server = serversMap.get(id);
      if (server) ordered.push(server);
    }
    // Add any servers not yet in orderedServerIds (newly joined)
    for (const server of notInFolder) {
      if (!orderedServerIds.includes(server.id)) {
        ordered.push(server);
      }
    }
    return ordered;
  }, [servers, folderState.serverToFolder, folderById, orderedServerIds]);

  // IDs for SortableContext
  const sortableServerIds = useMemo(() => rootServers.map((s) => getServerDragId(s.id)), [rootServers]);

  const serversById = useMemo(() => new Map(servers.map((s) => [s.id, s])), [servers]);

  const foldersWithServers = useMemo(() => {
    return folderState.folders.map((folder) => {
      const ordered = folder.serverIds
        .map((id) => serversById.get(id))
        .filter((s): s is ServerWithMembership => Boolean(s));
      return { folder, servers: ordered };
    });
  }, [folderState.folders, serversById]);

  const activeDragServer = useMemo(
    () => (activeDragServerId ? serversById.get(activeDragServerId) : undefined),
    [activeDragServerId, serversById],
  );

  return (
    <div className="w-full h-14 flex items-center px-3 gap-2 bg-background/20 border-b border-border/30">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              ref={setRootDroppableRef}
              className={cn(
                "flex-1 flex items-center gap-2 overflow-x-auto scrollbar-hide h-full py-1",
                isOverRoot && "outline outline-2 outline-primary/30 outline-offset-[-2px] rounded-md",
              )}
            >
              {/* Loading skeleton */}
              {isLoading && servers.length === 0 && (
                <div className="flex gap-2">
                  {[...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-12 h-12 rounded-[6px] bg-secondary/50 flex-shrink-0"
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              )}

              {/* Home / Direct Messages button */}
              <Tooltip delayDuration={300} open={tooltipsEnabled ? undefined : false}>
                <TooltipTrigger asChild>
                  <MotionButton
                    className="relative group flex-shrink-0"
                    onMouseEnter={() => setHoveredServer(null)}
                    onMouseLeave={() => setHoveredServer(null)}
                    onClick={() => {
                      setCurrentServer(null);
                      setCurrentConversation(null);
                      closeServerSettings();
                      closeModal();
                      navigate("/app");
                    }}
                    whileHover="hover"
                    whileTap="tap"
                  >
                    {/* Bottom indicator pill */}
                    <motion.span
                      className="absolute -bottom-3 left-1/2 -translate-x-1/2 h-1 bg-foreground rounded-t-full"
                      variants={pillVariants}
                      initial="hidden"
                      animate={getPillState(null, hasDMUnread)}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />

                    <motion.div
                      variants={iconVariants}
                      initial="animate"
                      animate={currentServer === null ? "active" : "animate"}
                      whileHover="hover"
                      whileTap="tap"
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      className={cn(
                        "w-10 h-10 flex items-center justify-center",
                        currentServer === null
                          ? "bg-primary text-primary-foreground ring-2 ring-primary/50"
                          : "bg-secondary hover:bg-primary/20 hover:text-neutral-200",
                      )}
                    >
                      <Home className="w-4 h-4" />
                    </motion.div>

                    {/* Unread DM badge */}
                    <AnimatePresence>
                      {totalDMUnread > 0 && currentServer !== null && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] bg-destructive rounded-[4px] text-xs text-destructive-foreground flex items-center justify-center px-1 font-bold shadow-lg"
                        >
                          {totalDMUnread > 99 ? "99+" : totalDMUnread}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </MotionButton>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="font-medium">
                  Home{totalDMUnread > 0 ? ` (${totalDMUnread} unread)` : ""}
                </TooltipContent>
              </Tooltip>

              {/* Separator */}
              <div className="w-0.5 h-6 bg-border rounded-full flex-shrink-0" />

              {/* Folders (as popovers) */}
              {foldersWithServers.map(({ folder, servers: folderServers }) => (
                <HorizontalFolderItem
                  key={folder.id}
                  folder={folder}
                  folderServers={folderServers}
                  tooltipsEnabled={tooltipsEnabled}
                  currentServer={currentServer}
                  hoveredServer={hoveredServer}
                  serverChannels={serverChannels}
                  getServerUnreadInfo={getServerUnreadInfo}
                  getPillState={getPillState}
                  getServerColor={getServerColor}
                  getServerInitials={getServerInitials}
                  onHoverServer={setHoveredServer}
                  onLeaveServer={() => setHoveredServer(null)}
                  onClickServer={(server) => {
                    setCurrentServer(server);
                    setCurrentConversation(null);
                    closeServerSettings();
                    closeModal();
                    navigate(`/app/servers/${server.id}`);
                  }}
                  onLeaveServerAction={async (serverId) => {
                    if (user?.id) {
                      try {
                        await leaveServer(serverId, user.id);
                        if (currentServer?.id === serverId) {
                          navigate("/app");
                        }
                      } catch (error) {
                        console.error("Failed to leave server:", error);
                      }
                    }
                  }}
                  onOpenSettings={(server) => {
                    setCurrentServer(server);
                    openServerSettings();
                  }}
                  onMarkAsRead={(channelIds) => {
                    if (channelIds.length > 0) {
                      markServerAsRead(channelIds);
                    }
                  }}
                  onToggleMute={(serverId) => {
                    if (user?.id) {
                      toggleServerMute(serverId, user.id);
                    }
                  }}
                  onRename={openRenameFolder}
                  onChangeColor={openChangeColor}
                  onDelete={deleteFolder}
                />
              ))}

              {/* Root servers (not in folders) - sortable */}
              <SortableContext items={sortableServerIds} strategy={horizontalListSortingStrategy}>
                <AnimatePresence mode="popLayout">
                  {rootServers.map((server, index) => {
                    const isActive = currentServer?.id === server.id;
                    const channelIds = serverChannels[server.id] || [];
                    const { hasUnread, totalMentions } = getServerUnreadInfo(channelIds);

                    return (
                      <HorizontalSortableServerItem
                        key={server.id}
                        server={server}
                        index={index}
                        isActive={isActive}
                        isHovered={hoveredServer === server.id}
                        hasUnread={hasUnread}
                        totalMentions={totalMentions}
                        tooltipsEnabled={tooltipsEnabled}
                        getPillState={getPillState}
                        getServerColor={getServerColor}
                        getServerInitials={getServerInitials}
                        onHover={() => setHoveredServer(server.id)}
                        onLeave={() => setHoveredServer(null)}
                        onClick={() => {
                          setCurrentServer(server);
                          setCurrentConversation(null);
                          closeServerSettings();
                          closeModal();
                          navigate(`/app/servers/${server.id}`);
                        }}
                        onLeaveServer={async (serverId) => {
                          if (user?.id) {
                            try {
                              await leaveServer(serverId, user.id);
                              if (currentServer?.id === serverId) {
                                navigate("/app");
                              }
                            } catch (error) {
                              console.error("Failed to leave server:", error);
                            }
                          }
                        }}
                        onOpenSettings={() => {
                          setCurrentServer(server);
                          openServerSettings();
                        }}
                        onMarkAsRead={() => {
                          if (channelIds.length > 0) {
                            markServerAsRead(channelIds);
                          }
                        }}
                        onToggleMute={() => {
                          if (user?.id) {
                            toggleServerMute(server.id, user.id);
                          }
                        }}
                      />
                    );
                  })}
                </AnimatePresence>
              </SortableContext>

              {/* Add Server button - inline with servers */}
              <Tooltip delayDuration={300} open={tooltipsEnabled ? undefined : false}>
                <TooltipTrigger asChild>
                  <MotionButton
                    whileTap={{ scale: 0.95 }}
                    whileHover="hover"
                    initial="default"
                    onClick={() => openModal("create-server")}
                    className="relative w-10 h-10 rounded-[4px] text-muted-foreground hover:text-foreground transition-colors duration-200 flex items-center justify-center overflow-hidden flex-shrink-0"
                  >
                    <motion.svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 40 40">
                      <motion.rect
                        x="1"
                        y="1"
                        width="38"
                        height="38"
                        rx="3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="5 3"
                        variants={{
                          default: { strokeDashoffset: 0, opacity: 0.5 },
                          hover: {
                            strokeDashoffset: -8,
                            opacity: 0,
                            transition: {
                              strokeDashoffset: { duration: 0.6, ease: "linear" },
                              opacity: { duration: 0.2, delay: 0.4 },
                            },
                          },
                        }}
                      />
                    </motion.svg>
                    <motion.div
                      className="absolute inset-0 rounded-[4px] border border-muted-foreground/50 pointer-events-none"
                      variants={{ default: { opacity: 0 }, hover: { opacity: 1 } }}
                      transition={{ duration: 0.2 }}
                    />
                    <Plus className="w-4 h-4 relative z-10" />
                  </MotionButton>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="font-medium">
                  Add or Join a Server
                </TooltipContent>
              </Tooltip>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={() => setIsCreateFolderOpen(true)}>Create folder…</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem disabled className="text-muted-foreground">
              Drag servers onto a folder to organize
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        <DragOverlay>
          {activeDragServer ? (
            <ServerIconVisual
              server={activeDragServer}
              getServerColor={getServerColor}
              getServerInitials={getServerInitials}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Right side - Notifications & Settings */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-0.5 h-6 bg-border rounded-full" />

        {/* Notification bell */}
        <Tooltip delayDuration={300} open={tooltipsEnabled ? undefined : false}>
          <TooltipTrigger asChild>
            <div>
              <NotificationBell variant="sidebar" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="font-medium">
            Notifications
          </TooltipContent>
        </Tooltip>

        {/* Support Us button */}
        <SupportUsButton tooltipsEnabled={tooltipsEnabled} />
      </div>

      {/* Dialogs */}
      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create folder</DialogTitle>
            <DialogDescription>Choose a name and color for your server folder.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-2">
              <Label htmlFor="kloak-folder-name-h">Name</Label>
              <Input
                id="kloak-folder-name-h"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. Work, Friends, Gaming"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kloak-folder-color-h">Color</Label>
              <Input
                id="kloak-folder-color-h"
                type="color"
                value={newFolderColor}
                onChange={(e) => setNewFolderColor(e.target.value)}
                className="h-10 w-14 p-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateFolderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
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
            <Label htmlFor="kloak-rename-folder-h">Folder name</Label>
            <Input
              id="kloak-rename-folder-h"
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
            <Button variant="ghost" onClick={() => setIsRenameFolderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameFolder} disabled={!renameFolderName.trim()}>
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
            <Label htmlFor="kloak-change-folder-color-h">Folder color</Label>
            <Input
              id="kloak-change-folder-color-h"
              type="color"
              value={changeFolderColor}
              onChange={(e) => setChangeFolderColor(e.target.value)}
              className="h-20 w-full p-2"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsChangeFolderColorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangeColor}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
