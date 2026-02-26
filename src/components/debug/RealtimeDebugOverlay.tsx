import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import { cn } from "@/lib/utils";

const LS_KEY = "kloak-debug-realtime";
const POLL_MS = 1000;
const MAX_HISTORY = 40;

type ChannelSnapshot = {
  key: string;
  topic: string;
  state: string;
};

type TransitionEvent = {
  at: number;
  topic: string;
  from: string;
  to: string;
};

function formatAge(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "-";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

function formatClock(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return "-";
  }
}

function getRealtimeSocketState(): string {
  const realtime = supabase.realtime as unknown as {
    connectionState?: () => string;
  };
  if (typeof realtime.connectionState !== "function") return "unknown";
  try {
    return realtime.connectionState();
  } catch {
    return "unknown";
  }
}

function readEnabledFromStorage(): boolean {
  try {
    return localStorage.getItem(LS_KEY) === "1";
  } catch {
    return false;
  }
}

function snapshotChannels(): ChannelSnapshot[] {
  const channels = supabase.getChannels();
  return channels.map((channel, index) => {
    const raw = channel as unknown as {
      topic?: unknown;
      state?: unknown;
    };
    const topic = typeof raw.topic === "string" ? raw.topic : `unknown:${index}`;
    const state = typeof raw.state === "string" ? raw.state : "unknown";
    return {
      key: `${topic}:${index}`,
      topic,
      state,
    };
  });
}

export function RealtimeDebugOverlay() {
  const connection = useConnectionStatus();
  const [isEnabled, setIsEnabled] = useState<boolean>(() => readEnabledFromStorage());
  const [channels, setChannels] = useState<ChannelSnapshot[]>([]);
  const [history, setHistory] = useState<TransitionEvent[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const prevStateByTopicRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY) {
        setIsEnabled(e.newValue === "1");
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Keep in sync for same-tab localStorage toggles (e.g. DevTools console).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const timer = window.setInterval(() => {
      const next = readEnabledFromStorage();
      setIsEnabled((prev) => (prev === next ? prev : next));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!isEnabled) return;

    let disposed = false;

    const runSample = () => {
      if (disposed) return;
      const next = snapshotChannels();
      const nextStates = new Map<string, string>();
      const events: TransitionEvent[] = [];
      const now = Date.now();

      for (const item of next) {
        nextStates.set(item.topic, item.state);
      }

      for (const [topic, nextState] of nextStates.entries()) {
        const prevState = prevStateByTopicRef.current.get(topic);
        if (prevState && prevState !== nextState) {
          events.push({ at: now, topic, from: prevState, to: nextState });
        } else if (!prevState) {
          events.push({ at: now, topic, from: "none", to: nextState });
        }
      }

      for (const [topic, prevState] of prevStateByTopicRef.current.entries()) {
        if (!nextStates.has(topic)) {
          events.push({ at: now, topic, from: prevState, to: "removed" });
        }
      }

      prevStateByTopicRef.current = nextStates;
      setChannels(next);
      setLastUpdatedAt(now);

      if (events.length > 0) {
        setHistory((prev) => [...prev, ...events].slice(-MAX_HISTORY));
      }
    };

    runSample();
    const interval = window.setInterval(runSample, POLL_MS);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [isEnabled]);

  const counts = useMemo(() => {
    let joined = 0;
    let joining = 0;
    let errored = 0;
    let closed = 0;
    let leaving = 0;

    for (const channel of channels) {
      if (channel.state === "joined") joined += 1;
      else if (channel.state === "joining") joining += 1;
      else if (channel.state === "errored") errored += 1;
      else if (channel.state === "closed") closed += 1;
      else if (channel.state === "leaving") leaving += 1;
    }

    return { joined, joining, errored, closed, leaving };
  }, [channels]);

  const close = () => {
    try {
      localStorage.setItem(LS_KEY, "0");
    } catch {
      // ignore
    }
    setIsEnabled(false);
  };

  if (!import.meta.env.DEV) return null;
  if (!isEnabled) return null;

  const socketState = getRealtimeSocketState();
  const latestTransitions = [...history].slice(-12).reverse();

  return (
    <div className="fixed bottom-4 right-4 z-[1000] w-[420px] max-w-[calc(100vw-2rem)]">
      <div className="rounded-xl border border-border bg-background/90 backdrop-blur shadow-xl">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="text-sm font-semibold">Realtime Debug</div>
          <button
            onClick={close}
            className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
            aria-label="Close realtime debug"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 py-2 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <div className="text-muted-foreground">conn.status</div>
            <div className="text-right">{connection.status}</div>

            <div className="text-muted-foreground">realtime</div>
            <div className="text-right">{connection.isRealtimeConnected ? "up" : "down"}</div>

            <div className="text-muted-foreground">socket</div>
            <div className="text-right">{socketState}</div>

            <div className="text-muted-foreground">channels total</div>
            <div className="text-right">{channels.length}</div>

            <div className="text-muted-foreground">joined / joining</div>
            <div className="text-right">{counts.joined} / {counts.joining}</div>

            <div className="text-muted-foreground">errored / closed</div>
            <div className="text-right">{counts.errored} / {counts.closed}</div>

            <div className="text-muted-foreground">leaving</div>
            <div className="text-right">{counts.leaving}</div>

            <div className="text-muted-foreground">last sample</div>
            <div className="text-right">{lastUpdatedAt ? `${formatAge(Date.now() - lastUpdatedAt)} ago` : "-"}</div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Channels</div>
            <div className="max-h-36 overflow-auto rounded-md border border-border/70 bg-background/50">
              {channels.length === 0 ? (
                <div className="px-2 py-2 text-muted-foreground">No channels</div>
              ) : (
                channels.map((channel) => (
                  <div key={channel.key} className="px-2 py-1.5 border-b border-border/40 last:border-b-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate font-mono text-[11px]">{channel.topic}</div>
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5",
                          channel.state === "joined" && "bg-[hsl(var(--kloak-success))/0.2] text-[hsl(var(--kloak-success))]",
                          channel.state === "joining" && "bg-[hsl(var(--kloak-warning))/0.2] text-[hsl(var(--kloak-warning))]",
                          channel.state === "errored" && "bg-destructive/20 text-destructive",
                          channel.state === "closed" && "bg-secondary text-muted-foreground",
                          channel.state === "leaving" && "bg-secondary text-foreground",
                        )}
                      >
                        {channel.state}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Recent Transitions</div>
            <div className="max-h-36 overflow-auto rounded-md border border-border/70 bg-background/50">
              {latestTransitions.length === 0 ? (
                <div className="px-2 py-2 text-muted-foreground">No transitions yet</div>
              ) : (
                latestTransitions.map((event, index) => (
                  <div key={`${event.at}-${event.topic}-${index}`} className="px-2 py-1.5 border-b border-border/40 last:border-b-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate font-mono text-[11px]">{event.topic}</div>
                      <div className="shrink-0 text-muted-foreground">{formatClock(event.at)}</div>
                    </div>
                    <div className="text-muted-foreground">{event.from} -&gt; {event.to}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="text-muted-foreground">
            Toggle: <span className="font-mono">localStorage.setItem("{LS_KEY}", "1")</span>
          </div>
        </div>
      </div>
    </div>
  );
}
