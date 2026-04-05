import { useEffect, useMemo, useState, type ReactNode } from 'react';
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

const PAGE_SIZE = 12;

type ExploreServer = {
  id: string;
  name: string;
  icon_url: string | null;
  banner_url: string | null;
  invite_code: string;
  created_at: string | null;
  owner_id: string;
  is_published: boolean;
  is_verified: boolean;
  about: string | null;
  member_count: number;
};

export const ExploreServers = () => {
  return <ExploreServersOriginal />;
};

const LazyCardMount = ({ children }: { children: ReactNode }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasObserved, setHasObserved] = useState(false);
  const cardRef = (node: HTMLDivElement | null) => {
    if (!node || hasObserved) return;
    setHasObserved(true);

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '160px 0px' },
    );

    observer.observe(node);
  };

  return (
    <div ref={cardRef}>
      {isVisible ? (
        children
      ) : (
        <div className="h-[260px] rounded-2xl border border-border/40 bg-card/30" />
      )}
    </div>
  );
};

const ExploreServersOriginal = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { servers: myServers, joinServer, setCurrentServer, fetchChannels } = useServerStore();

  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<ExploreServer[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

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
          is_verified: !!row.is_verified,
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
    if (!server.invite_code) {
      toast.error('This server is missing an invite code');
      return;
    }

    const joined = await joinServer(server.invite_code, user.id, 'discover');
    if (!joined) {
      const err = useServerStore.getState().error;
      toast.error(err || 'Failed to join server');
      return;
    }

    toast.success(`Joined ${joined.name}`);
    setCurrentServer(joined);
    await fetchChannels(joined.id, { force: true });
    navigate(`/app/servers/${joined.id}`);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [query, items.length]);

  const verifiedServers = filtered.filter((s) => s.is_verified);
  const regularServers = filtered.filter((s) => !s.is_verified);
  const regularTotalPages = Math.max(1, Math.ceil(regularServers.length / PAGE_SIZE));
  const safeRegularPage = Math.min(currentPage, regularTotalPages);
  const regularPageStart = (safeRegularPage - 1) * PAGE_SIZE;
  const paginated = regularServers.slice(regularPageStart, regularPageStart + PAGE_SIZE);

  return (
    <div className="h-full flex flex-col bg-layout-members overflow-hidden">
      {/* Header - hidden on mobile since we have MobileHeader */}
      <div className="h-12 px-4 hidden md:flex items-center justify-between border-b border-border bg-layout-sidebar-secondary flex-shrink-0">
        <h2 className="font-medium text-foreground">Explore</h2>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Hero Section */}
        <div className="relative overflow-hidden border-b border-border/50">
          {/* Solid Background */}
          <div className="absolute inset-0 bg-secondary" />

          {/* Hero Content */}
          <div className="relative px-4 py-6 md:py-8 min-h-[160px] md:min-h-[180px] flex items-center">
            <div className="max-w-4xl mx-auto w-full">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center space-y-4"
              >
                {/* Title */}
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-2xl md:text-3xl font-medium tracking-tight text-foreground"
                >
                  Explore{' '}
                  <span className="text-primary relative inline-block">
                    Servers
                    <motion.span
                      className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-primary/50 rounded-full"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.6, delay: 0.5 }}
                    />
                  </span>
                </motion.h1>

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
          <div className="space-y-6">
            {verifiedServers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-foreground">Verified Servers</h3>
                  <span className="text-xs text-muted-foreground">{verifiedServers.length}</span>
                </div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
                >
                  {verifiedServers.map((s, index) => {
                    const joined = myServerIds.has(s.id);
                    const tags = extractTags(s.about);
                    return (
                      <LazyCardMount key={s.id}>
                        <div
                          className={cn(
                            "relative rounded-2xl border border-primary/40 bg-card/40 overflow-hidden",
                            "bg-card/40 cursor-pointer group",
                          )}
                        >
                          <div className="absolute right-2 top-2 z-10 px-2 py-0.5 rounded-full bg-primary/90 text-primary-foreground text-[10px] font-medium">
                            VERIFIED
                          </div>
                          <div className="relative h-24 w-full overflow-hidden">
                            {s.banner_url ? (
                              <img src={s.banner_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <div className="h-full w-full bg-gradient-to-br from-secondary/60 via-secondary/40 to-secondary/20" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/40" />
                          </div>
                          <div className="absolute left-1/2 top-[76px] -translate-x-1/2">
                            <div className="w-16 h-16 rounded-full bg-background/80 backdrop-blur border border-border shadow-lg overflow-hidden flex items-center justify-center">
                              <div className="w-14 h-14 rounded-full bg-secondary overflow-hidden flex items-center justify-center">
                                {s.icon_url ? (
                                  <img src={s.icon_url} alt={s.name} className="w-full h-full object-cover" loading="lazy" />
                                ) : (
                                  <span className="text-sm font-medium text-foreground">{getInitials(s.name)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="px-4 pb-4 pt-12">
                            <div className="flex flex-col items-center text-center">
                              <div className="text-base font-medium text-foreground truncate w-full">{s.name}</div>
                              {s.about && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.about}</div>}
                            </div>
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
                        </div>
                      </LazyCardMount>
                    );
                  })}
                </motion.div>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">All Servers</h3>
                <span className="text-xs text-muted-foreground">{regularServers.length}</span>
              </div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
              >
                {paginated.map((s, index) => {
                  const joined = myServerIds.has(s.id);
                  const tags = extractTags(s.about);
                  return (
                    <LazyCardMount key={s.id}>
                      <div
                        className={cn(
                          "relative rounded-2xl border border-border/60 bg-card/40 overflow-hidden",
                          "bg-card/40 cursor-pointer group",
                        )}
                      >
                        <div className="relative h-24 w-full overflow-hidden">
                          {s.banner_url ? (
                            <img src={s.banner_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-secondary/60 via-secondary/40 to-secondary/20" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/40" />
                        </div>
                        <div className="absolute left-1/2 top-[76px] -translate-x-1/2">
                          <div className="w-16 h-16 rounded-full bg-background/80 backdrop-blur border border-border shadow-lg overflow-hidden flex items-center justify-center">
                            <div className="w-14 h-14 rounded-full bg-secondary overflow-hidden flex items-center justify-center">
                              {s.icon_url ? (
                                <img src={s.icon_url} alt={s.name} className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <span className="text-sm font-medium text-foreground">{getInitials(s.name)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="px-4 pb-4 pt-12">
                          <div className="flex flex-col items-center text-center">
                            <div className="text-base font-medium text-foreground truncate w-full">{s.name}</div>
                            {s.about && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.about}</div>}
                          </div>
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
                      </div>
                    </LazyCardMount>
                  );
                })}
              </motion.div>
            </div>
          </div>
        )}

        {!isLoading && regularServers.length > 0 && (
          <div className="pt-2 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-muted-foreground">
              Showing {regularPageStart + 1}-{Math.min(regularPageStart + PAGE_SIZE, regularServers.length)} of {regularServers.length}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={safeRegularPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <div className="text-xs text-muted-foreground min-w-[88px] text-center">
                Page {safeRegularPage} of {regularTotalPages}
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={safeRegularPage >= regularTotalPages}
                onClick={() => setCurrentPage((p) => Math.min(regularTotalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

