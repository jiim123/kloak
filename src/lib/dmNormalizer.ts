import type { DirectMessage, Message } from "@/types";

/**
 * Converts a DirectMessage to a Message shape so it can be rendered
 * by the unified MessageItem component.
 */
export function normalizeDirectMessage(dm: DirectMessage): Message {
  return {
    id: dm.id,
    channel_id: dm.conversation_id,
    user_id: dm.sender_id,
    reply_to_id: dm.reply_to_id,
    content: dm.content,
    is_pinned: false,
    is_system_message: false,
    embed_hidden: false,
    edited_at: dm.edited_at,
    created_at: dm.created_at || "",
    attachments: dm.attachments?.map((a) => ({
      id: a.id,
      message_id: a.message_id,
      file_name: a.file_name,
      file_url: a.file_url,
      file_type: a.file_type ?? null,
      file_size: a.file_size ?? null,
      width: a.width ?? null,
      height: a.height ?? null,
    })),
    reactions: dm.reactions,
    reply_to: dm.reply_to
      ? {
          id: dm.reply_to.id,
          content: dm.reply_to.content,
          user_id: dm.reply_to.sender_id,
        }
      : undefined,
  };
}
