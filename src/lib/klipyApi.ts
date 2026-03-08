import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────────────

export interface KlipyGifFile {
  url: string;
  width: number;
  height: number;
}

export interface KlipyGif {
  id: string;
  title: string;
  files: {
    gif: KlipyGifFile;
    original: KlipyGifFile;
  };
}

// ── Internal helper ────────────────────────────────────────────────────

async function callProxy(body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke("klipy-proxy", { body });
  if (error) throw error;
  return data;
}

// ── API Functions ──────────────────────────────────────────────────────

export async function fetchTrendingGifs(limit = 24): Promise<KlipyGif[]> {
  const data = await callProxy({ action: "trending", limit }) as any;
  return data?.data ?? data ?? [];
}

export async function searchGifs(query: string, limit = 24): Promise<KlipyGif[]> {
  const data = await callProxy({ action: "search", query, limit }) as any;
  return data?.data ?? data ?? [];
}

export async function fetchRecentGifs(userId: string, limit = 24): Promise<KlipyGif[]> {
  const data = await callProxy({ action: "recent", userId, limit }) as any;
  return data?.data ?? data ?? [];
}

export async function shareGif(gifId: string, userId: string): Promise<void> {
  callProxy({ action: "share", gifId, userId }).catch(() => {
    // Fire-and-forget
  });
}
