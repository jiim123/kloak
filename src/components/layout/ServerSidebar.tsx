import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Settings, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MotionButton, MotionDiv } from "@/components/ui/motion-elements";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import { useUIStore } from "@/stores/uiStore";
import { useUnread } from "@/hooks/useUnread";
import { useUnreadDMs } from "@/hooks/useUnreadDMs";
import { useDMStore } from "@/stores/dmStore";
import { supabase } from "@/integrations/supabase/client";

interface ServerChannels {
  [serverId: string]: string[];
}

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

export const ServerSidebar = () => {
  const { user } = useAuthStore();
  const { servers, currentServer, setCurrentServer, isLoading, fetchServers } = useServerStore();
  const { setCurrentConversation } = useDMStore();
  const { openModal, activeModal, closeServerSettings } = useUIStore();
  const [serverChannels, setServerChannels] = useState<ServerChannels>({});
  const [hoveredServer, setHoveredServer] = useState<string | null>(null);
  const [tooltipsEnabled, setTooltipsEnabled] = useState(false);

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

  const allChannelIds = useMemo(() => {
    return Object.values(serverChannels).flat();
  }, [serverChannels]);

  const { getServerUnreadInfo } = useUnread(allChannelIds);
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

  return (
    <div className="h-full flex flex-col items-center py-3 gap-2 bg-layout-sidebar">
      {/* Server list */}
      <div className="flex-1 flex flex-col items-center gap-2 overflow-y-auto scrollbar-overlay scrollbar-hide w-full px-3">
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
              }}
              whileHover="hover"
              whileTap="tap"
            >
              {/* Indicator pill */}
              <motion.span
                className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 bg-foreground rounded-r-full"
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
                  "w-12 h-12 flex items-center justify-center",
                  currentServer === null
                    ? "bg-primary text-primary-foreground ring-2 ring-primary/50"
                    : "bg-secondary hover:bg-primary hover:text-primary-foreground",
                )}
              >
                <Home className="w-5 h-5" />
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
            Home{totalDMUnread > 0 ? ` (${totalDMUnread} unread)` : ''}
          </TooltipContent>
        </Tooltip>

        {/* Separator */}
        <div className="w-8 h-0.5 bg-border rounded-full mb-2 shrink-0" />

        {/* Server items */}
        <AnimatePresence mode="popLayout">
          {servers.map((server, index) => {
            const isActive = currentServer?.id === server.id;
            const isHovered = hoveredServer === server.id;
            const channelIds = serverChannels[server.id] || [];
            const { hasUnread, totalMentions } = getServerUnreadInfo(channelIds);

            return (
              <motion.div
                key={server.id}
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
                      className="relative group"
                      onMouseEnter={() => setHoveredServer(server.id)}
                      onMouseLeave={() => setHoveredServer(null)}
                      onClick={() => setCurrentServer(server)}
                      whileHover="hover"
                      whileTap="tap"
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

                      {/* Unread dot */}
                      <AnimatePresence>
                        {hasUnread && !isActive && totalMentions === 0 && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="absolute bottom-0 right-0 w-3 h-3 bg-white rounded-[3px] border-2 border-layout-sidebar"
                          />
                        )}
                      </AnimatePresence>

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
            );
          })}
        </AnimatePresence>

        {/* Add Server button */}
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

      {/* Bottom actions */}
      <div className="flex flex-col items-center gap-2 w-full px-3">
        <div className="w-8 h-0.5 bg-border rounded-full shrink-0" />

        <Tooltip delayDuration={300} open={tooltipsEnabled ? undefined : false}>
          <TooltipTrigger asChild>
            <MotionButton
              className="relative group"
              onMouseEnter={() => setHoveredServer(null)}
              onMouseLeave={() => setHoveredServer(null)}
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
                  "w-12 h-12 flex items-center justify-center",
                  activeModal === "user-settings"
                    ? "bg-primary text-primary-foreground ring-2 ring-primary/50"
                    : "bg-secondary hover:bg-primary hover:text-primary-foreground",
                )}
              >
                <Settings className="w-5 h-5" />
              </motion.div>
            </MotionButton>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            Settings
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
