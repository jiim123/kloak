import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSyncStore } from '@/stores/syncStore';
import { useOnlineStatus } from './useOnlineStatus';

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const LATENCY_CHECK_INTERVAL = 60000; // 1 minute

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
    const channel = supabase.channel('connection-status');
    
    channel
      .on('system', { event: '*' }, (payload) => {
        if (payload.extension === 'presence') {
          setIsRealtimeConnected(true);
          setConnectionStatus('connected');
          resetReconnectAttempts();
        }
      })
      .subscribe((status) => {
        switch (status) {
          case 'SUBSCRIBED':
            setIsRealtimeConnected(true);
            setConnectionStatus('connected');
            resetReconnectAttempts();
            break;
          case 'CLOSED':
          case 'CHANNEL_ERROR':
            setIsRealtimeConnected(false);
            if (isOnline) {
              setConnectionStatus('reconnecting');
              incrementReconnectAttempts();
            }
            break;
          case 'TIMED_OUT':
            setIsRealtimeConnected(false);
            setConnectionStatus('disconnected');
            break;
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOnline, setConnectionStatus, resetReconnectAttempts, incrementReconnectAttempts]);

  // Heartbeat to detect silent disconnections
  useEffect(() => {
    if (!isOnline) return;

    const heartbeat = async () => {
      try {
        const { error } = await supabase.from('users').select('id').limit(1);
        if (error) throw error;
        
        if (connection.status !== 'connected') {
          setConnectionStatus('connected');
          resetReconnectAttempts();
        }
      } catch (error) {
        if (connection.status === 'connected') {
          setConnectionStatus('reconnecting');
          incrementReconnectAttempts();
        }
      }
    };

    // Initial check
    heartbeat();
    
    // Periodic heartbeat
    heartbeatRef.current = setInterval(heartbeat, HEARTBEAT_INTERVAL);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [isOnline, connection.status, setConnectionStatus, resetReconnectAttempts, incrementReconnectAttempts]);

  // Latency monitoring
  useEffect(() => {
    if (!isOnline) return;

    checkLatency();
    latencyRef.current = setInterval(checkLatency, LATENCY_CHECK_INTERVAL);

    return () => {
      if (latencyRef.current) {
        clearInterval(latencyRef.current);
      }
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
