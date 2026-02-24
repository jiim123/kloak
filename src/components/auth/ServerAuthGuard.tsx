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
 * Uses an identity-bound RPC to verify that the current user is an active
 * member of the target server before rendering.
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
    // Wait until auth has initialized
    if (isAuthLoading) return;

    // No user -> auth guard in AppLayout will redirect, nothing to do here
    if (!user?.id || !serverId) {
      setChecking(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase.rpc('is_server_member', {
          _server_id: serverId,
          _user_id: user.id,
        });

        if (cancelled) return;

        if (error || !data) {
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
