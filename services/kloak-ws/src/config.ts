import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type Config = {
  port: number;
  host: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  maxReplayEventsPerTopic: number;
  maxTopicsPerSocket: number;
  maxMessageBytes: number;
  maxBufferedBytes: number;
  rateLimitWindowMs: number;
  rateLimitMessages: number;
  heartbeatIntervalMs: number;
  authTimeoutMs: number;
  supabaseFetchTimeoutMs: number;
  /**
   * DCTS-style presence grace: after a user's last socket closes, their
   * presence is still reported to peers (and kept out of the offline sweep)
   * until this long after their last presence update. Quick reconnects
   * (network blips, tab switches, other sessions churning) therefore never
   * flicker the roster — the user is only marked offline once this window
   * passes with no live socket remaining.
   */
  presenceOfflineGraceMs: number;
  /** How often the server re-checks quiet users and publishes offline events. */
  presenceSweepMs: number;
};

loadDotenv();

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
};

const integer = (name: string, fallback: number) => {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid integer env var ${name}`);
  return value;
};

function loadDotenv() {
  let dir = process.cwd();

  for (let i = 0; i < 8; i++) {
    const file = join(dir, ".env");
    if (existsSync(file)) {
      loadDotenvFile(file);
      return;
    }

    const parent = dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}

function loadDotenvFile(file: string) {
  const content = readFileSync(file, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = line.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (process.env[key] !== undefined) continue;

    const rawValue = line.slice(equalsIndex + 1).trim();
    process.env[key] = unquoteEnvValue(rawValue);
  }
}

function unquoteEnvValue(value: string) {
  if (value.length < 2) return value;
  const quote = value[0];
  if ((quote !== '"' && quote !== "'") || value[value.length - 1] !== quote) return value;
  return value.slice(1, -1);
}

export const config: Config = {
  port: integer("PORT", integer("KLOAK_WS_PORT", 8787)),
  host: process.env.KLOAK_WS_HOST || "0.0.0.0",
  supabaseUrl: process.env.SUPABASE_URL || required("VITE_SUPABASE_URL"),
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || required("VITE_SUPABASE_PUBLISHABLE_KEY"),
  maxReplayEventsPerTopic: integer("KLOAK_WS_REPLAY_EVENTS", 1000),
  maxTopicsPerSocket: integer("KLOAK_WS_MAX_TOPICS_PER_SOCKET", 250),
  maxMessageBytes: integer("KLOAK_WS_MAX_MESSAGE_BYTES", 16_384),
  maxBufferedBytes: integer("KLOAK_WS_MAX_BUFFERED_BYTES", 1_048_576),
  rateLimitWindowMs: integer("KLOAK_WS_RATE_LIMIT_WINDOW_MS", 10_000),
  rateLimitMessages: integer("KLOAK_WS_RATE_LIMIT_MESSAGES", 80),
  heartbeatIntervalMs: integer("KLOAK_WS_HEARTBEAT_MS", 30_000),
  authTimeoutMs: integer("KLOAK_WS_AUTH_TIMEOUT_MS", 10_000),
  supabaseFetchTimeoutMs: integer("KLOAK_WS_SUPABASE_FETCH_TIMEOUT_MS", 12_000),
  presenceOfflineGraceMs: integer("KLOAK_WS_PRESENCE_OFFLINE_GRACE_MS", 30_000),
  presenceSweepMs: integer("KLOAK_WS_PRESENCE_SWEEP_MS", 5_000),
};
