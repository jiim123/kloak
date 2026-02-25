import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';

const LAST_SEEN_INTERVAL_MS = 90000; // 90 seconds
const IDLE_TIMEOUT_MS = 300000; // 5 minutes

export const usePresence = () => {
  const { user, isAuthenticated, updateStatus, updateLastSeen, manualStatus } = useAuthStore();
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSeenIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isIdleRef = useRef(false);

  const resetIdleTimer = useCallback(() => {
    if (!isAuthenticated || !user) return;

    // Don't override manual DND or Invisible
    if (manualStatus === 'dnd' || manualStatus === 'offline') {
      return;
    }

    // If was idle, set back to online
    if (isIdleRef.current && user.status !== 'dnd') {
      isIdleRef.current = false;
      updateStatus('online', { source: 'auto' });
    }

    // Clear existing timeout
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }

    // Set new idle timeout (only if not DND or invisible)
    if (user.status !== 'dnd' && user.status !== 'offline') {
      idleTimeoutRef.current = setTimeout(() => {
        if ((manualStatus as string) !== 'dnd' && (manualStatus as string) !== 'offline') {
          isIdleRef.current = true;
          updateStatus('idle', { source: 'auto' });
        }
      }, IDLE_TIMEOUT_MS);
    }
  }, [isAuthenticated, manualStatus, user, updateStatus]);

  // Set up activity listeners
  useEffect(() => {
    if (!isAuthenticated) return;

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

    const handleActivity = () => {
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
      if (document.visibilityState === 'hidden') {
        // Tab is hidden, could set to idle
        if (manualStatus !== 'dnd' && manualStatus !== 'offline') {
          updateStatus('idle', { source: 'auto' });
        }
      } else if (document.visibilityState === 'visible') {
        // Tab is visible again, set back to online if not manually set
        if (manualStatus !== 'dnd' && manualStatus !== 'offline') {
          isIdleRef.current = false;
          updateStatus('online', { source: 'auto' });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, manualStatus, updateStatus]);
};
