import { useEffect, useRef, useCallback } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { useSyncStore } from '@/stores/syncStore';
import { useOfflineQueueStore } from '@/stores/offlineQueueStore';
import { useMessageStore } from '@/stores/messageStore';
import { useServerStore } from '@/stores/serverStore';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000]; // Exponential backoff

/**
 * Hook for background data synchronization
 * Handles reconnection, queue processing, and periodic sync
 */
export function useBackgroundSync() {
  const { isOnline, wasOffline } = useOnlineStatus();
  const { 
    connection,
    sync,
    setConnectionStatus, 
    incrementReconnectAttempts, 
    resetReconnectAttempts,
    setSyncStatus,
    updateLastSync,
  } = useSyncStore();
  
  const { queuedMessages, removeFromQueue } = useOfflineQueueStore();
  const { sendMessage } = useMessageStore();
  const { currentChannel } = useServerStore();
  
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef(false);

  // Process queued messages when coming back online
  const processQueue = useCallback(async () => {
    if (queuedMessages.length === 0 || isSyncingRef.current) return;
    
    isSyncingRef.current = true;
    setSyncStatus('syncing');
    
    toast.warning('Syncing messages...', {
      description: `Sending ${queuedMessages.length} queued message${queuedMessages.length > 1 ? 's' : ''}`,
    });
    
    let successCount = 0;
    let failCount = 0;
    
    for (const msg of queuedMessages) {
      try {
        const result = await sendMessage(msg.channelId, msg.userId, msg.content, msg.replyToId);
        if (result) {
          successCount++;
          removeFromQueue(msg.id);
        } else {
          failCount++;
        }
      } catch (error) {
        console.error('Failed to sync message:', error);
        failCount++;
      }
    }
    
    if (successCount > 0) {
      toast.success('Messages synced', {
        description: `Successfully sent ${successCount} message${successCount > 1 ? 's' : ''}`,
      });
    }
    
    if (failCount > 0) {
      toast.error('Some messages failed', {
        description: `${failCount} message${failCount > 1 ? 's' : ''} couldn't be sent`,
      });
    }
    
    isSyncingRef.current = false;
    setSyncStatus('idle');
    updateLastSync();
  }, [queuedMessages, sendMessage, removeFromQueue, setSyncStatus, updateLastSync]);

  // refreshData is intentionally a no-op — realtime handles sync.
  // Kept as a stable reference for the forceSync return value.
  const refreshData = useCallback(async () => {}, []);

  // Handle reconnection with exponential backoff
  const attemptReconnect = useCallback(async () => {
    const attemptIndex = Math.min(connection.reconnectAttempts, RECONNECT_DELAYS.length - 1);
    const delay = RECONNECT_DELAYS[attemptIndex];
    
    setConnectionStatus('reconnecting');
    incrementReconnectAttempts();
    
    // Try to ping Supabase
    try {
      const { error } = await supabase.rpc('ping_health');
      
      if (!error) {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        setConnectionStatus('connected');
        resetReconnectAttempts();
        
        toast.success('Reconnected', {
          description: 'You\'re back online!',
        });
        
        // Sync queued messages
        await processQueue();
        
        // Re-fetch channels for current server to catch missed changes
        const { currentServer } = useServerStore.getState();
        if (currentServer) {
          await useServerStore.getState().fetchChannels(currentServer.id);
          await useServerStore.getState().fetchRolePermissions(currentServer.id);
        }
        
        return;
      }
    } catch (error) {
      console.error('Reconnection attempt failed:', error);
    }
    
    // Schedule next attempt
    reconnectTimeoutRef.current = setTimeout(() => {
      // Retry while the device is online; don't rely on a potentially stale closure value.
      if (navigator.onLine) attemptReconnect();
    }, delay);
  }, [connection.reconnectAttempts, isOnline, setConnectionStatus, incrementReconnectAttempts, resetReconnectAttempts, processQueue]);

  // Handle online/offline transitions
  useEffect(() => {
    if (isOnline && wasOffline) {
      // Coming back online
      setConnectionStatus('reconnecting');
      attemptReconnect();
    } else if (!isOnline) {
      // Going offline
      setConnectionStatus('disconnected');
      
      // Clear any pending reconnection attempts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    }
  }, [isOnline, wasOffline, setConnectionStatus, attemptReconnect]);

  // Periodic background sync removed — refreshData is a no-op and realtime handles everything.
  // The 30s setInterval was waking the event loop for nothing.

  // Cleanup reconnect timer
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    isConnected: connection.status === 'connected',
    isReconnecting: connection.status === 'reconnecting',
    isSyncing: sync.syncStatus === 'syncing',
    pendingOperations: sync.pendingOperations,
    lastSyncAt: sync.lastSyncAt,
    queuedCount: queuedMessages.length,
    forceSync: refreshData,
    processQueue,
  };
}
