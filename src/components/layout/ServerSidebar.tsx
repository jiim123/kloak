import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Plus, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import { useUIStore } from '@/stores/uiStore';
import { useUnread } from '@/hooks/useUnread';
import { supabase } from '@/integrations/supabase/client';

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
  hover: { scale: 1.05, borderRadius: 10 },
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
      type: 'spring' as const,
      stiffness: 300,
      damping: 24,
    },
  }),
};

export const ServerSidebar = () => {
  const { user } = useAuthStore();
  const { servers, currentServer, setCurrentServer, isLoading, fetchServers } = useServerStore();
  const { openModal } = useUIStore();
  const [serverChannels, setServerChannels] = useState<ServerChannels>({});
  const [hoveredServer, setHoveredServer] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchServers(user.id);
    }
  }, [user?.id, fetchServers]);

  useEffect(() => {
    const fetchAllChannels = async () => {
      if (servers.length === 0) return;
      
      const serverIds = servers.map(s => s.id);
      const { data: channels } = await supabase
        .from('channels')
        .select('id, server_id')
        .in('server_id', serverIds);

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

  const getServerInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const getServerColor = (name: string) => {
    const colors = [
      'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 
      'bg-red-500', 'bg-orange-500', 'bg-amber-500',
      'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-blue-500',
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  const getPillState = (serverId: string | null, hasUnread: boolean) => {
    if (currentServer?.id === serverId || (serverId === null && currentServer === null)) {
      return 'active';
    }
    if (hoveredServer === serverId) {
      return 'hover';
    }
    if (hasUnread) {
      return 'unread';
    }
    return 'hidden';
  };

  return (
    <div className="h-full flex flex-col items-center py-3 gap-2 bg-layout-sidebar">
      {/* Home button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            className="relative group"
            onMouseEnter={() => setHoveredServer(null)}
            onMouseLeave={() => setHoveredServer(null)}
            onClick={() => setCurrentServer(null)}
            whileHover="hover"
            whileTap="tap"
          >
            {/* Indicator pill */}
            <motion.span
              className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 bg-foreground rounded-r-full"
              variants={pillVariants}
              initial="hidden"
              animate={getPillState(null, false)}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
            
            <motion.div
              variants={iconVariants}
              initial="animate"
              animate={currentServer === null ? 'active' : 'animate'}
              whileHover="hover"
              whileTap="tap"
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className={cn(
                'w-12 h-12 flex items-center justify-center',
                currentServer === null 
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary/50' 
                  : 'bg-secondary hover:bg-primary hover:text-primary-foreground'
              )}
            >
              <MessageCircle className="w-5 h-5" />
            </motion.div>
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          Direct Messages
        </TooltipContent>
      </Tooltip>

      {/* Separator */}
      <div className="w-8 h-0.5 bg-border rounded-full" />

      {/* Server list */}
      <div className="flex-1 flex flex-col items-center gap-2 overflow-y-auto scrollbar-hide w-full px-3">
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
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
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                      
                      <motion.div
                        variants={iconVariants}
                        initial="animate"
                        animate={isActive ? 'active' : 'animate'}
                        whileHover="hover"
                        whileTap="tap"
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        className={cn(
                          'w-12 h-12 overflow-hidden',
                          isActive && 'ring-2 ring-primary/50',
                          !server.icon_url && getServerColor(server.name)
                        )}
                      >
                        {server.icon_url ? (
                          <Avatar className="w-12 h-12">
                            <AvatarImage src={server.icon_url} alt={server.name} className="object-cover" />
                            <AvatarFallback className={getServerColor(server.name)}>
                              {getServerInitials(server.name)}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-sm font-bold text-white">
                              {getServerInitials(server.name)}
                            </span>
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
                            {totalMentions > 99 ? '99+' : totalMentions}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.button>
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
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => openModal('create-server')}
              className="w-12 h-12 rounded-[6px] border-2 border-dashed border-nomo-success text-nomo-success hover:bg-nomo-success hover:text-white hover:border-solid transition-all duration-200 flex items-center justify-center"
            >
              <Plus className="w-5 h-5" />
            </motion.button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            Add a Server
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Separator */}
      <div className="w-8 h-0.5 bg-border rounded-full" />

      {/* User settings button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            whileHover={{ scale: 1.05, rotate: 90 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            onClick={() => openModal('user-settings')}
            className="w-12 h-12 rounded-[6px] bg-secondary hover:bg-secondary/80 transition-colors flex items-center justify-center"
          >
            <Settings className="w-5 h-5" />
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          User Settings
        </TooltipContent>
      </Tooltip>
    </div>
  );
};