// ── Types matching actual Klipy API response ───────────────────────────

export interface KlipyFileVariant {
  url: string;
  width: number;
  height: number;
  size: number;
}

export interface KlipySizeGroup {
  gif?: KlipyFileVariant;
  webp?: KlipyFileVariant;
  jpg?: KlipyFileVariant;
  mp4?: KlipyFileVariant;
  webm?: KlipyFileVariant;
}

export interface KlipyGif {
  id: number;
  slug: string;
  title: string;
  file: {
    hd?: KlipySizeGroup;
    md?: KlipySizeGroup;
    sm?: KlipySizeGroup;
    xs?: KlipySizeGroup;
  };
}

export interface KlipyCategory {
  category: string;
  query: string;
  preview_url: string;
}

// ── Direct fetch to edge function (bypasses custom supabase fetch wrapper) ──

import { getKeyHashAsync } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvcXV1Y3VybndwcWN2Z3F1a3B6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2ODUwNjEsImV4cCI6MjA4NzA0NTA2MX0.XgkhNWxe7CHzeyc8PrXJKztuT6oxFYXX1T8Fab1N6QA";

async function callProxy(body: Record<string, unknown>): Promise<any> {
  try {
    const keyHash = await getKeyHashAsync();
    if (!keyHash) {
      console.warn("[klipyApi] Not authenticated — skipping request");
      return null;
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/klipy-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "apikey": SUPABASE_ANON_KEY,
        "x-key-hash": keyHash,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("[klipyApi] Edge function HTTP error:", res.status);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error("[klipyApi] Fetch error:", err);
    return null;
  }
}

function extractGifs(data: any): KlipyGif[] {
  const gifs = data?.data?.data ?? data?.data ?? [];
  if (!Array.isArray(gifs)) {
    console.warn("[klipyApi] Unexpected response shape:", JSON.stringify(data)?.substring(0, 300));
    return [];
  }
  return gifs;
}

// ── API Functions ──────────────────────────────────────────────────────

export async function fetchTrendingGifs(perPage = 24, userId?: string): Promise<KlipyGif[]> {
  const data = await callProxy({ action: "trending", perPage, userId: userId || "anonymous" });
  return extractGifs(data);
}

export async function searchGifs(query: string, perPage = 24, userId?: string): Promise<KlipyGif[]> {
  const data = await callProxy({ action: "search", query, perPage, userId: userId || "anonymous" });
  return extractGifs(data);
}

export async function fetchRecentGifs(userId: string, perPage = 24): Promise<KlipyGif[]> {
  const data = await callProxy({ action: "recent", userId, perPage });
  return extractGifs(data);
}

export async function fetchCategories(locale = "en-US"): Promise<KlipyCategory[]> {
  const data = await callProxy({ action: "categories", locale });
  const categories = data?.data?.categories ?? data?.categories ?? [];
  if (!Array.isArray(categories)) {
    console.warn("[klipyApi] Unexpected categories shape:", JSON.stringify(data)?.substring(0, 300));
    return [];
  }
  return categories;
}

export async function shareGif(slug: string, userId?: string): Promise<void> {
  callProxy({ action: "share", slug, userId: userId || "anonymous" }).catch(() => {
    // Fire-and-forget
  });
}
