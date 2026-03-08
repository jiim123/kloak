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

// ── Direct fetch to edge function (bypasses custom supabase fetch wrapper) ──

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvcXV1Y3VybndwcWN2Z3F1a3B6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2ODUwNjEsImV4cCI6MjA4NzA0NTA2MX0.XgkhNWxe7CHzeyc8PrXJKztuT6oxFYXX1T8Fab1N6QA";

async function callProxy(body: Record<string, unknown>): Promise<KlipyGif[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/klipy-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("[klipyApi] Edge function HTTP error:", res.status);
      return [];
    }

    const data = await res.json();
    const gifs = data?.data?.data ?? data?.data ?? [];

    if (!Array.isArray(gifs)) {
      console.warn("[klipyApi] Unexpected response shape:", JSON.stringify(data)?.substring(0, 300));
      return [];
    }

    return gifs;
  } catch (err) {
    console.error("[klipyApi] Fetch error:", err);
    return [];
  }
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
  callProxy({ action: "share", slug, userId: userId || "anonymous" }).catch(() => {
    // Fire-and-forget
  });
}
