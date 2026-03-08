import { supabase } from "@/integrations/supabase/client";

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

// ── Internal helper ────────────────────────────────────────────────────

async function callProxy(body: Record<string, unknown>): Promise<KlipyGif[]> {
  const { data, error } = await supabase.functions.invoke("klipy-proxy", { body });

  if (error) {
    console.error("[klipyApi] Edge function error:", error);
    return [];
  }

  // The edge function returns the raw Klipy response: { result: true, data: { data: [...], ... } }
  // supabase.functions.invoke parses the JSON, so `data` here is the full Klipy response object.
  const gifs = data?.data?.data ?? data?.data ?? [];

  if (!Array.isArray(gifs)) {
    console.warn("[klipyApi] Unexpected response shape:", JSON.stringify(data)?.substring(0, 300));
    return [];
  }

  return gifs;
}

// ── API Functions ──────────────────────────────────────────────────────

export async function fetchTrendingGifs(perPage = 24, userId?: string): Promise<KlipyGif[]> {
  return callProxy({ action: "trending", perPage, userId: userId || "anonymous" });
}

export async function searchGifs(query: string, perPage = 24, userId?: string): Promise<KlipyGif[]> {
  return callProxy({ action: "search", query, perPage, userId: userId || "anonymous" });
}

export async function fetchRecentGifs(userId: string, perPage = 24): Promise<KlipyGif[]> {
  return callProxy({ action: "recent", userId, perPage });
}

export async function shareGif(slug: string, userId?: string): Promise<void> {
  supabase.functions.invoke("klipy-proxy", {
    body: { action: "share", slug, userId: userId || "anonymous" },
  }).catch(() => {
    // Fire-and-forget
  });
}
