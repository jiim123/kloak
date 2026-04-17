import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Hash, Users, MessageCircle, Server } from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { useDMStore } from '@/stores/dmStore';
import { cn } from '@/lib/utils';

type ResultType = 'server' | 'channel' | 'dm';

interface SearchResult {
  id: string;
  type: ResultType;
  name: string;
  subtitle?: string;
  icon?: string;
  color?: string;
}

export const QuickSwitcherModal = () => {
  const navigate = useNavigate();
  const { activeModal, closeModal } = useUIStore();
  const { servers, channels, currentServer, setCurrentServer, setCurrentChannel } = useServerStore();
  const { conversations, setCurrentConversation } = useDMStore();
  
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const isOpen = activeModal === 'quickSwitcher';

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Build search results
  const results = useMemo<SearchResult[]>(() => {
    const items: SearchResult[] = [];
    const q = query.toLowerCase();

    // Add servers
    servers.forEach(server => {
      if (!q || server.name.toLowerCase().includes(q)) {
        items.push({
          id: server.id,
          type: 'server',
          name: server.name,
          icon: server.icon_url || undefined,
        });
      }
    });

    // Add channels (from current server or all if searching)
    const channelsToSearch = q ? channels : channels.filter(c => c.server_id === currentServer?.id);
    channelsToSearch.forEach(channel => {
      if (!q || channel.name.toLowerCase().includes(q)) {
        const server = servers.find(s => s.id === channel.server_id);
        items.push({
          id: channel.id,
          type: 'channel',
          name: channel.name,
          subtitle: server?.name,
        });
      }
    });

    // Add DM conversations
    conversations.forEach(conv => {
      const participant = conv.participants?.find(p => p.user);
      if (participant?.user) {
        const username = participant.user.username;
        if (!q || username.toLowerCase().includes(q)) {
          items.push({
            id: conv.id,
            type: 'dm',
            name: participant.user.display_name || username,
            subtitle: `@${username}`,
            icon: participant.user.avatar_url || undefined,
            color: participant.user.banner_color || '#5865F2',
          });
        }
      }
    });

    return items.slice(0, 15);
  }, [query, servers, channels, conversations, currentServer]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const handleSelect = useCallback((result: SearchResult) => {
    switch (result.type) {
      case 'server': {
        const server = servers.find(s => s.id === result.id);
        if (server) {
          setCurrentServer(server);
          navigate(`/app/servers/${server.id}`);
        }
        break;
      }
      case 'channel': {
        const channel = channels.find(c => c.id === result.id);
        if (channel) {
          const server = servers.find(s => s.id === channel.server_id);
          if (server) {
            setCurrentServer(server);
            setCurrentChannel(channel);
            navigate(`/app/servers/${server.id}/channels/${channel.id}`);
          }
        }
        break;
      }
      case 'dm': {
        const conversation = conversations.find(c => c.id === result.id);
        if (conversation) {
          setCurrentServer(null);
          setCurrentConversation(conversation);
          navigate('/app');
        }
        break;
      }
    }
    closeModal();
  }, [servers, channels, conversations, setCurrentServer, setCurrentChannel, setCurrentConversation, closeModal, navigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        closeModal();
        break;
    }
  };

  const getIcon = (result: SearchResult) => {
    switch (result.type) {
      case 'server':
        return result.icon ? (
          <img src={result.icon} alt="" className="w-full h-full rounded-full object-cover" />
        ) : (
          <Server className="w-4 h-4" />
        );
      case 'channel':
        return <Hash className="w-4 h-4" />;
      case 'dm':
        return result.icon ? (
          <img src={result.icon} alt="" className="w-full h-full rounded-full object-cover" />
        ) : (
          <MessageCircle className="w-4 h-4" />
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="sm:max-w-lg p-0 gap-0">
        {/* Search Input */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Where would you like to go?"
              className="pl-10 h-12 text-lg border-0 focus-visible:ring-0"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <ScrollArea className="max-h-80">
          <div className="p-2">
            {results.length > 0 ? (
              results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelect(result)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                    index === selectedIndex ? "bg-accent" : "hover:bg-secondary/50"
                  )}
                >
                  <div 
                    className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: result.color }}
                  >
                    {getIcon(result)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{result.name}</div>
                    {result.subtitle && (
                      <div className="text-xs text-muted-foreground truncate">
                        {result.subtitle}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {result.type}
                  </div>
                </button>
              ))
            ) : query ? (
              <div className="text-center py-8 text-muted-foreground">
                No results found
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Start typing to search
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer hints */}
        <div className="p-2 border-t text-xs text-muted-foreground flex items-center justify-center gap-4">
          <span><kbd className="px-1.5 py-0.5 bg-secondary rounded">↑↓</kbd> Navigate</span>
          <span><kbd className="px-1.5 py-0.5 bg-secondary rounded">Enter</kbd> Select</span>
          <span><kbd className="px-1.5 py-0.5 bg-secondary rounded">Esc</kbd> Close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};