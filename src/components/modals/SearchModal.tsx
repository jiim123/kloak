import { useState, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { Search, X, Loader2, Hash, MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface SearchResult {
  message_id: string;
  content: string;
  channel_id: string;
  user_id: string;
  created_at: string;
  rank: number;
  user?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    banner_color: string | null;
  };
  channel?: {
    name: string;
  };
}

export const SearchModal = () => {
  const { activeModal, closeModal } = useUIStore();
  const { currentServer, setCurrentChannel, channels } = useServerStore();
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const isOpen = activeModal === 'search';

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setHasSearched(false);
    }
  }, [isOpen]);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !currentServer) return;

    setIsLoading(true);
    setHasSearched(true);
    
    try {
      // Parse search filters
      let searchQuery = query;
      let channelFilter: string | undefined;
      let userFilter: string | undefined;

      // Parse from:username
      const fromMatch = query.match(/from:(\w+)/);
      if (fromMatch) {
        userFilter = fromMatch[1];
        searchQuery = searchQuery.replace(fromMatch[0], '').trim();
      }

      // Parse in:channel
      const inMatch = query.match(/in:(\w+)/);
      if (inMatch) {
        const channelName = inMatch[1].toLowerCase();
        const channel = channels.find(c => c.name.toLowerCase() === channelName);
        if (channel) channelFilter = channel.id;
        searchQuery = searchQuery.replace(inMatch[0], '').trim();
      }

      // Use the database search function
      const { data, error } = await supabase.rpc('search_messages', {
        search_query: searchQuery || query,
        server_filter: currentServer.id,
        channel_filter: channelFilter,
        user_filter: userFilter,
        result_limit: 25,
      });

      if (error) throw error;

      // Fetch user and channel details for results
      const enrichedResults = await Promise.all(
        (data || []).map(async (result: SearchResult) => {
          const [userRes, channelRes] = await Promise.all([
            supabase.from('users').select('username, display_name, avatar_url, banner_color').eq('id', result.user_id).single(),
            supabase.from('channels').select('name').eq('id', result.channel_id).single(),
          ]);

          return {
            ...result,
            user: userRes.data || undefined,
            channel: channelRes.data || undefined,
          };
        })
      );

      setResults(enrichedResults);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [query, currentServer, channels]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleJumpToMessage = (result: SearchResult) => {
    const channel = channels.find(c => c.id === result.channel_id);
    if (channel) {
      setCurrentChannel(channel);
      closeModal();
      // In a full implementation, you'd scroll to the message
    }
  };

  // Highlight search terms in content
  const highlightContent = (content: string) => {
    const searchTerms = query.split(' ').filter(t => !t.includes(':'));
    if (!searchTerms.length) return content;

    let highlighted = content;
    searchTerms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      highlighted = highlighted.replace(regex, '**$1**');
    });

    return highlighted;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search Messages
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search messages... (from:user in:channel)"
              className="pl-10 pr-20"
              autoFocus
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-12 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setQuery('')}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
            <Button
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2"
              onClick={handleSearch}
              disabled={!query.trim() || isLoading}
            >
              Search
            </Button>
          </div>

          {/* Search Filters Help */}
          <div className="text-xs text-muted-foreground space-x-4">
            <span><code className="bg-secondary px-1 rounded">from:username</code> Filter by author</span>
            <span><code className="bg-secondary px-1 rounded">in:channel</code> Filter by channel</span>
          </div>

          {/* Results */}
          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-2">
                {results.map((result) => (
                  <button
                    key={result.message_id}
                    onClick={() => handleJumpToMessage(result)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg hover:bg-secondary/50 transition-colors",
                      "border border-transparent hover:border-border"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage src={result.user?.avatar_url || undefined} />
                        <AvatarFallback style={{ backgroundColor: result.user?.banner_color || '#5865F2' }}>
                          {result.user?.username?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">
                            {result.user?.display_name || result.user?.username}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Hash className="w-3 h-3" />
                            {result.channel?.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(result.created_at), 'MMM d, yyyy')}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {highlightContent(result.content)}
                        </p>
                      </div>
                      <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            ) : hasSearched ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="w-12 h-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No results found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try different keywords or filters
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="w-12 h-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">Search for messages</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter a search term and press Enter
                </p>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};