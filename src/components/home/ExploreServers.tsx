import { useEffect, useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type ExploreServer = {
  id: string;
  name: string;
  icon_url: string | null;
  banner_url: string | null;
  invite_code: string;
  created_at: string | null;
  owner_id: string;
  is_published: boolean;
  member_count: number;
};

export const ExploreServers = () => {
  const { user } = useAuthStore();
  const { servers: myServers, joinServer, setCurrentServer } = useServerStore();

  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<ExploreServer[]>([]);

  const myServerIds = useMemo(() => new Set(myServers.map((s) => s.id)), [myServers]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('servers')
          .select('id,name,icon_url,banner_url,invite_code,owner_id,created_at,is_published,server_members(count)')
          .eq('is_published', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (cancelled) return;

        const mapped = (data ?? []).map((row: any) => {
          const count = Array.isArray(row.server_members) ? (row.server_members[0]?.count ?? 0) : 0;
          const item: ExploreServer = {
            id: row.id,
            name: row.name,
            icon_url: row.icon_url,
            banner_url: row.banner_url,
            invite_code: row.invite_code,
            owner_id: row.owner_id,
            created_at: row.created_at,
            is_published: !!row.is_published,
            member_count: count,
          };
          return item;
        });

        setItems(mapped);
      } catch (e: any) {
        console.error('Failed to load Explore servers:', e);
        toast.error(e?.message || 'Failed to load public servers');
        setItems([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) => s.name.toLowerCase().includes(q));
  }, [items, query]);

  const handleJoin = async (server: ExploreServer) => {
    if (!user?.id) return;
    if (myServerIds.has(server.id)) return;

    const joined = await joinServer(server.invite_code, user.id);
    if (!joined) {
      const err = useServerStore.getState().error;
      toast.error(err || 'Failed to join server');
      return;
    }

    toast.success(`Joined ${joined.name}`);
    setCurrentServer(joined);
  };

  return (
    <div className="h-full flex flex-col bg-layout-chat">
      {/* Header - hidden on mobile since we have MobileHeader */}
      <div className="h-12 px-4 hidden md:flex items-center justify-between border-b border-border shadow-sm">
        <h2 className="font-semibold text-foreground">Explore</h2>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search servers"
            className="pl-9 h-10 bg-secondary/50 border-0"
          />
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading public servers…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground">No public servers found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((s) => {
              const joined = myServerIds.has(s.id);
              return (
                <div
                  key={s.id}
                  className="rounded-xl border border-border bg-card/40 overflow-hidden"
                >
                  {s.banner_url ? (
                    <div className="h-28 w-full overflow-hidden bg-secondary">
                      <img
                        src={s.banner_url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="h-10 w-full bg-secondary/40" />
                  )}

                  <div className="p-4 flex items-center gap-4">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-xl bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0',
                      )}
                    >
                      {s.icon_url ? (
                        <img
                          src={s.icon_url}
                          alt={s.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-sm font-bold text-foreground">
                          {s.name
                            .split(' ')
                            .map((w) => w[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-base font-semibold text-foreground truncate">{s.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            <span>{s.member_count} member{s.member_count === 1 ? '' : 's'}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={joined ? 'secondary' : 'default'}
                          disabled={joined}
                          onClick={() => handleJoin(s)}
                          className="flex-shrink-0"
                        >
                          {joined ? 'Joined' : 'Join'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

