import { useEffect, useMemo, useRef } from "react";
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
  const conversations = useDMStore((state) => state.conversations);
  const localUserId = useAuthStore((state) => state.user?.id ?? null);
  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;

  const conversationIds = useMemo(() => {
    const ids = new Set<string>();
    conversations.forEach((conversation) => {
      if (conversation.id) ids.add(conversation.id);
    });
    if (currentConversationId) ids.add(currentConversationId);
    return Array.from(ids).sort();
  }, [conversations, currentConversationId]);

  useEffect(() => {
    if (!userId || !isKloakSocketEnabled() || conversationIds.length === 0) return;
    const unsubscribers: Array<() => void> = [];
    let cancelled = false;
    const catchUp = (conversationId: string) => {
      void useDMStore.getState().fetchMessages(conversationId, userId, 50).catch(() => undefined);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      conversationIds.forEach(catchUp);
    };

    for (const conversationId of conversationIds) {
      void kloakSocket
        .subscribe(`dm:${conversationId}`, (event) => {
          if (event.event !== "dm.created") return;
          const message = toDirectMessage(event.payload);
          if (!message || message.conversation_id !== conversationId) return;
          useDMStore.getState().addMessage(conversationId, message);
          useDMStore.getState().updateConversation(conversationId, { last_message: message });
          if (message.sender_id !== localUserId) {
            onNewMessageRef.current?.(message, conversationId);
          }
        })
        .then((unsubscribe) => {
          if (cancelled) {
            unsubscribe();
            return;
          }
          unsubscribers.push(unsubscribe);
          catchUp(conversationId);
        })
        .catch((error) => {
          console.warn("[KloakWS] Failed to subscribe to DM", { conversationId, error });
        });
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [conversationIds, localUserId, userId]);
}

