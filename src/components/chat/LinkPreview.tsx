import { useState, useEffect } from "react";
import { ExternalLink, Play, X, AlertTriangle } from "lucide-react";
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
  twitterId?: string;
  error?: string;
}

interface LinkPreviewProps {
  url: string;
  disabled?: boolean;
  messageId?: string; // For persistent embed tracking
}

// Cache for link previews to avoid refetching
const previewCache = new Map<string, LinkPreviewData>();

// Generate a stable ID for an embed
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

    // Check cache first
    if (previewCache.has(url)) {
      setPreview(previewCache.get(url)!);
      return;
    }

    const fetchPreview = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke("fetch-link-preview", {
          body: { url },
        });

        if (fnError) {
          console.error("Link preview error:", fnError);
          setError("Failed to load preview");
          return;
        }

        if (data?.error) {
          setError(data.error);
          return;
        }

        setPreview(data);
        previewCache.set(url, data);
      } catch (err) {
        console.error("Link preview fetch error:", err);
        setError("Failed to load preview");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreview();
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
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-2">
        <img
          src={preview.image}
          alt="Linked image"
          className="max-w-[400px] max-h-[300px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
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
              if (img.src.includes("maxresdefault")) {
                img.src = `https://img.youtube.com/vi/${preview.videoId}/hqdefault.jpg`;
              }
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
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sm text-primary hover:underline line-clamp-2"
            >
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
            width="480"
            height="270"
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
            <img
              src={preview.image}
              alt={preview.title || "Vimeo video"}
              className="w-full aspect-video object-cover"
            />
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
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sm text-primary hover:underline line-clamp-2"
            >
              {preview.title}
            </a>
          )}
        </div>
      </div>
    );
  }

  // Twitch embed - uses persistent embed tracking
  if (preview.type === "twitch" && messageId && currentChannel) {
    const embedId = getEmbedId(url, messageId);
    const existingEmbed = activeEmbeds.find(e => e.id === embedId);
    
    const embedType: ActiveEmbed['type'] | null = 
      preview.twitchChannel ? 'twitch-channel' : 
      preview.twitchVideo ? 'twitch-video' : 
      preview.twitchClip ? 'twitch-clip' : null;
    
    const channelOrVideoId = preview.twitchChannel || preview.twitchVideo || preview.twitchClip;
    
    if (embedType && channelOrVideoId) {
      // Register this embed if not already registered
      if (!existingEmbed) {
        addEmbed({
          id: embedId,
          url,
          type: embedType,
          channelOrVideoId,
          messageId,
          channelId: currentChannel.id,
        });
      }
      
      // Render a placeholder div that the PersistentEmbedContainer will portal into
      return (
        <div 
          id={`embed-placeholder-${embedId}`}
          className="mt-2 rounded-lg overflow-hidden border border-border max-w-[480px] aspect-video bg-secondary/50"
        />
      );
    }
  }


  // Steam embed
  if (preview.type === "steam" && preview.steamId) {
    return (
      <div className="mt-2 rounded-lg overflow-hidden border border-border max-w-[400px]">
        <iframe
          src={`https://store.steampowered.com/widget/${preview.steamId}/`}
          width="400"
          height="190"
          className="w-full border-0"
          title={preview.title || "Steam game"}
        />
      </div>
    );
  }

  // TikTok embed
  if (preview.type === "tiktok" && preview.tiktokId) {
    return (
      <div className="mt-2 rounded-lg overflow-hidden border border-border max-w-[325px] mx-auto">
        <blockquote
          className="tiktok-embed"
          cite={url}
          data-video-id={preview.tiktokId}
          style={{ maxWidth: "605px", minWidth: "325px" }}
        >
          <section>
            <a
              target="_blank"
              rel="noopener noreferrer"
              href={url}
              className="block p-4 bg-secondary/50 hover:bg-secondary/70 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                {preview.favicon && <img src={preview.favicon} alt="" className="w-4 h-4" />}
                <span className="text-xs text-muted-foreground">TikTok</span>
              </div>
              {preview.title && <p className="font-medium text-sm line-clamp-2">{preview.title}</p>}
              {preview.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{preview.description}</p>
              )}
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
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block rounded-lg border border-border bg-secondary/50 p-3 max-w-[400px] hover:bg-secondary/70 transition-colors"
      >
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

  // X/Twitter embed
  if (preview.type === "twitter" && preview.twitterId) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block rounded-lg border border-border bg-secondary/50 p-3 max-w-[400px] hover:bg-secondary/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          {preview.favicon && <img src={preview.favicon} alt="" className="w-4 h-4" />}
          <span className="text-xs text-muted-foreground">{preview.siteName || "X (Twitter)"}</span>
          <ExternalLink className="w-3 h-3 text-muted-foreground ml-auto" />
        </div>
        {preview.title && <p className="font-medium text-sm mt-2 line-clamp-3">{preview.title}</p>}
        {preview.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{preview.description}</p>
        )}
        <p className="text-xs text-primary mt-2">View post on X →</p>
      </a>
    );
  }

  // Facebook video embed
  if (preview.type === "facebook" && preview.facebookVideoId) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block rounded-lg border border-border bg-secondary/50 p-3 max-w-[400px] hover:bg-secondary/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          {preview.favicon && <img src={preview.favicon} alt="" className="w-4 h-4" />}
          <span className="text-xs text-muted-foreground">Facebook</span>
          <ExternalLink className="w-3 h-3 text-muted-foreground ml-auto" />
        </div>
        {preview.image && <img src={preview.image} alt={preview.title || ""} className="w-full rounded-lg mt-2" />}
        {preview.title && <p className="font-medium text-sm mt-2 line-clamp-2">{preview.title}</p>}
        <p className="text-xs text-primary mt-1">View on Facebook →</p>
      </a>
    );
  }

  // Spotify embed
  if (preview.type === "spotify" && preview.spotifyId && preview.spotifyType) {
    const embedHeight = preview.spotifyType === "track" || preview.spotifyType === "episode" ? 152 : 352;

    return (
      <div className="mt-2 rounded-lg overflow-hidden border border-border max-w-[400px] bg-[#121212]">
        <iframe
          src={`https://open.spotify.com/embed/${preview.spotifyType}/${preview.spotifyId}?utm_source=generator&theme=0`}
          width="100%"
          height={embedHeight}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="border-0"
          title={preview.title || "Spotify embed"}
        />
        {preview.title && (
          <div className="p-3 bg-secondary/50">
            <div className="flex items-center gap-2 mb-1">
              {preview.favicon && <img src={preview.favicon} alt="" className="w-4 h-4" />}
              <span className="text-xs text-muted-foreground">{preview.siteName}</span>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sm text-primary hover:underline line-clamp-1"
            >
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
      return (
        <div className="mt-2 rounded-lg overflow-hidden border border-border max-w-[400px] bg-[#f2f2f2] dark:bg-[#1a1a1a]">
          <iframe
            src={preview.soundcloudUrl}
            width="100%"
            height={166}
            allow="autoplay"
            loading="lazy"
            className="border-0"
            title={preview.title || "SoundCloud embed"}
          />
          {preview.title && (
            <div className="p-3 bg-secondary/50">
              <div className="flex items-center gap-2 mb-1">
                {preview.favicon && <img src={preview.favicon} alt="" className="w-4 h-4" />}
                <span className="text-xs text-muted-foreground">{preview.siteName}</span>
              </div>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-sm text-primary hover:underline line-clamp-1"
              >
                {preview.title}
              </a>
            </div>
          )}
        </div>
      );
    }

    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block rounded-lg border border-border bg-secondary/50 p-3 max-w-[400px] hover:bg-secondary/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          {preview.favicon && <img src={preview.favicon} alt="" className="w-4 h-4" />}
          <span className="text-xs text-muted-foreground">{preview.siteName}</span>
        </div>
        {preview.title && <p className="font-medium text-sm mt-1 line-clamp-2">{preview.title}</p>}
      </a>
    );
  }

  // Standard Open Graph card
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block rounded-lg border border-border bg-secondary/50 overflow-hidden max-w-[400px] hover:bg-secondary/70 transition-colors group"
    >
      {preview.image && (
        <div className="relative">
          <img
            src={preview.image}
            alt={preview.title || ""}
            className="w-full h-40 object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
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
      <p className="text-foreground">Link previews make external requests to fetch website information.</p>
      <button onClick={onDismiss} className="text-primary hover:underline text-xs mt-1">
        Dismiss
      </button>
    </div>
  </div>
);
