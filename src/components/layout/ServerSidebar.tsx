import { useState } from 'react';
import { Home, Plus, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';

export const ServerSidebar = () => {
  const [activeServer, setActiveServer] = useState<string | null>(null);

  // Placeholder servers for demo
  const servers = [
    { id: '1', name: 'Gaming', icon: '🎮' },
    { id: '2', name: 'Music', icon: '🎵' },
    { id: '3', name: 'Tech', icon: '💻' },
  ];

  return (
    <div className="w-[72px] bg-sidebar flex flex-col items-center py-3 gap-2">
      {/* Home button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              'server-icon bg-secondary hover:bg-primary hover:text-primary-foreground',
              activeServer === null && 'bg-primary text-primary-foreground rounded-[16px]'
            )}
            onClick={() => setActiveServer(null)}
          >
            <Home className="w-5 h-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>Direct Messages</p>
        </TooltipContent>
      </Tooltip>

      <Separator className="w-8 bg-border" />

      {/* Server list */}
      <div className="flex-1 flex flex-col items-center gap-2 overflow-y-auto scrollbar-hide">
        {servers.map((server) => (
          <Tooltip key={server.id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  'server-icon bg-secondary text-lg',
                  activeServer === server.id && 'bg-primary text-primary-foreground rounded-[16px]'
                )}
                onClick={() => setActiveServer(server.id)}
              >
                {server.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{server.name}</p>
            </TooltipContent>
          </Tooltip>
        ))}

        {/* Add server button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className="server-icon bg-secondary hover:bg-nomo-success hover:text-white"
            >
              <Plus className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Add a Server</p>
          </TooltipContent>
        </Tooltip>

        {/* Explore servers button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className="server-icon bg-secondary hover:bg-nomo-success hover:text-white"
            >
              <Compass className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Explore Servers</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};