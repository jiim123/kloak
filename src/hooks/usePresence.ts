import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';

const LAST_SEEN_INTERVAL_MS = 30000; // 30 seconds
const IDLE_TIMEOUT_MS = 300000; // 5 minutes

export const usePresence = () => {
  const { user, isAuthenticated, updateStatus, updateLastSeen } = useAuthStore();
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSeenIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isIdleRef = useRef(false);
  const manualStatusRef = useRef<string | null>(null);

  const resetIdleTimer = useCallback(() => {
    if (!isAuthenticated || !user) return;

    // Don't override manual DND or invisible status
    if (manualStatusRef.current === 'dnd' || manualStatusRef.current === 'offline') {
      return;
    }

    // If was idle, set back to online
    if (isIdleRef.current && user.status !== 'dnd') {
      isIdleRef.current = false;
      updateStatus('online');
    }

    // Clear existing timeout
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }

    // Set new idle timeout (only if not DND or invisible)
    if (user.status !== 'dnd' && manualStatusRef.current !== 'offline') {
      idleTimeoutRef.current = setTimeout(() => {
        if (manualStatusRef.current !== 'dnd' && manualStatusRef.current !== 'offline') {
          isIdleRef.current = true;
          updateStatus('idle');
        }
      }, IDLE_TIMEOUT_MS);
    }
  }, [isAuthenticated, user, updateStatus]);

  // Track manual status changes
  useEffect(() => {
    if (user?.status) {
      // If user manually sets DND or invisible, remember it
      if (user.status === 'dnd' || user.status === 'offline') {
        manualStatusRef.current = user.status;
      } else if (user.status === 'online' && !isIdleRef.current) {
        // Reset manual status when going online
        manualStatusRef.current = null;
      }
    }
  }, [user?.status]);

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

    // Update immediately
    updateLastSeen();

    // Then update every 30 seconds
    lastSeenIntervalRef.current = setInterval(() => {
      updateLastSeen();
    }, LAST_SEEN_INTERVAL_MS);

    return () => {
      if (lastSeenIntervalRef.current) {
        clearInterval(lastSeenIntervalRef.current);
      }
    };
  }, [isAuthenticated, updateLastSeen]);

  // Set offline on page unload
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable delivery
      const { user } = useAuthStore.getState();
      if (user) {
        navigator.sendBeacon(
          `https://foquucurnwpqcvgqukpz.supabase.co/rest/v1/users?id=eq.${user.id}`,
          JSON.stringify({ status: 'offline', last_seen: new Date().toISOString() })
        );
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Tab is hidden, could set to idle
        if (manualStatusRef.current !== 'dnd' && manualStatusRef.current !== 'offline') {
          updateStatus('idle');
        }
      } else if (document.visibilityState === 'visible') {
        // Tab is visible again, set back to online if not manually set
        if (manualStatusRef.current !== 'dnd' && manualStatusRef.current !== 'offline') {
          isIdleRef.current = false;
          updateStatus('online');
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, updateStatus]);
};
