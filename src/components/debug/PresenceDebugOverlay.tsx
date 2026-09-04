import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { getEffectivePresence } from '@/lib/presence';
import { useServerStore } from '@/stores/serverStore';
import { useFriendStore } from '@/stores/friendStore';
import { isKloakSocketEnabled, kloakSocket } from '@/lib/kloakSocket';
import {
  getAuthoritativeKloakStatus,
  getSelfPresenceEchoAgeMs,
  hasRecentRealtimePresence,
} from '@/hooks/useRealtimeUsers';
import { getUserFromCache } from '@/stores/userCacheStore';
import type { User, UserStatus } from '@/types';

const LS_KEY = 'kloak-debug-presence';

function formatAge(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

const shortId = (id: string) => id.slice(0, 8);

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'online'
      ? 'bg-kloak-online'
      : status === 'idle'
        ? 'bg-kloak-idle'
        : status === 'dnd'
          ? 'bg-kloak-dnd'
          : 'bg-zinc-600';
  return <span className={cn('inline-block w-2 h-2 rounded-full mr-1.5 align-middle', color)} />;
}

export function PresenceDebugOverlay() {
  const { user, isAuthenticated, manualStatus } = useAuthStore();
  const connection = useConnectionStatus();
  const members = useServerStore((s) => s.members);
  const visibilityBlockedUserIds = useFriendStore((s) => s.visibilityBlockedUserIds);

  const [isEnabled, setIsEnabled] = useState(() => {
    try {
      return localStorage.getItem(LS_KEY) === '1';
    } catch {
      return false;
    }
  });

  const [serverUser, setServerUser] = useState<User | null>(null);
  const [lastFetchAt, setLastFetchAt] = useState<number | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [snapshot, setSnapshot] = useState<{ at: number; users: Array<{ user_id: string; status: string }> } | null>(
    null,
  );

  // Keep enabled state in sync if user toggles in console.
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY) setIsEnabled(e.newValue === '1');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!isEnabled) return;
    if (!isAuthenticated || !user?.id) return;

    let cancelled = false;

    const fetchServerUser = async () => {
      try {
        const { data, error } = await supabase.rpc('get_user_by_id', { _user_id: user.id });
        if (cancelled) return;
        if (error) throw error;
        setServerUser((data as unknown as User) ?? null);
        setFetchError(null);
        setLastFetchAt(Date.now());
      } catch (e: any) {
        if (cancelled) return;
        setFetchError(e?.message ?? 'Failed to fetch');
      }
    };

    fetchServerUser();
    const interval = window.setInterval(fetchServerUser, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isEnabled, isAuthenticated, user?.id]);

  // Poll the authoritative server presence snapshot so two viewers can compare
  // what the kloak-ws server itself reports (identical for everyone on the
  // same server) against what each client renders.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!isEnabled || !isAuthenticated || !user?.id) return;
    if (!isKloakSocketEnabled()) {
      setSnapshot(null);
      return;
    }

    let cancelled = false;
    const refresh = async () => {
      try {
        const data = (await kloakSocket.getPresenceSnapshot()) as unknown;
        if (cancelled) return;
        const rows = Array.isArray(data) ? data : [];
        const users = rows
          .filter(
            (r): r is { user_id: string; status: string } =>
              !!r && typeof (r as any).user_id === 'string' && typeof (r as any).status === 'string',
          )
          .map((r) => ({ user_id: r.user_id, status: r.status }));
        setSnapshot({ at: Date.now(), users });
      } catch {
        if (!cancelled) setSnapshot(null);
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isEnabled, isAuthenticated, user?.id]);

  const effective = useMemo(() => {
    const status = ((serverUser?.status ?? user?.status) as UserStatus | undefined) ?? 'offline';
    const lastSeen = (serverUser?.last_seen ?? null) as string | null;
    return getEffectivePresence(status, lastSeen, user?.id);
  }, [serverUser?.status, serverUser?.last_seen, user?.status, user?.id]);

  const blockedSet = useMemo(() => new Set(visibilityBlockedUserIds), [visibilityBlockedUserIds]);

  // The member roster exactly as this viewer's stores see it: status from the
  // authoritative kloak map (applied), then the user cache, then member.user.
  const rosterRows = useMemo(() => {
    return members
      .filter((m) => m.user)
      .map((m) => {
        const cached = getUserFromCache(m.user_id);
        const applied = getAuthoritativeKloakStatus(m.user_id);
        const memberStatus = (m.user?.status as UserStatus | undefined) ?? null;
        const cacheStatus = ((cached?.status as UserStatus | undefined) ?? null) as UserStatus | null;
        const status = (applied ?? cacheStatus ?? memberStatus) ?? 'offline';
        return {
          id: m.user_id,
          name: m.user?.username ?? m.nickname ?? shortId(m.user_id),
          status,
          applied,
          cacheStatus,
          fresh: hasRecentRealtimePresence(m.user_id),
          blocked: blockedSet.has(m.user_id),
        };
      })
      .sort((a, b) => {
        if (a.blocked !== b.blocked) return Number(a.blocked) - Number(b.blocked);
        if ((a.status === 'offline') !== (b.status === 'offline')) return Number(a.status === 'offline') - Number(b.status === 'offline');
        return a.name.localeCompare(b.name);
      });
  }, [members, blockedSet]);

  if (!import.meta.env.DEV) return null;
  if (!isEnabled) return null;

  const lastSeen = serverUser?.last_seen ?? null;
  const ageMs = lastSeen ? Date.now() - new Date(lastSeen).getTime() : NaN;

  const snapshotUsers = snapshot?.users ?? [];

  const close = () => {
    try {
      localStorage.setItem(LS_KEY, '0');
    } catch {
      // ignore
    }
    setIsEnabled(false);
  };

  return (
    <div className="fixed bottom-4 left-4 z-[1000] w-[420px] max-w-[calc(100vw-2rem)]">
      <div className="rounded-xl border border-border bg-background/90 backdrop-blur shadow-xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border sticky top-0 bg-background/95 z-10">
          <div className="text-sm font-medium">Presence Debug</div>
          <button
            onClick={close}
            className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
            aria-label="Close presence debug"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 py-2 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <div className="text-muted-foreground">auth</div>
            <div className="text-right">{isAuthenticated ? 'yes' : 'no'}</div>

            <div className="text-muted-foreground">user</div>
            <div className="text-right truncate">{user?.username ?? '—'}</div>

            <div className="text-muted-foreground">manualStatus</div>
            <div className="text-right">{manualStatus ?? '—'}</div>

            <div className="text-muted-foreground">db.status</div>
            <div className="text-right">{(serverUser?.status as any) ?? '—'}</div>

            <div className="text-muted-foreground">db.last_seen age</div>
            <div className="text-right">{lastSeen ? formatAge(ageMs) : '—'}</div>

            <div className="text-muted-foreground">effective</div>
            <div className="text-right">
              <span
                className={cn(
                  'font-medium',
                  effective.status === 'online' && 'text-[hsl(var(--kloak-success))]',
                  effective.status === 'idle' && 'text-[hsl(var(--kloak-warning))]',
                  effective.status === 'dnd' && 'text-destructive',
                  effective.status === 'offline' && 'text-muted-foreground',
                )}
              >
                {effective.status}
              </span>
              {effective.isStale ? <span className="text-muted-foreground"> (stale)</span> : null}
            </div>

            <div className="text-muted-foreground">conn.status</div>
            <div className="text-right">{connection.status}</div>

            <div className="text-muted-foreground">realtime</div>
            <div className="text-right">{connection.isRealtimeConnected ? 'up' : 'down'}</div>

            <div className="text-muted-foreground">latency</div>
            <div className="text-right">{connection.latency && connection.latency > 0 ? `${connection.latency}ms` : '—'}</div>

            <div className="text-muted-foreground">last fetch</div>
            <div className="text-right">{lastFetchAt ? `${formatAge(Date.now() - lastFetchAt)} ago` : '—'}</div>

            {isKloakSocketEnabled() && (
              <>
                <div className="text-muted-foreground">socket url</div>
                <div className="text-right font-mono text-[10px] break-all">{kloakSocket.url}</div>

                <div className="text-muted-foreground">socket</div>
                <div className="text-right">{kloakSocket.isOpen ? 'open' : 'closed'}</div>

                <div className="text-muted-foreground">self echo age</div>
                <div className="text-right">
                  {getSelfPresenceEchoAgeMs() != null ? `${formatAge(getSelfPresenceEchoAgeMs()!)} ago` : 'never'}
                </div>
              </>
            )}
          </div>

          {fetchError ? (
            <div className="text-destructive">fetch error: {fetchError}</div>
          ) : (
            <div className="text-muted-foreground">
              Toggle: <span className="font-mono">localStorage.setItem('{LS_KEY}','1')</span>
            </div>
          )}

          {isKloakSocketEnabled() && (
            <>
              {/* Server snapshot = the authoritative truth, identical for every viewer */}
              <div className="border-t border-border pt-2">
                <div className="font-medium text-foreground">
                  server snapshot: {snapshotUsers.length} user{snapshotUsers.length === 1 ? '' : 's'}
                  {snapshot ? <span className="text-muted-foreground font-normal"> ({formatAge(Date.now() - snapshot.at)} ago)</span> : null}
                </div>
                {snapshot ? (
                  snapshotUsers.length > 0 ? (
                    <div className="mt-1 grid grid-cols-1 gap-y-0.5 font-mono text-[10px] text-muted-foreground">
                      {snapshotUsers.map((u) => (
                        <div key={u.user_id} className="truncate">
                          <StatusDot status={u.status} />
                          {shortId(u.user_id)} <span className="text-foreground/80">{u.status}</span>
                          {blockedSet.has(u.user_id) ? <span className="text-destructive ml-1">BLOCKED</span> : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground mt-1">(empty)</div>
                  )
                ) : (
                  <div className="text-muted-foreground mt-1">(no snapshot — socket down or kloak disabled)</div>
                )}
              </div>

              {/* Viewer-side visibility filter — a blocker hiding members for one viewer only */}
              <div className="border-t border-border pt-2">
                <div className="font-medium text-foreground">
                  blocked (visibility): {visibilityBlockedUserIds.length}
                </div>
                {visibilityBlockedUserIds.length > 0 && (
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground break-all">
                    {visibilityBlockedUserIds.map(shortId).join(', ')}
                  </div>
                )}
              </div>

              {/* Rendered roster in the current server, per this viewer's stores */}
              <div className="border-t border-border pt-2">
                <div className="font-medium text-foreground">
                  roster (server members in store): {members.length} · online{' '}
                  {rosterRows.filter((r) => r.status !== 'offline' && !r.blocked).length}
                </div>
                <div className="mt-1 space-y-0.5 font-mono text-[10px] text-muted-foreground">
                  {rosterRows.length === 0 && <div>(no members in store — open the server)</div>}
                  {rosterRows.slice(0, 30).map((r) => (
                    <div key={r.id} className={cn('truncate', r.blocked && 'text-destructive line-through')}>
                      <StatusDot status={r.status} />
                      {r.name}
                      <span className="text-foreground/80"> {r.status}</span>
                      {r.blocked ? <span className="ml-1 text-destructive">BLOCKED</span> : null}
                      {r.applied !== r.cacheStatus ? (
                        <span className="ml-1 text-muted-foreground">
                          (applied:{r.applied ?? '—'} cache:{r.cacheStatus ?? '—'})
                        </span>
                      ) : null}
                      {r.fresh ? <span className="ml-1 text-muted-foreground">fresh</span> : null}
                    </div>
                  ))}
                  {rosterRows.length > 30 && (
                    <div className="text-muted-foreground">… +{rosterRows.length - 30} more</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
