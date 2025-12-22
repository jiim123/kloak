import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';

const LAST_SEEN_INTERVAL_MS = 30000; // 30 seconds
const IDLE_TIMEOUT_MS = 300000; // 5 minutes

export const usePresence = () => {
  const { user, isAuthenticated, updateStatus, updateLastSeen } = useAuthStore();
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSeenIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isIdleRef = useRef(false);

  const resetIdleTimer = useCallback(() => {
    if (!isAuthenticated || !user) return;

    // If was idle, set back to online
    if (isIdleRef.current) {
      isIdleRef.current = false;
      updateStatus('online');
    }

    // Clear existing timeout
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }

    // Set new idle timeout
    idleTimeoutRef.current = setTimeout(() => {
      isIdleRef.current = true;
      updateStatus('idle');
    }, IDLE_TIMEOUT_MS);
  }, [isAuthenticated, user, updateStatus]);

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
      updateStatus('offline');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isAuthenticated, updateStatus]);
};
