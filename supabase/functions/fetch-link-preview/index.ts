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

// Validate URL is safe to fetch (prevents SSRF)
function isUrlSafe(urlString: string): { safe: boolean; error?: string } {
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

  // Block private IP addresses
  if (BLOCKED_IP_PATTERNS.some(pattern => pattern.test(hostname))) {
    return { safe: false, error: 'Private IP addresses not allowed' };
  }

  // Block numeric IPs that resolve to internal ranges (additional check)
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    const parts = hostname.split('.').map(Number);
    // Additional IP range checks
    if (parts[0] === 0 || parts[0] === 127 || parts[0] === 10) {
      return { safe: false, error: 'Private IP addresses not allowed' };
    }
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
      return { safe: false, error: 'Private IP addresses not allowed' };
    }
    if (parts[0] === 192 && parts[1] === 168) {
      return { safe: false, error: 'Private IP addresses not allowed' };
    }
    if (parts[0] === 169 && parts[1] === 254) {
      return { safe: false, error: 'Link-local addresses not allowed' };
    }
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
    const validation = isUrlSafe(currentUrl);
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
  } catch {}
  
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
    } catch {}
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

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SSRF protection: Validate URL before fetching
    const urlValidation = isUrlSafe(url);
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
      return new Response(
        JSON.stringify({
          url,
          type: 'image',
          image: url,
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
          return new Response(
            JSON.stringify({
              url,
              type: 'youtube',
              videoId: youtubeId,
              title: oembed.title,
              description: oembed.author_name,
              image: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`,
              siteName: 'YouTube',
              favicon: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=32',
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
      } catch (e) {
        console.log('YouTube oEmbed failed, continuing with basic info');
      }
      
      // Fallback for YouTube
      return new Response(
        JSON.stringify({
          url,
          type: 'youtube',
          videoId: youtubeId,
          image: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`,
          siteName: 'YouTube',
          favicon: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=32',
        }),
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
      return new Response(
        JSON.stringify({
          url,
          type: 'twitter',
          siteName: 'X (Twitter)',
          favicon: 'https://www.google.com/s2/favicons?domain=x.com&sz=32',
        }),
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
          
          return new Response(
            JSON.stringify({
              url,
              type: 'spotify',
              spotifyType: spotifyInfo.type,
              spotifyId: spotifyInfo.id,
              title: preview.title,
              description: preview.description,
              image: preview.image,
              siteName: 'Spotify',
              favicon: 'https://www.google.com/s2/favicons?domain=spotify.com&sz=32',
            }),
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
      return new Response(
        JSON.stringify({
          url,
          type: 'spotify',
          spotifyType: spotifyInfo.type,
          spotifyId: spotifyInfo.id,
          siteName: 'Spotify',
          favicon: 'https://www.google.com/s2/favicons?domain=spotify.com&sz=32',
        }),
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
          
          return new Response(
            JSON.stringify({
              url,
              type: 'soundcloud',
              title: data.title,
              description: data.description,
              image: data.thumbnail_url,
              siteName: 'SoundCloud',
              favicon: 'https://www.google.com/s2/favicons?domain=soundcloud.com&sz=32',
              soundcloudUrl: embedUrl,
            }),
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
      return new Response(
        JSON.stringify({
          url,
          type: 'soundcloud',
          siteName: 'SoundCloud',
          favicon: 'https://www.google.com/s2/favicons?domain=soundcloud.com&sz=32',
        }),
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
        return new Response(
          JSON.stringify({
            url,
            siteName: urlObj.hostname.replace('www.', ''),
            favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`,
          }),
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
      return new Response(
        JSON.stringify({
          url,
          type: 'image',
          image: url,
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
