import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { hashSecretKey, isValidSecretKey } from "@/lib/crypto";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

const ENV_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const CURRENT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvcXV1Y3VybndwcWN2Z3F1a3B6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2ODUwNjEsImV4cCI6MjA4NzA0NTA2MX0.XgkhNWxe7CHzeyc8PrXJKztuT6oxFYXX1T8Fab1N6QA";
const SUPABASE_PUBLISHABLE_KEY = ENV_KEY || CURRENT_ANON_KEY;

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
      return fetch(input, init);
    },
  },
});
