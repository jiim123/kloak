import { useCallback, useRef } from 'react';
import { useMessageStore } from '@/stores/messageStore';
import { useAuthStore } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import { useOnlineStatus } from './useOnlineStatus';
import { useOfflineQueueStore } from '@/stores/offlineQueueStore';
import type { Message, User } from '@/types';

interface SendMessageOptions {
  channelId: string;
  content: string;
  replyToId?: string;
}

/**
 * Hook for sending messages with optimistic updates
 * Messages appear instantly, then sync in the background
 */
export function useOptimisticMessage() {
  const { user } = useAuthStore();
  const { messages, sendMessage, addMessage, removeMessage, updateMessage } = useMessageStore();
  const { addOptimisticItem, confirmOptimisticItem, failOptimisticItem, getOptimisticStatus } = useSyncStore();
  const { addToQueue } = useOfflineQueueStore();
  const { isOnline } = useOnlineStatus();
  
  const pendingMessages = useRef<Map<string, Message>>(new Map());

  const sendOptimistic = useCallback(async (options: SendMessageOptions): Promise<Message | null> => {
    if (!user) return null;

    const { channelId, content, replyToId } = options;
    
    // Generate temporary ID
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create optimistic message
    const optimisticMessage: Message = {
      id: tempId,
      channel_id: channelId,
      user_id: user.id,
      content,
      reply_to_id: replyToId || null,
      is_pinned: false,
      edited_at: null,
      created_at: new Date().toISOString(),
      user: user as User,
      attachments: [],
      reactions: [],
    };
    
    // Add to pending tracking
    pendingMessages.current.set(tempId, optimisticMessage);
    addOptimisticItem(tempId);
    
    // Add to store immediately (optimistic)
    addMessage(optimisticMessage);
    
    // If offline, queue for later
    if (!isOnline) {
      addToQueue({
        channelId,
        userId: user.id,
        content,
        replyToId,
      });
      // Keep the optimistic message visible
      return optimisticMessage;
    }
    
    try {
      // Send to server in background
      const realMessage = await sendMessage(channelId, user.id, content, replyToId);
      
      if (realMessage) {
        // Replace temp message with real one
        removeMessage(tempId);
        confirmOptimisticItem(tempId, realMessage.id);
        pendingMessages.current.delete(tempId);
        
        return realMessage;
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      // Mark as failed but keep visible with error state
      failOptimisticItem(tempId, error instanceof Error ? error.message : 'Send failed');
      
      // Update the optimistic message to show error state
      updateMessage(tempId, { 
        // We'll use a special marker in content or a custom field
        // For now, we'll leave it and let the UI show the status
      });
      
      return null;
    }
  }, [user, isOnline, addMessage, removeMessage, updateMessage, sendMessage, addOptimisticItem, confirmOptimisticItem, failOptimisticItem, addToQueue]);

  const retryMessage = useCallback(async (tempId: string): Promise<boolean> => {
    const pendingMessage = pendingMessages.current.get(tempId);
    if (!pendingMessage || !user) return false;
    
    // Reset status
    addOptimisticItem(tempId);
    
    try {
      const realMessage = await sendMessage(
        pendingMessage.channel_id,
        user.id,
        pendingMessage.content,
        pendingMessage.reply_to_id || undefined
      );
      
      if (realMessage) {
        removeMessage(tempId);
        addMessage(realMessage);
        confirmOptimisticItem(tempId, realMessage.id);
        pendingMessages.current.delete(tempId);
        return true;
      }
      
      throw new Error('Retry failed');
    } catch (error) {
      failOptimisticItem(tempId, error instanceof Error ? error.message : 'Retry failed');
      return false;
    }
  }, [user, sendMessage, removeMessage, addMessage, addOptimisticItem, confirmOptimisticItem, failOptimisticItem]);

  const cancelMessage = useCallback((tempId: string) => {
    removeMessage(tempId);
    pendingMessages.current.delete(tempId);
  }, [removeMessage]);

  const isPending = useCallback((messageId: string): boolean => {
    return messageId.startsWith('temp-') || getOptimisticStatus(messageId) === 'pending';
  }, [getOptimisticStatus]);

  const isFailed = useCallback((messageId: string): boolean => {
    return getOptimisticStatus(messageId) === 'failed';
  }, [getOptimisticStatus]);

  return {
    sendOptimistic,
    retryMessage,
    cancelMessage,
    isPending,
    isFailed,
  };
}
