import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';

const LAST_SEEN_INTERVAL_MS = 90000; // 90 seconds
const IDLE_TIMEOUT_MS = 300000; // 5 minutes

export const usePresence = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const manualStatus = useAuthStore((s) => s.manualStatus);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSeenIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isIdleRef = useRef(false);

  // Use refs for values that change frequently but shouldn't trigger effect re-runs
  const manualStatusRef = useRef(manualStatus);
  manualStatusRef.current = manualStatus;

  const resetIdleTimer = useCallback(() => {
    const { user, isAuthenticated: authed, manualStatus: ms } = useAuthStore.getState();
    if (!authed || !user) return;

    // Don't override manual DND or Invisible
    if (ms === 'dnd' || ms === 'offline') return;

    // If was idle, set back to online
    if (isIdleRef.current && user.status !== 'dnd') {
      isIdleRef.current = false;
      useAuthStore.getState().updateStatus('online', { source: 'auto' });
    }

    // Clear existing timeout
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }

    // Set new idle timeout (only if not DND or invisible)
    if (user.status !== 'dnd' && user.status !== 'offline') {
      idleTimeoutRef.current = setTimeout(() => {
        const currentMs = useAuthStore.getState().manualStatus;
        if (currentMs !== 'dnd' && currentMs !== 'offline') {
          isIdleRef.current = true;
          useAuthStore.getState().updateStatus('idle', { source: 'auto' });
        }
      }, IDLE_TIMEOUT_MS);
    }
  }, []); // Stable — reads from getState()

  // Set up activity listeners — registers ONCE when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

    // FIX: Throttle activity handler to prevent excessive timer churn
    // from high-frequency events like mousemove (fires hundreds of times per second)
    let lastActivityAt = 0;
    const ACTIVITY_THROTTLE_MS = 5000;
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivityAt < ACTIVITY_THROTTLE_MS) return;
      lastActivityAt = now;
      resetIdleTimer();
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial idle timer
    resetIdleTimer();

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });

      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
    };
  }, [isAuthenticated, resetIdleTimer]);

  // Update last_seen periodically
  useEffect(() => {
    if (!isAuthenticated) return;
    // If user chose Invisible, do not heartbeat last_seen (preserves "appear offline").
    if (manualStatus === 'offline') return;

    // Get the function directly to avoid dependency issues
    const { updateLastSeen } = useAuthStore.getState();

    // Update immediately only when visible.
    if (document.visibilityState === 'visible') {
      updateLastSeen();
    }

    // Then update periodically while visible.
    lastSeenIntervalRef.current = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      useAuthStore.getState().updateLastSeen();
    }, LAST_SEEN_INTERVAL_MS);

    return () => {
      if (lastSeenIntervalRef.current) {
        clearInterval(lastSeenIntervalRef.current);
      }
    };
  }, [isAuthenticated, manualStatus]);

  // Visibility-based presence (best-effort; offline is derived from last_seen elsewhere)
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleVisibilityChange = () => {
      const ms = useAuthStore.getState().manualStatus;
      if (document.visibilityState === 'hidden') {
        if (ms !== 'dnd' && ms !== 'offline') {
          useAuthStore.getState().updateStatus('idle', { source: 'auto' });
        }
      } else if (document.visibilityState === 'visible') {
        if (ms !== 'dnd' && ms !== 'offline') {
          isIdleRef.current = false;
          useAuthStore.getState().updateStatus('online', { source: 'auto' });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated]);
};
