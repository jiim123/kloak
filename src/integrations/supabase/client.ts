import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { hashSecretKey, isValidSecretKey } from "@/lib/crypto";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

const ENV_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const CURRENT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvcXV1Y3VybndwcWN2Z3F1a3B6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2ODUwNjEsImV4cCI6MjA4NzA0NTA2MX0.XgkhNWxe7CHzeyc8PrXJKztuT6oxFYXX1T8Fab1N6QA";
const SUPABASE_PUBLISHABLE_KEY = ENV_KEY || CURRENT_ANON_KEY;
const READ_ONLY_RPC_NAMES = new Set([
  "get_all_channel_unread_counts",
  "get_channel_messages_secure",
  "get_dm_bootstrap_secure",
  "get_dm_messages_by_ids_secure",
  "get_dm_unread_counts",
  "get_friend_dashboard",
  "get_message_author_styles_secure",
  "get_user_dm_conversations",
  "get_server_surface_secure",
  "get_server_overview_secure",
  "get_user_server_unread_summary",
  "get_user_servers",
  "get_users_by_ids",
  "get_users_presence_secure",
  "server",
]);
const inflightReadRequests = new Map<string, Promise<Response>>();

type DbRequestEntry = {
  at: number;
  method: string;
  kind: "rpc" | "table" | "function" | "other";
  name: string;
  url: string;
  status?: number;
  durationMs?: number;
  deduped?: boolean;
};

type DbRequestDebugState = {
  entries: DbRequestEntry[];
  summary: Record<string, number>;
  reset: () => void;
};

declare global {
  interface Window {
    __KLOAK_DB_REQUESTS__?: DbRequestDebugState;
  }
}

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in environment.");
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const keyPayload = parseJwtPayload(SUPABASE_PUBLISHABLE_KEY);
const keyRole = typeof keyPayload?.role === "string" ? keyPayload.role : null;
if (keyRole === "service_role") {
  throw new Error(
    "VITE_SUPABASE_PUBLISHABLE_KEY is set to a service_role key. Use anon/publishable key only and rotate leaked service_role key.",
  );
}

let currentKeyHash: string | null = null;
let inflightKeyHash: Promise<string | null> | null = null;

function tryGetPersistedKeyHash(): string | null {
  try {
    const raw = localStorage.getItem("kloak-auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { keyHash?: unknown } } | null;
    const kh = parsed?.state?.keyHash;
    return typeof kh === "string" && kh.length > 0 ? kh : null;
  } catch {
    return null;
  }
}

function tryGetPersistedSecretKey(): string | null {
  try {
    const raw = localStorage.getItem("kloak-auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { secretKey?: unknown } } | null;
    const sk = parsed?.state?.secretKey;
    return typeof sk === "string" && sk.length > 0 ? sk : null;
  } catch {
    return null;
  }
}

async function ensureKeyHash(): Promise<string | null> {
  if (currentKeyHash) return currentKeyHash;

  // Fast path
  const persisted = tryGetPersistedKeyHash();
  if (persisted) {
    currentKeyHash = persisted;
    return persisted;
  }

  if (inflightKeyHash) return inflightKeyHash;

  const secretKey = tryGetPersistedSecretKey();
  if (!secretKey || !isValidSecretKey(secretKey)) return null;

  inflightKeyHash = hashSecretKey(secretKey)
    .then((kh) => {
      currentKeyHash = kh;
      return kh;
    })
    .catch(() => null)
    .finally(() => {
      inflightKeyHash = null;
    });

  return inflightKeyHash;
}

currentKeyHash = tryGetPersistedKeyHash();

export function setKeyHashHeader(keyHash: string | null) {
  currentKeyHash = keyHash;
  inflightKeyHash = null;
}

export function getKeyHash(): string | null {
  return currentKeyHash;
}

export async function getKeyHashAsync(): Promise<string | null> {
  return ensureKeyHash();
}

function getFetchMethod(input: RequestInfo | URL, init?: RequestInit): string {
  return (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
}

function getFetchUrl(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : String(input);
}

function getRequestBodyKey(input: RequestInfo | URL, init?: RequestInit): string | null {
  if (!init?.body) return input instanceof Request ? null : "";
  if (typeof init.body === "string") return init.body;
  if (init.body instanceof URLSearchParams) return init.body.toString();
  return null;
}

function getReadDedupeKey(input: RequestInfo | URL, init?: RequestInit): string | null {
  const method = getFetchMethod(input, init);
  const url = getFetchUrl(input);

  if (method === "GET" || method === "HEAD") {
    return `${method}:${url}`;
  }

  if (method !== "POST") return null;

  let pathname = "";
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }

  const rpcName = pathname.match(/\/rpc\/([^/?#]+)/)?.[1];
  if (!rpcName || !READ_ONLY_RPC_NAMES.has(rpcName)) return null;

  const bodyKey = getRequestBodyKey(input, init);
  if (bodyKey === null) return null;
  return `${method}:${url}:${bodyKey}`;
}

function getDbRequestInfo(input: RequestInfo | URL, init?: RequestInit): Pick<DbRequestEntry, "method" | "kind" | "name" | "url"> {
  const method = getFetchMethod(input, init);
  const url = getFetchUrl(input);

  try {
    const parsed = new URL(url);
    const rpcName = parsed.pathname.match(/\/rpc\/([^/?#]+)/)?.[1];
    if (rpcName) return { method, kind: "rpc", name: rpcName, url };

    const functionName = parsed.pathname.match(/\/functions\/v1\/([^/?#]+)/)?.[1];
    if (functionName) return { method, kind: "function", name: functionName, url };

    const tableName = parsed.pathname.match(/\/rest\/v1\/([^/?#]+)/)?.[1];
    if (tableName) return { method, kind: "table", name: tableName, url };
  } catch {
    // Fall through to generic request tracking.
  }

  return { method, kind: "other", name: "unknown", url };
}

function getDbDebugState(): DbRequestDebugState | null {
  if (typeof window === "undefined" || !import.meta.env.DEV) return null;

  if (!window.__KLOAK_DB_REQUESTS__) {
    window.__KLOAK_DB_REQUESTS__ = {
      entries: [],
      summary: {},
      reset() {
        this.entries.length = 0;
        for (const key of Object.keys(this.summary)) {
          delete this.summary[key];
        }
      },
    };
  }

  return window.__KLOAK_DB_REQUESTS__;
}

async function trackedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const debugState = getDbDebugState();
  if (!debugState) return dedupedFetch(input, init);

  const startedAt = performance.now();
  const info = getDbRequestInfo(input, init);
  const dedupeKey = getReadDedupeKey(input, init);
  const wasDeduped = !!dedupeKey && inflightReadRequests.has(dedupeKey);

  try {
    const response = await dedupedFetch(input, init);
    const entry: DbRequestEntry = {
      ...info,
      at: Date.now(),
      status: response.status,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      deduped: wasDeduped,
    };
    debugState.entries.push(entry);
    if (!wasDeduped) {
      debugState.summary[`${entry.kind}:${entry.name}`] = (debugState.summary[`${entry.kind}:${entry.name}`] ?? 0) + 1;
    }
    return response;
  } catch (error) {
    const entry: DbRequestEntry = {
      ...info,
      at: Date.now(),
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      deduped: wasDeduped,
    };
    debugState.entries.push(entry);
    if (!wasDeduped) {
      debugState.summary[`${entry.kind}:${entry.name}`] = (debugState.summary[`${entry.kind}:${entry.name}`] ?? 0) + 1;
    }
    throw error;
  }
}

async function dedupedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const key = getReadDedupeKey(input, init);
  if (!key) return fetch(input, init);

  const existing = inflightReadRequests.get(key);
  if (existing) {
    const response = await existing;
    return response.clone();
  }

  const request = fetch(input, init).finally(() => {
    inflightReadRequests.delete(key);
  });
  inflightReadRequests.set(key, request);
  const response = await request;
  return response.clone();
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: async (input, init) => {
      const keyHash = await ensureKeyHash();
      if (keyHash) {
        init = init || {};
        const existingHeaders =
          init.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : init.headers || {};
        init.headers = {
          ...existingHeaders,
          "x-key-hash": keyHash,
        };
      }
      return trackedFetch(input, init);
    },
  },
});
