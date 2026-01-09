import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMessageStore } from "@/stores/messageStore";
import { useAuthStore } from "@/stores/authStore";
import { useSyncStore } from "@/stores/syncStore";
import { useOnlineStatus } from "./useOnlineStatus";
import { useOfflineQueueStore } from "@/stores/offlineQueueStore";
import type { Message, User } from "@/types";

interface SendMessageOptions {
  channelId: string;
  content: string;
  replyToId?: string;
}

/**
 * Hook for sending messages with optimistic updates.
 *
 * Flow:
 * 1. Creates temp message with temp-xxx ID → added to store → animates in
 * 2. Sends to server via RPC (not store's sendMessage to avoid double-add)
 * 3. On success: removes temp message, adds real message
 * 4. MessageList uses stable keys, so React keeps same component instance
 * 5. MessageItem tracks animations by stable key, so no double animation
 */
export function useOptimisticMessage() {
  const { user } = useAuthStore();
  const { getMessages, addMessage, removeMessage } = useMessageStore();
  const { addOptimisticItem, confirmOptimisticItem, failOptimisticItem, getOptimisticStatus } = useSyncStore();
  const { addToQueue } = useOfflineQueueStore();
  const { isOnline } = useOnlineStatus();

  const pendingMessages = useRef<Map<string, Message>>(new Map());

  const sendOptimistic = useCallback(
    async (options: SendMessageOptions): Promise<Message | null> => {
      if (!user) return null;

      const { channelId, content, replyToId } = options;

      // Generate temporary ID
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Find reply message data if replying
      let replyData: Message["reply_to"] | undefined;
      if (replyToId) {
        const messages = getMessages();
        const replyMsg = messages.find((m) => m.id === replyToId);
        if (replyMsg) {
          replyData = {
            id: replyMsg.id,
            content: replyMsg.content,
            user: replyMsg.user,
          };
        }
      }

      // Create optimistic message with current timestamp
      const now = new Date().toISOString();
      const optimisticMessage: Message = {
        id: tempId,
        channel_id: channelId,
        user_id: user.id,
        content,
        reply_to_id: replyToId || null,
        reply_to: replyData,
        is_pinned: false,
        edited_at: null,
        created_at: now,
        user: user as User,
        attachments: [],
        reactions: [],
      };

      // Track pending message for retry functionality
      pendingMessages.current.set(tempId, optimisticMessage);
      addOptimisticItem(tempId);

      // Add to store immediately (optimistic) - this triggers the animation
      addMessage(optimisticMessage);

      // If offline, queue for later and keep temp message visible
      if (!isOnline) {
        addToQueue({
          channelId,
          userId: user.id,
          content,
          replyToId,
        });
        return optimisticMessage;
      }

      try {
        // Send to server via RPC directly
        // DO NOT use store's sendMessage - it also adds to store causing duplicates
        const { data, error } = await supabase.rpc("send_message", {
          _channel_id: channelId,
          _user_id: user.id,
          _content: content,
          _reply_to_id: replyToId || null,
        });

        if (error) {
          if (error.message.includes("muted")) {
            throw new Error("You are muted in this server");
          }
          throw error;
        }

        const msgData = data as any;

        // Create the real message object
        const realMessage: Message = {
          id: msgData.id,
          channel_id: msgData.channel_id,
          user_id: msgData.user_id,
          content: msgData.content,
          reply_to_id: msgData.reply_to_id,
          reply_to: replyData,
          is_pinned: msgData.is_pinned || false,
          edited_at: msgData.edited_at,
          created_at: msgData.created_at,
          user: user as User,
          attachments: [],
          reactions: [],
        };

        // Remove temp message and add real message
        // MessageList's stable key ensures React keeps the same component instance
        // MessageItem's animation tracking by stable key prevents double animation
        removeMessage(tempId);
        addMessage(realMessage);

        // Clean up tracking
        confirmOptimisticItem(tempId, realMessage.id);
        pendingMessages.current.delete(tempId);

        return realMessage;
      } catch (error) {
        // Mark as failed - keep temp message visible with error state
        failOptimisticItem(tempId, error instanceof Error ? error.message : "Send failed");
        return null;
      }
    },
    [
      user,
      isOnline,
      getMessages,
      addMessage,
      removeMessage,
      addOptimisticItem,
      confirmOptimisticItem,
      failOptimisticItem,
      addToQueue,
    ],
  );

  const retryMessage = useCallback(
    async (tempId: string): Promise<boolean> => {
      const pendingMessage = pendingMessages.current.get(tempId);
      if (!pendingMessage || !user) return false;

      // Reset to pending status
      addOptimisticItem(tempId);

      try {
        const { data, error } = await supabase.rpc("send_message", {
          _channel_id: pendingMessage.channel_id,
          _user_id: user.id,
          _content: pendingMessage.content,
          _reply_to_id: pendingMessage.reply_to_id || null,
        });

        if (error) throw error;

        const msgData = data as any;

        const realMessage: Message = {
          id: msgData.id,
          channel_id: msgData.channel_id,
          user_id: msgData.user_id,
          content: msgData.content,
          reply_to_id: msgData.reply_to_id,
          reply_to: pendingMessage.reply_to,
          is_pinned: msgData.is_pinned || false,
          edited_at: msgData.edited_at,
          created_at: msgData.created_at,
          user: user as User,
          attachments: [],
          reactions: [],
        };

        removeMessage(tempId);
        addMessage(realMessage);

        confirmOptimisticItem(tempId, msgData.id);
        pendingMessages.current.delete(tempId);
        return true;
      } catch (error) {
        failOptimisticItem(tempId, error instanceof Error ? error.message : "Retry failed");
        return false;
      }
    },
    [user, removeMessage, addMessage, addOptimisticItem, confirmOptimisticItem, failOptimisticItem],
  );

  const cancelMessage = useCallback(
    (tempId: string) => {
      removeMessage(tempId);
      pendingMessages.current.delete(tempId);
    },
    [removeMessage],
  );

  const isPending = useCallback(
    (messageId: string): boolean => {
      return messageId.startsWith("temp-") || getOptimisticStatus(messageId) === "pending";
    },
    [getOptimisticStatus],
  );

  const isFailed = useCallback(
    (messageId: string): boolean => {
      return getOptimisticStatus(messageId) === "failed";
    },
    [getOptimisticStatus],
  );

  return {
    sendOptimistic,
    retryMessage,
    cancelMessage,
    isPending,
    isFailed,
  };
}
