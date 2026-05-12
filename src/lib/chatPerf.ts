type PerfPhase = {
  at: number;
  phase: string;
  data?: Record<string, unknown>;
};

type PerfEntry = {
  id: string;
  metric: string;
  startedAt: number;
  meta?: Record<string, unknown>;
  phases: PerfPhase[];
};

declare global {
  interface Window {
    __KLOAK_CHAT_PERF__?: PerfEntry[];
  }
}

const perfEntries = new Map<string, PerfEntry>();
const channelNavigationPerfIds = new Map<string, string>();
let perfCounter = 0;

const isPerfEnabled = () => {
  if (typeof window === "undefined") return false;
  if (!import.meta.env.DEV) return false;
  try {
    return window.localStorage.getItem("kloak:debug-perf") !== "0";
  } catch {
    return true;
  }
};

const getNow = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

const emit = (entry: PerfEntry, phase: string, at: number, data?: Record<string, unknown>) => {
  if (!isPerfEnabled()) return;

  const durationMs = Math.round((at - entry.startedAt) * 100) / 100;
  const payload = {
    metric: entry.metric,
    id: entry.id,
    phase,
    durationMs,
    ...(entry.meta ?? {}),
    ...(data ?? {}),
  };

  window.__KLOAK_CHAT_PERF__ = window.__KLOAK_CHAT_PERF__ ?? [];
  window.__KLOAK_CHAT_PERF__.push({
    ...entry,
    phases: [...entry.phases, { phase, at, data }],
  });
};

export const beginChatPerf = (metric: string, meta?: Record<string, unknown>) => {
  const id = `${metric}-${Date.now()}-${++perfCounter}`;
  perfEntries.set(id, {
    id,
    metric,
    startedAt: getNow(),
    meta,
    phases: [],
  });
  return id;
};

export const markChatPerf = (id: string | null | undefined, phase: string, data?: Record<string, unknown>) => {
  if (!id) return;
  const entry = perfEntries.get(id);
  if (!entry) return;
  const at = getNow();
  entry.phases.push({ phase, at, data });
  emit(entry, phase, at, data);
};

export const endChatPerf = (id: string | null | undefined, phase = "done", data?: Record<string, unknown>) => {
  if (!id) return;
  const entry = perfEntries.get(id);
  if (!entry) return;
  const at = getNow();
  entry.phases.push({ phase, at, data });
  emit(entry, phase, at, data);
  perfEntries.delete(id);
};

export const afterNextPaint = (fn: () => void) => {
  if (typeof requestAnimationFrame !== "function") {
    fn();
    return;
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(fn);
  });
};

export const beginChannelNavigationPerf = (channelId: string, meta?: Record<string, unknown>) => {
  const existingId = channelNavigationPerfIds.get(channelId);
  if (existingId) {
    endChatPerf(existingId, "replaced");
  }
  const id = beginChatPerf("channel-navigation", { channelId, ...(meta ?? {}) });
  channelNavigationPerfIds.set(channelId, id);
  return id;
};

export const markChannelNavigationPerf = (
  channelId: string,
  phase: string,
  data?: Record<string, unknown>,
) => {
  const id = channelNavigationPerfIds.get(channelId);
  if (!id) return;
  markChatPerf(id, phase, data);
};

export const endChannelNavigationPerf = (
  channelId: string,
  phase = "done",
  data?: Record<string, unknown>,
) => {
  const id = channelNavigationPerfIds.get(channelId);
  if (!id) return;
  endChatPerf(id, phase, data);
  channelNavigationPerfIds.delete(channelId);
};
