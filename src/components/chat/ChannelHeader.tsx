import { Hash, Volume2, Pin, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { useServerStore } from '@/stores/serverStore';
import { useUIStore } from '@/stores/uiStore';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import type { Channel } from '@/types';

interface ChannelHeaderProps {
  channel: Channel;
}

export const ChannelHeader = ({ channel }: ChannelHeaderProps) => {
  const { toggleMemberSidebar, openModal } = useUIStore();

  const ChannelIcon = channel.type === 'voice' ? Volume2 : Hash;

  return (
    <div className="h-12 px-4 flex items-center justify-between border-b border-border flex-shrink-0">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <ChannelIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        <span className="font-semibold text-foreground truncate">{channel.name}</span>
        
        {channel.topic && (
          <>
            <Separator orientation="vertical" className="h-5 mx-2" />
            <span className="text-muted-foreground text-sm truncate hidden sm:inline">
              {channel.topic}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <NotificationBell />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-8 h-8"
              onClick={() => openModal('pinned-messages', { channelId: channel.id })}
            >
              <Pin className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Pinned Messages</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-8 h-8"
              onClick={() => openModal('search', { channelId: channel.id })}
            >
              <Search className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Search</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-8 h-8"
              onClick={toggleMemberSidebar}
            >
              <Users className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Member List</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
