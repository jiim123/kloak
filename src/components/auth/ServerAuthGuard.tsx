import { useEffect, useState, forwardRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';

interface ServerAuthGuardProps {
  children: React.ReactNode;
}

const MEMBERSHIP_CACHE_TTL_MS = 5 * 60_000;
type MembershipCacheEntry = {
  authorized: boolean;
  checkedAt: number;
  inFlight?: Promise<boolean>;
};
const membershipCache = new Map<string, MembershipCacheEntry>();

const membershipCacheKey = (userId: string, serverId: string) => `${userId}:${serverId}`;

/**
 * Route guard for all /app/servers/:serverId routes.
 *
 * Uses an identity-bound RPC to verify that the current user is an active
 * member of the target server before rendering.
 *
 * Data integrity note: the `servers` UPDATE policy also restricts edits to
 * users with role 'owner' or 'admin' via is_server_admin_or_owner(), so even
 * if a savvy user bypasses the guard, the DB will reject their write.
 */
export const ServerAuthGuard = forwardRef<HTMLDivElement, ServerAuthGuardProps>(({ children }, _ref) => {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const servers = useServerStore((s) => s.servers);

  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Wait until auth has initialized
    if (isAuthLoading) return;

    // No user -> auth guard in AppLayout will redirect, nothing to do here
    if (!user?.id || !serverId) {
      setChecking(false);
      return;
    }

    const localMembership = servers.some((s) => s.id === serverId);
    const cacheKey = membershipCacheKey(user.id, serverId);

    // Fast path: local membership already loaded in server store.
    if (localMembership) {
      membershipCache.set(cacheKey, { authorized: true, checkedAt: Date.now() });
      setAuthorized(true);
      setChecking(false);
      return;
    }

    const cached = membershipCache.get(cacheKey);
    if (cached && Date.now() - cached.checkedAt < MEMBERSHIP_CACHE_TTL_MS) {
      setAuthorized(cached.authorized);
      setChecking(false);
      if (!cached.authorized) {
        navigate('/app', { replace: true });
      }
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const existingInFlight = membershipCache.get(cacheKey)?.inFlight;
        const checkPromise =
          existingInFlight ||
          (async () => {
            const { data, error } = await supabase.rpc('is_server_member', {
              _server_id: serverId,
              _user_id: user.id,
            });
            const authorizedNow = !error && !!data;
            membershipCache.set(cacheKey, { authorized: authorizedNow, checkedAt: Date.now() });
            return authorizedNow;
          })();

        if (!existingInFlight) {
          membershipCache.set(cacheKey, {
            authorized: false,
            checkedAt: 0,
            inFlight: checkPromise,
          });
        }

        const authorizedNow = await checkPromise;
        const latest = membershipCache.get(cacheKey);
        if (latest?.inFlight === checkPromise) {
          membershipCache.set(cacheKey, {
            authorized: authorizedNow,
            checkedAt: Date.now(),
          });
        }

        if (cancelled) return;

        if (!authorizedNow) {
          navigate('/app', { replace: true });
          return;
        }

        setAuthorized(true);
      } catch {
        membershipCache.set(cacheKey, { authorized: false, checkedAt: Date.now() });
        if (!cancelled) navigate('/app', { replace: true });
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [serverId, user?.id, isAuthLoading, navigate, servers]);

  // While we're checking, render nothing to avoid a flash of protected content
  if (checking || !authorized) return null;

  return <>{children}</>;
};
