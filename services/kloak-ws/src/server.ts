import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type WebSocket from "ws";
import type { RawData } from "ws";
import { WebSocketServer } from "ws";
import { config } from "./config.js";
import { SocketHub, type SocketContext } from "./hub.js";
import { authenticate, canSubscribeChannel, canSubscribeDm, rest, rpc, SupabaseRpcError } from "./supabase.js";
import { clientMessageSchema, type ClientMessage } from "./protocol.js";

const hub = new SocketHub();
const socketContexts = new WeakMap<WebSocket, SocketContext>();
const startedAt = new Date();

type ChannelRecipient = { user_id: string; server_id: string };
type DmRecipient = { user_id: string };
type PresenceRecipient = { user_id: string };

const server = createServer((req, res) => {
  if (req.url === "/healthz" || req.url === "/readyz") {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify({ ok: true, service: "kloak-ws", startedAt: startedAt.toISOString() }));
    return;
  }

  if (req.url === "/metrics.json") {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify({
      ok: true,
      service: "kloak-ws",
      uptimeSeconds: Math.round(process.uptime()),
      clients: wss.clients.size,
      hub: hub.stats(),
      memory: process.memoryUsage(),
    }));
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "not_found" }));
});

const wss = new WebSocketServer({ server, path: "/socket" });

wss.on("connection", (ws) => {
  const socket: SocketContext = {
    id: randomUUID(),
    ws,
    userId: null,
    keyHash: null,
    mfaSessionToken: null,
    topics: new Set(),
    alive: true,
    rateWindowStartedAt: Date.now(),
    rateWindowMessages: 0,
    currentPresence: null,
  };
  socketContexts.set(ws, socket);

  hub.send(socket, { type: "hello", heartbeatIntervalMs: config.heartbeatIntervalMs });

  const authTimer = setTimeout(() => {
    if (!socket.userId) {
      hub.send(socket, { type: "error", code: "auth_timeout", message: "Authenticate before sending commands" });
      ws.close(4001, "auth_timeout");
    }
  }, config.authTimeoutMs);

  ws.on("pong", () => {
    socket.alive = true;
  });

  ws.on("message", (raw) => {
    const byteLength = rawByteLength(raw);
    if (byteLength > config.maxMessageBytes) {
      hub.send(socket, { type: "error", code: "message_too_large", message: "WebSocket message is too large" });
      ws.close(4009, "message_too_large");
      return;
    }

    if (!consumeRateLimit(socket)) {
      hub.send(socket, { type: "error", code: "rate_limited", message: "Too many websocket messages" });
      ws.close(4008, "rate_limited");
      return;
    }

    void handleRawMessage(socket, raw.toString()).catch((error) => {
      hub.send(socket, {
        type: "error",
        code: error instanceof ClientVisibleError ? error.code : "internal_error",
        message: error instanceof Error ? error.message : "Unexpected websocket error",
      });
    });
  });

  ws.on("close", () => {
    clearTimeout(authTimer);
    hub.removeSocket(socket);
    void publishPresence(socket, {
      status: "offline",
      customStatus: socket.currentPresence?.customStatus ?? null,
      lastSeen: new Date().toISOString(),
      ts: Date.now(),
    }).catch((error) => console.warn("[kloak-ws] failed to publish offline presence", { socketId: socket.id, error }));
  });
});

const heartbeatTimer = setInterval(() => {
  for (const ws of wss.clients) {
    const socket = socketContexts.get(ws);
    if (socket && !socket.alive) {
      ws.terminate();
      continue;
    }
    if (socket) socket.alive = false;
    ws.ping();
  }
}, config.heartbeatIntervalMs);

async function handleRawMessage(socket: SocketContext, raw: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    hub.send(socket, { type: "error", code: "bad_json", message: "Message must be valid JSON" });
    return;
  }

  const result = clientMessageSchema.safeParse(parsed);
  if (!result.success) {
    hub.send(socket, {
      type: "error",
      requestId: typeof parsed === "object" && parsed && "requestId" in parsed ? String((parsed as any).requestId) : undefined,
      code: "bad_message",
      message: result.error.issues[0]?.message ?? "Invalid websocket message",
    });
    return;
  }

  const message = result.data;
  if (message.type !== "auth" && !socket.userId) {
    hub.send(socket, {
      type: "error",
      requestId: message.requestId,
      code: "unauthenticated",
      message: "Authenticate before sending commands",
    });
    return;
  }

  await handleMessage(socket, message);
}

async function handleMessage(socket: SocketContext, message: ClientMessage) {
  switch (message.type) {
    case "auth": {
      const user = await authenticate(message.keyHash, message.mfaSessionToken);
      socket.userId = user.id;
      socket.keyHash = message.keyHash;
      socket.mfaSessionToken = message.mfaSessionToken ?? null;
      hub.subscribe(socket, `user:${user.id}`);
      hub.send(socket, { type: "auth_ok", requestId: message.requestId, user });
      return;
    }
    case "ping":
      hub.send(socket, { type: "pong", requestId: message.requestId, now: new Date().toISOString() });
      return;
    case "subscribe": {
      const topics = await filterAuthorizedTopics(socket, message.topics);
      const availableSlots = Math.max(0, config.maxTopicsPerSocket - socket.topics.size);
      const acceptedTopics = topics.slice(0, availableSlots);
      for (const topic of acceptedTopics) {
        hub.subscribe(socket, topic, message.cursors?.[topic] ?? 0);
      }
      hub.send(socket, { type: "subscribed", requestId: message.requestId, topics: acceptedTopics });
      return;
    }
    case "unsubscribe":
      for (const topic of message.topics) hub.unsubscribe(socket, topic);
      hub.send(socket, { type: "unsubscribed", requestId: message.requestId, topics: message.topics });
      return;
    case "send_channel_message":
      await sendChannelMessage(socket, message);
      return;
    case "mark_channel_read":
      await markChannelRead(socket, message);
      return;
    case "send_dm_message":
      await sendDmMessage(socket, message);
      return;
    case "mark_dm_read":
      await markDmRead(socket, message);
      return;
    case "get_channel_bootstrap":
      await getChannelBootstrap(socket, message);
      return;
    case "get_dm_bootstrap":
      await getDmBootstrap(socket, message);
      return;
    case "get_channel_unread_counts":
      await getChannelUnreadCounts(socket, message);
      return;
    case "get_dm_unread_counts":
      await getDmUnreadCounts(socket, message);
      return;
    case "get_notifications":
      await getNotifications(socket, message);
      return;
    case "mark_notification_read":
      await markNotificationRead(socket, message);
      return;
    case "mark_all_notifications_read":
      await markAllNotificationsRead(socket, message);
      return;
    case "delete_notification":
      await deleteNotification(socket, message);
      return;
    case "clear_notifications":
      await clearNotifications(socket, message);
      return;
    case "get_channel_tasks":
      await getChannelTasks(socket, message);
      return;
    case "task_rpc":
      await taskRpc(socket, message);
      return;
    case "get_calendar_events":
      await getCalendarEvents(socket, message);
      return;
    case "calendar_rpc":
      await calendarRpc(socket, message);
      return;
        case "forum_rpc":
      await forumRpc(socket, message);
      return;
    case "media_rpc":
      await mediaRpc(socket, message);
      return;case "send_typing":
      await sendTyping(socket, message);
      return;
    case "update_presence":
      await updatePresence(socket, message);
      return;
  }
}

async function filterAuthorizedTopics(socket: SocketContext, topics: string[]) {
  const userId = requireUser(socket);
  const authorized: string[] = [];

  for (const topic of Array.from(new Set(topics))) {
    if (topic === `user:${userId}`) {
      authorized.push(topic);
      continue;
    }

    const [kind, id] = topic.split(":");
    const allowed =
      kind === "channel"
        ? await canSubscribeChannel(id, userId, socketRpcOptions(socket))
        : kind === "dm"
          ? await canSubscribeDm(id, userId, socketRpcOptions(socket))
          : false;

    if (allowed) authorized.push(topic);
  }

  return authorized;
}

async function sendChannelMessage(socket: SocketContext, message: Extract<ClientMessage, { type: "send_channel_message" }>) {
  const userId = requireUser(socket);
  const replyToIds = normalizeReplyIds(message.replyToId ?? null, message.replyToIds);
  const data = await callAsSocketUser<Record<string, unknown>>(socket, "send_message", {
    _channel_id: message.channelId,
    _user_id: userId,
    _content: message.content,
    _reply_to_id: replyToIds[0] ?? null,
    _reply_to_ids: replyToIds,
  });

  hub.publish(`channel:${message.channelId}`, "message.created", data);
  hub.publish(`user:${userId}`, "message.sent", data);

  const recipients = await getChannelRecipients(socket, message.channelId, userId);
  const messageId = typeof data.id === "string" ? data.id : null;
  const createdAt = typeof data.created_at === "string" ? data.created_at : new Date().toISOString();
  for (const recipient of recipients) {
    hub.publish(`user:${recipient.user_id}`, "channel.unread", {
      server_id: recipient.server_id,
      channel_id: message.channelId,
      message_id: messageId,
      created_at: createdAt,
      author_user_id: userId,
      unread_count_delta: 1,
      mention_count_delta: 0,
    });
  }

  hub.send(socket, { type: "ack", requestId: message.requestId, ok: true, data });
}

async function markChannelRead(socket: SocketContext, message: Extract<ClientMessage, { type: "mark_channel_read" }>) {
  const userId = requireUser(socket);
  const lastReadAt = message.lastReadAt ?? new Date().toISOString();
  const data = message.lastReadMessageId
    ? await callAsSocketUser(socket, "mark_channel_read", {
        _channel_id: message.channelId,
        _user_id: userId,
        _last_read_message_id: message.lastReadMessageId,
        _last_read_at: lastReadAt,
      })
    : await callAsSocketUser(socket, "mark_channels_read", {
        _channel_ids: [message.channelId],
        _user_id: userId,
        _last_read_at: lastReadAt,
      });

  hub.publish(`user:${userId}`, "channel.read", {
    channel_id: message.channelId,
    last_read_message_id: message.lastReadMessageId ?? null,
    last_read_at: lastReadAt,
  });
  hub.send(socket, { type: "ack", requestId: message.requestId, ok: true, data });
}

async function sendDmMessage(socket: SocketContext, message: Extract<ClientMessage, { type: "send_dm_message" }>) {
  const userId = requireUser(socket);
  const replyToIds = normalizeReplyIds(message.replyToId ?? null, message.replyToIds);
  const data = await callAsSocketUser<Record<string, unknown>>(socket, "send_dm", {
    _conversation_id: message.conversationId,
    _sender_id: userId,
    _content: message.content,
    _reply_to_id: replyToIds[0] ?? null,
    _reply_to_ids: replyToIds,
  });

  hub.publish(`dm:${message.conversationId}`, "dm.created", data);
  hub.publish(`user:${userId}`, "dm.created", data);
  hub.publish(`user:${userId}`, "dm.sent", data);

  const recipients = await getDmRecipients(socket, message.conversationId, userId);
  const messageId = typeof data.id === "string" ? data.id : null;
  const createdAt = typeof data.created_at === "string" ? data.created_at : new Date().toISOString();
  for (const recipient of recipients) {
    hub.publish(`user:${recipient.user_id}`, "dm.created", data);
    hub.publish(`user:${recipient.user_id}`, "dm.unread", {
      conversation_id: message.conversationId,
      message_id: messageId,
      created_at: createdAt,
      sender_id: userId,
      unread_count_delta: 1,
    });
  }

  hub.send(socket, { type: "ack", requestId: message.requestId, ok: true, data });
}

async function markDmRead(socket: SocketContext, message: Extract<ClientMessage, { type: "mark_dm_read" }>) {
  const userId = requireUser(socket);
  const data = await callAsSocketUser(socket, "mark_dm_read", {
    _conversation_id: message.conversationId,
    _user_id: userId,
  });

  hub.publish(`user:${userId}`, "dm.read", { conversation_id: message.conversationId });
  hub.send(socket, { type: "ack", requestId: message.requestId, ok: true, data });
}

async function getChannelBootstrap(socket: SocketContext, message: Extract<ClientMessage, { type: "get_channel_bootstrap" }>) {
  const userId = requireUser(socket);
  const data = await callAsSocketUser(socket, "get_channel_bootstrap_secure", {
    _channel_id: message.channelId,
    _user_id: userId,
    _limit: message.limit,
    _blocked_user_ids: message.blockedUserIds ?? [],
  });

  hub.send(socket, { type: "ack", requestId: message.requestId, ok: true, data });
}

async function getDmBootstrap(socket: SocketContext, message: Extract<ClientMessage, { type: "get_dm_bootstrap" }>) {
  const userId = requireUser(socket);
  const data = await callAsSocketUser(socket, "get_dm_bootstrap_secure", {
    _conversation_id: message.conversationId,
    _user_id: userId,
    _limit: message.limit,
    _before_id: message.beforeId ?? null,
  });

  hub.send(socket, { type: "ack", requestId: message.requestId, ok: true, data });
}

async function getChannelUnreadCounts(socket: SocketContext, message: Extract<ClientMessage, { type: "get_channel_unread_counts" }>) {
  const userId = requireUser(socket);
  const data = await callAsSocketUser(socket, "get_all_channel_unread_counts", {
    _user_id: userId,
    _channel_ids: message.channelIds,
    _blocked_user_ids: message.blockedUserIds ?? [],
  });

  hub.send(socket, { type: "ack", requestId: message.requestId, ok: true, data });
}

async function getDmUnreadCounts(socket: SocketContext, message: Extract<ClientMessage, { type: "get_dm_unread_counts" }>) {
  const userId = requireUser(socket);
  const data = await callAsSocketUser(socket, "get_dm_unread_counts", {
    _user_id: userId,
  });

  hub.send(socket, { type: "ack", requestId: message.requestId, ok: true, data });
}

type NotificationRow = Record<string, unknown> & { id?: string };

async function getNotifications(socket: SocketContext, message: Extract<ClientMessage, { type: "get_notifications" }>) {
  const userId = requireUser(socket);
  const data = await rest<NotificationRow[]>(
    `notifications?select=id,user_id,type,title,body,link,is_read,created_at&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=${message.limit}`,
    socketRestOptions(socket),
  );

  hub.send(socket, { type: "ack", requestId: message.requestId, ok: true, data: Array.isArray(data) ? data : [] });
}

async function markNotificationRead(socket: SocketContext, message: Extract<ClientMessage, { type: "mark_notification_read" }>) {
  const rows = await rest<NotificationRow[]>(
    `notifications?id=eq.${encodeURIComponent(message.notificationId)}`,
    {
      ...socketRestOptions(socket),
      method: "PATCH",
      body: { is_read: true },
      prefer: "return=representation",
    },
  );

  publishNotificationRows(socket, "UPDATE", rows);
  hub.send(socket, { type: "ack", requestId: message.requestId, ok: true, data: rows });
}

async function markAllNotificationsRead(socket: SocketContext, message: Extract<ClientMessage, { type: "mark_all_notifications_read" }>) {
  const userId = requireUser(socket);
  const rows = await rest<NotificationRow[]>(
    `notifications?user_id=eq.${encodeURIComponent(userId)}&is_read=eq.false`,
    {
      ...socketRestOptions(socket),
      method: "PATCH",
      body: { is_read: true },
      prefer: "return=representation",
    },
  );

  publishNotificationRows(socket, "UPDATE", rows);
  hub.send(socket, { type: "ack", requestId: message.requestId, ok: true, data: rows });
}

async function deleteNotification(socket: SocketContext, message: Extract<ClientMessage, { type: "delete_notification" }>) {
  const rows = await rest<NotificationRow[]>(
    `notifications?id=eq.${encodeURIComponent(message.notificationId)}`,
    {
      ...socketRestOptions(socket),
      method: "DELETE",
      prefer: "return=representation",
    },
  );

  publishNotificationRows(socket, "DELETE", rows);
  hub.send(socket, { type: "ack", requestId: message.requestId, ok: true, data: rows });
}

async function clearNotifications(socket: SocketContext, message: Extract<ClientMessage, { type: "clear_notifications" }>) {
  const userId = requireUser(socket);
  const rows = await rest<NotificationRow[]>(
    `notifications?user_id=eq.${encodeURIComponent(userId)}`,
    {
      ...socketRestOptions(socket),
      method: "DELETE",
      prefer: "return=representation",
    },
  );

  publishNotificationRows(socket, "DELETE", rows);
  hub.send(socket, { type: "ack", requestId: message.requestId, ok: true, data: rows });
}

async function getChannelTasks(socket: SocketContext, message: Extract<ClientMessage, { type: "get_channel_tasks" }>) {
  const userId = requireUser(socket);
  const data = await callAsSocketUser(socket, "get_channel_tasks", {
    _channel_id: message.channelId,
    _user_id: userId,
    _status_filter: message.statusFilter ?? null,
    _sort_by: message.sortBy ?? "position",
    _sort_order: message.sortOrder ?? "asc",
  });

  hub.send(socket, { type: "ack", requestId: message.requestId, ok: true, data });
}

async function taskRpc(socket: SocketContext, message: Extract<ClientMessage, { type: "task_rpc" }>) {
  const userId = requireUser(socket);
  const params = message.params ?? {};
  const refreshTarget = await resolveTaskRefreshTarget(socket, message.name, params);
  const data = await callAsSocketUser(socket, message.name, {
    ...params,
    _user_id: userId,
  });

  publishTaskRefresh(message.name, refreshTarget, data, userId);
  hub.send(socket, { type: "ack", requestId: message.requestId, ok: true, data });
}

const TASK_MUTATION_RPCS = new Set([
  "create_task",
  "update_task",
  "delete_task",
  "move_task",
  "assign_task_users",
  "unassign_task_users",
]);

type TaskRefreshTarget = {
  channelId: string | null;
  taskId: string | null;
};

async function resolveTaskRefreshTarget(socket: SocketContext, name: string, params: Record<string, unknown>): Promise<TaskRefreshTarget> {
  if (!TASK_MUTATION_RPCS.has(name)) return { channelId: null, taskId: null };

  const directChannelId = typeof params._channel_id === "string" ? params._channel_id : null;
  const taskId = typeof params._task_id === "string" ? params._task_id : null;
  if (directChannelId) return { channelId: directChannelId, taskId };
  if (taskId) return { channelId: await getTaskChannelId(socket, taskId), taskId };

  return { channelId: null, taskId: null };
}

async function getTaskChannelId(socket: SocketContext, taskId: string) {
  try {
    const rows = await rest<Array<{ channel_id?: unknown }>>(
      `tasks?select=channel_id&id=eq.${encodeURIComponent(taskId)}&limit=1`,
      socketRestOptions(socket),
    );
    const channelId = rows[0]?.channel_id;
    return typeof channelId === "string" ? channelId : null;
  } catch (error) {
    console.warn("[kloak-ws] failed to resolve task channel", { taskId, error });
    return null;
  }
}

function publishTaskRefresh(name: string, target: TaskRefreshTarget, data: unknown, actorUserId: string) {
  if (!TASK_MUTATION_RPCS.has(name) || !target.channelId) return;
  hub.publish(`channel:${target.channelId}`, "task.refresh", {
    rpc: name,
    channel_id: target.channelId,
    task_id: target.taskId ?? extractTaskId(data),
    actor_user_id: actorUserId,
    updated_at: new Date().toISOString(),
  });
}

function extractTaskId(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const task = record.task;
  if (task && typeof task === "object" && typeof (task as Record<string, unknown>).id === "string") {
    return (task as Record<string, unknown>).id as string;
  }
  return typeof record.id === "string" ? record.id : null;
}

async function getCalendarEvents(socket: SocketContext, message: Extract<ClientMessage, { type: "get_calendar_events" }>) {
  const userId = requireUser(socket);
  const data = await callAsSocketUser(socket, "get_calendar_events", {
    _channel_id: message.channelId,
    _user_id: userId,
    _starts_after: message.startsAfter,
    _starts_before: message.startsBefore,
  });

  hub.send(socket, { type: "ack", requestId: message.requestId, ok: true, data });
}

async function calendarRpc(socket: SocketContext, message: Extract<ClientMessage, { type: "calendar_rpc" }>) {
  const userId = requireUser(socket);
  const params = message.params ?? {};
  const refreshTarget = await resolveCalendarRefreshTarget(socket, message.name, params);
  const data = await callAsSocketUser(socket, message.name, {
    ...params,
    _user_id: userId,
  });

  publishCalendarRefresh(message.name, refreshTarget, data, userId);
  hub.send(socket, { type: "ack", requestId: message.requestId, ok: true, data });
}

const CALENDAR_MUTATION_RPCS = new Set([
  "create_calendar_event",
  "update_calendar_event",
  "delete_calendar_event",
  "set_calendar_event_rsvp",
  "insert_calendar_event_comment",
  "delete_calendar_event_comment",
  "toggle_calendar_event_reaction",
]);

type CalendarRefreshTarget = {
  channelId: string | null;
  eventId: string | null;
};

async function resolveCalendarRefreshTarget(socket: SocketContext, name: string, params: Record<string, unknown>): Promise<CalendarRefreshTarget> {
  if (!CALENDAR_MUTATION_RPCS.has(name)) return { channelId: null, eventId: null };

  const directChannelId = typeof params._channel_id === "string" ? params._channel_id : null;
  if (directChannelId) return { channelId: directChannelId, eventId: null };

  const directEventId = typeof params._event_id === "string" ? params._event_id : null;
  if (directEventId) {
    return { channelId: await getCalendarEventChannelId(socket, directEventId), eventId: directEventId };
  }

  const commentId = typeof params._comment_id === "string" ? params._comment_id : null;
  if (commentId) {
    const eventId = await getCalendarCommentEventId(socket, commentId);
    return { channelId: eventId ? await getCalendarEventChannelId(socket, eventId) : null, eventId };
  }

  return { channelId: null, eventId: null };
}

async function getCalendarEventChannelId(socket: SocketContext, eventId: string) {
  try {
    const rows = await rest<Array<{ channel_id?: unknown }>>(
      `calendar_events?select=channel_id&id=eq.${encodeURIComponent(eventId)}&limit=1`,
      socketRestOptions(socket),
    );
    const channelId = rows[0]?.channel_id;
    return typeof channelId === "string" ? channelId : null;
  } catch (error) {
    console.warn("[kloak-ws] failed to resolve calendar event channel", { eventId, error });
    return null;
  }
}

async function getCalendarCommentEventId(socket: SocketContext, commentId: string) {
  try {
    const rows = await rest<Array<{ event_id?: unknown }>>(
      `calendar_event_comments?select=event_id&id=eq.${encodeURIComponent(commentId)}&limit=1`,
      socketRestOptions(socket),
    );
    const eventId = rows[0]?.event_id;
    return typeof eventId === "string" ? eventId : null;
  } catch (error) {
    console.warn("[kloak-ws] failed to resolve calendar comment event", { commentId, error });
    return null;
  }
}

function publishCalendarRefresh(name: string, target: CalendarRefreshTarget, data: unknown, actorUserId: string) {
  if (!CALENDAR_MUTATION_RPCS.has(name) || !target.channelId) return;
  hub.publish(`channel:${target.channelId}`, "calendar.refresh", {
    rpc: name,
    channel_id: target.channelId,
    event_id: target.eventId ?? extractCalendarEventId(data),
    actor_user_id: actorUserId,
    updated_at: new Date().toISOString(),
  });
}

function extractCalendarEventId(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const event = record.event;
  if (event && typeof event === "object" && typeof (event as Record<string, unknown>).id === "string") {
    return (event as Record<string, unknown>).id as string;
  }
  return typeof record.id === "string" ? record.id : null;
}

const FORUM_MUTATION_RPCS = new Set([
  "create_thread",
  "send_thread_message",
  "update_forum_thread_moderation",
  "edit_forum_thread_post",
  "edit_thread_message",
  "delete_thread_message",
  "delete_forum_thread",
  "toggle_thread_reaction",
]);

const FORUM_USER_SCOPED_RPCS = new Set([
  "get_messages_by_ids_secure",
  "get_thread_messages",
  "create_thread",
  "send_thread_message",
  "update_forum_thread_moderation",
  "delete_thread_message",
  "delete_forum_thread",
  "toggle_thread_reaction",
]);

type ForumRefreshTarget = {
  channelId: string | null;
  threadId: string | null;
  messageId: string | null;
};

async function forumRpc(socket: SocketContext, message: Extract<ClientMessage, { type: "forum_rpc" }>) {
  const userId = requireUser(socket);
  const params = message.params ?? {};
  const refreshTarget = await resolveForumRefreshTarget(socket, message.name, params);
  const rpcParams = FORUM_USER_SCOPED_RPCS.has(message.name) ? { ...params, _user_id: userId } : params;
  const data = await callAsSocketUser(socket, message.name, rpcParams);

  publishForumRefresh(message.name, refreshTarget, data, userId);
  hub.send(socket, { type: "ack", requestId: message.requestId, ok: true, data });
}

async function resolveForumRefreshTarget(socket: SocketContext, name: string, params: Record<string, unknown>): Promise<ForumRefreshTarget> {
  if (!FORUM_MUTATION_RPCS.has(name)) return { channelId: null, threadId: null, messageId: null };

  const directThreadId = typeof params._thread_id === "string" ? params._thread_id : null;
  const directMessageId = typeof params._message_id === "string" ? params._message_id : null;

  if (directThreadId) {
    return { channelId: await getForumThreadChannelId(socket, directThreadId), threadId: directThreadId, messageId: directMessageId };
  }

  if (directMessageId) {
    if (name === "create_thread") {
      return { channelId: await getChannelMessageChannelId(socket, directMessageId), threadId: null, messageId: directMessageId };
    }

    const threadId = await getThreadMessageThreadId(socket, directMessageId);
    return { channelId: threadId ? await getForumThreadChannelId(socket, threadId) : null, threadId, messageId: directMessageId };
  }

  return { channelId: null, threadId: null, messageId: null };
}

async function getForumThreadChannelId(socket: SocketContext, threadId: string) {
  try {
    const rows = await rest<Array<{ channel_id?: unknown }>>(
      `threads?select=channel_id&id=eq.${encodeURIComponent(threadId)}&limit=1`,
      socketRestOptions(socket),
    );
    const channelId = rows[0]?.channel_id;
    return typeof channelId === "string" ? channelId : null;
  } catch (error) {
    console.warn("[kloak-ws] failed to resolve forum thread channel", { threadId, error });
    return null;
  }
}

async function getThreadMessageThreadId(socket: SocketContext, messageId: string) {
  try {
    const rows = await rest<Array<{ thread_id?: unknown }>>(
      `thread_messages?select=thread_id&id=eq.${encodeURIComponent(messageId)}&limit=1`,
      socketRestOptions(socket),
    );
    const threadId = rows[0]?.thread_id;
    return typeof threadId === "string" ? threadId : null;
  } catch (error) {
    console.warn("[kloak-ws] failed to resolve forum message thread", { messageId, error });
    return null;
  }
}

async function getChannelMessageChannelId(socket: SocketContext, messageId: string) {
  try {
    const rows = await rest<Array<{ channel_id?: unknown }>>(
      `messages?select=channel_id&id=eq.${encodeURIComponent(messageId)}&limit=1`,
      socketRestOptions(socket),
    );
    const channelId = rows[0]?.channel_id;
    return typeof channelId === "string" ? channelId : null;
  } catch (error) {
    console.warn("[kloak-ws] failed to resolve channel message channel", { messageId, error });
    return null;
  }
}

function publishForumRefresh(name: string, target: ForumRefreshTarget, data: unknown, actorUserId: string) {
  if (!FORUM_MUTATION_RPCS.has(name) || !target.channelId) return;
  hub.publish(`channel:${target.channelId}`, "forum.refresh", {
    rpc: name,
    channel_id: target.channelId,
    thread_id: target.threadId ?? extractThreadId(data),
    message_id: target.messageId ?? extractForumMessageId(data),
    actor_user_id: actorUserId,
    updated_at: new Date().toISOString(),
  });
}

function extractThreadId(data: unknown) {
  if (typeof data === "string") return data.length >= 32 ? data : null;
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  return typeof record.thread_id === "string" ? record.thread_id : typeof record.id === "string" ? record.id : null;
}

function extractForumMessageId(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  return typeof record.message_id === "string" ? record.message_id : typeof record.id === "string" ? record.id : null;
}

const MEDIA_MUTATION_RPCS = new Set([
  "insert_media_item",
  "delete_media_item",
  "insert_media_comment",
  "edit_media_comment",
  "delete_media_comment",
  "toggle_media_comment_reaction",
]);

type MediaRefreshTarget = {
  channelId: string | null;
  mediaId: string | null;
  commentId: string | null;
};

async function mediaRpc(socket: SocketContext, message: Extract<ClientMessage, { type: "media_rpc" }>) {
  const userId = requireUser(socket);
  const params = message.params ?? {};
  const refreshTarget = await resolveMediaRefreshTarget(socket, message.name, params);
  const data = await callAsSocketUser(socket, message.name, {
    ...params,
    _user_id: userId,
  });

  publishMediaRefresh(message.name, refreshTarget, data, userId);
  hub.send(socket, { type: "ack", requestId: message.requestId, ok: true, data });
}

async function resolveMediaRefreshTarget(socket: SocketContext, name: string, params: Record<string, unknown>): Promise<MediaRefreshTarget> {
  if (!MEDIA_MUTATION_RPCS.has(name)) return { channelId: null, mediaId: null, commentId: null };

  const directChannelId = typeof params._channel_id === "string" ? params._channel_id : null;
  const itemId = typeof params._item_id === "string" ? params._item_id : null;
  const mediaId = typeof params._media_id === "string" ? params._media_id : itemId;
  const commentId = typeof params._comment_id === "string" ? params._comment_id : null;

  if (directChannelId) return { channelId: directChannelId, mediaId, commentId };
  if (mediaId) return { channelId: await getMediaItemChannelId(socket, mediaId), mediaId, commentId };
  if (commentId) {
    const resolvedMediaId = await getMediaCommentMediaId(socket, commentId);
    return { channelId: resolvedMediaId ? await getMediaItemChannelId(socket, resolvedMediaId) : null, mediaId: resolvedMediaId, commentId };
  }

  return { channelId: null, mediaId: null, commentId: null };
}

async function getMediaItemChannelId(socket: SocketContext, mediaId: string) {
  try {
    const rows = await rest<Array<{ channel_id?: unknown }>>(
      `media_items?select=channel_id&id=eq.${encodeURIComponent(mediaId)}&limit=1`,
      socketRestOptions(socket),
    );
    const channelId = rows[0]?.channel_id;
    return typeof channelId === "string" ? channelId : null;
  } catch (error) {
    console.warn("[kloak-ws] failed to resolve media item channel", { mediaId, error });
    return null;
  }
}

async function getMediaCommentMediaId(socket: SocketContext, commentId: string) {
  try {
    const rows = await rest<Array<{ media_id?: unknown }>>(
      `media_comments?select=media_id&id=eq.${encodeURIComponent(commentId)}&limit=1`,
      socketRestOptions(socket),
    );
    const mediaId = rows[0]?.media_id;
    return typeof mediaId === "string" ? mediaId : null;
  } catch (error) {
    console.warn("[kloak-ws] failed to resolve media comment item", { commentId, error });
    return null;
  }
}

function publishMediaRefresh(name: string, target: MediaRefreshTarget, data: unknown, actorUserId: string) {
  if (!MEDIA_MUTATION_RPCS.has(name) || !target.channelId) return;
  hub.publish(`channel:${target.channelId}`, "media.refresh", {
    rpc: name,
    channel_id: target.channelId,
    media_id: target.mediaId ?? extractMediaId(data),
    comment_id: target.commentId ?? extractMediaCommentId(data),
    actor_user_id: actorUserId,
    updated_at: new Date().toISOString(),
  });
}

function extractMediaId(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  return typeof record.media_id === "string" ? record.media_id : typeof record.id === "string" ? record.id : null;
}

function extractMediaCommentId(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  return typeof record.comment_id === "string" ? record.comment_id : typeof record.id === "string" ? record.id : null;
}
function publishNotificationRows(socket: SocketContext, op: "UPDATE" | "DELETE", rows: unknown) {
  const userId = socket.userId;
  if (!userId || !Array.isArray(rows)) return;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    hub.publish(`user:${userId}`, "notifications", op === "DELETE" ? { op, old: row } : { op, new: row });
  }
}
async function sendTyping(socket: SocketContext, message: Extract<ClientMessage, { type: "send_typing" }>) {
  const userId = requireUser(socket);
  const allowed = await canSubscribeChannel(message.channelId, userId, socketRpcOptions(socket));
  if (!allowed) throw new ClientVisibleError("forbidden", "You cannot send typing events to this channel");

  hub.publishEphemeral(`channel:${message.channelId}`, message.isTyping ? "typing.start" : "typing.stop", {
    user_id: userId,
    channel_id: message.channelId,
    started_at: Date.now(),
  });
  hub.send(socket, { type: "ack", requestId: message.requestId, ok: true });
}

async function updatePresence(socket: SocketContext, message: Extract<ClientMessage, { type: "update_presence" }>) {
  const userId = requireUser(socket);
  const presence = {
    status: message.status,
    customStatus: message.customStatus ?? null,
    lastSeen: message.lastSeen ?? new Date().toISOString(),
    ts: message.ts ?? Date.now(),
  };
  await publishPresence(socket, presence);
  hub.send(socket, { type: "ack", requestId: message.requestId, ok: true });
}

async function publishPresence(socket: SocketContext, presence: NonNullable<SocketContext["currentPresence"]>) {
  const userId = socket.userId;
  if (!userId) return;
  socket.currentPresence = presence;

  const payload = {
    user_id: userId,
    status: presence.status,
    custom_status: presence.customStatus,
    last_seen: presence.lastSeen,
    ts: presence.ts,
  };

  hub.publish(`user:${userId}`, "user.presence", payload);
  const recipients = await getPresenceRecipients(socket, userId);
  for (const recipient of recipients) {
    hub.publish(`user:${recipient.user_id}`, "user.presence", payload);
  }
}

async function getChannelRecipients(socket: SocketContext, channelId: string, senderId: string) {
  try {
    const recipients = await callAsSocketUser<ChannelRecipient[]>(socket, "get_socket_channel_recipients", {
      _channel_id: channelId,
      _sender_id: senderId,
    });
    return Array.isArray(recipients) ? recipients.filter((row) => isUuidString(row.user_id) && isUuidString(row.server_id)) : [];
  } catch (error) {
    console.warn("[kloak-ws] failed to resolve channel recipients", { channelId, error });
    return [];
  }
}

async function getDmRecipients(socket: SocketContext, conversationId: string, senderId: string) {
  try {
    const recipients = await callAsSocketUser<DmRecipient[]>(socket, "get_socket_dm_recipients", {
      _conversation_id: conversationId,
      _sender_id: senderId,
    });
    return Array.isArray(recipients) ? recipients.filter((row) => isUuidString(row.user_id)) : [];
  } catch (error) {
    console.warn("[kloak-ws] failed to resolve DM recipients", { conversationId, error });
    return [];
  }
}

async function getPresenceRecipients(socket: SocketContext, userId: string) {
  try {
    const recipients = await callAsSocketUser<PresenceRecipient[]>(socket, "get_socket_presence_recipients", {
      _user_id: userId,
    });
    return Array.isArray(recipients) ? recipients.filter((row) => isUuidString(row.user_id) && row.user_id !== userId) : [];
  } catch (error) {
    console.warn("[kloak-ws] failed to resolve presence recipients", { userId, error });
    return [];
  }
}

async function callAsSocketUser<T>(socket: SocketContext, name: string, body: Record<string, unknown>): Promise<T> {
  try {
    return await rpc<T>(name, body, socketRpcOptions(socket));
  } catch (error) {
    if (error instanceof SupabaseRpcError) {
      throw new ClientVisibleError("rpc_failed", error.message);
    }
    throw error;
  }
}

function socketRpcOptions(socket: SocketContext) {
  return {
    keyHash: socket.keyHash ?? undefined,
    mfaSessionToken: socket.mfaSessionToken,
  };
}

function socketRestOptions(socket: SocketContext) {
  return socketRpcOptions(socket);
}

function requireUser(socket: SocketContext) {
  if (!socket.userId) throw new Error("Unauthenticated socket");
  return socket.userId;
}

function normalizeReplyIds(replyToId: string | null, replyToIds?: string[]) {
  return Array.from(new Set([...(replyToIds ?? []), ...(replyToId ? [replyToId] : [])])).slice(0, 5);
}

function isUuidString(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function consumeRateLimit(socket: SocketContext) {
  const now = Date.now();
  if (now - socket.rateWindowStartedAt >= config.rateLimitWindowMs) {
    socket.rateWindowStartedAt = now;
    socket.rateWindowMessages = 0;
  }

  socket.rateWindowMessages += 1;
  return socket.rateWindowMessages <= config.rateLimitMessages;
}

function rawByteLength(raw: RawData) {
  if (typeof raw === "string") return Buffer.byteLength(raw);
  if (Buffer.isBuffer(raw)) return raw.length;
  if (Array.isArray(raw)) return raw.reduce((total, chunk) => total + chunk.length, 0);
  return raw.byteLength;
}

class ClientVisibleError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "ClientVisibleError";
  }
}

server.listen(config.port, config.host, () => {
  console.info(`[kloak-ws] listening on ws://${config.host}:${config.port}/socket`);
});

function shutdown(signal: NodeJS.Signals) {
  console.info(`[kloak-ws] received ${signal}, closing websocket clients`);
  clearInterval(heartbeatTimer);

  for (const ws of wss.clients) {
    try {
      ws.close(1012, "service_restart");
    } catch {
      // ignore close errors
    }
  }

  wss.close(() => {
    server.close((error) => {
      if (error) {
        console.error("[kloak-ws] failed to close HTTP server", error);
        process.exit(1);
      }
      process.exit(0);
    });
  });

  setTimeout(() => {
    console.warn("[kloak-ws] graceful shutdown timed out");
    process.exit(0);
  }, 25_000).unref();
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));

