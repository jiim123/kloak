import { useEffect, useCallback, useRef } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { useSyncStore } from '@/stores/syncStore';
import { useOfflineQueueStore } from '@/stores/offlineQueueStore';
import { useMessageStore } from '@/stores/messageStore';
import { toast } from 'sonner';

/**
 * Hook for background queue draining.
 *
 * Connection status (`syncStore.connection.*`) and reconnect attempts are owned
 * exclusively by `useConnectionStatus` (Supabase realtime channel state + ping
 * heartbeat). Writing to those fields from here as well caused flicker between
 * 'reconnecting' / 'connected' on reconnect and double-incremented
 * reconnectAttempts. This hook now only drains the offline message queue when
 * the browser transitions from offline → online.
 */
export function useBackgroundSync() {
  const { isOnline, wasOffline } = useOnlineStatus();
  const { connection, sync, setSyncStatus, updateLastSync } = useSyncStore();

  const { queuedMessages, removeFromQueue } = useOfflineQueueStore();
  const { sendMessage } = useMessageStore();

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

  // forceSync is a stable no-op return — realtime handles data refresh.
  const refreshData = useCallback(async () => {}, []);

  // Drain queue on offline → online transition. Connection status writes are
  // intentionally absent — useConnectionStatus owns them.
  useEffect(() => {
    if (isOnline && wasOffline) {
      void processQueue();
    }
  }, [isOnline, wasOffline, processQueue]);

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
