import { z } from "zod";

const uuid = z.string().uuid();
const requestId = z.string().min(1).max(128).optional();
const topic = z.string().regex(/^(user|channel|dm):[0-9a-fA-F-]{36}$/);
const rpcParams = z.record(z.unknown()).optional();

const base = z.object({
  type: z.string(),
  requestId,
});

export const clientMessageSchema = z.discriminatedUnion("type", [
  base.extend({
    type: z.literal("auth"),
    keyHash: z.string().min(32).max(256),
    mfaSessionToken: z.string().min(1).max(512).optional().nullable(),
  }),
  base.extend({
    type: z.literal("ping"),
  }),
  base.extend({
    type: z.literal("subscribe"),
    topics: z.array(topic).min(1).max(200),
    cursors: z.record(z.number().int().nonnegative()).optional(),
  }),
  base.extend({
    type: z.literal("unsubscribe"),
    topics: z.array(topic).min(1).max(200),
  }),
  base.extend({
    type: z.literal("send_channel_message"),
    channelId: uuid,
    content: z.string().min(1).max(2000),
    replyToId: uuid.optional().nullable(),
    replyToIds: z.array(uuid).max(5).optional(),
  }),
  base.extend({
    type: z.literal("mark_channel_read"),
    channelId: uuid,
    lastReadMessageId: uuid.optional().nullable(),
    lastReadAt: z.string().datetime().optional(),
  }),
  base.extend({
    type: z.literal("send_dm_message"),
    conversationId: uuid,
    content: z.string().min(1).max(2000),
    replyToId: uuid.optional().nullable(),
    replyToIds: z.array(uuid).max(5).optional(),
  }),
  base.extend({
    type: z.literal("mark_dm_read"),
    conversationId: uuid,
  }),
  base.extend({
    type: z.literal("get_channel_bootstrap"),
    channelId: uuid,
    limit: z.number().int().min(1).max(100).default(50),
    blockedUserIds: z.array(uuid).max(500).optional(),
  }),
  base.extend({
    type: z.literal("get_dm_bootstrap"),
    conversationId: uuid,
    limit: z.number().int().min(1).max(100).default(50),
    beforeId: uuid.optional().nullable(),
  }),
  base.extend({
    type: z.literal("get_channel_unread_counts"),
    channelIds: z.array(uuid).min(1).max(500),
    blockedUserIds: z.array(uuid).max(500).optional(),
  }),
  base.extend({
    type: z.literal("get_dm_unread_counts"),
  }),
  base.extend({
    type: z.literal("get_notifications"),
    limit: z.number().int().min(1).max(100).default(50),
  }),
  base.extend({
    type: z.literal("mark_notification_read"),
    notificationId: uuid,
  }),
  base.extend({
    type: z.literal("mark_all_notifications_read"),
  }),
  base.extend({
    type: z.literal("delete_notification"),
    notificationId: uuid,
  }),
  base.extend({
    type: z.literal("clear_notifications"),
  }),
  base.extend({
    type: z.literal("get_channel_tasks"),
    channelId: uuid,
    statusFilter: z.string().max(50).optional().nullable(),
    sortBy: z.string().max(50).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
  base.extend({
    type: z.literal("task_rpc"),
    name: z.enum(["get_task_secure", "create_task", "update_task", "delete_task", "move_task", "assign_task_users", "unassign_task_users"]),
    params: rpcParams,
  }),
  base.extend({
    type: z.literal("get_calendar_events"),
    channelId: uuid,
    startsAfter: z.string().datetime(),
    startsBefore: z.string().datetime(),
  }),
  base.extend({
    type: z.literal("calendar_rpc"),
    name: z.enum([
      "get_calendar_event_details",
      "create_calendar_event",
      "update_calendar_event",
      "delete_calendar_event",
      "set_calendar_event_rsvp",
      "insert_calendar_event_comment",
      "delete_calendar_event_comment",
      "toggle_calendar_event_reaction",
    ]),
    params: rpcParams,
  }),
  base.extend({
    type: z.literal("send_typing"),
    channelId: uuid,
    isTyping: z.boolean(),
  }),
  base.extend({
    type: z.literal("update_presence"),
    status: z.enum(["online", "idle", "dnd", "offline"]),
    customStatus: z.string().max(20).optional().nullable(),
    lastSeen: z.string().datetime().optional().nullable(),
    ts: z.number().int().nonnegative().optional(),
  }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export type SocketEvent = {
  topic: string;
  seq: number;
  event: string;
  payload: unknown;
  createdAt: string;
};

export type AuthUser = {
  id: string;
  username?: string;
  display_name?: string | null;
  avatar_url?: string | null;
};

export type ServerMessage =
  | { type: "hello"; heartbeatIntervalMs: number }
  | { type: "auth_ok"; requestId?: string; user: AuthUser }
  | { type: "ack"; requestId?: string; ok: true; data?: unknown }
  | { type: "error"; requestId?: string; code: string; message: string }
  | { type: "subscribed"; requestId?: string; topics: string[] }
  | { type: "unsubscribed"; requestId?: string; topics: string[] }
  | { type: "event"; event: SocketEvent }
  | { type: "pong"; requestId?: string; now: string };

