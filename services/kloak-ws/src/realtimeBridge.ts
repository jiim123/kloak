import { createClient } from "@supabase/supabase-js";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { config } from "./config.js";
import type { SocketHub } from "./hub.js";

type BroadcastPayload = {
  op?: string;
  new?: Record<string, unknown> | null;
};

type RelayEntry = {
  refCount: number;
  channel: RealtimeChannel;
};

export class ChannelRelayManager {
  private readonly supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  private readonly relays = new Map<string, RelayEntry>();

  constructor(private readonly hub: Pick<SocketHub, "publish">) {}

  acquire(channelId: string) {
    const existing = this.relays.get(channelId);
    if (existing) {
      existing.refCount += 1;
      return;
    }

    const channel = this.supabase
      .channel(`chat:${channelId}`)
      .on("broadcast", { event: "messages" }, ({ payload }) => {
        const eventPayload = payload as BroadcastPayload | null;
        if (eventPayload?.op !== "INSERT") return;
        const row = eventPayload.new;
        if (!row?.id) return;
        this.hub.publish(`channel:${channelId}`, "message.created", row);
      });

    channel.subscribe();
    this.relays.set(channelId, { refCount: 1, channel });
  }

  release(channelId: string) {
    const existing = this.relays.get(channelId);
    if (!existing) return;

    existing.refCount -= 1;
    if (existing.refCount > 0) return;

    this.relays.delete(channelId);
    void this.supabase.removeChannel(existing.channel);
  }
}
