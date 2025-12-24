import { useState, useMemo } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Hash, 
  Volume2, 
  Settings, 
  Plus, 
  LogOut,
  UserPlus,
  Users,
  FolderPlus,
  Mic,
  Headphones,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import { useUIStore } from '@/stores/uiStore';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import type { Channel, ChannelCategory, ServerRole } from '@/types';

// Helper to check admin permissions
const isAdminRole = (role: ServerRole | undefined): boolean => {
  return role === 'owner' || role === 'admin' || role === 'moderator';
};

export const ChannelSidebar = () => {
  const { user, logout } = useAuthStore();
  const { 
    currentServer, 
    currentChannel, 
    setCurrentChannel,
    categories, 
    channels,
    servers,
    leaveServer
  } = useServerStore();
  const { openModal } = useUIStore();

  // Track collapsed categories locally
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Get current user's role in this server
  const currentMembership = useMemo(() => {
    if (!currentServer) return null;
    return servers.find(s => s.id === currentServer.id);
  }, [servers, currentServer]);

  const userRole = currentMembership?.role;
  const isAdmin = isAdminRole(userRole);
  const isOwner = userRole === 'owner';

  // Group channels by category
  const channelsByCategory = useMemo(() => {
    const uncategorized: Channel[] = [];
    const categorized: Map<string, Channel[]> = new Map();

    channels.forEach(channel => {
      if (channel.category_id) {
        const existing = categorized.get(channel.category_id) || [];
        categorized.set(channel.category_id, [...existing, channel]);
      } else {
        uncategorized.push(channel);
      }
    });

    return { uncategorized, categorized };
  }, [channels]);

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleLeaveServer = async () => {
    if (!currentServer || !user || isOwner) return;
    await leaveServer(currentServer.id, user.id);
  };

  const renderChannel = (channel: Channel) => {
    const isActive = currentChannel?.id === channel.id;
    // TODO: Add unread/mention tracking
    const isUnread = false;
    const mentionCount = 0;

    return (
      <ContextMenu key={channel.id}>
        <ContextMenuTrigger>
          <button
            className={cn(
              'group w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors',
              isActive
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-secondary-foreground',
              isUnread && !isActive && 'text-foreground font-semibold'
            )}
            onClick={() => setCurrentChannel(channel)}
          >
            {channel.type === 'text' ? (
              <Hash className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
            ) : (
              <Volume2 className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
            )}
            <span className="truncate flex-1 text-left">{channel.name}</span>
            
            {/* Mention badge */}
            {mentionCount > 0 && (
              <span className="ml-auto px-1.5 py-0.5 text-xs font-bold rounded-full bg-destructive text-destructive-foreground">
                {mentionCount}
              </span>
            )}

            {/* Admin actions on hover */}
            {isAdmin && (
              <Settings 
                className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground" 
                onClick={(e) => {
                  e.stopPropagation();
                  openModal('edit-channel', { channelId: channel.id });
                }}
              />
            )}
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {isAdmin && (
            <>
              <ContextMenuItem onClick={() => openModal('edit-channel', { channelId: channel.id })}>
                <Settings className="w-4 h-4 mr-2" />
                Edit Channel
              </ContextMenuItem>
              <ContextMenuItem 
                className="text-destructive"
                onClick={() => openModal('delete-message', { channelId: channel.id, type: 'channel' })}
              >
                Delete Channel
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem>
            Mark as Read
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const renderCategory = (category: ChannelCategory) => {
    const isCollapsed = collapsedCategories.has(category.id);
    const categoryChannels = channelsByCategory.categorized.get(category.id) || [];

    return (
      <div key={category.id} className="mb-2">
        {/* Category header */}
        <div className="group flex items-center gap-0.5 px-0.5">
          <button
            className="flex items-center gap-0.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground uppercase tracking-wide flex-1"
            onClick={() => toggleCategory(category.id)}
          >
            {isCollapsed ? (
              <ChevronRight className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            <span className="truncate">{category.name}</span>
            {isCollapsed && (
              <span className="ml-1 text-muted-foreground">({categoryChannels.length})</span>
            )}
          </button>
          
          {/* Add channel button (admin only) */}
          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="p-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                  onClick={() => openModal('create-channel', { categoryId: category.id })}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Create Channel</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Channels in category */}
        {!isCollapsed && (
          <div className="mt-0.5 space-y-0.5">
            {categoryChannels.map(channel => renderChannel(channel))}
          </div>
        )}
      </div>
    );
  };

  if (!currentServer) {
    return (
      <div className="h-full flex flex-col border-r border-border bg-layout-sidebar-secondary">
        <div className="flex-1 flex items-center justify-center p-4 text-muted-foreground text-sm text-center">
          Select a server to view channels
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col border-r border-border">
      {/* Server header with dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="h-12 px-4 flex items-center justify-between border-b border-border hover:bg-secondary/50 cursor-pointer w-full text-left">
            <h2 className="font-semibold text-foreground truncate">{currentServer.name}</h2>
            <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="start" sideOffset={0}>
          <DropdownMenuItem onClick={() => openModal('invite', { serverId: currentServer.id })}>
            <UserPlus className="w-4 h-4 mr-2" />
            Invite People
          </DropdownMenuItem>

          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => openModal('server-settings', { serverId: currentServer.id })}>
                <Settings className="w-4 h-4 mr-2" />
                Server Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openModal('create-channel', { serverId: currentServer.id })}>
                <Hash className="w-4 h-4 mr-2" />
                Create Channel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openModal('create-channel', { serverId: currentServer.id, isCategory: true })}>
                <FolderPlus className="w-4 h-4 mr-2" />
                Create Category
              </DropdownMenuItem>
            </>
          )}

          {!isOwner && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive"
                onClick={handleLeaveServer}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Leave Server
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Uncategorized channels first */}
        {channelsByCategory.uncategorized.length > 0 && (
          <div className="mb-2 space-y-0.5">
            {channelsByCategory.uncategorized.map(channel => renderChannel(channel))}
          </div>
        )}

        {/* Categories with their channels */}
        {categories.map(category => renderCategory(category))}

        {/* Empty state */}
        {channels.length === 0 && categories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Hash className="w-10 h-10 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No channels yet</p>
            {isAdmin && (
              <Button 
                variant="link" 
                size="sm" 
                className="mt-1"
                onClick={() => openModal('create-channel', { serverId: currentServer.id })}
              >
                Create a channel
              </Button>
            )}
          </div>
        )}
      </div>

      {/* User panel */}
      <div className="h-14 px-2 flex items-center gap-2 bg-layout-sidebar border-t border-border">
        {/* Avatar with status */}
        <div className="relative flex-shrink-0">
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white cursor-pointer hover:opacity-80 transition-opacity"
            style={{ backgroundColor: user?.banner_color || '#5865F2' }}
            onClick={() => openModal('user-profile', { userId: user?.id })}
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.username} className="w-full h-full rounded-full object-cover" />
            ) : (
              user?.username?.[0]?.toUpperCase() || '?'
            )}
          </div>
          <div 
            className={cn(
              'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-layout-sidebar',
              user?.status === 'online' && 'bg-green-500',
              user?.status === 'idle' && 'bg-yellow-500',
              user?.status === 'dnd' && 'bg-red-500',
              user?.status === 'offline' && 'bg-gray-500'
            )} 
          />
        </div>

        {/* User info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {user?.display_name || user?.username}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {user?.custom_status || (user?.status === 'online' ? 'Online' : user?.status || 'Online')}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground">
                <Mic className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Mute</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground">
                <Headphones className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Deafen</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-8 h-8 text-muted-foreground hover:text-foreground"
                onClick={() => openModal('user-settings')}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>User Settings</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};
