import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSyncStore } from '@/stores/syncStore';
import { useOnlineStatus } from './useOnlineStatus';

// OPTIMIZATION: Consolidated heartbeat and latency into single check every 60s
const COMBINED_CHECK_INTERVAL = 60000; // 60 seconds (was 30s heartbeat + 60s latency)
const HEARTBEAT_FAILURES_BEFORE_RECONNECT = 2;
const MIN_HEALTH_CHECK_GAP_MS = 20000;

type RealtimeListener = (connected: boolean) => void;
type RealtimeSubscribeError = {
  message?: string;
  name?: string;
  cause?: unknown;
};

let sharedRealtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let sharedCombinedTimer: NodeJS.Timeout | null = null;
let sharedSubscriberCount = 0;
let sharedHealthCheckInFlight: Promise<void> | null = null;
let sharedLastHealthCheckAt = 0;
const realtimeListeners = new Set<RealtimeListener>();

const notifyRealtimeConnected = (connected: boolean) => {
  realtimeListeners.forEach((fn) => {
    try {
      fn(connected);
    } catch {
      // ignore listener errors
    }
  });
};

/**
 * Hook for monitoring connection status and latency
 * OPTIMIZATION: Consolidated heartbeat and latency checks into single query
 */
export function useConnectionStatus() {
  const { isOnline } = useOnlineStatus();
  const { 
    connection, 
    setConnectionStatus, 
    updateLatency,
    incrementReconnectAttempts,
    resetReconnectAttempts,
  } = useSyncStore();
  
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(true);
  const combinedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatFailuresRef = useRef(0);

  // Combined heartbeat and latency check - single query instead of two
  const checkConnectionHealth = useCallback(async () => {
    if (!isOnline) return;

    const now = Date.now();
    if (sharedHealthCheckInFlight) {
      await sharedHealthCheckInFlight;
      return;
    }
    if (now - sharedLastHealthCheckAt < MIN_HEALTH_CHECK_GAP_MS) {
      return;
    }

    const p = (async () => {
      const start = performance.now();
      try {
        const { error } = await supabase.rpc('ping_health');
        if (error) throw error;

        // Success - update latency and reset failures
        const latency = Math.round(performance.now() - start);
        updateLatency(latency);
        heartbeatFailuresRef.current = 0;

        if (connection.status !== 'connected') {
          setConnectionStatus('connected');
          resetReconnectAttempts();
        }
      } catch (error) {
        // Connection issue
        updateLatency(-1);
        heartbeatFailuresRef.current += 1;

        if (heartbeatFailuresRef.current >= HEARTBEAT_FAILURES_BEFORE_RECONNECT) {
          if (connection.status === 'connected') {
            setConnectionStatus('reconnecting');
            incrementReconnectAttempts();
          }
        }
      }
    })().finally(() => {
      if (sharedHealthCheckInFlight === p) {
        sharedHealthCheckInFlight = null;
      }
    });

    sharedLastHealthCheckAt = now;
    sharedHealthCheckInFlight = p;
    await p;
  }, [isOnline, connection.status, setConnectionStatus, updateLatency, resetReconnectAttempts, incrementReconnectAttempts]);

  // Monitor Supabase realtime connection
  useEffect(() => {
    sharedSubscriberCount += 1;

    const onRealtime = (connected: boolean) => setIsRealtimeConnected(connected);
    realtimeListeners.add(onRealtime);

    // Create a single shared realtime channel to avoid multiple subscriptions
    // fighting each other and causing "reconnecting" chatter.
    if (!sharedRealtimeChannel) {
      const channel = supabase.channel('connection-status');
      sharedRealtimeChannel = channel;

      channel.subscribe((status, err) => {
        const typedErr = err as RealtimeSubscribeError | null | undefined;
        switch (status) {
          case 'SUBSCRIBED':
            notifyRealtimeConnected(true);
            setConnectionStatus('connected');
            resetReconnectAttempts();
            break;
          case 'CLOSED':
          case 'CHANNEL_ERROR':
            if (err) {
              console.warn('[Realtime] connection-status subscribe error:', {
                status,
                message: typedErr?.message,
                name: typedErr?.name,
                cause: typedErr?.cause,
                details: err,
              });
            }
            notifyRealtimeConnected(false);
            if (navigator.onLine) {
              setConnectionStatus('reconnecting');
              incrementReconnectAttempts();
            } else {
              setConnectionStatus('disconnected');
            }
            break;
          case 'TIMED_OUT':
            if (err) {
              console.warn('[Realtime] connection-status timed out:', {
                status,
                message: typedErr?.message,
                name: typedErr?.name,
                cause: typedErr?.cause,
                details: err,
              });
            }
            notifyRealtimeConnected(false);
            setConnectionStatus('disconnected');
            break;
        }
      });
    } else {
      // Sync local state with current shared status
      setIsRealtimeConnected(true);
    }

    return () => {
      realtimeListeners.delete(onRealtime);
      sharedSubscriberCount = Math.max(0, sharedSubscriberCount - 1);
      if (sharedSubscriberCount === 0 && sharedRealtimeChannel) {
        try {
          supabase.removeChannel(sharedRealtimeChannel);
        } catch {
          // ignore
        }
        sharedRealtimeChannel = null;
        if (sharedCombinedTimer) clearInterval(sharedCombinedTimer);
        sharedCombinedTimer = null;
      }
    };
  }, [isOnline, setConnectionStatus, resetReconnectAttempts, incrementReconnectAttempts]);

  // OPTIMIZATION: Single combined check instead of separate heartbeat + latency
  useEffect(() => {
    if (!isOnline) return;

    // Initial check
    checkConnectionHealth();
    
    // Periodic combined check using shared timer
    if (!sharedCombinedTimer) {
      sharedCombinedTimer = setInterval(checkConnectionHealth, COMBINED_CHECK_INTERVAL);
    }
    combinedTimerRef.current = sharedCombinedTimer;

    return () => {
      // shared timer is cleaned up when last subscriber unmounts
    };
  }, [isOnline, checkConnectionHealth]);

  // Connection quality based on latency
  const connectionQuality = useCallback((): 'excellent' | 'good' | 'poor' | 'disconnected' => {
    if (!isOnline || connection.status !== 'connected') return 'disconnected';
    if (connection.latency === null || connection.latency < 0) return 'poor';
    if (connection.latency < 100) return 'excellent';
    if (connection.latency < 300) return 'good';
    return 'poor';
  }, [isOnline, connection.status, connection.latency]);

  return {
    status: connection.status,
    isConnected: connection.status === 'connected' && isOnline,
    isReconnecting: connection.status === 'reconnecting',
    isRealtimeConnected,
    latency: connection.latency,
    reconnectAttempts: connection.reconnectAttempts,
    quality: connectionQuality(),
    lastConnectedAt: connection.lastConnectedAt,
  };
}
