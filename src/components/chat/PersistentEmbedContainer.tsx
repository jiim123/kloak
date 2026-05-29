import { X } from 'lucide-react';
import { useEmbedStore } from '@/stores/embedStore';
import { useServerStore } from '@/stores/serverStore';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

/**
 * This component renders all active stream embeds.
 * Embeds are kept mounted but hidden when not viewing their channel,
 * preserving playback state when switching channels.
 */
export const PersistentEmbedContainer = () => {
  const { activeEmbeds, removeEmbed } = useEmbedStore();
  const { currentChannel } = useServerStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || activeEmbeds.length === 0) return null;

  return (
    <>
      {activeEmbeds.map((embed) => {
        const isVisible = currentChannel?.id === embed.channelId;
        const placeholder = document.getElementById(`embed-placeholder-${embed.id}`);
        
        // Render into placeholder if visible and placeholder exists
        if (isVisible && placeholder) {
          return createPortal(
            <div className="relative w-full">
              {renderEmbedIframe(embed)}
              <button
                onClick={() => removeEmbed(embed.id)}
                className="absolute top-2 right-2 p-1 rounded bg-muted/60 hover:bg-muted/80 transition-colors z-10"
                title="Close embed"
              >
                <X className="w-4 h-4 text-foreground" />
              </button>
            </div>,
            placeholder,
            embed.id
          );
        }
        
        // Keep iframe alive but hidden when not visible
        return (
          <div
            key={embed.id}
            className="fixed pointer-events-none"
            style={{ 
              top: -9999, 
              left: -9999, 
              width: 480, 
              height: 270,
              visibility: 'hidden' 
            }}
          >
            {renderEmbedIframe(embed)}
          </div>
        );
      })}
    </>
  );
};

const SAFE_EMBED_ID = /^[A-Za-z0-9_-]{1,64}$/;

function renderEmbedIframe(embed: { id: string; type: string; channelOrVideoId: string }) {
  if (!SAFE_EMBED_ID.test(embed.channelOrVideoId)) return null;

  const commonProps = {
    height: 270,
    width: 480,
    allowFullScreen: true,
    className: "w-full aspect-video",
  };

  switch (embed.type) {
    case 'twitch-channel':
      return (
        <iframe
          {...commonProps}
          src={`https://player.twitch.tv/?channel=${embed.channelOrVideoId}&parent=${window.location.hostname}&autoplay=false`}
          title={`${embed.channelOrVideoId} on Twitch`}
        />
      );
    case 'twitch-video':
      return (
        <iframe
          {...commonProps}
          src={`https://player.twitch.tv/?video=${embed.channelOrVideoId}&parent=${window.location.hostname}&autoplay=false`}
          title="Twitch video"
        />
      );
    case 'twitch-clip':
      return (
        <iframe
          {...commonProps}
          src={`https://clips.twitch.tv/embed?clip=${embed.channelOrVideoId}&parent=${window.location.hostname}&autoplay=false`}
          title="Twitch clip"
        />
      );
    case 'kick-channel':
      return (
        <iframe
          {...commonProps}
          src={`https://player.kick.com/${embed.channelOrVideoId}`}
          title={`${embed.channelOrVideoId} on Kick`}
        />
      );
    case 'kick-video':
      return (
        <iframe
          {...commonProps}
          src={`https://player.kick.com/video/${embed.channelOrVideoId}`}
          title="Kick video"
        />
      );
    default:
      return null;
  }
}
