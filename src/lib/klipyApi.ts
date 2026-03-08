import { supabase } from "@/integrations/supabase/client";

// ── Types matching actual Klipy API response ───────────────────────────

export interface KlipyFileVariant {
  url: string;
  width: number;
  height: number;
  size: number;
}

export interface KlipySizeGroup {
  gif: KlipyFileVariant;
  webp: KlipyFileVariant;
  jpg: KlipyFileVariant;
  mp4: KlipyFileVariant;
  webm: KlipyFileVariant;
}

export interface KlipyGif {
  id: number;
  slug: string;
  title: string;
  file: {
    hd: KlipySizeGroup;
    md: KlipySizeGroup;
    sm: KlipySizeGroup;
    xs: KlipySizeGroup;
  };
}

// ── Internal helper ────────────────────────────────────────────────────

async function callProxy(body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke("klipy-proxy", { body });
  if (error) throw error;
  return data;
}

// ── API Functions ──────────────────────────────────────────────────────

export async function fetchTrendingGifs(perPage = 24, userId?: string): Promise<KlipyGif[]> {
  const res = await callProxy({ action: "trending", perPage, userId }) as any;
  return res?.data?.data ?? [];
}

export async function searchGifs(query: string, perPage = 24, userId?: string): Promise<KlipyGif[]> {
  const res = await callProxy({ action: "search", query, perPage, userId }) as any;
  return res?.data?.data ?? [];
}

export async function fetchRecentGifs(userId: string, perPage = 24): Promise<KlipyGif[]> {
  const res = await callProxy({ action: "recent", userId, perPage }) as any;
  return res?.data?.data ?? [];
}

export async function shareGif(slug: string, userId?: string): Promise<void> {
  callProxy({ action: "share", slug, userId }).catch(() => {
    // Fire-and-forget
  });
}
