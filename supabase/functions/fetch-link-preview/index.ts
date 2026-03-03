import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, enforceRateLimit, getAuthContext } from "../_shared/edgeSecurity.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-key-hash',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
  type?: string;
  videoId?: string; // For YouTube
  spotifyType?: string;
  spotifyId?: string;
  soundcloudUrl?: string;
  // Platform-specific IDs
  twitterId?: string;
  redditSubreddit?: string;
  redditPostId?: string;
  redditAuthor?: string;
  redditScore?: string;
  redditComments?: string;
  linkedinType?: string; // post, article, profile, company
  facebookType?: string; // post, video, page
  facebookVideoId?: string;
  // Steam enriched data
  steamId?: string;
  steamPrice?: string;
  steamOriginalPrice?: string;
  steamDiscount?: string;
  steamActionText?: string;
  steamReleaseDate?: string;
  steamDeveloper?: string;
  steamReviewSummary?: string;
  steamTags?: string[];
  // Author info (generic)
  author?: string;
  authorAvatar?: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LINK_PREVIEW_PROXY_SECRET = Deno.env.get("LINK_PREVIEW_PROXY_SECRET") || SUPABASE_SERVICE_ROLE_KEY;
const LINK_PREVIEW_PROXY_FUNCTION = "fetch-link-preview-asset";
const LINK_PREVIEW_PROXY_TTL_SECONDS = 60 * 60 * 24; // 24h

const textEncoder = new TextEncoder();
let signingKeyPromise: Promise<CryptoKey> | null = null;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function getSigningKey(): Promise<CryptoKey> {
  if (!LINK_PREVIEW_PROXY_SECRET) {
    throw new Error("Missing link preview proxy signing secret");
  }
  if (!signingKeyPromise) {
    signingKeyPromise = crypto.subtle.importKey(
      "raw",
      textEncoder.encode(LINK_PREVIEW_PROXY_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  }
  return signingKeyPromise;
}

async function signPayload(payload: string): Promise<string> {
  const key = await getSigningKey();
  const sigBuffer = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));
  return toBase64Url(new Uint8Array(sigBuffer));
}

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isAlreadyProxiedAssetUrl(url: string): boolean {
  if (!SUPABASE_URL) return false;
  try {
    const parsed = new URL(url);
    const supabaseHost = new URL(SUPABASE_URL).host;
    return parsed.host === supabaseHost && parsed.pathname.endsWith(`/${LINK_PREVIEW_PROXY_FUNCTION}`);
  } catch {
    return false;
  }
}

async function buildSignedAssetProxyUrl(targetUrl: string): Promise<string | null> {
  if (!SUPABASE_URL || !LINK_PREVIEW_PROXY_SECRET) return null;
  const exp = Math.floor(Date.now() / 1000) + LINK_PREVIEW_PROXY_TTL_SECONDS;
  const sig = await signPayload(`${exp}:${targetUrl}`);
  const proxyUrl = new URL(`${SUPABASE_URL.replace(/\/+$/g, "")}/functions/v1/${LINK_PREVIEW_PROXY_FUNCTION}`);
  proxyUrl.searchParams.set("u", targetUrl);
  proxyUrl.searchParams.set("exp", String(exp));
  proxyUrl.searchParams.set("sig", sig);
  return proxyUrl.toString();
}

async function proxyExternalAssetUrl(assetUrl?: string): Promise<string | undefined> {
  if (!assetUrl) return undefined;
  if (!isHttpUrl(assetUrl)) return assetUrl;
  if (isAlreadyProxiedAssetUrl(assetUrl)) return assetUrl;

  const safe = await isUrlSafe(assetUrl);
  if (!safe.safe) return undefined;

  const proxied = await buildSignedAssetProxyUrl(assetUrl);
  return proxied ?? undefined;
}

async function proxyPreviewAssets(preview: LinkPreview): Promise<LinkPreview> {
  preview.image = await proxyExternalAssetUrl(preview.image);
  preview.favicon = await proxyExternalAssetUrl(preview.favicon);
  preview.authorAvatar = await proxyExternalAssetUrl(preview.authorAvatar);
  return preview;
}

// SSRF protection: Block private IPs and cloud metadata endpoints
const BLOCKED_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^fd[0-9a-f]{2}:/i,
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./,
];

const BLOCKED_HOSTNAMES = [
  'localhost',
  'metadata.google.internal',
  'metadata',
  'metadata.azure.com',
  'instance-data',
  'kubernetes.default',
  'kubernetes.default.svc',
  'kubernetes',
];

function isPrivateIp(ip: string): boolean {
  if (BLOCKED_IP_PATTERNS.some(pattern => pattern.test(ip))) return true;
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 0 || parts[0] === 127 || parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
  }
  return false;
}

async function isUrlSafe(urlString: string): Promise<{ safe: boolean; error?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { safe: false, error: 'Invalid URL format' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { safe: false, error: 'Only HTTP(S) protocols allowed' };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { safe: false, error: 'Blocked hostname' };
  }

  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    if (isPrivateIp(hostname)) {
      return { safe: false, error: 'Private IP addresses not allowed' };
    }
    return { safe: true };
  }

  try {
    const addresses = await Deno.resolveDns(hostname, 'A');
    if (!addresses || addresses.length === 0) {
      return { safe: false, error: 'DNS resolution returned no addresses' };
    }
    for (const ip of addresses) {
      if (isPrivateIp(ip)) {
        return { safe: false, error: 'Domain resolves to private IP' };
      }
    }
  } catch {
    return { safe: false, error: 'DNS resolution failed' };
  }

  return { safe: true };
}

async function fetchSafeWithRedirects(
  initialUrl: string,
  init: RequestInit,
  maxRedirects = 3,
): Promise<Response> {
  let currentUrl = initialUrl;

  for (let i = 0; i <= maxRedirects; i++) {
    const validation = await isUrlSafe(currentUrl);
    if (!validation.safe) {
      throw new Error(validation.error || "Unsafe redirect target");
    }

    const response = await fetch(currentUrl, {
      ...init,
      redirect: 'manual',
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        return response;
      }

      currentUrl = new URL(location, currentUrl).href;
      continue;
    }

    return response;
  }

  throw new Error('Too many redirects');
}

// Extract Open Graph and meta tags from HTML
function extractMetadata(html: string, url: string): LinkPreview {
  const preview: LinkPreview = { url };
  
  try {
    const urlObj = new URL(url);
    preview.favicon = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
    preview.siteName = urlObj.hostname.replace('www.', '');
  } catch {
    // Ignore URL parsing failure
  }
  
  const getMetaContent = (property: string): string | undefined => {
    let match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["'](?:og:)?${property}["'][^>]+content=["']([^"']+)["']`, 'i'));
    if (!match) {
      match = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:)?${property}["']`, 'i'));
    }
    if (!match) {
      match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']twitter:${property}["'][^>]+content=["']([^"']+)["']`, 'i'));
    }
    return match?.[1];
  };
  
  preview.title = getMetaContent('title');
  if (!preview.title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    preview.title = titleMatch?.[1]?.trim();
  }
  
  preview.description = getMetaContent('description');
  
  preview.image = getMetaContent('image');
  if (preview.image && !preview.image.startsWith('http')) {
    try {
      const urlObj = new URL(url);
      preview.image = new URL(preview.image, urlObj.origin).href;
    } catch {
      // Ignore malformed relative image URL
    }
  }
  
  const siteName = getMetaContent('site_name');
  if (siteName) preview.siteName = siteName;
  
  preview.type = getMetaContent('type');

  // Extract author if available
  const author = getMetaContent('author') || getMetaContent('article:author');
  if (author) preview.author = author;
  
  return preview;
}

// Check if URL is a direct image
function isDirectImage(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(url);
}

// Extract YouTube video ID
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Check if URL is Twitter/X
function isTwitterUrl(url: string): boolean {
  return /(?:twitter\.com|x\.com)\/\w+\/status\/\d+/.test(url);
}

function getTwitterPostId(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/);
  return match ? match[2] : null;
}

function getTwitterAuthor(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/(\w+)\/status\/\d+/);
  return match ? match[1] : null;
}

// Extract Spotify info
function getSpotifyInfo(url: string): { type: string; id: string } | null {
  const patterns = [
    /open\.spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/,
    /spotify\.link\/([a-zA-Z0-9]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      if (pattern.source.includes('spotify\\.link')) {
        return { type: 'track', id: match[1] };
      }
      return { type: match[1], id: match[2] };
    }
  }
  return null;
}

// Check if URL is SoundCloud
function isSoundCloudUrl(url: string): boolean {
  return /soundcloud\.com\/[\w-]+\/[\w-]+/.test(url);
}

// ── LinkedIn detection ──
function isLinkedInUrl(url: string): boolean {
  return /linkedin\.com\/(posts|pulse|feed|in|company)\//.test(url);
}

function getLinkedInType(url: string): string {
  if (/linkedin\.com\/posts\//.test(url)) return 'post';
  if (/linkedin\.com\/pulse\//.test(url)) return 'article';
  if (/linkedin\.com\/in\//.test(url)) return 'profile';
  if (/linkedin\.com\/company\//.test(url)) return 'company';
  return 'post';
}

// ── Reddit detection ──
function isRedditUrl(url: string): boolean {
  return /(?:reddit\.com|old\.reddit\.com)\/r\//.test(url);
}

function getRedditInfo(url: string): { subreddit?: string; postId?: string } | null {
  const match = url.match(/reddit\.com\/r\/([\w]+)(?:\/comments\/([\w]+))?/);
  if (match) {
    return { subreddit: match[1], postId: match[2] || undefined };
  }
  return null;
}

// ── Facebook detection ──
function isFacebookUrl(url: string): boolean {
  return /(?:facebook\.com|fb\.com|fb\.watch)\//.test(url);
}

function getFacebookType(url: string): string {
  if (/(?:facebook\.com|fb\.com)\/.*\/videos\//.test(url) || /fb\.watch/.test(url)) return 'video';
  if (/(?:facebook\.com|fb\.com)\/.*\/posts\//.test(url)) return 'post';
  if (/(?:facebook\.com|fb\.com)\/(?:photo|media)/.test(url)) return 'photo';
  if (/(?:facebook\.com|fb\.com)\/events\//.test(url)) return 'event';
  return 'page';
}

function getFacebookVideoId(url: string): string | null {
  const match = url.match(/\/videos\/(\d+)/);
  return match ? match[1] : null;
}

// ── Steam detection ──
function getSteamAppId(url: string): string | null {
  const match = url.match(/store\.steampowered\.com\/app\/(\d+)/);
  return match ? match[1] : null;
}

// Extract Steam-specific data from HTML
function extractSteamData(html: string, preview: LinkPreview): void {
  // Extract price
  const priceMatch = html.match(/class="game_purchase_price[^"]*"[^>]*>([^<]+)</i) 
    || html.match(/class="discount_final_price"[^>]*>([^<]+)</i);
  if (priceMatch) {
    preview.steamPrice = priceMatch[1].trim();
  }

  // Extract original price (if discounted)
  const origPriceMatch = html.match(/class="discount_original_price"[^>]*>([^<]+)</i);
  if (origPriceMatch) {
    preview.steamOriginalPrice = origPriceMatch[1].trim();
  }

  // Extract discount percentage
  const discountMatch = html.match(/class="discount_pct"[^>]*>([^<]+)</i);
  if (discountMatch) {
    preview.steamDiscount = discountMatch[1].trim();
  }

  // Extract action button text (Add to Cart, Free to Play, etc.)
  const actionMatch = html.match(/class="btn_addtocart[^"]*"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/i)
    || html.match(/class="game_area_purchase_game_wrapper"[\s\S]*?<a[^>]*class="[^"]*btn_green_steamui[^"]*"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/i);
  if (actionMatch) {
    preview.steamActionText = actionMatch[1].trim();
  }

  // Check for Free to Play
  if (!preview.steamPrice) {
    if (/class="game_area_purchase_game_wrapper"[\s\S]*?Free to Play/i.test(html)) {
      preview.steamPrice = 'Free to Play';
      preview.steamActionText = preview.steamActionText || 'Play Game';
    }
  }

  // Extract release date
  const releaseDateMatch = html.match(/class="date"[^>]*>([^<]+)</i);
  if (releaseDateMatch) {
    preview.steamReleaseDate = releaseDateMatch[1].trim();
  }

  // Extract developer
  const devMatch = html.match(/id="developers_list"[^>]*>[\s\S]*?<a[^>]*>([^<]+)</i);
  if (devMatch) {
    preview.steamDeveloper = devMatch[1].trim();
  }

  // Extract review summary
  const reviewMatch = html.match(/class="game_review_summary[^"]*"[^>]*data-tooltip-html="([^"]+)"/i);
  if (reviewMatch) {
    preview.steamReviewSummary = reviewMatch[1].replace(/&amp;/g, '&').replace(/<[^>]+>/g, '').trim();
  }

  // Extract popular tags (first 3)
  const tagsMatch = html.match(/class="app_tag"[^>]*>([^<]+)/gi);
  if (tagsMatch) {
    preview.steamTags = tagsMatch
      .slice(0, 4)
      .map(t => t.replace(/.*>/, '').trim())
      .filter(t => t.length > 0);
  }
}

// Extract Reddit-specific data from HTML
function extractRedditData(html: string, preview: LinkPreview): void {
  // Try to get author from meta
  const authorMatch = html.match(/<meta[^>]+(?:property|name)=["'](?:og:)?author["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/posted by[^<]*u\/([\w-]+)/i);
  if (authorMatch) {
    preview.redditAuthor = authorMatch[1].replace(/^u\//, '');
  }

  // Try to get score/upvotes from structured data
  const scoreMatch = html.match(/"score"\s*:\s*(\d+)/);
  if (scoreMatch) {
    preview.redditScore = scoreMatch[1];
  }

  // Try to get comment count
  const commentsMatch = html.match(/"num_comments"\s*:\s*(\d+)/)
    || html.match(/(\d+)\s*comments?/i);
  if (commentsMatch) {
    preview.redditComments = commentsMatch[1];
  }
}

// ── Shared fetch helpers ──
const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

const FETCH_TIMEOUT = 10000;

function jsonResponse(data: unknown, status = 200, cacheMaxAge = 3600): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(cacheMaxAge > 0 ? { 'Cache-Control': `public, max-age=${cacheMaxAge}` } : {}),
    },
  });
}

async function fetchAndExtract(url: string): Promise<{ html: string; preview: LinkPreview } | null> {
  try {
    const response = await fetchSafeWithRedirects(url, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });

    if (!response.ok) return null;

    const reader = response.body?.getReader();
    let html = '';
    let bytesRead = 0;
    const maxBytes = 512 * 1024;

    if (reader) {
      const decoder = new TextDecoder();
      while (bytesRead < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        bytesRead += value.length;
        html += decoder.decode(value, { stream: true });
      }
      reader.cancel();
    }

    const preview = extractMetadata(html, url);
    return { html, preview };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, 0);
  }

  try {
    const supabase = createServiceClient();
    const auth = await getAuthContext(supabase, req);
    const rateOk = await enforceRateLimit(supabase, auth.scopeBase, 'edge_link_preview', 60, 60);
    if (!rateOk) {
      return jsonResponse({ error: 'Rate limited: too many link previews' }, 429, 0);
    }

    const { url } = await req.json();

    if (!url || typeof url !== 'string' || url.length > 2048) {
      return jsonResponse({ error: !url ? 'URL is required' : 'URL too long (max 2048 characters)' }, 400, 0);
    }

    const urlValidation = await isUrlSafe(url);
    if (!urlValidation.safe) {
      console.log(`Blocked unsafe URL: ${url} - ${urlValidation.error}`);
      return jsonResponse({ error: urlValidation.error }, 400, 0);
    }

    console.log('Fetching link preview for:', url);

    // ── Direct images ──
    if (isDirectImage(url)) {
      const proxiedImage = await proxyExternalAssetUrl(url);
      return jsonResponse({ url, type: 'image', image: proxiedImage }, 200, 86400);
    }

    // ── YouTube ──
    const youtubeId = getYouTubeVideoId(url);
    if (youtubeId) {
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const oembedResponse = await fetch(oembedUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
        if (oembedResponse.ok) {
          const oembed = await oembedResponse.json();
          return jsonResponse(await proxyPreviewAssets({
            url, type: 'youtube', videoId: youtubeId,
            title: oembed.title, description: oembed.author_name,
            image: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`,
            siteName: 'YouTube',
            favicon: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=32',
          }), 200, 86400);
        }
      } catch {
        console.log('YouTube oEmbed failed, using fallback');
      }
      return jsonResponse(await proxyPreviewAssets({
        url, type: 'youtube', videoId: youtubeId,
        image: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`,
        siteName: 'YouTube',
        favicon: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=32',
      }), 200, 86400);
    }

    // ── Twitter/X ──
    if (isTwitterUrl(url)) {
      const twitterId = getTwitterPostId(url);
      const twitterAuthor = getTwitterAuthor(url);
      // Fetch OG metadata for title/description
      const fetched = await fetchAndExtract(url);
      const preview = await proxyPreviewAssets({
        url,
        type: 'twitter',
        twitterId: twitterId || undefined,
        author: twitterAuthor ? `@${twitterAuthor}` : undefined,
        title: fetched?.preview.title,
        description: fetched?.preview.description,
        image: fetched?.preview.image,
        siteName: 'X (Twitter)',
        favicon: 'https://www.google.com/s2/favicons?domain=x.com&sz=32',
      });
      return jsonResponse(preview);
    }

    // ── LinkedIn ──
    if (isLinkedInUrl(url)) {
      const linkedinType = getLinkedInType(url);
      const fetched = await fetchAndExtract(url);
      const preview = await proxyPreviewAssets({
        url,
        type: 'linkedin',
        linkedinType,
        title: fetched?.preview.title,
        description: fetched?.preview.description,
        image: fetched?.preview.image,
        author: fetched?.preview.author,
        siteName: 'LinkedIn',
        favicon: 'https://www.google.com/s2/favicons?domain=linkedin.com&sz=32',
      });
      return jsonResponse(preview);
    }

    // ── Reddit ──
    if (isRedditUrl(url)) {
      const redditInfo = getRedditInfo(url);
      const fetched = await fetchAndExtract(url);
      const preview: LinkPreview = {
        url,
        type: 'reddit',
        redditSubreddit: redditInfo?.subreddit,
        redditPostId: redditInfo?.postId,
        title: fetched?.preview.title,
        description: fetched?.preview.description,
        image: fetched?.preview.image,
        siteName: redditInfo?.subreddit ? `r/${redditInfo.subreddit}` : 'Reddit',
        favicon: 'https://www.google.com/s2/favicons?domain=reddit.com&sz=32',
      };
      // Extract Reddit-specific data
      if (fetched?.html) {
        extractRedditData(fetched.html, preview);
      }
      return jsonResponse(await proxyPreviewAssets(preview));
    }

    // ── Facebook ──
    if (isFacebookUrl(url)) {
      const fbType = getFacebookType(url);
      const fbVideoId = getFacebookVideoId(url);
      const fetched = await fetchAndExtract(url);
      const preview = await proxyPreviewAssets({
        url,
        type: 'facebook',
        facebookType: fbType,
        facebookVideoId: fbVideoId || undefined,
        title: fetched?.preview.title,
        description: fetched?.preview.description,
        image: fetched?.preview.image,
        author: fetched?.preview.author,
        siteName: 'Facebook',
        favicon: 'https://www.google.com/s2/favicons?domain=facebook.com&sz=32',
      });
      return jsonResponse(preview);
    }

    // ── Spotify ──
    const spotifyInfo = getSpotifyInfo(url);
    if (spotifyInfo) {
      const fetched = await fetchAndExtract(url);
      const preview = await proxyPreviewAssets({
        url, type: 'spotify',
        spotifyType: spotifyInfo.type, spotifyId: spotifyInfo.id,
        title: fetched?.preview.title, description: fetched?.preview.description,
        image: fetched?.preview.image,
        siteName: 'Spotify',
        favicon: 'https://www.google.com/s2/favicons?domain=spotify.com&sz=32',
      });
      return jsonResponse(preview);
    }

    // ── SoundCloud ──
    if (isSoundCloudUrl(url)) {
      try {
        const oembedUrl = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`;
        const response = await fetch(oembedUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)' },
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
        });
        if (response.ok) {
          const data = await response.json();
          const iframeSrcMatch = data.html?.match(/src="([^"]+)"/);
          const embedUrl = iframeSrcMatch ? iframeSrcMatch[1] : null;
          return jsonResponse(await proxyPreviewAssets({
            url, type: 'soundcloud',
            title: data.title, description: data.description,
            image: data.thumbnail_url, siteName: 'SoundCloud',
            favicon: 'https://www.google.com/s2/favicons?domain=soundcloud.com&sz=32',
            soundcloudUrl: embedUrl,
          }));
        }
      } catch {
        console.log('SoundCloud oEmbed failed');
      }
      return jsonResponse(await proxyPreviewAssets({
        url, type: 'soundcloud', siteName: 'SoundCloud',
        favicon: 'https://www.google.com/s2/favicons?domain=soundcloud.com&sz=32',
      }));
    }

    // ── Steam ──
    const steamId = getSteamAppId(url);
    if (steamId) {
      const fetched = await fetchAndExtract(url);
      const preview: LinkPreview = {
        url,
        type: 'steam',
        steamId,
        title: fetched?.preview.title?.replace(' on Steam', ''),
        description: fetched?.preview.description,
        image: fetched?.preview.image,
        siteName: 'Steam',
        favicon: 'https://www.google.com/s2/favicons?domain=store.steampowered.com&sz=32',
      };
      if (fetched?.html) {
        extractSteamData(fetched.html, preview);
      }
      // If no action text found, default based on price
      if (!preview.steamActionText) {
        if (preview.steamPrice === 'Free to Play') {
          preview.steamActionText = 'Play Game';
        } else if (preview.steamPrice) {
          preview.steamActionText = 'Add to Cart';
        }
      }
      return jsonResponse(await proxyPreviewAssets(preview), 200, 3600);
    }

    // ── General URL fetch ──
    const response = await fetchSafeWithRedirects(url, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });

    if (!response.ok) {
      try {
        const urlObj = new URL(url);
        return jsonResponse(await proxyPreviewAssets({
          url,
          siteName: urlObj.hostname.replace('www.', ''),
          favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`,
        }));
      } catch {
        return jsonResponse({ url });
      }
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.startsWith('image/')) {
      const proxiedImage = await proxyExternalAssetUrl(url);
      return jsonResponse({ url, type: 'image', image: proxiedImage });
    }

    const reader = response.body?.getReader();
    let html = '';
    let bytesRead = 0;
    const maxBytes = 512 * 1024;

    if (reader) {
      const decoder = new TextDecoder();
      while (bytesRead < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        bytesRead += value.length;
        html += decoder.decode(value, { stream: true });
      }
      reader.cancel();
    }

    const preview = extractMetadata(html, url);
    await proxyPreviewAssets(preview);

    console.log('Link preview extracted:', preview.title);
    return jsonResponse(preview);
  } catch (error) {
    console.error('Error fetching link preview:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch preview';
    return jsonResponse({ error: errorMessage }, 500, 0);
  }
});
