/**
 * Auto-disconnect Timer Hook
 * Disconnects from voice channel after configured idle time
 */

import { useEffect, useRef, useCallback } from 'react';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';
import { toast } from 'sonner';

interface UseAutoDisconnectOptions {
  isJoined: boolean;
  isSpeaking: boolean;
  onDisconnect: () => void;
}

export function useAutoDisconnect({
  isJoined,
  isSpeaking,
  onDisconnect,
}: UseAutoDisconnectOptions) {
  const autoDisconnectMinutes = useVoiceSettingsStore(
    (s) => s.settings.autoDisconnectMinutes
  );
  
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Clear any existing timer
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Reset the idle timer
  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    clearTimer();

    // Don't set timer if disabled or not joined
    if (autoDisconnectMinutes === 0 || !isJoined) return;

    const timeoutMs = autoDisconnectMinutes * 60 * 1000;

    timerRef.current = setTimeout(() => {
      toast.info('Disconnected due to inactivity', {
        description: `You were idle for ${autoDisconnectMinutes} minute${autoDisconnectMinutes > 1 ? 's' : ''}.`,
      });
      onDisconnect();
    }, timeoutMs);
  }, [autoDisconnectMinutes, isJoined, onDisconnect, clearTimer]);

  // Reset timer when user speaks
  useEffect(() => {
    if (isSpeaking && isJoined) {
      resetTimer();
    }
  }, [isSpeaking, isJoined, resetTimer]);

  // Set up timer when joining, clear when leaving
  useEffect(() => {
    if (isJoined && autoDisconnectMinutes > 0) {
      resetTimer();
    } else {
      clearTimer();
    }

    return clearTimer;
  }, [isJoined, autoDisconnectMinutes, resetTimer, clearTimer]);

  // Also reset on any user interaction while in voice
  useEffect(() => {
    if (!isJoined || autoDisconnectMinutes === 0) return;

    const handleActivity = () => {
      resetTimer();
    };

    // Listen to various user activity events
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    return () => {
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [isJoined, autoDisconnectMinutes, resetTimer]);

  return {
    resetTimer,
    clearTimer,
  };
}
