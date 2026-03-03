import { useState, useEffect } from "react";
import { ExternalLink, Play, X, AlertTriangle, ArrowUp, MessageSquare, ShoppingCart, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useEmbedStore, ActiveEmbed } from "@/stores/embedStore";
import { useServerStore } from "@/stores/serverStore";

interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
  type?: string;
  videoId?: string;
  spotifyType?: string;
  spotifyId?: string;
  soundcloudUrl?: string;
  twitchChannel?: string;
  twitchVideo?: string;
  twitchClip?: string;
  kickChannel?: string;
  kickVideo?: string;
  vimeoId?: string;
  steamId?: string;
  tiktokId?: string;
  instagramId?: string;
  facebookVideoId?: string;
  facebookType?: string;
  twitterId?: string;
  // New fields
  redditSubreddit?: string;
  redditPostId?: string;
  redditAuthor?: string;
  redditScore?: string;
  redditComments?: string;
  linkedinType?: string;
  author?: string;
  authorAvatar?: string;
  // Steam enriched
  steamPrice?: string;
  steamOriginalPrice?: string;
  steamDiscount?: string;
  steamActionText?: string;
  steamReleaseDate?: string;
  steamDeveloper?: string;
  steamReviewSummary?: string;
  steamTags?: string[];
  error?: string;
}

interface LinkPreviewProps {
  url: string;
  disabled?: boolean;
  messageId?: string;
}

// Cache for link previews
type CachedPreview =
  | { kind: "ok"; data: LinkPreviewData; cachedAt: number }
  | { kind: "error"; cachedAt: number };

const PREVIEW_OK_TTL_MS = 30 * 60_000;
const PREVIEW_ERROR_TTL_MS = 2 * 60_000;
const previewCache = new Map<string, CachedPreview>();

const getEmbedId = (url: string, messageId: string) => `${messageId}-${btoa(url).slice(0, 16)}`;

export const LinkPreview = ({ url, disabled, messageId }: LinkPreviewProps) => {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { activeEmbeds, addEmbed, removeEmbed } = useEmbedStore();
  const { currentChannel } = useServerStore();

  useEffect(() => {
    if (disabled) return;

    const cached = previewCache.get(url);
    if (cached) {
      const age = Date.now() - cached.cachedAt;
      if (cached.kind === "ok" && age < PREVIEW_OK_TTL_MS) {
        setPreview(cached.data);
        return;
      }
      if (cached.kind === "error" && age < PREVIEW_ERROR_TTL_MS) {
        return;
      }
      previewCache.delete(url);
    }

    const controller = new AbortController();
    let cancelled = false;

    const fetchPreview = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke("fetch-link-preview", {
          body: { url },
        });

        if (cancelled) return;

        if (fnError) {
          console.error("Link preview error:", fnError);
          setError("Failed to load preview");
          previewCache.set(url, { kind: "error", cachedAt: Date.now() });
          return;
        }

        if (data?.error) {
          setError(data.error);
          previewCache.set(url, { kind: "error", cachedAt: Date.now() });
          return;
        }

        setPreview(data);
        previewCache.set(url, { kind: "ok", data, cachedAt: Date.now() });
      } catch (err) {
        if (cancelled) return;
        console.error("Link preview fetch error:", err);
        setError("Failed to load preview");
        previewCache.set(url, { kind: "error", cachedAt: Date.now() });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchPreview();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url, disabled]);

  if (disabled) return null;
  if (isLoading) {
    return (
      <div className="mt-2 p-3 bg-secondary/50 rounded-lg border border-border animate-pulse">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-muted rounded" />
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
        <div className="h-4 w-full bg-muted rounded mt-2" />
        <div className="h-3 w-2/3 bg-muted rounded mt-1" />
      </div>
    );
  }

  if (error || !preview) return null;

  // Direct image
  if (preview.type === "image") {
    const lightboxUrl = preview.image || url;
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-2">
        <img
          src={lightboxUrl}
          alt="Linked image"
          className="max-w-full sm:max-w-[400px] max-h-[300px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
          data-image-url={lightboxUrl}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </a>
    );
  }

  // YouTube embed
  if (preview.type === "youtube" && preview.videoId) {
    if (showEmbed) {
      return (
        <div className="mt-2 rounded-lg overflow-hidden border border-border max-w-[480px]">
          <iframe
            width="480"
            height="270"
            src={`https://www.youtube.com/embed/${preview.videoId}?autoplay=1`}
            title={preview.title || "YouTube video"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full aspect-video"
          />
        </div>
      );
    }

    return (
      <div className="mt-2 rounded-lg overflow-hidden border border-border max-w-[400px] bg-secondary/50">
        <div className="relative cursor-pointer group" onClick={() => setShowEmbed(true)}>
          <img
            src={preview.image}
            alt={preview.title || "YouTube video"}
            className="w-full aspect-video object-cover"
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.style.display = "none";
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
            <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Play className="w-8 h-8 text-white fill-white ml-1" />
            </div>
          </div>
        </div>
        <div className="p-3">
          <div className="flex items-center gap-2 mb-1">
            {preview.favicon && <img src={preview.favicon} alt="" className="w-4 h-4" />}
            <span className="text-xs text-muted-foreground">{preview.siteName}</span>
          </div>
          {preview.title && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-sm text-primary hover:underline line-clamp-2">
              {preview.title}
            </a>
          )}
          {preview.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{preview.description}</p>
          )}
        </div>
      </div>
    );
  }

  // Vimeo embed
  if (preview.type === "vimeo" && preview.vimeoId) {
    if (showEmbed) {
      return (
        <div className="mt-2 rounded-lg overflow-hidden border border-border max-w-[480px]">
          <iframe
            src={`https://player.vimeo.com/video/${preview.vimeoId}?autoplay=1`}
            width="480" height="270"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="w-full aspect-video"
            title={preview.title || "Vimeo video"}
          />
        </div>
      );
    }

    return (
      <div className="mt-2 rounded-lg overflow-hidden border border-border max-w-[400px] bg-secondary/50">
        <div className="relative cursor-pointer group" onClick={() => setShowEmbed(true)}>
          {preview.image ? (
            <img src={preview.image} alt={preview.title || "Vimeo video"} className="w-full aspect-video object-cover" />
          ) : (
            <div className="w-full aspect-video bg-[#1ab7ea] flex items-center justify-center">
              <Play className="w-16 h-16 text-white" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
            <div className="w-16 h-16 rounded-full bg-[#1ab7ea] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Play className="w-8 h-8 text-white fill-white ml-1" />
            </div>
          </div>
        </div>
        <div className="p-3">
          <div className="flex items-center gap-2 mb-1">
            {preview.favicon && <img src={preview.favicon} alt="" className="w-4 h-4" />}
            <span className="text-xs text-muted-foreground">{preview.siteName || "Vimeo"}</span>
          </div>
          {preview.title && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-sm text-primary hover:underline line-clamp-2">
              {preview.title}
            </a>
          )}
        </div>
      </div>
    );
  }

  // Twitch embed - persistent
  if (preview.type === "twitch" && messageId && currentChannel) {
    const embedId = getEmbedId(url, messageId);
    const existingEmbed = activeEmbeds.find(e => e.id === embedId);
    
    const embedType: ActiveEmbed['type'] | null = 
      preview.twitchChannel ? 'twitch-channel' : 
      preview.twitchVideo ? 'twitch-video' : 
      preview.twitchClip ? 'twitch-clip' : null;
    
    const channelOrVideoId = preview.twitchChannel || preview.twitchVideo || preview.twitchClip;
    
    if (embedType && channelOrVideoId) {
      if (!existingEmbed) {
        addEmbed({
          id: embedId, url, type: embedType, channelOrVideoId,
          messageId, channelId: currentChannel.id,
        });
      }
      return (
        <div 
          id={`embed-placeholder-${embedId}`}
          className="mt-2 rounded-lg overflow-hidden border border-border max-w-[480px] aspect-video bg-secondary/50"
        />
      );
    }
  }

  // ── Steam embed – just the widget, clean and airy ──
  if (preview.type === "steam" && preview.steamId) {
    return (
      <div className="mt-2 rounded-xl overflow-hidden border border-border max-w-full sm:max-w-[400px] bg-[#1b2838]">
        <iframe
          src={`https://store.steampowered.com/widget/${preview.steamId}/`}
          width="400" height="190"
          className="w-full border-0"
          title={preview.title || "Steam game"}
          loading="lazy"
        />
      </div>
    );
  }

  // ── Reddit embed ──
  if (preview.type === "reddit") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block rounded-lg border-l-4 border-l-[#ff4500] border border-border bg-secondary/50 overflow-hidden max-w-[400px] hover:bg-secondary/70 transition-colors"
      >
        {preview.image && (
          <img
            src={preview.image}
            alt={preview.title || ""}
            className="w-full h-40 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
        <div className="p-3">
          {/* Subreddit header */}
          <div className="flex items-center gap-2 mb-1.5">
            {preview.favicon && <img src={preview.favicon} alt="" className="w-4 h-4" />}
            <span className="text-xs font-medium text-[#ff4500]">
              {preview.redditSubreddit ? `r/${preview.redditSubreddit}` : 'Reddit'}
            </span>
            {preview.redditAuthor && (
              <span className="text-xs text-muted-foreground">• u/{preview.redditAuthor}</span>
            )}
            <ExternalLink className="w-3 h-3 text-muted-foreground ml-auto" />
          </div>
          {/* Title */}
          {preview.title && (
            <p className="font-medium text-sm text-primary line-clamp-2">{preview.title}</p>
          )}
          {/* Description */}
          {preview.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{preview.description}</p>
          )}
          {/* Stats row */}
          {(preview.redditScore || preview.redditComments) && (
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              {preview.redditScore && (
                <span className="flex items-center gap-1">
                  <ArrowUp className="w-3 h-3" />
                  {Number(preview.redditScore).toLocaleString()}
                </span>
              )}
              {preview.redditComments && (
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {Number(preview.redditComments).toLocaleString()} comments
                </span>
              )}
            </div>
          )}
        </div>
      </a>
    );
  }

  // ── LinkedIn embed ──
  if (preview.type === "linkedin") {
    const typeLabel = preview.linkedinType === 'article' ? 'Article' :
      preview.linkedinType === 'profile' ? 'Profile' :
      preview.linkedinType === 'company' ? 'Company' : 'Post';
    
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block rounded-lg border-l-4 border-l-[#0a66c2] border border-border bg-secondary/50 overflow-hidden max-w-[400px] hover:bg-secondary/70 transition-colors"
      >
        {preview.image && (
          <img
            src={preview.image}
            alt={preview.title || ""}
            className="w-full h-40 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
        <div className="p-3">
          <div className="flex items-center gap-2 mb-1.5">
            {preview.favicon && <img src={preview.favicon} alt="" className="w-4 h-4" />}
            <span className="text-xs font-medium text-[#0a66c2]">LinkedIn</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0a66c2]/10 text-[#0a66c2] font-medium">{typeLabel}</span>
            <ExternalLink className="w-3 h-3 text-muted-foreground ml-auto" />
          </div>
          {preview.title && (
            <p className="font-medium text-sm text-primary line-clamp-2">{preview.title}</p>
          )}
          {preview.author && (
            <p className="text-xs text-muted-foreground mt-1">By {preview.author}</p>
          )}
          {preview.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{preview.description}</p>
          )}
        </div>
      </a>
    );
  }

  // ── Facebook embed ──
  if (preview.type === "facebook") {
    const typeLabel = preview.facebookType === 'video' ? 'Video' :
      preview.facebookType === 'event' ? 'Event' :
      preview.facebookType === 'photo' ? 'Photo' :
      preview.facebookType === 'post' ? 'Post' : 'Page';

    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block rounded-lg border-l-4 border-l-[#1877f2] border border-border bg-secondary/50 overflow-hidden max-w-[400px] hover:bg-secondary/70 transition-colors"
      >
        {preview.image && (
          <img
            src={preview.image}
            alt={preview.title || ""}
            className="w-full h-40 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
        <div className="p-3">
          <div className="flex items-center gap-2 mb-1.5">
            {preview.favicon && <img src={preview.favicon} alt="" className="w-4 h-4" />}
            <span className="text-xs font-medium text-[#1877f2]">Facebook</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1877f2]/10 text-[#1877f2] font-medium">{typeLabel}</span>
            <ExternalLink className="w-3 h-3 text-muted-foreground ml-auto" />
          </div>
          {preview.title && (
            <p className="font-medium text-sm text-primary line-clamp-2">{preview.title}</p>
          )}
          {preview.author && (
            <p className="text-xs text-muted-foreground mt-1">By {preview.author}</p>
          )}
          {preview.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{preview.description}</p>
          )}
        </div>
      </a>
    );
  }

  // ── X/Twitter embed (enhanced) ──
  if (preview.type === "twitter") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block rounded-lg border-l-4 border-l-foreground/80 border border-border bg-secondary/50 overflow-hidden max-w-[400px] hover:bg-secondary/70 transition-colors"
      >
        {preview.image && (
          <img
            src={preview.image}
            alt={preview.title || ""}
            className="w-full h-40 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
        <div className="p-3">
          <div className="flex items-center gap-2 mb-1.5">
            {preview.favicon && <img src={preview.favicon} alt="" className="w-4 h-4" />}
            <span className="text-xs font-medium text-foreground/80">{preview.siteName || "X (Twitter)"}</span>
            {preview.author && (
              <span className="text-xs text-muted-foreground">{preview.author}</span>
            )}
            <ExternalLink className="w-3 h-3 text-muted-foreground ml-auto" />
          </div>
          {preview.title && <p className="font-medium text-sm text-primary line-clamp-3">{preview.title}</p>}
          {preview.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{preview.description}</p>
          )}
          <p className="text-xs text-primary mt-2">View post on X →</p>
        </div>
      </a>
    );
  }

  // TikTok embed
  if (preview.type === "tiktok" && preview.tiktokId) {
    return (
      <div className="mt-2 rounded-lg overflow-hidden border border-border max-w-[325px] mx-auto">
        <blockquote className="tiktok-embed" cite={url} data-video-id={preview.tiktokId} style={{ maxWidth: "605px", minWidth: "325px" }}>
          <section>
            <a target="_blank" rel="noopener noreferrer" href={url} className="block p-4 bg-secondary/50 hover:bg-secondary/70 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                {preview.favicon && <img src={preview.favicon} alt="" className="w-4 h-4" />}
                <span className="text-xs text-muted-foreground">TikTok</span>
              </div>
              {preview.title && <p className="font-medium text-sm line-clamp-2">{preview.title}</p>}
              {preview.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{preview.description}</p>}
              <p className="text-xs text-primary mt-2">View on TikTok →</p>
            </a>
          </section>
        </blockquote>
      </div>
    );
  }

  // Instagram embed
  if (preview.type === "instagram" && preview.instagramId) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 block rounded-lg border border-border bg-secondary/50 p-3 max-w-[400px] hover:bg-secondary/70 transition-colors">
        <div className="flex items-center gap-2">
          {preview.favicon && <img src={preview.favicon} alt="" className="w-4 h-4" />}
          <span className="text-xs text-muted-foreground">Instagram</span>
          <ExternalLink className="w-3 h-3 text-muted-foreground ml-auto" />
        </div>
        {preview.image && <img src={preview.image} alt={preview.title || ""} className="w-full rounded-lg mt-2" />}
        {preview.title && <p className="font-medium text-sm mt-2 line-clamp-2">{preview.title}</p>}
        <p className="text-xs text-primary mt-1">View on Instagram →</p>
      </a>
    );
  }

  // Spotify embed
  if (preview.type === "spotify" && preview.spotifyId && preview.spotifyType) {
    const embedHeight = preview.spotifyType === "track" || preview.spotifyType === "episode" ? 152 : 352;

    if (!showEmbed) {
      return (
        <div className="mt-2 rounded-lg overflow-hidden border border-border max-w-[400px] bg-[#121212] p-3">
          <div className="flex items-center gap-2 mb-2">
            {preview.favicon && <img src={preview.favicon} alt="" className="w-4 h-4" />}
            <span className="text-xs text-muted-foreground">{preview.siteName || "Spotify"}</span>
            <a href={url} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-primary hover:underline flex items-center gap-1">
              Open <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          {preview.title && <p className="font-medium text-sm text-foreground line-clamp-2">{preview.title}</p>}
          {preview.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{preview.description}</p>}
          <button
            type="button"
            onClick={() => setShowEmbed(true)}
            className="mt-3 w-full rounded-md bg-[#1db954] px-3 py-2 text-xs font-medium text-black hover:opacity-90 transition-opacity"
          >
            Load Spotify embed
          </button>
        </div>
      );
    }

    return (
      <div className="mt-2 rounded-lg overflow-hidden border border-border max-w-[400px] bg-[#121212]">
        <iframe
          src={`https://open.spotify.com/embed/${preview.spotifyType}/${preview.spotifyId}?utm_source=generator&theme=0`}
          width="100%" height={embedHeight}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy" className="border-0"
          title={preview.title || "Spotify embed"}
        />
        {preview.title && (
          <div className="p-3 bg-secondary/50">
            <div className="flex items-center gap-2 mb-1">
              {preview.favicon && <img src={preview.favicon} alt="" className="w-4 h-4" />}
              <span className="text-xs text-muted-foreground">{preview.siteName}</span>
            </div>
            <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-sm text-primary hover:underline line-clamp-1">
              {preview.title}
            </a>
          </div>
        )}
      </div>
    );
  }

  // SoundCloud embed
  if (preview.type === "soundcloud") {
    if (preview.soundcloudUrl) {
      if (!showEmbed) {
        return (
          <div className="mt-2 rounded-lg overflow-hidden border border-border max-w-[400px] bg-secondary/50 p-3">
            <div className="flex items-center gap-2">
              {preview.favicon && <img src={preview.favicon} alt="" className="w-4 h-4" />}
              <span className="text-xs text-muted-foreground">{preview.siteName || "SoundCloud"}</span>
              <a href={url} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-primary hover:underline flex items-center gap-1">
                Open <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            {preview.title && <p className="font-medium text-sm mt-2 line-clamp-2">{preview.title}</p>}
            {preview.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{preview.description}</p>}
            <button
              type="button"
              onClick={() => setShowEmbed(true)}
              className="mt-3 w-full rounded-md bg-[#ff5500] px-3 py-2 text-xs font-medium text-white hover:opacity-90 transition-opacity"
            >
              Load SoundCloud embed
            </button>
          </div>
        );
      }

      return (
        <div className="mt-2 rounded-lg overflow-hidden border border-border max-w-[400px] bg-[#f2f2f2] dark:bg-[#1a1a1a]">
          <iframe
            src={preview.soundcloudUrl}
            width="100%" height={166}
            allow="autoplay" loading="lazy" className="border-0"
            title={preview.title || "SoundCloud embed"}
          />
          {preview.title && (
            <div className="p-3 bg-secondary/50">
              <div className="flex items-center gap-2 mb-1">
                {preview.favicon && <img src={preview.favicon} alt="" className="w-4 h-4" />}
                <span className="text-xs text-muted-foreground">{preview.siteName}</span>
              </div>
              <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-sm text-primary hover:underline line-clamp-1">
                {preview.title}
              </a>
            </div>
          )}
        </div>
      );
    }

    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 block rounded-lg border border-border bg-secondary/50 p-3 max-w-[400px] hover:bg-secondary/70 transition-colors">
        <div className="flex items-center gap-2">
          {preview.favicon && <img src={preview.favicon} alt="" className="w-4 h-4" />}
          <span className="text-xs text-muted-foreground">{preview.siteName}</span>
        </div>
        {preview.title && <p className="font-medium text-sm mt-1 line-clamp-2">{preview.title}</p>}
      </a>
    );
  }

  // Standard Open Graph card (fallback)
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block rounded-lg border border-border bg-secondary/50 overflow-hidden max-w-full sm:max-w-[400px] hover:bg-secondary/70 transition-colors group"
    >
      {preview.image && (
        <div className="relative">
          <img
            src={preview.image}
            alt={preview.title || ""}
            className="w-full h-40 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          {preview.favicon && <img src={preview.favicon} alt="" className="w-4 h-4" />}
          <span className="text-xs text-muted-foreground">{preview.siteName}</span>
          <ExternalLink className="w-3 h-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        {preview.title && <p className="font-medium text-sm text-primary line-clamp-2">{preview.title}</p>}
        {preview.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{preview.description}</p>
        )}
      </div>
    </a>
  );
};

// Privacy notice component for first-time users
export const LinkPreviewNotice = ({ onDismiss }: { onDismiss: () => void }) => (
  <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm">
    <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
    <div className="flex-1">
      <p className="text-foreground">Link previews fetch metadata server-side. Opening links or loading embeds connects directly to external sites.</p>
      <button onClick={onDismiss} className="text-primary hover:underline text-xs mt-1">
        Dismiss
      </button>
    </div>
  </div>
);
