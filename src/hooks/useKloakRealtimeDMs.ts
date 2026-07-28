import { useEffect, useRef } from "react";
import { kloakSocket, isKloakSocketEnabled } from "@/lib/kloakSocket";
import { useDMStore } from "@/stores/dmStore";
import { useAuthStore } from "@/stores/authStore";
import { useUserCacheStore } from "@/stores/userCacheStore";
import type { DirectMessage, User } from "@/types";

type Options = {
  userId: string | null;
  currentConversationId: string | null;
  onNewMessage?: (message: DirectMessage, conversationId: string) => void;
};

const toDirectMessage = (raw: any): DirectMessage | null => {
  if (!raw?.id || !raw.conversation_id || !raw.sender_id || typeof raw.content !== "string" || !raw.created_at) return null;
  if (raw.sender?.id) useUserCacheStore.getState().upsertUser(raw.sender as User);

  const replyList = Array.isArray(raw.reply_to_list)
    ? raw.reply_to_list.filter((entry: any) => !!entry?.id && typeof entry.content === "string")
    : [];

  return {
    id: raw.id,
    conversation_id: raw.conversation_id,
    sender_id: raw.sender_id,
    content: raw.content,
    reply_to_id: raw.reply_to_id ?? replyList[0]?.id ?? null,
    reply_to_ids: Array.isArray(raw.reply_to_ids) ? raw.reply_to_ids : raw.reply_to_id ? [raw.reply_to_id] : [],
    reply_to: replyList[0],
    reply_to_list: replyList.length > 0 ? replyList : undefined,
    edited_at: raw.edited_at ?? null,
    created_at: raw.created_at,
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    reactions: Array.isArray(raw.reactions) ? raw.reactions : [],
  };
};

export function useKloakRealtimeDMs({ userId, currentConversationId, onNewMessage }: Options) {
  const localUserId = useAuthStore((state) => state.user?.id ?? null);
  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;

  useEffect(() => {
    if (!userId || !isKloakSocketEnabled()) return;
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    const catchUp = (conversationId: string) => {
      void useDMStore.getState().fetchMessages(conversationId, userId, 50).catch(() => undefined);
    };
    const catchUpLoadedConversations = () => {
      const loadedConversationIds = Object.keys(useDMStore.getState().messagesByConversation);
      loadedConversationIds.forEach(catchUp);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      catchUpLoadedConversations();
    };

    void kloakSocket
      .subscribe(`user:${userId}`, (event) => {
        if (event.event !== "dm.created") return;
        const message = toDirectMessage(event.payload);
        const conversationId = message?.conversation_id;
        if (!message || !conversationId) return;

        useDMStore.getState().addMessage(conversationId, message);
        useDMStore.getState().updateConversation(conversationId, { last_message: message });
        if (message.sender_id !== localUserId) {
          onNewMessageRef.current?.(message, conversationId);
        }
      })
      .then((off) => {
        if (cancelled) {
          off();
          return;
        }
        unsubscribe = off;
        if (currentConversationId) catchUp(currentConversationId);
      })
      .catch((error) => {
        console.warn("[KloakWS] Failed to subscribe to DM fanout", { userId, error });
      });

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      unsubscribe?.();
    };
  }, [currentConversationId, localUserId, userId]);
}

