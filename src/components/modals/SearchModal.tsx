import { useState, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { Search, X, Loader2, Hash, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
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
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const isOpen = activeModal === 'search';

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setHasSearched(false);
    }
  }, [isOpen]);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !currentServer || !currentUserId) return;

    setIsLoading(true);
    setHasSearched(true);

    try {
      let searchQuery = query;
      let channelFilter: string | undefined;
      let userFilter: string | undefined;

      const fromMatch = query.match(/from:(\w+)/);
      if (fromMatch) {
        userFilter = fromMatch[1];
        searchQuery = searchQuery.replace(fromMatch[0], '').trim();
      }

      const inMatch = query.match(/in:(\w+)/);
      if (inMatch) {
        const channelName = inMatch[1].toLowerCase();
        const channel = channels.find((c) => c.name.toLowerCase() === channelName);
        if (channel) channelFilter = channel.id;
        searchQuery = searchQuery.replace(inMatch[0], '').trim();
      }

      const { data, error } = await supabase.rpc('search_messages', {
        search_query: searchQuery || query,
        server_filter: currentServer.id,
        channel_filter: channelFilter,
        user_filter: userFilter,
        result_limit: 25,
      });

      if (error) throw error;

      const rawResults = data || [];

      if (rawResults.length === 0) {
        setResults([]);
        return;
      }

      const userIds = [...new Set(rawResults.map((r: SearchResult) => r.user_id))];
      const channelIds = [...new Set(rawResults.map((r: SearchResult) => r.channel_id))];

      const [usersRes, channelsRes] = await Promise.all([
        supabase.rpc('get_users_basic_secure', {
          _user_id: currentUserId,
          _target_user_ids: userIds,
        }),
        supabase
          .from('channels')
          .select('id, name')
          .in('id', channelIds),
      ]);

      const usersMap = new Map(((usersRes.data as any[]) || []).map((u) => [u.id, u]));
      const channelsMap = new Map((channelsRes.data || []).map((c) => [c.id, c]));

      const enrichedResults = rawResults.map((result: SearchResult) => ({
        ...result,
        user: usersMap.get(result.user_id) || undefined,
        channel: channelsMap.get(result.channel_id) || undefined,
      }));

      setResults(enrichedResults);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [query, currentServer, channels, currentUserId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleJumpToMessage = (result: SearchResult) => {
    const channel = channels.find((c) => c.id === result.channel_id);
    if (channel) {
      setCurrentChannel(channel);
      closeModal();
    }
  };

  const highlightContent = (content: string) => {
    const searchTerms = query.split(' ').filter((t) => !t.includes(':'));
    if (!searchTerms.length) return content;

    let highlighted = content;
    searchTerms.forEach((term) => {
      const regex = new RegExp(`(${term})`, 'gi');
      highlighted = highlighted.replace(regex, '**$1**');
    });

    return highlighted;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-[4px] border border-border bg-card p-0 text-foreground shadow-2xl sm:max-w-[640px]">
        <div className="flex max-h-[82vh] flex-col overflow-hidden">
          <div className="border-b border-border bg-muted px-5 py-3">
            <div className="text-base font-medium leading-none tracking-tight">Search messages</div>
          </div>

          <div className="space-y-5 overflow-y-auto px-6 py-4">
            <div>
              <div className="flex items-center justify-between gap-3">
                <Label
                  htmlFor="message-search"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Search query
                </Label>
                <span className="text-xs text-muted-foreground">Use `from:` or `in:` filters</span>
              </div>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="message-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search messages... (from:user in:channel)"
                  className="h-12 rounded-none border-0 border-b border-white/80 bg-transparent pl-7 pr-10 text-sm text-foreground shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                  autoFocus
                />
                {query && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-1/2 h-8 w-8 -translate-y-1/2 rounded-[3px] text-muted-foreground hover:bg-[#3b4049] hover:text-white"
                    onClick={() => setQuery('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="border border-border bg-muted p-3">
                <p className="text-sm font-medium leading-none text-foreground">Filter by author</p>
                <p className="mt-2 font-mono text-xs leading-5 tracking-[0.08em] text-muted-foreground">from:username</p>
              </div>
              <div className="border border-border bg-muted p-3">
                <p className="text-sm font-medium leading-none text-foreground">Filter by channel</p>
                <p className="mt-2 font-mono text-xs leading-5 tracking-[0.08em] text-muted-foreground">in:channel</p>
              </div>
            </div>

            {(hasSearched || isLoading) && (
              <div className="border border-border bg-muted">
                <div className="border-b border-[#3a404a] px-4 py-3">
                  <p className="text-sm font-medium leading-none text-foreground">
                    {isLoading
                      ? 'Searching messages...'
                      : results.length > 0
                        ? `${results.length} result${results.length === 1 ? '' : 's'}`
                        : 'No results'}
                  </p>
                </div>

                <ScrollArea className="h-[360px]">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : results.length > 0 ? (
                    <div className="p-2">
                      {results.map((result) => (
                        <button
                          key={result.message_id}
                          onClick={() => handleJumpToMessage(result)}
                          className={cn(
                            "w-full border border-transparent px-3 py-3 text-left transition-colors",
                            "hover:border-[#454b56] hover:bg-[#363b45]"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarImage src={result.user?.avatar_url || undefined} />
                              <AvatarFallback style={{ backgroundColor: result.user?.banner_color || '#5865F2' }}>
                                {result.user?.username?.[0]?.toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="text-sm font-medium text-foreground">
                                  {result.user?.display_name || result.user?.username}
                                </span>
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Hash className="h-3 w-3" />
                                  {result.channel?.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(result.created_at), 'MMM d, yyyy')}
                                </span>
                              </div>
                              <p className="line-clamp-2 text-sm text-muted-foreground">
                                {highlightContent(result.content)}
                              </p>
                            </div>
                            <MessageSquare className="h-4 w-4 flex-shrink-0 text-[#8d94a0]" />
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                      <Search className="mb-3 h-12 w-12 text-[#666d78]" />
                      <p className="text-sm font-medium text-foreground">No results found</p>
                      <p className="mt-1 text-xs text-muted-foreground">Try different keywords or filters.</p>
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border bg-card px-5 py-3">
            <Button
              type="button"
              variant="ghost"
              onClick={closeModal}
              className="h-9 rounded-[3px] px-4 text-muted-foreground hover:bg-transparent hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSearch}
              disabled={!query.trim() || isLoading}
              className="h-9 rounded-[3px] bg-primary px-5 font-medium text-primary-foreground hover:bg-white disabled:bg-[#454b55] disabled:text-muted-foreground disabled:opacity-100"
            >
              Search
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
