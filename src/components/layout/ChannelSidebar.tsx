import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Palette
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
import type { Channel, ChannelCategory, ServerRole } from '@/types';

// Animation variants
const channelVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -10 },
};

const categoryVariants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: { height: 'auto', opacity: 1 },
};

const isAdminRole = (role: ServerRole | undefined): boolean => {
  return role === 'owner' || role === 'admin' || role === 'moderator';
};

// Modern Sortable Channel Item
const SortableChannel = ({ 
  channel, 
  isActive, 
  isUnread, 
  mentionCount,
  isAdmin,
  onSelect,
  onEdit,
}: {
  channel: Channel;
  isActive: boolean;
  isUnread: boolean;
  mentionCount: number;
  isAdmin: boolean;
  onSelect: () => void;
  onEdit: () => void;
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

  // Determine the icon to display
  const getChannelIcon = () => {
    if (channel.icon) {
      return <span className="text-base font-emoji">{channel.icon}</span>;
    }
    if (channel.type === 'voice') {
      return <Volume2 className={cn(
        'w-4 h-4 flex-shrink-0 transition-colors',
        isUnread && !isActive ? 'text-foreground' : 'text-muted-foreground'
      )} />;
    }
    return <Hash className={cn(
      'w-4 h-4 flex-shrink-0 transition-colors',
      isUnread && !isActive ? 'text-foreground' : 'text-muted-foreground'
    )} />;
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      variants={channelVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className="relative"
    >
      <button
        onClick={onSelect}
        className={cn(
          'group w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all duration-150',
          'hover:bg-secondary/80',
          isActive && 'bg-secondary text-foreground',
          !isActive && 'text-muted-foreground hover:text-foreground',
          isUnread && !isActive && 'text-foreground font-medium'
        )}
      >
        {/* Channel icon */}
        <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
          {getChannelIcon()}
        </div>
        
        {/* Channel name */}
        <span className="truncate flex-1 text-left">{channel.name}</span>
        
        {/* Mention badge */}
        <AnimatePresence>
          {mentionCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="px-1.5 py-0.5 text-xs font-bold rounded-full bg-destructive text-destructive-foreground"
            >
              {mentionCount > 99 ? '99+' : mentionCount}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Admin settings */}
        {isAdmin && (
          <Settings 
            className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground cursor-pointer flex-shrink-0" 
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          />
        )}

        {/* Drag handle for admins */}
        {isAdmin && (
          <div
            {...attributes}
            {...listeners}
            className="opacity-0 group-hover:opacity-50 hover:!opacity-100 cursor-grab active:cursor-grabbing"
          >
            <div className="w-1 h-3 flex flex-col gap-0.5 justify-center">
              <div className="w-1 h-1 rounded-full bg-muted-foreground" />
              <div className="w-1 h-1 rounded-full bg-muted-foreground" />
            </div>
          </div>
        )}
      </button>

      {/* Active indicator */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            layoutId="channel-indicator"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Modern Sortable Category
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
  onEditChannel,
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
  onEditChannel: (channelId: string) => void;
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
    <motion.div 
      ref={setNodeRef} 
      style={style} 
      className="mb-4"
      layout
    >
      {/* Category header */}
      <div className="group flex items-center gap-1 px-0.5 mb-1">
        <button
          className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground uppercase tracking-wide flex-1 py-1"
          onClick={onToggle}
        >
          <motion.div
            animate={{ rotate: isCollapsed ? -90 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <ChevronDown className="w-3 h-3" />
          </motion.div>
          <span className="truncate">{category.name}</span>
          {isCollapsed && (
            <span className="ml-1 text-muted-foreground/60">({channels.length})</span>
          )}
        </button>
        
        {/* Add channel button */}
        {isAdmin && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground rounded hover:bg-secondary"
                onClick={onAddChannel}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Create Channel</TooltipContent>
          </Tooltip>
        )}

        {/* Drag handle */}
        {isAdmin && (
          <div
            {...attributes}
            {...listeners}
            className="p-1 opacity-0 group-hover:opacity-50 hover:!opacity-100 cursor-grab active:cursor-grabbing"
          >
            <div className="w-1 h-3 flex flex-col gap-0.5 justify-center">
              <div className="w-1 h-1 rounded-full bg-muted-foreground" />
              <div className="w-1 h-1 rounded-full bg-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Channels */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={categoryVariants}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="space-y-0.5 ml-1 overflow-hidden"
          >
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
                  />
                );
              })}
            </SortableContext>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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
  } = useServerStore();
  const { openModal, cycleTheme } = useUIStore();

  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'channel' | 'category' | null>(null);

  const channelIds = useMemo(() => channels.map(c => c.id), [channels]);
  const { getChannelUnread, markAsRead } = useUnread(channelIds);

  const currentMembership = useMemo(() => {
    if (!currentServer) return null;
    return servers.find(s => s.id === currentServer.id);
  }, [servers, currentServer]);

  const userRole = currentMembership?.role;
  const isAdmin = isAdminRole(userRole);
  const isOwner = userRole === 'owner';

  const { uncategorizedChannels, sortedCategories } = useMemo(() => {
    const uncategorized = channels
      .filter(channel => !channel.category_id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    
    const sorted = [...categories].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    
    return { uncategorizedChannels: uncategorized, sortedCategories: sorted };
  }, [channels, categories]);

  const getChannelsForCategory = useCallback((categoryId: string) => {
    return channels
      .filter(c => c.category_id === categoryId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }, [channels]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
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

    if (activeData?.type === 'category' && overData?.type === 'category') {
      const oldIndex = sortedCategories.findIndex(c => c.id === active.id);
      const newIndex = sortedCategories.findIndex(c => c.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(sortedCategories, oldIndex, newIndex);
        await reorderCategories(newOrder.map(c => c.id));
      }
    }

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

  const getActiveItem = () => {
    if (!activeId) return null;
    
    if (activeType === 'category') {
      const category = categories.find(c => c.id === activeId);
      if (category) {
        return (
          <div className="flex items-center gap-1 px-2 py-1 bg-secondary rounded-md text-sm">
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
          <div className="flex items-center gap-2 px-2 py-1.5 bg-secondary rounded-md text-sm">
            {channel.icon ? (
              <span className="text-base font-emoji">{channel.icon}</span>
            ) : (
              <Hash className="w-4 h-4" />
            )}
            <span>{channel.name}</span>
          </div>
        );
      }
    }
    
    return null;
  };

  if (!currentServer) {
    return (
      <div className="h-full flex flex-col bg-layout-sidebar-secondary">
        <div className="flex-1 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-secondary/50 flex items-center justify-center">
              <Hash className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">Select a server</p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-layout-sidebar-secondary">
      {/* Server header */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <motion.button 
            className="h-12 px-4 flex items-center justify-between border-b border-border/50 hover:bg-secondary/50 cursor-pointer w-full text-left transition-colors"
            whileHover={{ backgroundColor: 'hsl(var(--secondary) / 0.5)' }}
            whileTap={{ scale: 0.99 }}
          >
            <h2 className="font-semibold text-foreground truncate">{currentServer.name}</h2>
            <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </motion.button>
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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
          {/* Uncategorized channels */}
          {uncategorizedChannels.length > 0 && (
            <div className="mb-4 space-y-0.5">
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
                    />
                  );
                })}
              </SortableContext>
            </div>
          )}

          {/* Categories */}
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
                onEditChannel={(channelId) => openModal('edit-channel', { channelId })}
              />
            ))}
          </SortableContext>

          {/* Empty state */}
          {channels.length === 0 && categories.length === 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center mb-3">
                <Hash className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground mb-2">No channels yet</p>
              {isAdmin && (
                <Button 
                  variant="link" 
                  size="sm"
                  onClick={() => openModal('create-channel', { serverId: currentServer.id })}
                >
                  Create a channel
                </Button>
              )}
            </motion.div>
          )}
        </div>

        <DragOverlay>
          {getActiveItem()}
        </DragOverlay>
      </DndContext>

      {/* User panel */}
      <motion.div 
        className="h-14 px-2 flex items-center gap-2 bg-layout-sidebar border-t border-border/50"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        {/* Avatar with status */}
        <StatusSelector side="top" align="start">
          <button className="relative flex-shrink-0 group">
            <motion.div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white cursor-pointer overflow-hidden"
              style={{ backgroundColor: user?.banner_color || '#5865F2' }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                user?.username?.[0]?.toUpperCase() || '?'
              )}
            </motion.div>
            <div 
              className={cn(
                'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-layout-sidebar transition-colors',
                user?.status === 'online' && 'bg-nomo-online',
                user?.status === 'idle' && 'bg-nomo-idle',
                user?.status === 'dnd' && 'bg-nomo-dnd',
                user?.status === 'offline' && 'bg-nomo-offline'
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
              <motion.div whileHover={{ rotate: 30 }} transition={{ type: 'spring', stiffness: 300 }}>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="w-8 h-8 text-muted-foreground hover:text-foreground"
                  onClick={cycleTheme}
                >
                  <Palette className="w-4 h-4" />
                </Button>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>Theme</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div whileHover={{ rotate: 90 }} transition={{ type: 'spring', stiffness: 300 }}>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="w-8 h-8 text-muted-foreground hover:text-foreground"
                  onClick={() => openModal('user-settings')}
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
        </div>
      </motion.div>
    </div>
  );
};