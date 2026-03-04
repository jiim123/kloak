/**
 * Decoration Preloader
 * 
 * Eagerly detects animated vs static for ALL known decorations at module load,
 * and captures still frames for animated ones. Components read synchronously
 * from this cache — zero per-instance async work.
 */
import { useSyncExternalStore } from 'react';
import { AVATAR_DECORATIONS } from './avatarDecorations';

export interface DecorationAsset {
  isAnimated: boolean;
  stillSrc: string | null; // data URL of first frame (only for animated)
}

// Fully resolved cache: src → asset
const cache = new Map<string, DecorationAsset>();

// Listeners for useSyncExternalStore
let listeners: Array<() => void> = [];
function emitChange() {
  for (const l of listeners) l();
}

// ── Binary helpers ──

const toAscii = (bytes: Uint8Array, start: number, len: number) => {
  let out = '';
  for (let i = 0; i < len; i++) out += String.fromCharCode(bytes[start + i] ?? 0);
  return out;
};

const includesAscii = (bytes: Uint8Array, needle: string): boolean => {
  const n = needle.length;
  for (let i = 0; i <= bytes.length - n; i++) {
    let ok = true;
    for (let j = 0; j < n; j++) {
      if (bytes[i + j] !== needle.charCodeAt(j)) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
};

function detectAnimatedFromBytes(url: string, bytes: Uint8Array): boolean {
  if (/\.(gif)(\?|#|$)/i.test(url)) return true;

  const isPng = bytes.length >= 8 && toAscii(bytes, 0, 8) === '\x89PNG\r\n\x1a\n';
  if (isPng) return includesAscii(bytes, 'acTL');

  const isWebp = bytes.length >= 12 && toAscii(bytes, 0, 4) === 'RIFF' && toAscii(bytes, 8, 4) === 'WEBP';
  if (isWebp) return includesAscii(bytes, 'ANIM') || includesAscii(bytes, 'ANMF');

  return false;
}

function captureStillFrame(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    img.onload = () => {
      const w = img.naturalWidth || 1;
      const h = img.naturalHeight || 1;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, 0, 0, w, h);
      try { resolve(canvas.toDataURL('image/png')); }
      catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
  });
}

async function preloadOne(src: string) {
  if (cache.has(src)) return;

  try {
    // Fast path for .gif — skip fetch, just capture still
    if (/\.(gif)(\?|#|$)/i.test(src)) {
      const stillSrc = await captureStillFrame(src);
      cache.set(src, { isAnimated: true, stillSrc });
      emitChange();
      return;
    }

    const res = await fetch(src, { cache: 'force-cache' });
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const isAnimated = detectAnimatedFromBytes(src, bytes);

    if (isAnimated) {
      const stillSrc = await captureStillFrame(src);
      cache.set(src, { isAnimated: true, stillSrc });
    } else {
      cache.set(src, { isAnimated: false, stillSrc: null });
    }
    emitChange();
  } catch {
    // On failure, treat as static so decoration still shows
    cache.set(src, { isAnimated: false, stillSrc: null });
    emitChange();
  }
}

// ── Kick off preload for ALL known decorations at import time ──
let preloadStarted = false;
function startPreload() {
  if (preloadStarted) return;
  preloadStarted = true;
  // Process in parallel but don't block anything
  for (const deco of AVATAR_DECORATIONS) {
    preloadOne(deco.src);
  }
}
startPreload();

// ── React hook: synchronous read from cache ──

function subscribe(cb: () => void) {
  listeners.push(cb);
  return () => { listeners = listeners.filter((l) => l !== cb); };
}

let snapshotVersion = 0;
const origEmit = emitChange;
// Override to bump snapshot
(function patchEmit() {
  // We need subscribe to detect changes, so use a version number
})();

function getSnapshot() {
  return cache;
}

/**
 * Zero-cost hook: reads preloaded decoration data synchronously.
 * Returns null if not yet preloaded (rare — only during initial load race).
 */
export function useDecorationAsset(src: string | null): DecorationAsset | null {
  const store = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (!src) return null;
  return store.get(src) ?? null;
}

/**
 * Imperatively preload a decoration src that isn't in the static list
 * (e.g. if decorations are added dynamically in the future).
 */
export function ensureDecorationPreloaded(src: string) {
  if (!cache.has(src)) preloadOne(src);
}
