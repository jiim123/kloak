import { z } from "zod";

const uuid = z.string().uuid();
const requestId = z.string().min(1).max(128).optional();
const topic = z.string().regex(/^(user|channel|dm):[0-9a-fA-F-]{36}$/);

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
