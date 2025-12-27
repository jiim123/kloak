import { useState, useMemo, useEffect } from 'react';
import { Home, Plus, Users, MessageSquarePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import { useUIStore } from '@/stores/uiStore';
import { useUnread } from '@/hooks/useUnread';
import { StatusSelector } from '@/components/StatusSelector';
import { ServerIconSkeleton } from '@/components/ui/skeletons';
import { supabase } from '@/integrations/supabase/client';
import type { Channel } from '@/types';

// Status colors
const statusColors: Record<string, string> = {
  online: 'bg-green-500',
  idle: 'bg-yellow-500',
  dnd: 'bg-red-500',
  offline: 'bg-gray-500',
};

interface ServerChannels {
  [serverId: string]: string[];
}

export const ServerSidebar = () => {
  const { user } = useAuthStore();
  const { servers, currentServer, setCurrentServer, isLoading, fetchServers } = useServerStore();
  const { openModal } = useUIStore();
  const [serverChannels, setServerChannels] = useState<ServerChannels>({});

  // Fetch servers when user is available (on login/mount)
  useEffect(() => {
    if (user?.id) {
      fetchServers(user.id);
    }
  }, [user?.id, fetchServers]);

  // Fetch all channels for all servers
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

  // Get all channel IDs for unread tracking
  const allChannelIds = useMemo(() => {
    return Object.values(serverChannels).flat();
  }, [serverChannels]);

  const { getServerUnreadInfo } = useUnread(allChannelIds);
  
  // Track which server is being hovered for pill animation
  const [hoveredServer, setHoveredServer] = useState<string | null>(null);

  // Get initials from server name
  const getServerInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  // Get initials from username
  const getUserInitials = (username?: string) => {
    if (!username) return '?';
    return username.slice(0, 2).toUpperCase();
  };

  // Generate a color based on server name
  const getServerColor = (name: string) => {
    const colors = [
      'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 
      'bg-red-500', 'bg-orange-500', 'bg-yellow-500',
      'bg-green-500', 'bg-teal-500', 'bg-cyan-500', 'bg-blue-500',
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  return (
    <div className="h-full flex flex-col items-center py-3 gap-2">
      {/* Home button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              'relative w-12 h-12 p-0 transition-all duration-200',
              currentServer === null 
                ? 'bg-primary text-primary-foreground rounded-2xl' 
                : 'bg-secondary hover:bg-primary hover:text-primary-foreground rounded-full hover:rounded-2xl'
            )}
            onClick={() => setCurrentServer(null)}
          >
            {/* Active indicator pill */}
            {currentServer === null && (
              <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-10 bg-foreground rounded-r-full" />
            )}
            <Home className="w-5 h-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-semibold">
          Direct Messages
        </TooltipContent>
      </Tooltip>

      <Separator className="w-8 h-0.5 bg-border rounded-full" />

      {/* Server list */}
      <div className="flex-1 flex flex-col items-center gap-2 overflow-y-auto scrollbar-hide w-full px-3">
        {/* Loading skeletons */}
        {isLoading && servers.length === 0 && (
          <>
            <ServerIconSkeleton />
            <ServerIconSkeleton />
            <ServerIconSkeleton />
          </>
        )}

        {/* Empty state */}
        {!isLoading && servers.length === 0 && (
          <div className="flex flex-col items-center py-4 text-center">
            <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center mb-2">
              <Users className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-[10px] text-muted-foreground px-2">No servers yet</p>
          </div>
        )}

        {servers.map((server) => {
          const isActive = currentServer?.id === server.id;
          const isHovered = hoveredServer === server.id;
          const channelIds = serverChannels[server.id] || [];
          const { hasUnread, totalMentions } = getServerUnreadInfo(channelIds);
          
          return (
            <Tooltip key={server.id}>
              <TooltipTrigger asChild>
                <div
                  className="relative"
                  onMouseEnter={() => setHoveredServer(server.id)}
                  onMouseLeave={() => setHoveredServer(null)}
                >
                  {/* Active/Hover indicator pill */}
                  <span 
                    className={cn(
                      'absolute -left-3 top-1/2 -translate-y-1/2 w-1 bg-foreground rounded-r-full transition-all duration-200',
                      isActive ? 'h-10' : isHovered ? 'h-5' : hasUnread && !isActive ? 'h-2' : 'h-0'
                    )} 
                  />
                  
                  <Button
                    variant="ghost"
                    className={cn(
                      'w-12 h-12 p-0 transition-all duration-200 overflow-hidden',
                      isActive 
                        ? 'rounded-2xl' 
                        : 'rounded-full hover:rounded-2xl',
                      !server.icon_url && getServerColor(server.name)
                    )}
                    onClick={() => setCurrentServer(server)}
                  >
                    {server.icon_url ? (
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={server.icon_url} alt={server.name} />
                        <AvatarFallback className={getServerColor(server.name)}>
                          {getServerInitials(server.name)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <span className="text-sm font-semibold text-white">
                        {getServerInitials(server.name)}
                      </span>
                    )}
                  </Button>

                  {/* Unread indicator dot */}
                  {hasUnread && !isActive && totalMentions === 0 && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-white rounded-full border-2 border-layout-sidebar" />
                  )}
                  
                  {/* Mention badge */}
                  {totalMentions > 0 && (
                    <span className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] bg-destructive rounded-full text-xs text-destructive-foreground flex items-center justify-center px-1 font-bold">
                      {totalMentions > 99 ? '99+' : totalMentions}
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-semibold">
                {server.name}
              </TooltipContent>
            </Tooltip>
          );
        })}

        {/* Add Server button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className="w-12 h-12 p-0 rounded-full border-2 border-dashed border-green-500 text-green-500 hover:bg-green-500 hover:text-white hover:border-solid transition-all duration-200"
              onClick={() => openModal('create-server')}
            >
              <Plus className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-semibold">
            Add a Server
          </TooltipContent>
        </Tooltip>
      </div>

      <Separator className="w-8 h-0.5 bg-border rounded-full" />

      {/* User settings button - click to change status */}
      <StatusSelector side="right" align="end">
        <button className="relative w-10 h-10 p-0 rounded-full hover:opacity-80 transition-opacity">
          <Avatar className="w-10 h-10">
            <AvatarImage src={user?.avatar_url || undefined} alt={user?.username} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {getUserInitials(user?.username)}
            </AvatarFallback>
          </Avatar>
          
          {/* Status indicator */}
          <span 
            className={cn(
              'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-layout-sidebar',
              statusColors[user?.status || 'offline']
            )} 
          />
        </button>
      </StatusSelector>
    </div>
  );
};