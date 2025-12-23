import { useState } from 'react';
import { Home, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import { useUIStore } from '@/stores/uiStore';

// Status colors
const statusColors: Record<string, string> = {
  online: 'bg-green-500',
  idle: 'bg-yellow-500',
  dnd: 'bg-red-500',
  offline: 'bg-gray-500',
};

export const ServerSidebar = () => {
  const { user } = useAuthStore();
  const { servers, currentServer, setCurrentServer } = useServerStore();
  const { openModal } = useUIStore();
  
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
        {servers.map((server) => {
          const isActive = currentServer?.id === server.id;
          const isHovered = hoveredServer === server.id;
          
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
                      isActive ? 'h-10' : isHovered ? 'h-5' : 'h-0'
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

                  {/* Unread indicator dot - placeholder for future */}
                  {/* <span className="absolute bottom-0 right-0 w-3 h-3 bg-white rounded-full border-2 border-layout-sidebar" /> */}
                  
                  {/* Mention badge - placeholder for future */}
                  {/* <span className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full text-xs text-white flex items-center justify-center px-1">3</span> */}
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

      {/* User settings button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            className="relative w-10 h-10 p-0 rounded-full"
            onClick={() => openModal('user-settings')}
          >
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
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-semibold">
          {user?.username || 'User Settings'}
        </TooltipContent>
      </Tooltip>
    </div>
  );
};