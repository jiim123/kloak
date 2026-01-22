import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSyncStore } from '@/stores/syncStore';
import { useOnlineStatus } from './useOnlineStatus';

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const LATENCY_CHECK_INTERVAL = 60000; // 1 minute
const HEARTBEAT_FAILURES_BEFORE_RECONNECT = 2;

type RealtimeListener = (connected: boolean) => void;

let sharedRealtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let sharedHeartbeatTimer: NodeJS.Timeout | null = null;
let sharedLatencyTimer: NodeJS.Timeout | null = null;
let sharedSubscriberCount = 0;
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
 * Provides real-time feedback about connection quality
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
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const latencyRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatFailuresRef = useRef(0);

  // Check latency by timing a simple query
  const checkLatency = useCallback(async () => {
    if (!isOnline) return;
    
    const start = performance.now();
    try {
      await supabase.from('users').select('id').limit(1);
      const latency = Math.round(performance.now() - start);
      updateLatency(latency);
    } catch (error) {
      // Connection issue
      updateLatency(-1);
    }
  }, [isOnline, updateLatency]);

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

      channel.subscribe((status) => {
        switch (status) {
          case 'SUBSCRIBED':
            notifyRealtimeConnected(true);
            setConnectionStatus('connected');
            resetReconnectAttempts();
            break;
          case 'CLOSED':
          case 'CHANNEL_ERROR':
            notifyRealtimeConnected(false);
            if (navigator.onLine) {
              setConnectionStatus('reconnecting');
              incrementReconnectAttempts();
            } else {
              setConnectionStatus('disconnected');
            }
            break;
          case 'TIMED_OUT':
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
        if (sharedHeartbeatTimer) clearInterval(sharedHeartbeatTimer);
        if (sharedLatencyTimer) clearInterval(sharedLatencyTimer);
        sharedHeartbeatTimer = null;
        sharedLatencyTimer = null;
      }
    };
  }, [isOnline, setConnectionStatus, resetReconnectAttempts, incrementReconnectAttempts]);

  // Heartbeat to detect silent disconnections
  useEffect(() => {
    if (!isOnline) return;

    const heartbeat = async () => {
      try {
        const { error } = await supabase.from('users').select('id').limit(1);
        if (error) throw error;
        heartbeatFailuresRef.current = 0;
        
        if (connection.status !== 'connected') {
          setConnectionStatus('connected');
          resetReconnectAttempts();
        }
      } catch (error) {
        heartbeatFailuresRef.current += 1;
        if (heartbeatFailuresRef.current >= HEARTBEAT_FAILURES_BEFORE_RECONNECT) {
          if (connection.status === 'connected') {
            setConnectionStatus('reconnecting');
            incrementReconnectAttempts();
          }
        }
      }
    };

    // Initial check
    heartbeat();
    
    // Periodic heartbeat
    // Use a shared timer so multiple components don't create multiple heartbeats.
    if (!sharedHeartbeatTimer) {
      sharedHeartbeatTimer = setInterval(heartbeat, HEARTBEAT_INTERVAL);
    }
    heartbeatRef.current = sharedHeartbeatTimer;

    return () => {
      // shared timer is cleaned up when last subscriber unmounts
    };
  }, [isOnline, connection.status, setConnectionStatus, resetReconnectAttempts, incrementReconnectAttempts]);

  // Latency monitoring
  useEffect(() => {
    if (!isOnline) return;

    checkLatency();
    if (!sharedLatencyTimer) {
      sharedLatencyTimer = setInterval(checkLatency, LATENCY_CHECK_INTERVAL);
    }
    latencyRef.current = sharedLatencyTimer;

    return () => {
      // shared timer is cleaned up when last subscriber unmounts
    };
  }, [isOnline, checkLatency]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (latencyRef.current) clearInterval(latencyRef.current);
    };
  }, []);

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
