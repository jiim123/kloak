import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';

interface ServerAuthGuardProps {
  children: React.ReactNode;
}

/**
 * Route guard for all /app/servers/:serverId routes.
 *
 * Fetches the current user's membership record from Supabase before rendering.
 * Because the `server_members` SELECT policy now enforces membership server-side,
 * a non-member (or banned user) will receive an empty result — this guard treats
 * that as unauthorised and redirects to /app immediately.
 *
 * Data integrity note: the `servers` UPDATE policy also restricts edits to
 * users with role 'owner' or 'admin' via is_server_admin_or_owner(), so even
 * if a savvy user bypasses the guard, the DB will reject their write.
 */
export const ServerAuthGuard = ({ children }: ServerAuthGuardProps) => {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);

  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Wait until auth has initialised
    if (isAuthLoading) return;

    // No user → auth guard in AppLayout will redirect, nothing to do here
    if (!user?.id || !serverId) {
      setChecking(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // Ask Supabase for this specific membership row.
        // The server-side RLS policy on server_members only returns rows where
        // the requesting user is a non-banned member of that server.
        // If the row doesn't come back, access is denied.
        const { data, error } = await supabase
          .from('server_members')
          .select('id, is_banned')
          .eq('server_id', serverId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (cancelled) return;

        if (error || !data || data.is_banned) {
          // No membership record returned (or banned) — server-side enforcement
          navigate('/app', { replace: true });
          return;
        }

        setAuthorized(true);
      } catch {
        if (!cancelled) navigate('/app', { replace: true });
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [serverId, user?.id, isAuthLoading, navigate]);

  // While we're checking, render nothing to avoid a flash of protected content
  if (checking || !authorized) return null;

  return <>{children}</>;
};
