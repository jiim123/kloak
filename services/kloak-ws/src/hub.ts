import type WebSocket from "ws";
import { config } from "./config.js";
import type { ServerMessage, SocketEvent } from "./protocol.js";

export type SocketContext = {
  id: string;
  ws: WebSocket;
  userId: string | null;
  keyHash: string | null;
  mfaSessionToken: string | null;
  topics: Set<string>;
  alive: boolean;
  rateWindowStartedAt: number;
  rateWindowMessages: number;
  currentPresence: { status: "online" | "idle" | "dnd" | "offline"; customStatus: string | null; lastSeen: string; ts: number } | null;
};

type TopicState = {
  sockets: Set<SocketContext>;
  replay: SocketEvent[];
  seq: number;
};

export class SocketHub {
  private topics = new Map<string, TopicState>();

  subscribe(socket: SocketContext, topic: string, afterSeq = 0) {
    const state = this.getTopic(topic);
    state.sockets.add(socket);
    socket.topics.add(topic);

    const missed = state.replay.filter((event) => event.seq > afterSeq);
    for (const event of missed) {
      this.send(socket, { type: "event", event });
    }
  }

  unsubscribe(socket: SocketContext, topic: string) {
    socket.topics.delete(topic);
    const state = this.topics.get(topic);
    if (!state) return;
    state.sockets.delete(socket);
  }

  removeSocket(socket: SocketContext) {
    for (const topic of Array.from(socket.topics)) {
      this.unsubscribe(socket, topic);
    }
  }

  publish(topic: string, event: string, payload: unknown): SocketEvent {
    const state = this.getTopic(topic);
    const socketEvent: SocketEvent = {
      topic,
      event,
      payload,
      seq: ++state.seq,
      createdAt: new Date().toISOString(),
    };

    state.replay.push(socketEvent);
    if (state.replay.length > config.maxReplayEventsPerTopic) {
      state.replay.splice(0, state.replay.length - config.maxReplayEventsPerTopic);
    }

    for (const socket of state.sockets) {
      this.send(socket, { type: "event", event: socketEvent });
    }

    return socketEvent;
  }

  send(socket: SocketContext, message: ServerMessage) {
    if (socket.ws.readyState !== socket.ws.OPEN) return;
    if (socket.ws.bufferedAmount > config.maxBufferedBytes) {
      socket.ws.close(4008, "backpressure");
      return;
    }
    socket.ws.send(JSON.stringify(message));
  }

  stats() {
    let subscriptions = 0;
    for (const state of this.topics.values()) subscriptions += state.sockets.size;
    return {
      topics: this.topics.size,
      subscriptions,
    };
  }

  private getTopic(topic: string): TopicState {
    const existing = this.topics.get(topic);
    if (existing) return existing;
    const state: TopicState = {
      sockets: new Set(),
      replay: [],
      seq: 0,
    };
    this.topics.set(topic, state);
    return state;
  }
}

