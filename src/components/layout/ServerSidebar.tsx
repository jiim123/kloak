import { useState, useMemo, useEffect, useCallback, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Folder, Plus, Settings, Home, Mail, Columns3, ChevronDown, ChevronRight, Trash2, Edit2, Palette, LogOut, CheckCheck, BellOff, Bell } from "lucide-react";
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

interface ServerChannels {
  [serverId: string]: string[];
}

interface ServerFolder {
  id: string;
  name: string;
  color: string; // hex
  isCollapsed: boolean;
  serverIds: string[];
}

interface ServerFolderState {
  folders: ServerFolder[];
  serverToFolder: Record<string, string>; // serverId -> folderId
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

    // Basic sanitize
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cryptoAny = crypto as any;
  if (cryptoAny?.randomUUID) return cryptoAny.randomUUID() as string;
  return `folder-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

// Animation variants
const pillVariants = {
  hidden: { height: 0, opacity: 0 },
  hover: { height: 20, opacity: 1 },
  unread: { height: 8, opacity: 1 },
  active: { height: 40, opacity: 1 },
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
        "w-12 h-12 overflow-hidden rounded-[6px] flex items-center justify-center",
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
  );
};

const FolderItem = ({
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

  return (
    <ContextMenu>
      <Tooltip delayDuration={300} open={tooltipsEnabled ? undefined : false}>
        <ContextMenuTrigger asChild>
          <TooltipTrigger asChild>
            <MotionButton
              ref={setNodeRef}
              className={cn("relative group", isOver && "ring-1 ring-primary/50 rounded-[6px]")}
              onClick={() => onToggleCollapse(folder.id)}
              whileHover="hover"
              whileTap="tap"
            >
              <motion.div
                variants={iconVariants}
                initial="animate"
                animate="animate"
                whileHover="hover"
                whileTap="tap"
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
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

      <ContextMenuContent className="w-52 rounded-xl border-border/50 p-1.5">
        <ContextMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onRename(folder.id);
          }}
        >
          <Edit2 className="w-4 h-4 mr-2" />
          Rename folder
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onChangeColor(folder.id);
          }}
        >
          <Palette className="w-4 h-4 mr-2" />
          Change color
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onDelete(folder.id);
          }}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete folder
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

const DraggableServerItem = forwardRef<
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
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
      id: getServerDragId(server.id),
    });

    const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

    const isOwner = server.owner_id === useAuthStore.getState().user?.id;
    const canManageServer = isOwner; // Full permission check requires role data not available here; owner is safe fallback

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
            exit={{ opacity: 0, x: -20, transition: { duration: 0.15 } }}
            layout
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
                  {/* Indicator pill */}
                  <motion.span
                    className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 bg-foreground rounded-r-full"
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
                      "w-12 h-12 overflow-hidden",
                      isActive && !server.icon_url && "ring-2 ring-primary/50",
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
              <TooltipContent side="right" className="font-medium">
                {server.name}
              </TooltipContent>
            </Tooltip>
          </motion.div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onSelect={(e) => {
              e.preventDefault();
              onMarkAsRead?.();
            }}
          >
            <CheckCheck className="w-4 h-4 mr-2" />
            Mark as Read
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={(e) => {
              e.preventDefault();
              onToggleMute?.();
            }}
          >
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
            <ContextMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onOpenSettings();
              }}
            >
              <Settings className="w-4 h-4 mr-2" />
              Server Settings
            </ContextMenuItem>
          )}
          {!isOwner && onLeaveServer && (
            <ContextMenuItem
              onSelect={(e) => {
                e.preventDefault();
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

DraggableServerItem.displayName = "DraggableServerItem";

export const ServerSidebar = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { servers, currentServer, setCurrentServer, isLoading, fetchServers, leaveServer, toggleServerMute } = useServerStore();
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

  // Disable tooltips initially to prevent them from showing when sidebar opens
  useEffect(() => {
    const timer = setTimeout(() => {
      setTooltipsEnabled(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchServers(user.id);
    }
  }, [user?.id, fetchServers]);

  // Load folder state from database on mount
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
          // Also update localStorage cache
          try {
            localStorage.setItem(
              SERVER_FOLDERS_STORAGE_KEY,
              JSON.stringify({ folders: sanitizedFolders, serverToFolder }),
            );
          } catch {
            // ignore
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

  // Persist folders state to localStorage and database (debounced)
  useEffect(() => {
    if (!isFolderStateLoaded || !user?.id) return;

    // Immediately save to localStorage
    try {
      localStorage.setItem(SERVER_FOLDERS_STORAGE_KEY, JSON.stringify(folderState));
    } catch {
      // ignore
    }

    // Debounce database save
    const timeoutId = setTimeout(async () => {
      try {
        const { error } = await supabase.rpc("save_user_server_folders" as any, {
          _user_id: user.id,
          _folder_data: folderState,
        });

        if (error) {
          console.error("Failed to save folder state to database:", error);
        }
      } catch (err) {
        console.error("Error saving folder state:", err);
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [folderState, user?.id, isFolderStateLoaded]);

  // Clean up folder mappings when servers list changes
  useEffect(() => {
    // Skip cleanup on initial load when servers haven't loaded yet
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
  const pendingFriendCount = useFriendStore((s) => s.pendingRequests.length);
  const totalHomeBadge = totalDMUnread + pendingFriendCount;
  const hasHomeUnread = hasDMUnread || pendingFriendCount > 0;

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
      folders: [
        ...prev.folders,
        {
          id,
          name,
          color: newFolderColor || "#6366f1",
          isCollapsed: false,
          serverIds: [],
        },
      ],
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
      } else if (overId.startsWith("folder:")) {
        const folderId = overId.slice("folder:".length);
        moveServerToFolder(serverId, folderId);
      }

      setActiveDragServerId(null);
    },
    [moveServerToFolder],
  );

  const folderById = useMemo(() => new Map(folderState.folders.map((f) => [f.id, f])), [folderState.folders]);
  const rootServers = useMemo(() => {
    return servers.filter((s) => !folderById.has(folderState.serverToFolder[s.id] || ""));
  }, [servers, folderState.serverToFolder, folderById]);

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

  return (
    <div className="h-full flex flex-col items-center bg-layout-sidebar relative overflow-hidden">
      {/* Server list */}
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
                "flex-1 flex flex-col items-center gap-2 overflow-y-auto scrollbar-overlay scrollbar-hide w-full pl-3 pr-2 pt-3 pb-24",
                isOverRoot && "outline outline-2 outline-primary/30 outline-offset-[-2px] rounded-md",
              )}
            >
              {/* Loading skeleton */}
              {isLoading && servers.length === 0 && (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-12 h-12 rounded-[6px] bg-secondary/50"
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
                    className="relative group mb-2"
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
                    {/* Indicator pill */}
                    <motion.span
                      className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 bg-foreground rounded-r-full"
                      variants={pillVariants}
                      initial="hidden"
                      animate={getPillState(null, hasHomeUnread)}
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
                        "w-12 h-12 flex items-center justify-center",
                        currentServer === null
                          ? "bg-primary text-primary-foreground ring-2 ring-primary/50"
                          : "bg-secondary hover:bg-primary/20 hover:text-neutral-200",
                      )}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {currentServer === null ? (
                          <motion.span
                            key="active-icon"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <Columns3 className="w-5 h-5" />
                          </motion.span>
                        ) : (
                          <motion.span
                            key="inactive-icon"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <Mail className="w-5 h-5" />
                          </motion.span>
                        )}
                      </AnimatePresence>
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
                <TooltipContent side="right" className="font-medium">
                  Home{totalDMUnread > 0 ? ` (${totalDMUnread} unread)` : ""}
                </TooltipContent>
              </Tooltip>

              {/* Separator */}
              <div className="w-8 h-0.5 bg-border rounded-full mb-2 shrink-0" />

              {/* Folder items + servers */}
              <AnimatePresence mode="popLayout">
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

                    <AnimatePresence mode="popLayout">
                      {!folder.isCollapsed &&
                        folderServers.map((server, index) => {
                          const isActive = currentServer?.id === server.id;
                          const channelIds = serverChannels[server.id] || [];
                          const { hasUnread, totalMentions } = getServerUnreadInfo(channelIds);
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
                  </div>
                ))}

                {rootServers.map((server, index) => {
                  const isActive = currentServer?.id === server.id;
                  const channelIds = serverChannels[server.id] || [];
                  const { hasUnread, totalMentions } = getServerUnreadInfo(channelIds);

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

            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setIsCreateFolderOpen(true);
                setNewFolderName("");
              }}
            >
              Create folder…
            </ContextMenuItem>
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

      {/* Sticky Add Server button at bottom */}
      <div className="absolute bottom-0 left-0 right-0 pl-3 pr-2 pb-3 pt-2 bg-layout-sidebar z-10">
        <div className="w-8 h-0.5 bg-border rounded-full shrink-0 mx-auto mb-2" />
        <div className="flex justify-center">
          <Tooltip delayDuration={300} open={tooltipsEnabled ? undefined : false}>
            <TooltipTrigger asChild>
              <MotionButton
                whileTap={{ scale: 0.95 }}
                whileHover="hover"
                initial="default"
                onClick={() => openModal("create-server")}
                className="relative w-12 h-12 rounded-[6px] text-muted-foreground hover:text-foreground transition-colors duration-200 flex items-center justify-center overflow-hidden"
              >
                {/* Animated dashed border */}
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
                    variants={{
                      default: {
                        strokeDashoffset: 0,
                        opacity: 0.5,
                      },
                      hover: {
                        strokeDashoffset: -10,
                        opacity: 0,
                        transition: {
                          strokeDashoffset: {
                            duration: 0.6,
                            ease: "linear",
                          },
                          opacity: {
                            duration: 0.2,
                            delay: 0.4,
                          },
                        },
                      },
                    }}
                  />
                </motion.svg>

                {/* Solid border on hover */}
                <motion.div
                  className="absolute inset-0 rounded-[6px] border border-muted-foreground/50 pointer-events-none"
                  variants={{
                    default: {
                      opacity: 0,
                    },
                    hover: {
                      opacity: 1,
                    },
                  }}
                  transition={{ duration: 0.2 }}
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
            <Label htmlFor="kloak-rename-folder">Folder name</Label>
            <Input
              id="kloak-rename-folder"
              value={renameFolderName}
              onChange={(e) => setRenameFolderName(e.target.value)}
              placeholder="e.g. Work, Friends, Gaming"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && renameFolderName.trim()) {
                  handleRenameFolder();
                }
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
