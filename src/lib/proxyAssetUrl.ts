/**
 * Proxy external asset URLs through our signed link-preview proxy so the
 * user's browser never contacts attacker-controlled origins directly.
 *
 * Used for media-channel items whose `media_url` / `thumbnail_url` may point
 * at arbitrary third-party hosts (YouTube thumbnails, image URL uploads,
 * etc.). First-party URLs (Supabase / Bunny CDN) bypass the proxy.
 */

import { getKeyHashAsync } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const SERVER_TTL_SECONDS = 60 * 60 * 24; // 24h (server-side)
const LOCAL_TTL_SECONDS = 60 * 60 * 22; // refresh before expiry
const BATCH_WINDOW_MS = 40;
const MAX_BATCH = 24;

// 1x1 transparent PNG — used when signing fails so we never fall back to the
// raw external URL.
const FALLBACK_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

// ---------------------------------------------------------------------------
// First-party detection
// ---------------------------------------------------------------------------

const SUPABASE_HOST = (() => {
  try { return new URL(SUPABASE_URL).host.toLowerCase(); } catch { return ""; }
})();

const FIRST_PARTY_HOST_SUFFIXES = [
  ".b-cdn.net", // Bunny CDN pull zones
  ".bunnycdn.com",
  ".storage.bunnycdn.com",
];

function isFirstPartyUrl(url: string): boolean {
  try {
    const p = new URL(url);
    const host = p.hostname.toLowerCase();
    if (SUPABASE_HOST && host === SUPABASE_HOST) return true;
    if (FIRST_PARTY_HOST_SUFFIXES.some((s) => host.endsWith(s))) return true;
    if (p.protocol === "data:" || p.protocol === "blob:") return true;
    return false;
  } catch { return false; }
}

function isHttpUrl(url: string): boolean {
  try {
    const p = new URL(url);
    return p.protocol === "http:" || p.protocol === "https:";
  } catch { return false; }
}

function isAlreadyProxied(url: string): boolean {
  try {
    const p = new URL(url);
    return (
      p.host.toLowerCase() === SUPABASE_HOST &&
      p.pathname.endsWith("/functions/v1/fetch-link-preview-asset")
    );
  } catch { return false; }
}

// ---------------------------------------------------------------------------
// Cache + batching
// ---------------------------------------------------------------------------

interface Entry { url: string; expiresAt: number }
const cache = new Map<string, Entry>();
const MAX_CACHE = 500;

function nowSec(): number { return Math.floor(Date.now() / 1000); }

function getCached(original: string): string | null {
  const e = cache.get(original);
  if (!e) return null;
  if (e.expiresAt > nowSec()) return e.url;
  cache.delete(original);
  return null;
}

function setCached(original: string, proxied: string) {
  if (cache.size >= MAX_CACHE) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(original, { url: proxied, expiresAt: nowSec() + LOCAL_TTL_SECONDS });
}

type Resolver = (url: string) => void;
const pending = new Map<string, Promise<string>>();
const queue = new Map<string, Resolver[]>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  flushTimer = null;
  if (queue.size === 0) return;
  const batch = Array.from(queue.entries()).slice(0, MAX_BATCH);
  const urls = batch.map(([u]) => u);
  for (const u of urls) queue.delete(u);

  let results: Record<string, string | null> = {};
  try {
    const keyHash = await getKeyHashAsync();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
    };
    if (keyHash) headers["x-key-hash"] = keyHash;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/sign-asset-proxy`, {
      method: "POST",
      headers,
      body: JSON.stringify({ urls }),
    });
    if (res.ok) {
      const data = await res.json();
      results = (data?.results as Record<string, string | null>) || {};
    } else {
      console.warn("[proxyAssetUrl] sign-asset-proxy failed:", res.status);
    }
  } catch (err) {
    console.warn("[proxyAssetUrl] sign request error:", err);
  }

  for (const [original, resolvers] of batch) {
    const proxied = results[original] ?? null;
    const value = proxied || FALLBACK_DATA_URI;
    if (proxied) setCached(original, proxied);
    for (const r of resolvers) r(value);
    pending.delete(original);
  }

  // If more queued than MAX_BATCH allowed, kick another flush.
  if (queue.size > 0) {
    flushTimer = setTimeout(flush, BATCH_WINDOW_MS);
  }
}

function enqueue(original: string): Promise<string> {
  const existing = pending.get(original);
  if (existing) return existing;
  const p = new Promise<string>((resolve) => {
    const list = queue.get(original) ?? [];
    list.push(resolve);
    queue.set(original, list);
  });
  pending.set(original, p);
  if (!flushTimer) flushTimer = setTimeout(flush, BATCH_WINDOW_MS);
  return p;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function peekProxiedAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!isHttpUrl(url) || isFirstPartyUrl(url) || isAlreadyProxied(url)) return url;
  return getCached(url);
}

export async function getProxiedAssetUrl(url: string | null | undefined): Promise<string> {
  if (!url) return FALLBACK_DATA_URI;
  if (!isHttpUrl(url)) return url;
  if (isFirstPartyUrl(url) || isAlreadyProxied(url)) return url;
  const cached = getCached(url);
  if (cached) return cached;
  return enqueue(url);
}

// Suppress unused import warning if tree-shaken in some build modes.
void supabase;
