import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle YouTube
    const youtubeId = getYouTubeVideoId(url);
    if (youtubeId) {
      // Fetch YouTube oEmbed data
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const oembedResponse = await fetch(oembedUrl);
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
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle Spotify
    const spotifyInfo = getSpotifyInfo(url);
    if (spotifyInfo) {
      // Fetch the page to get Open Graph metadata for title/description
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)',
            'Accept': 'text/html,application/xhtml+xml',
          },
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
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
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

    // Parse HTML
    const html = await response.text();
    const preview = extractMetadata(html, url);

    console.log('Link preview extracted:', preview.title);

    return new Response(
      JSON.stringify(preview),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
