import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Plus, Settings, Home, X, ChevronDown, LogOut, CheckCheck, BellOff, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MotionButton, MotionDiv } from "@/components/ui/motion-elements";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import { useUIStore } from "@/stores/uiStore";
import { useUnread } from "@/hooks/useUnread";
import { useUnreadDMs } from "@/hooks/useUnreadDMs";
import { useDMStore } from "@/stores/dmStore";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { ServerWithMembership, Server } from "@/types";

interface ServerChannels {
  [serverId: string]: string[];
}

interface ServerTab {
  serverId: string | null; // null means "New Tab" placeholder
  isNewTab?: boolean;
}

const SERVER_TABS_STORAGE_KEY = "kloak-server-tabs-v1";

const loadServerTabsState = (): string[] => {
  try {
    const raw = localStorage.getItem(SERVER_TABS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
};

// Animation variants
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

const tabVariants = {
  hidden: { opacity: 0, scale: 0.8, x: -20 },
  visible: {
    opacity: 1,
    scale: 1,
    x: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
  exit: { opacity: 0, scale: 0.8, x: -20, transition: { duration: 0.15 } },
};

// Server tab component
const ServerTabItem = ({
  server,
  isActive,
  hasUnread,
  totalMentions,
  tooltipsEnabled,
  getServerColor,
  getServerInitials,
  onClick,
  onClose,
  onLeaveServer,
  onOpenSettings,
  onMarkAsRead,
  onToggleMute,
}: {
  server: ServerWithMembership;
  isActive: boolean;
  hasUnread: boolean;
  totalMentions: number;
  tooltipsEnabled: boolean;
  getServerColor: (name: string) => string;
  getServerInitials: (name: string) => string;
  onClick: () => void;
  onClose: () => void;
  onLeaveServer?: (serverId: string) => void;
  onOpenSettings?: () => void;
  onMarkAsRead?: () => void;
  onToggleMute?: () => void;
}) => {
  const isOwner = server.role === "owner";

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <motion.div
          variants={tabVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          layout
          className={cn(
            "relative group flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all cursor-pointer min-w-0",
            isActive
              ? "bg-primary/15 border-primary/40"
              : "bg-secondary/50 border-border/50 hover:bg-secondary hover:border-border"
          )}
          onClick={onClick}
        >
          {/* Server icon */}
          <div
            className={cn(
              "w-6 h-6 rounded-[3px] overflow-hidden flex-shrink-0 flex items-center justify-center",
              !server.icon_url && getServerColor(server.name)
            )}
          >
            {server.icon_url ? (
              <Avatar className="w-6 h-6 border-0 rounded-[3px]">
                <AvatarImage src={server.icon_url} alt={server.name} className="object-cover rounded-[3px]" />
                <AvatarFallback className={cn("rounded-[3px] text-[10px]", getServerColor(server.name))}>
                  {getServerInitials(server.name)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <span className="text-[10px] font-bold text-white">{getServerInitials(server.name)}</span>
            )}
          </div>

          {/* Server name */}
          <span
            className={cn(
              "text-sm truncate max-w-[120px]",
              isActive ? "text-foreground font-medium" : "text-muted-foreground",
              hasUnread && !isActive && "font-semibold text-foreground"
            )}
          >
            {server.name}
          </span>

          {/* Unread/mention badge */}
          {totalMentions > 0 && (
            <span className="flex-shrink-0 min-w-[18px] h-[18px] bg-destructive rounded-[4px] text-[10px] text-destructive-foreground flex items-center justify-center px-1 font-bold">
              {totalMentions > 99 ? "99+" : totalMentions}
            </span>
          )}
          {hasUnread && totalMentions === 0 && (
            <span className="flex-shrink-0 w-2 h-2 bg-foreground rounded-full" />
          )}

          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="flex-shrink-0 p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
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
        {isOwner && onOpenSettings && (
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
};

// New Tab placeholder with server selector
const NewTabPlaceholder = ({
  servers,
  openTabServerIds,
  getServerColor,
  getServerInitials,
  onSelectServer,
  onClose,
  tooltipsEnabled,
}: {
  servers: ServerWithMembership[];
  openTabServerIds: Set<string>;
  getServerColor: (name: string) => string;
  getServerInitials: (name: string) => string;
  onSelectServer: (serverId: string) => void;
  onClose: () => void;
  tooltipsEnabled: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(true);
  
  // Filter out servers already in tabs
  const availableServers = useMemo(
    () => servers.filter((s) => !openTabServerIds.has(s.id)),
    [servers, openTabServerIds]
  );

  return (
    <motion.div
      variants={tabVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      className="relative group"
    >
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all cursor-pointer",
              "bg-primary/10 border-primary/50 text-primary"
            )}
          >
            <div className="w-6 h-6 rounded-[3px] bg-primary/20 flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium whitespace-nowrap">New Tab</span>
            <ChevronDown className="w-3.5 h-3.5" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" className="w-64 p-2 max-h-80 overflow-auto">
          <div className="text-xs font-semibold text-muted-foreground px-2 mb-2">
            Select a server
          </div>
          {availableServers.length === 0 ? (
            <div className="text-sm text-muted-foreground px-2 py-4 text-center">
              All servers are already open
            </div>
          ) : (
            <div className="space-y-1">
              {availableServers.map((server) => (
                <button
                  key={server.id}
                  onClick={() => {
                    onSelectServer(server.id);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-2 py-1.5 rounded-md transition-colors hover:bg-secondary"
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-[4px] overflow-hidden flex items-center justify-center flex-shrink-0",
                      !server.icon_url && getServerColor(server.name)
                    )}
                  >
                    {server.icon_url ? (
                      <Avatar className="w-8 h-8 border-0 rounded-[4px]">
                        <AvatarImage src={server.icon_url} alt={server.name} className="object-cover rounded-[4px]" />
                        <AvatarFallback className={cn("rounded-[4px]", getServerColor(server.name))}>
                          {getServerInitials(server.name)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <span className="text-xs font-bold text-white">{getServerInitials(server.name)}</span>
                    )}
                  </div>
                  <span className="text-sm truncate">{server.name}</span>
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </motion.div>
  );
};

export const HorizontalServerSidebar = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { servers, currentServer, setCurrentServer, isLoading, fetchServers, leaveServer, toggleServerMute } = useServerStore();
  const { setCurrentConversation } = useDMStore();
  const { openModal, activeModal, closeModal, closeServerSettings, openServerSettings } = useUIStore();
  const [serverChannels, setServerChannels] = useState<ServerChannels>({});
  const [tooltipsEnabled, setTooltipsEnabled] = useState(false);
  
  // Tab state: array of server IDs that are pinned/open as tabs
  const [openTabs, setOpenTabs] = useState<ServerTab[]>([]);
  const [isTabsLoaded, setIsTabsLoaded] = useState(false);

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

  // Load tabs from localStorage/database
  useEffect(() => {
    if (!user?.id || isTabsLoaded) return;

    const loadTabs = async () => {
      try {
        // Try to load from database first
        const { data, error } = await supabase.rpc("get_user_server_tabs" as any, {
          _user_id: user.id,
        });

        if (!error && data && Array.isArray(data)) {
          const serverIds = data.filter((id: any) => typeof id === "string");
          setOpenTabs(serverIds.map((id: string) => ({ serverId: id })));
          try {
            localStorage.setItem(SERVER_TABS_STORAGE_KEY, JSON.stringify(serverIds));
          } catch {}
        } else {
          // Fallback to localStorage
          const localTabs = loadServerTabsState();
          setOpenTabs(localTabs.map((id) => ({ serverId: id })));
        }
      } catch {
        // Fallback to localStorage
        const localTabs = loadServerTabsState();
        setOpenTabs(localTabs.map((id) => ({ serverId: id })));
      }
      setIsTabsLoaded(true);
    };

    loadTabs();
  }, [user?.id, isTabsLoaded]);

  // Clean up tabs when servers change (remove tabs for servers user left)
  useEffect(() => {
    if (!isTabsLoaded || servers.length === 0) return;

    const serverIdSet = new Set(servers.map((s) => s.id));
    setOpenTabs((prev) => {
      const filtered = prev.filter((tab) => tab.isNewTab || (tab.serverId && serverIdSet.has(tab.serverId)));
      if (filtered.length !== prev.length) {
        return filtered;
      }
      return prev;
    });
  }, [servers, isTabsLoaded]);

  // Persist tabs
  useEffect(() => {
    if (!isTabsLoaded || !user?.id) return;

    const serverIds = openTabs
      .filter((tab) => tab.serverId && !tab.isNewTab)
      .map((tab) => tab.serverId as string);

    try {
      localStorage.setItem(SERVER_TABS_STORAGE_KEY, JSON.stringify(serverIds));
    } catch {}

    // Debounce database save
    const timeoutId = setTimeout(async () => {
      try {
        await supabase.rpc("save_user_server_tabs" as any, {
          _user_id: user.id,
          _tab_data: serverIds,
        });
      } catch (err) {
        console.error("Error saving tabs:", err);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [openTabs, user?.id, isTabsLoaded]);

  // Fetch all channels for unread counts
  useEffect(() => {
    const fetchAllChannels = async () => {
      if (servers.length === 0) return;

      const serverIds = servers.map((s) => s.id);
      const { data: channels } = await supabase.from("channels").select("id, server_id").in("server_id", serverIds);

      if (channels) {
        const channelsByServer: ServerChannels = {};
        channels.forEach((ch: { id: string; server_id: string }) => {
          if (!channelsByServer[ch.server_id]) {
            channelsByServer[ch.server_id] = [];
          }
          channelsByServer[ch.server_id].push(ch.id);
        });
        setServerChannels(channelsByServer);
      }
    };

    fetchAllChannels();
  }, [servers]);

  const allChannelIds = useMemo(() => Object.values(serverChannels).flat(), [serverChannels]);
  const { getServerUnreadInfo, markServerAsRead } = useUnread(allChannelIds);
  const { totalUnread: totalDMUnread, hasUnread: hasDMUnread } = useUnreadDMs(user?.id || null);

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
      "bg-indigo-500", "bg-purple-500", "bg-pink-500", "bg-red-500", "bg-orange-500",
      "bg-amber-500", "bg-emerald-500", "bg-teal-500", "bg-cyan-500", "bg-blue-500",
    ];
    const index = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  const getPillState = (serverId: string | null, hasUnread: boolean) => {
    if (currentServer?.id === serverId || (serverId === null && currentServer === null)) {
      return "active";
    }
    if (hasUnread) {
      return "unread";
    }
    return "hidden";
  };

  const serversById = useMemo(() => new Map(servers.map((s) => [s.id, s])), [servers]);

  const openTabServerIds = useMemo(
    () => new Set(openTabs.filter((t) => t.serverId && !t.isNewTab).map((t) => t.serverId as string)),
    [openTabs]
  );

  const hasNewTabOpen = useMemo(() => openTabs.some((t) => t.isNewTab), [openTabs]);

  // Add a new empty tab
  const addNewTab = useCallback(() => {
    if (hasNewTabOpen) return; // Don't allow multiple new tabs
    setOpenTabs((prev) => [...prev, { serverId: null, isNewTab: true }]);
  }, [hasNewTabOpen]);

  // Select a server for the new tab placeholder
  const selectServerForNewTab = useCallback((serverId: string) => {
    setOpenTabs((prev) => {
      // Find the new tab placeholder and replace it with the selected server
      const newTabIndex = prev.findIndex((t) => t.isNewTab);
      if (newTabIndex === -1) {
        // No new tab placeholder, just add the server
        return [...prev, { serverId }];
      }
      const updated = [...prev];
      updated[newTabIndex] = { serverId };
      return updated;
    });

    // Navigate to the server
    const server = serversById.get(serverId);
    if (server) {
      setCurrentServer(server);
      setCurrentConversation(null);
      closeServerSettings();
      closeModal();
      navigate(`/app/servers/${serverId}`);
    }
  }, [serversById, setCurrentServer, setCurrentConversation, closeServerSettings, closeModal, navigate]);

  // Close a tab
  const closeTab = useCallback((tabIndex: number) => {
    setOpenTabs((prev) => {
      const updated = prev.filter((_, i) => i !== tabIndex);
      return updated;
    });
  }, []);

  // Remove new tab placeholder
  const removeNewTabPlaceholder = useCallback(() => {
    setOpenTabs((prev) => prev.filter((t) => !t.isNewTab));
  }, []);

  return (
    <div className="w-full h-14 flex items-center px-3 gap-2 bg-background border-b border-border/30">
      <div className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-hide h-full py-1">
        {/* Loading skeleton */}
        {isLoading && servers.length === 0 && (
          <div className="flex gap-2">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="w-32 h-9 rounded-lg bg-secondary/50 flex-shrink-0"
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
                    : "bg-secondary hover:bg-primary/20 hover:text-neutral-200"
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

        {/* Server tabs */}
        <AnimatePresence mode="popLayout">
          {openTabs.map((tab, index) => {
            if (tab.isNewTab) {
              return (
                <NewTabPlaceholder
                  key="new-tab"
                  servers={servers}
                  openTabServerIds={openTabServerIds}
                  getServerColor={getServerColor}
                  getServerInitials={getServerInitials}
                  onSelectServer={selectServerForNewTab}
                  onClose={removeNewTabPlaceholder}
                  tooltipsEnabled={tooltipsEnabled}
                />
              );
            }

            const server = tab.serverId ? serversById.get(tab.serverId) : null;
            if (!server) return null;

            const isActive = currentServer?.id === server.id;
            const channelIds = serverChannels[server.id] || [];
            const { hasUnread, totalMentions } = getServerUnreadInfo(channelIds);

            return (
              <ServerTabItem
                key={server.id}
                server={server}
                isActive={isActive}
                hasUnread={hasUnread}
                totalMentions={totalMentions}
                tooltipsEnabled={tooltipsEnabled}
                getServerColor={getServerColor}
                getServerInitials={getServerInitials}
                onClick={() => {
                  setCurrentServer(server);
                  setCurrentConversation(null);
                  closeServerSettings();
                  closeModal();
                  navigate(`/app/servers/${server.id}`);
                }}
                onClose={() => closeTab(index)}
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

        {/* New Tab button */}
        <Tooltip delayDuration={300} open={tooltipsEnabled ? undefined : false}>
          <TooltipTrigger asChild>
            <MotionButton
              whileTap={{ scale: 0.95 }}
              whileHover="hover"
              initial="default"
              onClick={addNewTab}
              disabled={hasNewTabOpen}
              className={cn(
                "relative w-10 h-10 rounded-[4px] text-muted-foreground hover:text-foreground transition-colors duration-200 flex items-center justify-center overflow-hidden flex-shrink-0",
                hasNewTabOpen && "opacity-50 cursor-not-allowed"
              )}
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
                      transition: { strokeDashoffset: { duration: 0.6, ease: "linear" }, opacity: { duration: 0.2, delay: 0.4 } },
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
            {hasNewTabOpen ? "Complete selection first" : "New Tab"}
          </TooltipContent>
        </Tooltip>
      </div>

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

        {/* Settings button */}
        <Tooltip delayDuration={300} open={tooltipsEnabled ? undefined : false}>
          <TooltipTrigger asChild>
            <MotionButton
              className="relative group flex-shrink-0"
              onClick={() => openModal("user-settings")}
              whileHover="hover"
              whileTap="tap"
            >
              <motion.div
                variants={iconVariants}
                initial="animate"
                animate={activeModal === "user-settings" ? "active" : "animate"}
                whileHover="hover"
                whileTap="tap"
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className={cn(
                  "w-10 h-10 flex items-center justify-center",
                  activeModal === "user-settings"
                    ? "bg-primary text-primary-foreground ring-2 ring-primary/50"
                    : "bg-secondary hover:bg-primary/20 hover:text-neutral-200"
                )}
              >
                <Settings className="w-4 h-4" />
              </motion.div>
            </MotionButton>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="font-medium">
            Settings
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
