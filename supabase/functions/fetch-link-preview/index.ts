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
  spotifyType?: string; // For Spotify (track, album, playlist, episode, show)
  spotifyId?: string; // For Spotify
  soundcloudUrl?: string; // For SoundCloud embed URL
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
  return preview;
}

// SSRF protection: Block private IPs and cloud metadata endpoints
const BLOCKED_IP_PATTERNS = [
  /^127\./,                           // localhost
  /^10\./,                            // private class A
  /^172\.(1[6-9]|2[0-9]|3[01])\./,   // private class B
  /^192\.168\./,                      // private class C
  /^169\.254\./,                      // link-local (AWS metadata)
  /^0\./,                             // reserved
  /^::1$/,                            // IPv6 localhost
  /^fc00:/i,                          // IPv6 private
  /^fe80:/i,                          // IPv6 link-local
  /^fd[0-9a-f]{2}:/i,                // IPv6 private
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./, // Carrier-grade NAT
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

// Check if an IP address is private/internal
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

// Validate URL is safe to fetch (prevents SSRF + DNS rebinding)
async function isUrlSafe(urlString: string): Promise<{ safe: boolean; error?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { safe: false, error: 'Invalid URL format' };
  }

  // Only allow http/https protocols
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { safe: false, error: 'Only HTTP(S) protocols allowed' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block known metadata/internal hostnames
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { safe: false, error: 'Blocked hostname' };
  }

  // For direct IP addresses, validate immediately
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    if (isPrivateIp(hostname)) {
      return { safe: false, error: 'Private IP addresses not allowed' };
    }
    return { safe: true };
  }

  // For domain names, resolve DNS and validate ALL resolved IPs
  // This prevents DNS rebinding attacks (TOCTOU)
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
  
  // Parse URL for favicon fallback
  try {
    const urlObj = new URL(url);
    preview.favicon = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
    preview.siteName = urlObj.hostname.replace('www.', '');
  } catch {
    // Ignore URL parsing failure; preview continues with best-effort metadata.
  }
  
  // Helper to extract content from meta tags
  const getMetaContent = (property: string): string | undefined => {
    // Try og: prefix first
    let match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["'](?:og:)?${property}["'][^>]+content=["']([^"']+)["']`, 'i'));
    if (!match) {
      match = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:)?${property}["']`, 'i'));
    }
    // Try twitter: prefix
    if (!match) {
      match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']twitter:${property}["'][^>]+content=["']([^"']+)["']`, 'i'));
    }
    return match?.[1];
  };
  
  // Extract title
  preview.title = getMetaContent('title');
  if (!preview.title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    preview.title = titleMatch?.[1]?.trim();
  }
  
  // Extract description
  preview.description = getMetaContent('description');
  
  // Extract image
  preview.image = getMetaContent('image');
  if (preview.image && !preview.image.startsWith('http')) {
    try {
      const urlObj = new URL(url);
      preview.image = new URL(preview.image, urlObj.origin).href;
    } catch {
      // Ignore malformed relative image URL.
    }
  }
  
  // Extract site name
  const siteName = getMetaContent('site_name');
  if (siteName) preview.siteName = siteName;
  
  // Extract type
  preview.type = getMetaContent('type');
  
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

// Extract Spotify track/album/playlist/episode ID and type
function getSpotifyInfo(url: string): { type: string; id: string } | null {
  const patterns = [
    /open\.spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/,
    /spotify\.link\/([a-zA-Z0-9]+)/, // Short links - treat as track
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createServiceClient();
    const auth = await getAuthContext(supabase, req);
    const rateOk = await enforceRateLimit(supabase, auth.scopeBase, 'edge_link_preview', 60, 60);
    if (!rateOk) {
      return new Response(
        JSON.stringify({ error: 'Rate limited: too many link previews' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { url } = await req.json();

    if (!url || typeof url !== 'string' || url.length > 2048) {
      return new Response(
        JSON.stringify({ error: !url ? 'URL is required' : 'URL too long (max 2048 characters)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SSRF protection: Validate URL before fetching
    const urlValidation = await isUrlSafe(url);
    if (!urlValidation.safe) {
      console.log(`Blocked unsafe URL: ${url} - ${urlValidation.error}`);
      return new Response(
        JSON.stringify({ error: urlValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching link preview for:', url);

    // Handle direct images
    if (isDirectImage(url)) {
      const proxiedImage = await proxyExternalAssetUrl(url);
      return new Response(
        JSON.stringify({
          url,
          type: 'image',
          image: proxiedImage,
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
          } 
        }
      );
    }

    // Handle YouTube
    const youtubeId = getYouTubeVideoId(url);
    if (youtubeId) {
      // Fetch YouTube oEmbed data
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const oembedResponse = await fetch(oembedUrl, { 
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        if (oembedResponse.ok) {
          const oembed = await oembedResponse.json();
          const preview = await proxyPreviewAssets({
            url,
            type: 'youtube',
            videoId: youtubeId,
            title: oembed.title,
            description: oembed.author_name,
            image: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`,
            siteName: 'YouTube',
            favicon: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=32',
          });
          return new Response(
            JSON.stringify(preview),
            { 
              headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
              } 
            }
          );
        }
      } catch (e) {
        console.log('YouTube oEmbed failed, continuing with basic info');
      }
      
      // Fallback for YouTube
      const preview = await proxyPreviewAssets({
        url,
        type: 'youtube',
        videoId: youtubeId,
        image: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`,
        siteName: 'YouTube',
        favicon: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=32',
      });
      return new Response(
        JSON.stringify(preview),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=86400',
          } 
        }
      );
    }

    // Handle Twitter/X - mark as twitter type
    if (isTwitterUrl(url)) {
      const preview = await proxyPreviewAssets({
        url,
        type: 'twitter',
        siteName: 'X (Twitter)',
        favicon: 'https://www.google.com/s2/favicons?domain=x.com&sz=32',
      });
      return new Response(
        JSON.stringify(preview),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600',
          } 
        }
      );
    }

    // Handle Spotify
    const spotifyInfo = getSpotifyInfo(url);
    if (spotifyInfo) {
      // Fetch the page to get Open Graph metadata for title/description
      try {
        const response = await fetchSafeWithRedirects(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)',
            'Accept': 'text/html,application/xhtml+xml',
          },
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });
        
        if (response.ok) {
          const html = await response.text();
          const preview = extractMetadata(html, url);
          const proxied = await proxyPreviewAssets({
            url,
            type: 'spotify',
            spotifyType: spotifyInfo.type,
            spotifyId: spotifyInfo.id,
            title: preview.title,
            description: preview.description,
            image: preview.image,
            siteName: 'Spotify',
            favicon: 'https://www.google.com/s2/favicons?domain=spotify.com&sz=32',
          });
          
          return new Response(
            JSON.stringify(proxied),
            { 
              headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=3600',
              } 
            }
          );
        }
      } catch (e) {
        console.log('Spotify metadata fetch failed, using basic info');
      }
      
      // Fallback for Spotify
      const preview = await proxyPreviewAssets({
        url,
        type: 'spotify',
        spotifyType: spotifyInfo.type,
        spotifyId: spotifyInfo.id,
        siteName: 'Spotify',
        favicon: 'https://www.google.com/s2/favicons?domain=spotify.com&sz=32',
      });
      return new Response(
        JSON.stringify(preview),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600',
          } 
        }
      );
    }

    // Handle SoundCloud
    if (isSoundCloudUrl(url)) {
      try {
        // Use oEmbed API to get the embed URL
        const oembedUrl = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`;
        const response = await fetch(oembedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)',
          },
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });
        
        if (response.ok) {
          const data = await response.json();
          // Extract the iframe src from the html field
          const iframeSrcMatch = data.html?.match(/src="([^"]+)"/);
          const embedUrl = iframeSrcMatch ? iframeSrcMatch[1] : null;
          const preview = await proxyPreviewAssets({
            url,
            type: 'soundcloud',
            title: data.title,
            description: data.description,
            image: data.thumbnail_url,
            siteName: 'SoundCloud',
            favicon: 'https://www.google.com/s2/favicons?domain=soundcloud.com&sz=32',
            soundcloudUrl: embedUrl,
          });
          
          return new Response(
            JSON.stringify(preview),
            { 
              headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=3600',
              } 
            }
          );
        }
      } catch (e) {
        console.log('SoundCloud oEmbed fetch failed:', e);
      }
      
      // Fallback for SoundCloud
      const preview = await proxyPreviewAssets({
        url,
        type: 'soundcloud',
        siteName: 'SoundCloud',
        favicon: 'https://www.google.com/s2/favicons?domain=soundcloud.com&sz=32',
      });
      return new Response(
        JSON.stringify(preview),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600',
          } 
        }
      );
    }

    // General URL fetch with timeout and size limit
    const response = await fetchSafeWithRedirects(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    // If fetch fails (403, 401, etc.), return basic preview with domain info
    if (!response.ok) {
      try {
        const urlObj = new URL(url);
        const preview = await proxyPreviewAssets({
          url,
          siteName: urlObj.hostname.replace('www.', ''),
          favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`,
        });
        return new Response(
          JSON.stringify(preview),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch {
        return new Response(
          JSON.stringify({ url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const contentType = response.headers.get('content-type') || '';
    
    // Check if it's an image
    if (contentType.startsWith('image/')) {
      const proxiedImage = await proxyExternalAssetUrl(url);
      return new Response(
        JSON.stringify({
          url,
          type: 'image',
          image: proxiedImage,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse HTML (limit to first 512KB to prevent memory issues)
    const reader = response.body?.getReader();
    let html = '';
    let bytesRead = 0;
    const maxBytes = 512 * 1024; // 512KB limit
    
    if (reader) {
      const decoder = new TextDecoder();
      while (bytesRead < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        bytesRead += value.length;
        html += decoder.decode(value, { stream: true });
      }
      reader.cancel(); // Cancel if we hit the limit
    }
    
    const preview = extractMetadata(html, url);
    await proxyPreviewAssets(preview);

    console.log('Link preview extracted:', preview.title);

    return new Response(
      JSON.stringify(preview),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          // Cache link previews for 1 hour to reduce repeated edge function calls
          'Cache-Control': 'public, max-age=3600',
        } 
      }
    );
  } catch (error) {
    console.error('Error fetching link preview:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch preview';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
