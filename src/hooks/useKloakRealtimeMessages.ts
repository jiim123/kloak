import { useEffect } from "react";
import { kloakSocket, isKloakSocketEnabled } from "@/lib/kloakSocket";
import { useMessageStore } from "@/stores/messageStore";
import { useAuthStore } from "@/stores/authStore";
import { useUserCacheStore } from "@/stores/userCacheStore";
import type { Message, MessageReply, User } from "@/types";

const toReply = (raw: any): MessageReply | undefined => {
  if (!raw?.id || typeof raw.content !== "string") return undefined;
  if (raw.user?.id) useUserCacheStore.getState().upsertUser(raw.user as User);
  return {
    id: raw.id,
    content: raw.content,
    user_id: raw.user_id ?? raw.user?.id,
  };
};

const toMessage = (raw: any, currentUserId?: string | null): Message | null => {
  if (!raw?.id || !raw.channel_id || !raw.user_id || typeof raw.content !== "string" || !raw.created_at) return null;
  if (raw.user?.id) useUserCacheStore.getState().upsertUser(raw.user as User);

  const replyList = Array.isArray(raw.reply_to_list)
    ? raw.reply_to_list.map(toReply).filter((reply: MessageReply | undefined): reply is MessageReply => !!reply)
    : [];

  return {
    id: raw.id,
    channel_id: raw.channel_id,
    user_id: raw.user_id,
    is_own: currentUserId === raw.user_id,
    reply_to_id: raw.reply_to_id ?? replyList[0]?.id ?? null,
    reply_to_ids: Array.isArray(raw.reply_to_ids) ? raw.reply_to_ids : raw.reply_to_id ? [raw.reply_to_id] : [],
    content: raw.content,
    is_pinned: raw.is_pinned ?? false,
    is_system_message: raw.is_system_message ?? false,
    embed_hidden: raw.embed_hidden ?? false,
    edited_at: raw.edited_at ?? null,
    created_at: raw.created_at,
    reply_to: replyList[0],
    reply_to_list: replyList,
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    reactions: Array.isArray(raw.reactions) ? raw.reactions : [],
  };
};

export function useKloakRealtimeMessages(channelId: string | null) {
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);

  useEffect(() => {
    if (!channelId || !isKloakSocketEnabled()) return;
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;
    const catchUp = () => {
      void useMessageStore.getState().fetchMessages(channelId, 50, undefined, true, true).catch(() => undefined);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") catchUp();
    };

    void kloakSocket
      .subscribe(`channel:${channelId}`, (event) => {
        if (event.event !== "message.created") return;
        const message = toMessage(event.payload, currentUserId);
        if (!message || message.channel_id !== channelId) return;
        useMessageStore.getState().addMessage(message);
      })
      .then((fn) => {
        if (cancelled) {
          fn();
          return;
        }
        unsubscribe = fn;
        catchUp();
      })
      .catch((error) => {
        console.warn("[KloakWS] Failed to subscribe to channel", { channelId, error });
      });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      unsubscribe?.();
    };
  }, [channelId, currentUserId]);
}
