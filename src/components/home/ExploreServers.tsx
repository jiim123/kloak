import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Flag, Loader2, Search, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getServerInitials } from '@/lib/serverUtils';
import { toast } from 'sonner';
import { ReportReasonDialog, type ReportReasonOption } from '@/components/modals/ReportReasonDialog';

const PAGE_SIZE = 12;

const SERVER_REPORT_REASONS: ReportReasonOption[] = [
  { value: 'Inappropriate content', label: 'Inappropriate content' },
  { value: 'Abusive management', label: 'Abusive management' },
  { value: 'Impersonation or deception', label: 'Impersonation or deception' },
  { value: 'Illegal or dangerous activity', label: 'Illegal or dangerous activity' },
];

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

type ExploreServerRow = Partial<Record<keyof ExploreServer, unknown>>;

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
    <div ref={cardRef} className="h-full">
      {isVisible ? children : <div className="h-[226px] rounded-lg bg-card" />}
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
  const [reportingServer, setReportingServer] = useState<ExploreServer | null>(null);

  const myServerIds = useMemo(() => new Set(myServers.map((s) => s.id)), [myServers]);

  useEffect(() => {
    let cancelled = false;
    let isInitialLoad = true;

    const fetchServers = async () => {
      if (isInitialLoad) {
        setIsLoading(true);
      }

      try {
        const { data, error } = await (supabase.rpc as (name: string, args?: object) => ReturnType<typeof supabase.rpc>)('get_explore_servers');

        if (error) throw error;
        if (cancelled) return;

        const raw = Array.isArray(data) ? data : (data ? [data] : []);
        const mapped: ExploreServer[] = raw.map((row: ExploreServerRow) => {
          const memberCount = Number(row.member_count);

          return {
            id: String(row.id ?? ''),
            name: String(row.name ?? 'Untitled server'),
            icon_url: typeof row.icon_url === 'string' ? row.icon_url : null,
            banner_url: typeof row.banner_url === 'string' ? row.banner_url : null,
            invite_code: String(row.invite_code ?? ''),
            owner_id: String(row.owner_id ?? ''),
            created_at: typeof row.created_at === 'string' ? row.created_at : null,
            is_published: !!row.is_published,
            is_verified: !!row.is_verified,
            about: typeof row.about === 'string' ? row.about : null,
            member_count: Number.isFinite(memberCount) ? memberCount : 0,
          };
        });
        setItems(mapped);
      } catch (e: unknown) {
        console.error('Failed to load Explore servers:', e);
        if (isInitialLoad) {
          toast.error(e instanceof Error ? e.message : 'Failed to load public servers');
          setItems([]);
        }
      } finally {
        if (!cancelled && isInitialLoad) {
          setIsLoading(false);
          isInitialLoad = false;
        }
      }
    };

    fetchServers();
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

  const handleOpenServer = async (serverId: string) => {
    const server = myServers.find((s) => s.id === serverId);
    if (!server) return;

    setCurrentServer(server);
    await fetchChannels(server.id, { force: true });
    navigate(`/app/servers/${server.id}`);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [query, items.length]);

  const verifiedServers = filtered.filter((s) => s.is_verified);
  const regularServers = filtered.filter((s) => !s.is_verified);
  const featuredServers = (verifiedServers.length > 0 ? verifiedServers : filtered)
    .slice()
    .sort((a, b) => b.member_count - a.member_count)
    .slice(0, 8);
  const featuredIds = new Set(featuredServers.map((s) => s.id));
  const regularServersWithoutFeatured = regularServers.filter((s) => !featuredIds.has(s.id));
  const regularTotalPages = Math.max(1, Math.ceil(regularServersWithoutFeatured.length / PAGE_SIZE));
  const safeRegularPage = Math.min(currentPage, regularTotalPages);
  const regularPageStart = (safeRegularPage - 1) * PAGE_SIZE;
  const paginated = regularServersWithoutFeatured.slice(regularPageStart, regularPageStart + PAGE_SIZE);
  const formatMemberCount = (count: number) => {
    if (count >= 1000) {
      const rounded = Math.round((count / 1000) * 10) / 10;
      return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded}k`;
    }

    return String(count);
  };

  const handleCardClick = (server: ExploreServer) => {
    if (myServerIds.has(server.id)) {
      void handleOpenServer(server.id);
      return;
    }

    void handleJoin(server);
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>, server: ExploreServer) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleCardClick(server);
  };

  const handleReportServer = async (reason: string) => {
    if (!user?.id || !reportingServer) return;

    try {
      const { error } = await (supabase.rpc as any)('report_server', {
        _server_id: reportingServer.id,
        _reason: reason,
        _details: null,
      });

      if (error) throw error;
      toast.success('Server reported');
    } catch (error) {
      console.error('Failed to report server:', error);
      toast.error('Failed to report server');
      throw error;
    }
  };

  const renderCommunityCard = (server: ExploreServer, compact = false) => {
    const joined = myServerIds.has(server.id);

    return (
      <LazyCardMount key={server.id}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => handleCardClick(server)}
          onKeyDown={(event) => handleCardKeyDown(event, server)}
          className={cn(
            "group relative block h-full w-full cursor-pointer overflow-hidden rounded-lg bg-card text-left",
            "border border-border/60 transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
            compact ? "min-h-[206px]" : "min-h-[226px]",
          )}
        >
          <div className="relative h-[76px] w-full overflow-hidden bg-secondary">
            {server.banner_url ? (
              <img src={server.banner_url} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-secondary via-card to-background" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-black/45" />
            {user?.id && user.id !== server.owner_id && (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute right-2 top-2 h-7 w-7 rounded-md bg-black/45 text-white hover:bg-black/60"
                title="Report server"
                onClick={(event) => {
                  event.stopPropagation();
                  setReportingServer(server);
                }}
              >
                <Flag className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <div className="absolute left-1/2 top-9 -translate-x-1/2">
            <div className="flex h-[64px] w-[64px] items-center justify-center overflow-hidden rounded-xl bg-background ring-4 ring-card">
              {server.icon_url ? (
                <img src={server.icon_url} alt={server.name} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <span className="text-sm font-semibold text-foreground">{getServerInitials(server.name)}</span>
              )}
            </div>
          </div>

          <div className="flex min-h-[128px] flex-col items-center px-4 pb-4 pt-9 text-center">
            <div className="flex max-w-full items-center justify-center gap-1.5">
              <span className="truncate text-[15px] font-semibold leading-5 text-foreground">{server.name}</span>
              {server.is_verified && <img src="/verified.svg" alt="Verified server" className="h-4 w-4 shrink-0" />}
            </div>

            <p className="mt-2 line-clamp-3 min-h-[48px] text-[11px] leading-4 text-muted-foreground">
              {server.about || "Public community"}
            </p>

            <div className="mt-auto flex w-full items-center justify-between pt-3 text-[11px] font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-1">
                <Users className="h-3 w-3" />
                {formatMemberCount(server.member_count)} members
              </span>
              <Button
                size="sm"
                variant={joined ? "secondary" : "default"}
                className="h-7 px-3 text-[11px]"
                onClick={(event) => {
                  event.stopPropagation();
                  handleCardClick(server);
                }}
              >
                {joined ? "Open Server" : "Join Server"}
              </Button>
            </div>
          </div>
        </div>
      </LazyCardMount>
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-layout-chat">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative min-h-full overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-layout-chat" />
          </div>

          <div className="relative mx-auto flex w-full max-w-7xl flex-col px-4 pb-8 pt-10 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="mx-auto flex w-full max-w-xl flex-col items-center text-center"
            >
              <h1 className="text-[23px] font-bold tracking-tight text-foreground">Find communities</h1>
              <p className="mt-2 max-w-md text-[13px] leading-4 text-muted-foreground">
              Jump into our public communities to find your people, start a conversation, and find a group to hang out with.
              </p>

              <div className="relative mt-5 w-full">
                <Search className="absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search communities"
                  className="h-12 rounded-full border border-border/60 bg-card pl-11 pr-4 text-[13px] font-medium text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/60"
                />
              </div>
            </motion.div>

            <div className="mt-14 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-bold text-foreground">Featured communities</h2>
                {featuredServers.length > 4 && <ChevronRight className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
              </div>

              {isLoading ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading public servers...</span>
                </motion.div>
              ) : filtered.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg bg-card px-4 py-12 text-center"
                >
                  <Search className="mx-auto h-6 w-6 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium text-muted-foreground">No public communities found.</p>
                  {query && <p className="mt-1 text-xs text-muted-foreground/70">Try a different search term</p>}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.35, delay: 0.1 }}
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
                >
                  {featuredServers.map((server) => renderCommunityCard(server, true))}
                </motion.div>
              )}
            </div>

            {!isLoading && regularServersWithoutFeatured.length > 0 && (
              <div className="mt-8 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-bold text-foreground">All communities</h2>
                  <span className="text-xs font-medium text-muted-foreground">{regularServersWithoutFeatured.length}</span>
                </div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.35, delay: 0.15 }}
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
                >
                  {paginated.map((server) => renderCommunityCard(server))}
                </motion.div>
              </div>
            )}

            {!isLoading && regularServersWithoutFeatured.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-medium text-muted-foreground">
                  Showing {regularPageStart + 1}-{Math.min(regularPageStart + PAGE_SIZE, regularServersWithoutFeatured.length)} of {regularServersWithoutFeatured.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={safeRegularPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="h-8 border-border/70 bg-card text-xs text-foreground hover:bg-secondary hover:text-foreground"
                  >
                    Previous
                  </Button>
                  <div className="min-w-[88px] text-center text-xs font-medium text-muted-foreground">
                    Page {safeRegularPage} of {regularTotalPages}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={safeRegularPage >= regularTotalPages}
                    onClick={() => setCurrentPage((p) => Math.min(regularTotalPages, p + 1))}
                    className="h-8 border-border/70 bg-card text-xs text-foreground hover:bg-secondary hover:text-foreground"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <ReportReasonDialog
        open={!!reportingServer}
        onOpenChange={(open) => {
          if (!open) setReportingServer(null);
        }}
        title="Report server"
        description={reportingServer ? `Choose the reason that best describes ${reportingServer.name}.` : 'Choose a report reason.'}
        reasons={SERVER_REPORT_REASONS}
        onSubmit={handleReportServer}
      />
    </div>
  );
};
