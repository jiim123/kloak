import { useEffect, useRef, useCallback } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { useSyncStore } from '@/stores/syncStore';
import { useOfflineQueueStore } from '@/stores/offlineQueueStore';
import { useMessageStore } from '@/stores/messageStore';
import { useServerStore } from '@/stores/serverStore';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const SYNC_INTERVAL = 30000; // 30 seconds
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
  
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef(false);

  // Process queued messages when coming back online
  const processQueue = useCallback(async () => {
    if (queuedMessages.length === 0 || isSyncingRef.current) return;
    
    isSyncingRef.current = true;
    setSyncStatus('syncing');
    
    const toastId = toast({
      title: 'Syncing messages...',
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
      toast({
        title: 'Messages synced',
        description: `Successfully sent ${successCount} message${successCount > 1 ? 's' : ''}`,
        variant: 'success',
      });
    }
    
    if (failCount > 0) {
      toast({
        title: 'Some messages failed',
        description: `${failCount} message${failCount > 1 ? 's' : ''} couldn't be sent`,
        variant: 'destructive',
      });
    }
    
    isSyncingRef.current = false;
    setSyncStatus('idle');
    updateLastSync();
  }, [queuedMessages, sendMessage, removeFromQueue, setSyncStatus, updateLastSync]);

  // Refresh current data (non-blocking) - DISABLED to prevent message clearing
  // Real-time subscriptions handle new messages, so periodic refresh is not needed
  const refreshData = useCallback(async () => {
    // Don't do periodic fetches - it causes the chat to flash/clear
    // Real-time updates via useRealtimeMessages handle new messages
    return;
  }, []);

  // Handle reconnection with exponential backoff
  const attemptReconnect = useCallback(async () => {
    const attemptIndex = Math.min(connection.reconnectAttempts, RECONNECT_DELAYS.length - 1);
    const delay = RECONNECT_DELAYS[attemptIndex];
    
    setConnectionStatus('reconnecting');
    incrementReconnectAttempts();
    
    // Try to ping Supabase
    try {
      const { error } = await supabase.from('users').select('id').limit(1);
      
      if (!error) {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        setConnectionStatus('connected');
        resetReconnectAttempts();
        
        toast({
          title: 'Reconnected',
          description: 'You\'re back online!',
          variant: 'success',
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
  }, [connection.reconnectAttempts, isOnline, setConnectionStatus, incrementReconnectAttempts, resetReconnectAttempts, processQueue, refreshData]);

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

  // Periodic background sync (when online)
  useEffect(() => {
    if (isOnline) {
      // Initial sync
      const initialSync = setTimeout(() => {
        refreshData();
      }, 2000);
      
      // Periodic sync
      syncIntervalRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          refreshData();
        }
      }, SYNC_INTERVAL);
      
      return () => {
        clearTimeout(initialSync);
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
        }
      };
    }
  }, [isOnline, refreshData]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
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
