import { useState, useEffect, useMemo } from 'react';
import { FluentEmoji } from '@/components/ui/FluentEmoji';
import { fetchServerEmojis, type ServerEmoji } from '@/lib/serverEmojis';

interface RoleIconPreviewProps {
  icon: string;
  serverId: string;
  className?: string;
}

/**
 * Renders a role icon - handles both native emoji and custom server emoji (:name:)
 */
export function RoleIconPreview({ icon, serverId, className = '' }: RoleIconPreviewProps) {
  const [serverEmojis, setServerEmojis] = useState<ServerEmoji[]>([]);

  useEffect(() => {
    if (!serverId) return;
    
    let cancelled = false;
    fetchServerEmojis(serverId).then((emojis) => {
      if (!cancelled) {
        setServerEmojis(emojis);
      }
    }).catch(() => {
      // Ignore errors, will just show the raw text
    });

    return () => {
      cancelled = true;
    };
  }, [serverId]);

  const emojiMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const emoji of serverEmojis) {
      map.set(emoji.name, emoji.url);
    }
    return map;
  }, [serverEmojis]);

  // Check if it's a custom emoji (format :name:)
  const match = icon.match(/^:([a-z0-9_]{2,12}):$/i);
  
  if (match) {
    const emojiName = match[1];
    const url = emojiMap.get(emojiName);
    
    if (url) {
      return (
        <img 
          src={url} 
          alt={icon} 
         className={`inline-block w-5 h-5 object-contain ${className}`}
          decoding="async"
        />
      );
    }
    
    // Custom emoji not found, show raw text
    return <span className={`text-sm leading-none ${className}`}>{icon}</span>;
  }

  // Native emoji - render as Fluent Emoji 3D
  return <FluentEmoji emoji={icon} size={18} className={className} />;
}
