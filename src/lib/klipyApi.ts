const API_KEY = import.meta.env.VITE_KLIPY_API_KEY as string | undefined;
const BASE_URL = `https://api.klipy.com/api/v1`;

function baseUrl(): string {
  if (!API_KEY) {
    console.warn("[klipyApi] VITE_KLIPY_API_KEY is not set");
    return BASE_URL;
  }
  return `${BASE_URL}/${API_KEY}`;
}

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

// ── API Functions ──────────────────────────────────────────────────────

export async function fetchTrendingGifs(limit = 24): Promise<KlipyGif[]> {
  const url = `${baseUrl()}/gifs/trending?limit=${limit}&locale=en-US`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Klipy trending failed: ${res.status}`);
  const data = await res.json();
  return data?.data ?? data ?? [];
}

export async function searchGifs(query: string, limit = 24): Promise<KlipyGif[]> {
  const url = `${baseUrl()}/gifs/search?q=${encodeURIComponent(query)}&limit=${limit}&locale=en-US`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Klipy search failed: ${res.status}`);
  const data = await res.json();
  return data?.data ?? data ?? [];
}

export async function fetchRecentGifs(userId: string, limit = 24): Promise<KlipyGif[]> {
  const url = `${baseUrl()}/gifs/recent/${encodeURIComponent(userId)}?limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Klipy recent failed: ${res.status}`);
  const data = await res.json();
  return data?.data ?? data ?? [];
}

export async function shareGif(gifId: string, userId: string): Promise<void> {
  await fetch(`${baseUrl()}/gifs/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gif_id: gifId, customer_id: userId }),
  }).catch(() => {
    // Fire-and-forget — don't block the user
  });
}
