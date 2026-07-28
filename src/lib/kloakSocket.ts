import { useAuthStore } from "@/stores/authStore";

type KloakSocketEvent = {
  topic: string;
  seq: number;
  event: string;
  payload: unknown;
  createdAt: string;
};

type ServerMessage =
  | { type: "hello"; heartbeatIntervalMs: number }
  | { type: "auth_ok"; requestId?: string; user: unknown }
  | { type: "ack"; requestId?: string; ok: true; data?: unknown }
  | { type: "error"; requestId?: string; code: string; message: string }
  | { type: "subscribed"; requestId?: string; topics: string[] }
  | { type: "unsubscribed"; requestId?: string; topics: string[] }
  | { type: "event"; event: KloakSocketEvent }
  | { type: "pong"; requestId?: string; now: string };

type PendingRequest = {
  resolve: (value: ServerMessage) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

type TopicListener = (event: KloakSocketEvent) => void;

const DEFAULT_SOCKET_URL = "ws://localhost:8787/socket";
const REQUEST_TIMEOUT_MS = 15_000;
const RECONNECT_MIN_MS = 500;
const RECONNECT_MAX_MS = 10_000;

let requestSeq = 0;

export function isKloakSocketEnabled() {
  if (typeof window === "undefined") return false;
  try {
    const override = window.localStorage.getItem("kloak:use-kloak-ws");
    if (override === "1") return true;
    if (override === "0") return false;
    return import.meta.env.VITE_KLOAK_WS_ENABLED === "true";
  } catch {
    return import.meta.env.VITE_KLOAK_WS_ENABLED === "true";
  }
}

export class KloakSocketClient {
  private ws: WebSocket | null = null;
  private connectPromise: Promise<void> | null = null;
  private pending = new Map<string, PendingRequest>();
  private listeners = new Map<string, Set<TopicListener>>();
  private topicCursors = new Map<string, number>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private manuallyClosed = false;
  private authenticated = false;

  get url() {
    return (import.meta.env.VITE_KLOAK_WS_URL as string | undefined)?.trim() || DEFAULT_SOCKET_URL;
  }

  get isOpen() {
    return this.ws?.readyState === WebSocket.OPEN && this.authenticated;
  }

  async connect() {
    if (!isKloakSocketEnabled()) throw new Error("Kloak websocket is not enabled");
    if (this.isOpen) return;
    if (this.connectPromise) return this.connectPromise;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.manuallyClosed = false;
    this.connectPromise = this.openAndAuthenticate().finally(() => {
      this.connectPromise = null;
    });
    return this.connectPromise;
  }

  close() {
    this.manuallyClosed = true;
    this.authenticated = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const ws = this.ws;
    this.ws = null;
    ws?.close(1000, "client_close");
  }

  async subscribe(topic: string, listener: TopicListener) {
    let set = this.listeners.get(topic);
    if (!set) {
      set = new Set();
      this.listeners.set(topic, set);
    }
    set.add(listener);

    await this.connect();
    await this.request({
      type: "subscribe",
      topics: [topic],
      cursors: { [topic]: this.topicCursors.get(topic) ?? 0 },
    });

    return () => {
      const current = this.listeners.get(topic);
      current?.delete(listener);
      if (current && current.size === 0) {
        this.listeners.delete(topic);
        void this.request({ type: "unsubscribe", topics: [topic] }).catch(() => undefined);
      }
    };
  }

  async sendChannelMessage(input: { channelId: string; content: string; replyToId?: string | null; replyToIds?: string[] }) {
    await this.connect();
    const response = await this.request({ type: "send_channel_message", ...input });
    if (response.type !== "ack") throw new Error("Unexpected socket response");
    return response.data;
  }

  async sendDmMessage(input: { conversationId: string; content: string; replyToId?: string | null; replyToIds?: string[] }) {
    await this.connect();
    const response = await this.request({ type: "send_dm_message", ...input });
    if (response.type !== "ack") throw new Error("Unexpected socket response");
    return response.data;
  }

  async markChannelRead(input: { channelId: string; lastReadMessageId?: string | null; lastReadAt?: string }) {
    await this.connect();
    const response = await this.request({ type: "mark_channel_read", ...input });
    if (response.type !== "ack") throw new Error("Unexpected socket response");
    return response.data;
  }

  async markDmRead(conversationId: string) {
    await this.connect();
    const response = await this.request({ type: "mark_dm_read", conversationId });
    if (response.type !== "ack") throw new Error("Unexpected socket response");
    return response.data;
  }

  async sendTyping(input: { channelId: string; isTyping: boolean }) {
    await this.connect();
    const response = await this.request({ type: "send_typing", ...input });
    if (response.type !== "ack") throw new Error("Unexpected socket response");
    return response.data;
  }

  async updatePresence(input: {
    status: "online" | "idle" | "dnd" | "offline";
    customStatus?: string | null;
    lastSeen?: string | null;
    ts?: number;
  }) {
    await this.connect();
    const response = await this.request({ type: "update_presence", ...input });
    if (response.type !== "ack") throw new Error("Unexpected socket response");
    return response.data;
  }
  private async openAndAuthenticate() {
    const { keyHash, mfaSessionToken } = useAuthStore.getState();
    if (!keyHash) throw new Error("Missing Kloak key hash for websocket auth");

    const ws = new WebSocket(this.url);
    this.ws = ws;
    this.authenticated = false;

    try {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          ws.removeEventListener("open", onOpen);
          ws.removeEventListener("error", onError);
        };
        const onOpen = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error("Failed to open Kloak websocket"));
        };

        ws.addEventListener("open", onOpen, { once: true });
        ws.addEventListener("error", onError, { once: true });
        ws.addEventListener("message", (event) => this.handleMessage(ws, event.data));
        ws.addEventListener("close", () => this.handleClose(ws));
      });

      if (this.ws !== ws) throw new Error("Kloak websocket was replaced before auth");
      const response = await this.request({ type: "auth", keyHash, mfaSessionToken: mfaSessionToken ?? null });
      if (response.type !== "auth_ok") throw new Error("Kloak websocket auth failed");
      if (this.ws !== ws) throw new Error("Kloak websocket was replaced after auth");
      this.authenticated = true;
      this.reconnectAttempt = 0;

      const topics = Array.from(this.listeners.keys());
      if (topics.length > 0) {
        await this.request({
          type: "subscribe",
          topics,
          cursors: Object.fromEntries(topics.map((topic) => [topic, this.topicCursors.get(topic) ?? 0])),
        });
      }
    } catch (error) {
      if (this.ws === ws) {
        this.authenticated = false;
        this.ws = null;
      }
      try {
        ws.close();
      } catch {
        // ignore cleanup errors
      }
      throw error;
    }
  }

  private request(payload: Record<string, unknown>): Promise<ServerMessage> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error("Kloak websocket is not open"));

    const requestId = typeof payload.requestId === "string" ? payload.requestId : `kws-${Date.now()}-${++requestSeq}`;
    const message = { ...payload, requestId };

    return new Promise<ServerMessage>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Kloak websocket request timed out: ${String(payload.type)}`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(requestId, { resolve, reject, timeoutId });
      ws.send(JSON.stringify(message));
    });
  }

  private handleMessage(ws: WebSocket, data: unknown) {
    if (ws !== this.ws) return;
    let message: ServerMessage;
    try {
      message = JSON.parse(String(data)) as ServerMessage;
    } catch {
      return;
    }

    if ("requestId" in message && message.requestId) {
      const pending = this.pending.get(message.requestId);
      if (pending) {
        this.pending.delete(message.requestId);
        clearTimeout(pending.timeoutId);
        if (message.type === "error") pending.reject(new Error(message.message));
        else pending.resolve(message);
        return;
      }
    }

    if (message.type === "event") {
      this.topicCursors.set(message.event.topic, message.event.seq);
      const listeners = this.listeners.get(message.event.topic);
      listeners?.forEach((listener) => listener(message.event));
    }
  }

  private handleClose(ws?: WebSocket) {
    if (ws && ws !== this.ws) return;
    this.authenticated = false;
    this.ws = null;
    for (const [requestId, pending] of this.pending) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error("Kloak websocket closed"));
      this.pending.delete(requestId);
    }

    if (this.manuallyClosed || !isKloakSocketEnabled()) return;
    const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_MIN_MS * 2 ** this.reconnectAttempt++);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect().catch(() => this.handleClose(this.ws ?? undefined));
    }, delay);
  }
}

export const kloakSocket = new KloakSocketClient();

