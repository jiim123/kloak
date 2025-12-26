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
  FolderPlus,
  Mic,
  Headphones,
  GripVertical,
  Trash2
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import { useUIStore } from '@/stores/uiStore';
import { useUnread } from '@/hooks/useUnread';
import { StatusSelector } from '@/components/StatusSelector';
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

// Sortable Channel Item
const SortableChannel = ({ 
  channel, 
  isActive, 
  isUnread, 
  mentionCount,
  isAdmin,
  onSelect,
  onEdit,
  onDelete,
  onMarkAsRead
}: {
  channel: Channel;
  isActive: boolean;
  isUnread: boolean;
  mentionCount: number;
  isAdmin: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMarkAsRead: () => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: channel.id, data: { type: 'channel', channel } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          ref={setNodeRef}
          style={style}
          className={cn(
            'group w-full flex items-center gap-1 px-2 py-1.5 rounded text-sm transition-colors',
            isActive
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:bg-secondary/50 hover:text-secondary-foreground',
            isUnread && !isActive && 'text-foreground font-semibold'
          )}
        >
          {/* Drag handle - only visible for admins */}
          {isAdmin && (
            <button
              {...attributes}
              {...listeners}
              className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-0.5 -ml-1"
            >
              <GripVertical className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
          
          <button className="flex items-center gap-2 flex-1 min-w-0" onClick={onSelect}>
            {channel.type === 'text' ? (
              <Hash className={cn(
                'w-4 h-4 flex-shrink-0',
                isUnread && !isActive ? 'text-foreground' : 'text-muted-foreground'
              )} />
            ) : (
              <Volume2 className={cn(
                'w-4 h-4 flex-shrink-0',
                isUnread && !isActive ? 'text-foreground' : 'text-muted-foreground'
              )} />
            )}
            <span className="truncate flex-1 text-left">{channel.name}</span>
          </button>
          
          {/* Mention badge */}
          {mentionCount > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-bold rounded-full bg-destructive text-destructive-foreground">
              {mentionCount > 99 ? '99+' : mentionCount}
            </span>
          )}

          {/* Admin actions on hover */}
          {isAdmin && (
            <Settings 
              className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground cursor-pointer" 
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            />
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {isAdmin && (
          <>
            <ContextMenuItem onClick={onEdit}>
              <Settings className="w-4 h-4 mr-2" />
              Edit Channel
            </ContextMenuItem>
            <ContextMenuItem className="text-destructive" onClick={onDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Channel
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem onClick={onMarkAsRead}>
          Mark as Read
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

// Sortable Category
const SortableCategory = ({
  category,
  channels,
  isCollapsed,
  isAdmin,
  currentChannelId,
  getChannelUnread,
  onToggle,
  onSelectChannel,
  onAddChannel,
  onEditCategory,
  onDeleteCategory,
  onEditChannel,
  onDeleteChannel,
  onMarkAsRead,
}: {
  category: ChannelCategory;
  channels: Channel[];
  isCollapsed: boolean;
  isAdmin: boolean;
  currentChannelId: string | undefined;
  getChannelUnread: (channelId: string) => { unreadCount: number; mentionCount: number };
  onToggle: () => void;
  onSelectChannel: (channel: Channel) => void;
  onAddChannel: () => void;
  onEditCategory: () => void;
  onDeleteCategory: () => void;
  onEditChannel: (channelId: string) => void;
  onDeleteChannel: (channelId: string) => void;
  onMarkAsRead: (channelId: string) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id, data: { type: 'category', category } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div ref={setNodeRef} style={style} className="mb-2">
          {/* Category header */}
          <div className="group flex items-center gap-0.5 px-0.5">
            {/* Drag handle for category */}
            {isAdmin && (
              <button
                {...attributes}
                {...listeners}
                className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-0.5"
              >
                <GripVertical className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
            
            <button
              className="flex items-center gap-0.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground uppercase tracking-wide flex-1"
              onClick={onToggle}
            >
              {isCollapsed ? (
                <ChevronRight className="w-3 h-3 transition-transform" />
              ) : (
                <ChevronDown className="w-3 h-3 transition-transform" />
              )}
              <span className="truncate">{category.name}</span>
              {isCollapsed && (
                <span className="ml-1 text-muted-foreground">({channels.length})</span>
              )}
            </button>
            
            {/* Add channel button (admin only) */}
            {isAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="p-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                    onClick={onAddChannel}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Create Channel</TooltipContent>
              </Tooltip>
            )}

            {isAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="p-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                    onClick={onEditCategory}
                  >
                    <Settings className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Edit Category</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Channels in category */}
          {!isCollapsed && (
            <div className="mt-0.5 space-y-0.5 ml-2">
              <SortableContext items={channels.map(c => c.id)} strategy={verticalListSortingStrategy}>
                {channels.map(channel => {
                  const { unreadCount, mentionCount } = getChannelUnread(channel.id);
                  return (
                    <SortableChannel
                      key={channel.id}
                      channel={channel}
                      isActive={currentChannelId === channel.id}
                      isUnread={unreadCount > 0}
                      mentionCount={mentionCount}
                      isAdmin={isAdmin}
                      onSelect={() => onSelectChannel(channel)}
                      onEdit={() => onEditChannel(channel.id)}
                      onDelete={() => onDeleteChannel(channel.id)}
                      onMarkAsRead={() => onMarkAsRead(channel.id)}
                    />
                  );
                })}
              </SortableContext>
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {isAdmin && (
          <>
            <ContextMenuItem onClick={onAddChannel}>
              <Plus className="w-4 h-4 mr-2" />
              Create Channel
            </ContextMenuItem>
            <ContextMenuItem onClick={onEditCategory}>
              <Settings className="w-4 h-4 mr-2" />
              Edit Category
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem className="text-destructive" onClick={onDeleteCategory}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Category
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};

export const ChannelSidebar = () => {
  const { user } = useAuthStore();
  const { 
    currentServer, 
    currentChannel, 
    setCurrentChannel,
    categories, 
    channels,
    servers,
    leaveServer,
    reorderCategories,
    reorderChannels,
    deleteCategory: deleteCategoryAction,
  } = useServerStore();
  const { openModal } = useUIStore();

  // Track collapsed categories locally
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'channel' | 'category' | null>(null);

  // Get all channel IDs for this server
  const channelIds = useMemo(() => channels.map(c => c.id), [channels]);
  const { getChannelUnread, markAsRead } = useUnread(channelIds);

  // Get current user's role in this server
  const currentMembership = useMemo(() => {
    if (!currentServer) return null;
    return servers.find(s => s.id === currentServer.id);
  }, [servers, currentServer]);

  const userRole = currentMembership?.role;
  const isAdmin = isAdminRole(userRole);
  const isOwner = userRole === 'owner';

  // Group channels by category with sorting
  const { uncategorizedChannels, sortedCategories } = useMemo(() => {
    const uncategorized = channels
      .filter(channel => !channel.category_id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    
    const sorted = [...categories].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    
    return { uncategorizedChannels: uncategorized, sortedCategories: sorted };
  }, [channels, categories]);

  const getChannelsForCategory = (categoryId: string) => {
    return channels
      .filter(c => c.category_id === categoryId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  };

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const handleMarkAsRead = async (channelId: string) => {
    await markAsRead(channelId);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;
    setActiveId(active.id as string);
    setActiveType(data?.type || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveType(null);

    if (!over || active.id === over.id) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Handle category reordering
    if (activeData?.type === 'category' && overData?.type === 'category') {
      const oldIndex = sortedCategories.findIndex(c => c.id === active.id);
      const newIndex = sortedCategories.findIndex(c => c.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(sortedCategories, oldIndex, newIndex);
        await reorderCategories(newOrder.map(c => c.id));
      }
    }

    // Handle channel reordering within same category
    if (activeData?.type === 'channel') {
      const activeChannel = activeData.channel as Channel;
      const overChannel = overData?.channel as Channel | undefined;
      
      if (overChannel && activeChannel.category_id === overChannel.category_id) {
        const categoryChannels = getChannelsForCategory(activeChannel.category_id || '');
        const oldIndex = categoryChannels.findIndex(c => c.id === active.id);
        const newIndex = categoryChannels.findIndex(c => c.id === over.id);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          await reorderChannels(
            activeChannel.id,
            activeChannel.category_id,
            newIndex
          );
        }
      }
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Future: handle cross-category channel dragging
  };

  const getActiveItem = () => {
    if (!activeId) return null;
    
    if (activeType === 'category') {
      const category = categories.find(c => c.id === activeId);
      if (category) {
        return (
          <div className="flex items-center gap-1 px-2 py-1 bg-secondary rounded text-sm opacity-80">
            <ChevronRight className="w-3 h-3" />
            <span className="uppercase text-xs font-semibold">{category.name}</span>
          </div>
        );
      }
    }
    
    if (activeType === 'channel') {
      const channel = channels.find(c => c.id === activeId);
      if (channel) {
        return (
          <div className="flex items-center gap-2 px-2 py-1.5 bg-secondary rounded text-sm opacity-80">
            <Hash className="w-4 h-4" />
            <span>{channel.name}</span>
          </div>
        );
      }
    }
    
    return null;
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

      {/* Channel list with DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
      >
        <div className="flex-1 overflow-y-auto p-2">
          {/* Uncategorized channels first */}
          {uncategorizedChannels.length > 0 && (
            <div className="mb-2 space-y-0.5">
              <SortableContext items={uncategorizedChannels.map(c => c.id)} strategy={verticalListSortingStrategy}>
                {uncategorizedChannels.map(channel => {
                  const { unreadCount, mentionCount } = getChannelUnread(channel.id);
                  return (
                    <SortableChannel
                      key={channel.id}
                      channel={channel}
                      isActive={currentChannel?.id === channel.id}
                      isUnread={unreadCount > 0}
                      mentionCount={mentionCount}
                      isAdmin={isAdmin}
                      onSelect={() => setCurrentChannel(channel)}
                      onEdit={() => openModal('edit-channel', { channelId: channel.id })}
                      onDelete={() => openModal('delete-message', { channelId: channel.id, type: 'channel' })}
                      onMarkAsRead={() => handleMarkAsRead(channel.id)}
                    />
                  );
                })}
              </SortableContext>
            </div>
          )}

          {/* Categories with their channels */}
          <SortableContext items={sortedCategories.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {sortedCategories.map(category => (
              <SortableCategory
                key={category.id}
                category={category}
                channels={getChannelsForCategory(category.id)}
                isCollapsed={collapsedCategories.has(category.id)}
                isAdmin={isAdmin}
                currentChannelId={currentChannel?.id}
                getChannelUnread={getChannelUnread}
                onToggle={() => toggleCategory(category.id)}
                onSelectChannel={setCurrentChannel}
                onAddChannel={() => openModal('create-channel', { categoryId: category.id })}
                onEditCategory={() => openModal('edit-channel', { categoryId: category.id, isCategory: true })}
                onDeleteCategory={() => deleteCategoryAction(category.id)}
                onEditChannel={(channelId) => openModal('edit-channel', { channelId })}
                onDeleteChannel={(channelId) => openModal('delete-message', { channelId, type: 'channel' })}
                onMarkAsRead={handleMarkAsRead}
              />
            ))}
          </SortableContext>

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

        {/* Drag overlay */}
        <DragOverlay>
          {getActiveItem()}
        </DragOverlay>
      </DndContext>

      {/* User panel */}
      <div className="h-14 px-2 flex items-center gap-2 bg-layout-sidebar border-t border-border">
        {/* Avatar with status - click to change status */}
        <StatusSelector side="top" align="start">
          <button className="relative flex-shrink-0">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white cursor-pointer hover:opacity-80 transition-opacity"
              style={{ backgroundColor: user?.banner_color || '#5865F2' }}
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
          </button>
        </StatusSelector>

        {/* User info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {user?.display_name || user?.username}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {user?.custom_status || (user?.status === 'online' ? 'Online' : user?.status === 'idle' ? 'Idle' : user?.status === 'dnd' ? 'Do Not Disturb' : 'Offline')}
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