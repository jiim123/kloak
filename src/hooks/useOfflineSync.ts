import { useEffect, useRef } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { useOfflineQueueStore } from '@/stores/offlineQueueStore';
import { useMessageStore } from '@/stores/messageStore';
import { toast } from 'sonner';

export function useOfflineSync() {
  const { isOnline, wasOffline } = useOnlineStatus();
  const { queuedMessages, removeFromQueue, clearQueue } = useOfflineQueueStore();
  const { sendMessage } = useMessageStore();
  const isSyncing = useRef(false);

  useEffect(() => {
    // When coming back online and there are queued messages
    if (isOnline && wasOffline && queuedMessages.length > 0 && !isSyncing.current) {
      isSyncing.current = true;

      const syncMessages = async () => {
        toast.warning("Reconnected", {
          description: `Sending ${queuedMessages.length} queued message${queuedMessages.length > 1 ? 's' : ''}...`,
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
          toast.success("Messages sent", {
            description: `Successfully sent ${successCount} queued message${successCount > 1 ? 's' : ''}.`,
          });
        }

        if (failCount > 0) {
          toast.error("Some messages failed", {
            description: `${failCount} message${failCount > 1 ? 's' : ''} couldn't be sent. Please try again.`,
          });
        }

        isSyncing.current = false;
      };

      syncMessages();
    }
  }, [isOnline, wasOffline, queuedMessages, sendMessage, removeFromQueue]);

  return { queuedMessages, clearQueue };
}
