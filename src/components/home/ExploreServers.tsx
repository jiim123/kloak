import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Compass } from 'lucide-react';
import { motion } from 'framer-motion';
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
  about: string | null;
  member_count: number;
};

export const ExploreServers = () => {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">
      <p>Explore is currently disabled.</p>
    </div>
  );
};

const ExploreServersOriginal = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { servers: myServers, joinServer, setCurrentServer } = useServerStore();

  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<ExploreServer[]>([]);

  const myServerIds = useMemo(() => new Set(myServers.map((s) => s.id)), [myServers]);

  useEffect(() => {
    let cancelled = false;
    let isInitialLoad = true;

    const fetchServers = async () => {
      // Only show loading spinner on initial load
      if (isInitialLoad) {
        setIsLoading(true);
      }
      
      try {
        // Use RPC for one efficient query (avoids PostgREST LATERAL server_members(count) per row)
        const { data, error } = await (supabase.rpc as (name: string, args?: object) => ReturnType<typeof supabase.rpc>)('get_explore_servers');

        if (error) throw error;
        if (cancelled) return;

        const raw = Array.isArray(data) ? data : (data ? [data] : []);
        const mapped: ExploreServer[] = raw.map((row: any) => ({
          id: row.id,
          name: row.name,
          icon_url: row.icon_url,
          banner_url: row.banner_url,
          invite_code: row.invite_code,
          owner_id: row.owner_id,
          created_at: row.created_at,
          is_published: !!row.is_published,
          about: row.about ?? null,
          member_count: Number(row.member_count) ?? 0,
        }));
        setItems(mapped);
      } catch (e: any) {
        console.error('Failed to load Explore servers:', e);
        // Only show error toast on initial load
        if (isInitialLoad) {
          toast.error(e?.message || 'Failed to load public servers');
        }
        if (isInitialLoad) {
          setItems([]);
        }
      } finally {
        if (!cancelled && isInitialLoad) {
          setIsLoading(false);
          isInitialLoad = false;
        }
      }
    };

    // Initial fetch
    fetchServers();

    // Poll every 30 seconds for updates (icons, banners, member counts, etc.)
    const intervalId = setInterval(fetchServers, 30000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) => s.name.toLowerCase().includes(q));
  }, [items, query]);

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  const extractTags = (about: string | null) => {
    if (!about) return [];
    const matches = about.match(/#[\w-]+/g) ?? [];
    // unique + cap (keeps UI tidy)
    return Array.from(new Set(matches)).slice(0, 5);
  };

  const handleJoin = async (server: ExploreServer) => {
    if (!user?.id) return;
    if (myServerIds.has(server.id)) return;

    const joined = await joinServer(server.invite_code, user.id, 'discover');
    if (!joined) {
      const err = useServerStore.getState().error;
      toast.error(err || 'Failed to join server');
      return;
    }

    toast.success(`Joined ${joined.name}`);
    setCurrentServer(joined);
    navigate(`/app/servers/${joined.id}`);
  };

  return (
    <div className="h-full flex flex-col bg-layout-chat overflow-hidden">
      {/* Header - hidden on mobile since we have MobileHeader */}
      <div className="h-12 px-4 hidden md:flex items-center justify-between border-b border-border shadow-sm flex-shrink-0">
        <h2 className="font-semibold text-foreground">Explore</h2>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Hero Section */}
        <div className="relative overflow-hidden border-b border-border/50">
          {/* Background Image */}
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: 'url(https://images.unsplash.com/photo-1558844109-f45f2d162527?q=80&w=1317&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D)'
            }}
          />
          
          {/* Dark Overlay for Text Readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/70 to-background/60" />
          
          {/* Subtle Primary Overlay */}
          <div className="absolute inset-0 bg-primary/5" />

          {/* Hero Content */}
          <div className="relative px-4 py-6 md:py-8 min-h-[200px] md:min-h-[220px] flex items-center">
            <div className="max-w-4xl mx-auto w-full">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center space-y-4"
              >
                {/* Icon and Title Row */}
                <div className="flex items-center justify-center gap-3">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="inline-flex items-center justify-center p-2 rounded-xl bg-background/80 backdrop-blur-md border border-primary/30 shadow-lg"
                  >
                    <Compass className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                  </motion.div>
                  <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="text-2xl md:text-3xl font-bold tracking-tight text-foreground drop-shadow-lg"
                  >
                    Discover{' '}
                    <span className="text-primary relative inline-block drop-shadow-md">
                      Communities
                      <motion.span
                        className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-primary/50 rounded-full"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.6, delay: 0.5 }}
                      />
                    </span>
                  </motion.h1>
                </div>

                {/* Description */}
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="text-sm md:text-base text-foreground/90 max-w-xl mx-auto drop-shadow-md"
                >
                  Explore public servers and join communities that match your interests
                </motion.p>

                {/* Search Bar */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="relative max-w-xl mx-auto pt-2"
                >
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search servers"
                    className="pl-9 h-10 bg-background/80 backdrop-blur-md border border-border/50 shadow-lg"
                  />
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Server Grid */}
        <div className="px-4 pb-6 pt-5 space-y-5">

        {isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-muted-foreground text-center py-8"
          >
            <div className="inline-flex items-center gap-2">
              <motion.div
                className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <span>Loading public servers…</span>
            </div>
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12 space-y-3"
          >
            <div className="inline-flex items-center justify-center p-3 rounded-full bg-muted/50">
              <Compass className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No public servers found.</p>
            {query && (
              <p className="text-xs text-muted-foreground/70">Try a different search term</p>
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filtered.map((s, index) => {
              const joined = myServerIds.has(s.id);
              const tags = extractTags(s.about);
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className={cn(
                    "relative rounded-2xl border border-border/60 bg-card/40 overflow-hidden",
                    "hover:bg-card/60 transition-colors cursor-pointer group",
                  )}
                >
                  {/* Banner */}
                  <div className="relative h-24 w-full overflow-hidden">
                    {s.banner_url ? (
                      <img
                        src={s.banner_url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-secondary/60 via-secondary/40 to-secondary/20" />
                    )}
                    {/* subtle vignette like the reference */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/40" />
                  </div>

                  {/* Floating icon (centered, overlaps banner like the reference) */}
                  <div className="absolute left-1/2 top-[76px] -translate-x-1/2">
                    <div className="w-16 h-16 rounded-full bg-background/80 backdrop-blur border border-border shadow-lg overflow-hidden flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-secondary overflow-hidden flex items-center justify-center">
                        {s.icon_url ? (
                          <img src={s.icon_url} alt={s.name} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <span className="text-sm font-bold text-foreground">{getInitials(s.name)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="px-4 pb-4 pt-12">
                    <div className="flex flex-col items-center text-center">
                      <div className="text-base font-semibold text-foreground truncate w-full">{s.name}</div>
                      {s.about && (
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {s.about}
                        </div>
                      )}
                    </div>

                    {/* Tag chips (derived from #tags in about, if present) */}
                    {tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 justify-center">
                        {tags.map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded-full text-[11px] bg-secondary/60 text-muted-foreground border border-border/40"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Footer row */}
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <div className="text-muted-foreground flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        <span>{s.member_count} member{s.member_count === 1 ? '' : 's'}</span>
                      </div>
                      <Button
                        size="sm"
                        variant={joined ? 'secondary' : 'default'}
                        disabled={joined}
                        onClick={() => handleJoin(s)}
                        className="h-7 px-3 text-xs"
                      >
                        {joined ? 'Joined' : 'Join'}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
        </div>
      </div>
    </div>
  );
};

