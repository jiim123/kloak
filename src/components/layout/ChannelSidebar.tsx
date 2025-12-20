import { useState } from 'react';
import { ChevronDown, ChevronRight, Hash, Volume2, Settings, Plus, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Category {
  id: string;
  name: string;
  isCollapsed: boolean;
  channels: Channel[];
}

interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice';
  unread?: boolean;
}

export const ChannelSidebar = () => {
  const { user, logout } = useAuthStore();
  const [activeChannel, setActiveChannel] = useState<string>('1');
  
  // Placeholder categories and channels
  const [categories, setCategories] = useState<Category[]>([
    {
      id: '1',
      name: 'Text Channels',
      isCollapsed: false,
      channels: [
        { id: '1', name: 'general', type: 'text' },
        { id: '2', name: 'random', type: 'text', unread: true },
        { id: '3', name: 'introductions', type: 'text' },
      ],
    },
    {
      id: '2',
      name: 'Voice Channels',
      isCollapsed: false,
      channels: [
        { id: '4', name: 'General', type: 'voice' },
        { id: '5', name: 'Gaming', type: 'voice' },
      ],
    },
  ]);

  const toggleCategory = (categoryId: string) => {
    setCategories(prev =>
      prev.map(cat =>
        cat.id === categoryId ? { ...cat, isCollapsed: !cat.isCollapsed } : cat
      )
    );
  };

  return (
    <div className="w-60 bg-card flex flex-col border-r border-border">
      {/* Server header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-border hover:bg-secondary/50 cursor-pointer">
        <h2 className="font-semibold text-foreground truncate">Server Name</h2>
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto p-2">
        {categories.map((category) => (
          <div key={category.id} className="mb-2">
            {/* Category header */}
            <button
              className="w-full flex items-center gap-1 px-1 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground uppercase tracking-wide"
              onClick={() => toggleCategory(category.id)}
            >
              {category.isCollapsed ? (
                <ChevronRight className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              {category.name}
              <Plus className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100" />
            </button>

            {/* Channels */}
            {!category.isCollapsed && (
              <div className="mt-1 space-y-0.5">
                {category.channels.map((channel) => (
                  <button
                    key={channel.id}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-smooth',
                      activeChannel === channel.id
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
                      channel.unread && 'text-foreground font-medium'
                    )}
                    onClick={() => setActiveChannel(channel.id)}
                  >
                    {channel.type === 'text' ? (
                      <Hash className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <Volume2 className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="truncate">{channel.name}</span>
                    {channel.unread && (
                      <div className="w-2 h-2 rounded-full bg-primary ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* User panel */}
      <div className="h-14 px-2 flex items-center gap-2 bg-sidebar border-t border-border">
        {/* Avatar */}
        <div className="relative">
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white"
            style={{ backgroundColor: user?.banner_color || '#5865F2' }}
          >
            {user?.username?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-sidebar status-online" />
        </div>

        {/* User info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {user?.display_name || user?.username}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {user?.custom_status || 'Online'}
          </p>
        </div>

        {/* Settings & Logout */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="w-8 h-8">
              <Settings className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-8 h-8 text-destructive hover:text-destructive"
              onClick={logout}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Logout</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};