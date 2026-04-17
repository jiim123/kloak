import { User as UserIcon, X } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { getEffectivePresence } from '@/lib/presence';
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

export function PresenceDebugOverlay() {
 const { user, isAuthenticated, manualStatus } = useAuthStore();
 const connection = useConnectionStatus();

 const [isEnabled, setIsEnabled] = useState(() => {
 try {
 return localStorage.getItem(LS_KEY) === '1';
 } catch {
 return false;
 }
 });

 const [serverUser, setServerUser] = useState<UserIcon | null>(null);
 const [lastFetchAt, setLastFetchAt] = useState<number | null>(null);
 const [fetchError, setFetchError] = useState<string | null>(null);

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

 const effective = useMemo(() => {
 const status = ((serverUser?.status ?? user?.status) as UserStatus | undefined) ?? 'offline';
 const lastSeen = (serverUser?.last_seen ?? null) as string | null;
 return getEffectivePresence(status, lastSeen, user?.id);
 }, [serverUser?.status, serverUser?.last_seen, user?.status, user?.id]);

 if (!import.meta.env.DEV) return null;
 if (!isEnabled) return null;

 const lastSeen = serverUser?.last_seen ?? null;
 const ageMs = lastSeen ? Date.now() - new Date(lastSeen).getTime() : NaN;

 const close = () => {
 try {
 localStorage.setItem(LS_KEY, '0');
 } catch {
 // ignore
 }
 setIsEnabled(false);
 };

 return (
 <div className="fixed bottom-4 left-4 z-[1000] w-[360px] max-w-[calc(100vw-2rem)]">
 <div className="rounded-xl border border-border bg-background/90 backdrop-blur shadow-xl">
 <div className="flex items-center justify-between px-3 py-2 border-b border-border">
 <div className="text-sm font-medium">Presence Debug</div>
 <button
 onClick={close}
 className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
 aria-label="Close presence debug"
 >
 <X className="w-4 h-4" />
 </button>
 </div>

 <div className="px-3 py-2 space-y-2 text-xs">
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
 </div>

 {fetchError ? (
 <div className="text-destructive">fetch error: {fetchError}</div>
 ) : (
 <div className="text-muted-foreground">
 Toggle: <span className="font-mono">localStorage.setItem('{LS_KEY}','1')</span>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}

