import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type WebSocket from "ws";
import type { RawData } from "ws";
import { WebSocketServer } from "ws";
import { config } from "./config.js";
import { SocketHub, type SocketContext } from "./hub.js";
import { authenticate, canSubscribeChannel, canSubscribeDm, rpc, SupabaseRpcError } from "./supabase.js";
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
    case "send_typing":
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

