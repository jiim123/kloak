import { useMemo, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CodeBlock, InlineCode } from './CodeBlock';
import { LinkPreview } from './LinkPreview';
import { InviteLinkPreview } from './InviteLinkPreview';
import { ImageLightbox } from '@/components/modals/ImageLightbox';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { fetchServerEmojis } from '@/lib/serverEmojis';

interface UserInfo {
  id: string;
  username: string;
  display_name?: string | null;
  nickname?: string | null;
}

interface ChannelInfo {
  id: string;
  name: string;
}

interface MessageContentProps {
  content: string;
  currentUserId?: string;
  messageId?: string;
  users?: UserInfo[];
  messageUser?: UserInfo | null;
  hideEmbeds?: boolean;
}

interface ParsedSegment {
  type: 'text' | 'code-block' | 'inline-code';
  content: string;
  language?: string;
}

// Check if URL is an image (including GIFs)
const isImageUrl = (url: string): boolean => {
  // Check for common image extensions
  const imageExtensions = /\.(gif|jpe?g|png|webp|bmp|svg)(\?.*)?$/i;
  if (imageExtensions.test(url)) return true;
  
  // Check for known image hosting services
  const imageHosts = [
    /media\d*\.giphy\.com/i,
    /i\.giphy\.com/i,
    /tenor\.com.*\.gif/i,
    /i\.imgur\.com/i,
    /pbs\.twimg\.com/i,
    /media\.discordapp\.net/i,
    /cdn\.discordapp\.com/i,
    /supabase\.co.*\/storage/i, // Supabase storage URLs
  ];
  
  return imageHosts.some(pattern => pattern.test(url));
};

// Validate URL is safe (only http/https protocols)
const isSafeUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

// Extract URLs from content
const extractUrls = (content: string): string[] => {
  const urlPattern = /https?:\/\/[^\s<>`\]]+/g;
  const matches = content.match(urlPattern) || [];
  // Return unique URLs, filtered to only safe URLs
  return [...new Set(matches)].filter(isSafeUrl);
};

// Parse message into segments (text, code blocks, inline code)
const parseMessageSegments = (content: string): ParsedSegment[] => {
  const segments: ParsedSegment[] = [];
  let remaining = content;
  
  // Match code blocks first: ```language\ncode``` or ```code```
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  
  while ((match = codeBlockRegex.exec(remaining)) !== null) {
    // Add text before this code block
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: remaining.slice(lastIndex, match.index),
      });
    }
    
    // Add code block
    segments.push({
      type: 'code-block',
      content: match[2].trim(),
      language: match[1] || undefined,
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text after last code block
  if (lastIndex < remaining.length) {
    segments.push({
      type: 'text',
      content: remaining.slice(lastIndex),
    });
  }
  
  // Now parse inline code within text segments
  const finalSegments: ParsedSegment[] = [];
  
  for (const segment of segments) {
    if (segment.type === 'text') {
      const inlineCodeRegex = /`([^`]+)`/g;
      let textRemaining = segment.content;
      let textLastIndex = 0;
      let inlineMatch;
      
      while ((inlineMatch = inlineCodeRegex.exec(textRemaining)) !== null) {
        // Add text before inline code
        if (inlineMatch.index > textLastIndex) {
          finalSegments.push({
            type: 'text',
            content: textRemaining.slice(textLastIndex, inlineMatch.index),
          });
        }
        
        // Add inline code
        finalSegments.push({
          type: 'inline-code',
          content: inlineMatch[1],
        });
        
        textLastIndex = inlineMatch.index + inlineMatch[0].length;
      }
      
      // Add remaining text
      if (textLastIndex < textRemaining.length) {
        finalSegments.push({
          type: 'text',
          content: textRemaining.slice(textLastIndex),
        });
      }
    } else {
      finalSegments.push(segment);
    }
  }
  
  return finalSegments;
};

// Escape HTML entities
const escapeHtml = (text: string): string => {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, char => entities[char]);
};

// Parse text content (markdown, URLs, mentions, channels, colors)
export const parseTextContent = (
  content: string,
  currentUserId?: string,
  usersMap?: Map<string, UserInfo>,
  customEmojiMap?: Map<string, string>,
  channelsMap?: Map<string, ChannelInfo>
): string => {
  // Process separator - use a unique placeholder that won't be escaped
  const SEPARATOR_PLACEHOLDER = '___SEPARATOR_DOTS_PLACEHOLDER___';
  const lines = content.split('\n');
  const processedLines = lines.map(line => {
    // Check if this line is a separator (--- with optional whitespace)
    if (/^\s*---\s*$/.test(line)) {
      return SEPARATOR_PLACEHOLDER;
    }
    return line;
  });
  
  // Rejoin and escape HTML
  let parsed = escapeHtml(processedLines.join('\n'));
  
  // Replace placeholder with actual separator HTML (after escaping, so it won't be escaped again)
  parsed = parsed.replace(new RegExp(escapeHtml(SEPARATOR_PLACEHOLDER), 'g'), '<div class="separator-dots my-4 text-center text-muted-foreground" style="font-size: 1.5rem; letter-spacing: 0.5rem;">•••</div>');
  
  // Headings - must be at start of line or after newline
  // Process in reverse order (h3, h2, h1) to avoid conflicts
  // ### Heading 3
  parsed = parsed.replace(/^###\s+(.+?)$/gm, '<h3 class="text-lg font-semibold mt-2 mb-1">$1</h3>');
  // ## Heading 2
  parsed = parsed.replace(/^##\s+(.+?)$/gm, '<h2 class="text-xl font-semibold mt-3 mb-1">$1</h2>');
  // # Heading 1
  parsed = parsed.replace(/^#\s+(.+?)$/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>');
  
  // Bold **text**
  parsed = parsed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Italic *text* (but not inside URLs)
  parsed = parsed.replace(/(?<![:/])\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  
  // Strikethrough ~~text~~
  parsed = parsed.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  
  // Underline __text__
  parsed = parsed.replace(/__([^_]+)__/g, '<u>$1</u>');
  
  // Spoiler ||text|| - interactive reveal on click
  parsed = parsed.replace(
    /\|\|([^|]+)\|\|/g,
    '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')" role="button" tabindex="0" onkeydown="if(event.key===\'Enter\'||event.key===\' \')this.classList.toggle(\'revealed\')">$1</span>'
  );
  
  // Color syntax [color:text] - supports red, orange, yellow, green, blue, purple, pink
  parsed = parsed.replace(
    /\[(red|orange|yellow|green|blue|purple|pink):([^\]]+)\]/gi,
    (_, color, text) => `<span class="text-color-${color.toLowerCase()}">${text}</span>`
  );
  
  // Images with custom format [img:align:width:url]
  parsed = parsed.replace(/\[img:(\w+):([^:]+):([^\]]+)\]/g, (match, align, width, url) => {
    const widthStyle = width !== 'auto' ? `width="${width}"` : '';
    const alignClass = align === 'center' ? 'mx-auto block' : align === 'right' ? 'ml-auto block' : 'mr-auto block';
    return `<img src="${escapeHtml(url)}" alt="Image" ${widthStyle} class="${alignClass} max-w-full rounded-lg my-2 cursor-pointer hover:opacity-90" loading="lazy" data-image-url="${escapeHtml(url)}" data-align="${align}" />`;
  });
  
  // URLs - render image URLs inline, others as links (only safe URLs)
  const urlPattern = /https?:\/\/[^\s<]+/g;
  parsed = parsed.replace(
    urlPattern,
    (url) => {
      // Validate URL is safe before linkifying
      if (!isSafeUrl(url)) {
        return escapeHtml(url); // Don't linkify unsafe URLs
      }
      if (isImageUrl(url)) {
        // Render image inline where it appears - constrained width for all screens, left-aligned
        return `<img src="${escapeHtml(url)}" alt="Image" class="block mr-auto max-w-[320px] sm:max-w-[400px] max-h-80 rounded-lg my-2 cursor-pointer hover:opacity-90 object-contain" loading="lazy" data-image-url="${escapeHtml(url)}" />`;
      }
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="message-link">${escapeHtml(url)}</a>`;
    }
  );
  
  // @everyone and @here
  parsed = parsed.replace(
    /@(everyone|here)\b/gi,
    '<span class="mention mention-everyone">@$1</span>'
  );
  
  // User mentions <@userId> - make them clickable with cursor pointer
  parsed = parsed.replace(
    /&lt;@(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})&gt;/g,
    (match, userId) => {
      const isSelf = userId === currentUserId;
      const userInfo = usersMap?.get(userId);
      // Use nickname first, then display_name, then username, fallback to 'user'
      const displayName = userInfo?.nickname || userInfo?.display_name || userInfo?.username || 'user';
      return `<span class="mention mention-clickable${isSelf ? ' mention-self' : ''}" data-user-id="${userId}" role="button" tabindex="0">@${escapeHtml(displayName)}</span>`;
    }
  );

  // Channel tags <#channelId> - make them clickable with cursor pointer
  parsed = parsed.replace(
    /&lt;#(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})&gt;/g,
    (match, channelId) => {
      const channelInfo = channelsMap?.get(channelId);
      const channelName = channelInfo?.name || 'channel';
      return `<span class="channel-tag channel-tag-clickable" data-channel-id="${channelId}" role="button" tabindex="0">#${escapeHtml(channelName)}</span>`;
    }
  );

  // Custom emojis :name: (server scope)
  if (customEmojiMap && customEmojiMap.size > 0) {
    parsed = parsed.replace(/:([a-z0-9_]{2,32}):/g, (full, name: string) => {
      const url = customEmojiMap.get(name);
      if (!url) return full;
      const safeUrl = escapeHtml(url);
      const safeName = escapeHtml(name);
      return `<img src="${safeUrl}" alt=":${safeName}:" title=":${safeName}:" class="inline-block w-8 h-8 align-middle object-contain" loading="lazy" />`;
    });
  }
  
  // Convert newlines to <br>
  parsed = parsed.replace(/\n/g, '<br>');
  
  return parsed;
};

export const MessageContent = ({ content, currentUserId, messageId, users, messageUser, hideEmbeds = false }: MessageContentProps) => {
  const navigate = useNavigate();
  const { linkPreviewsEnabled, openModal } = useUIStore();
  const { members, currentServer, channels, setCurrentChannel } = useServerStore();
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [customEmojiMap, setCustomEmojiMap] = useState<Map<string, string>>(new Map());
  const segments = useMemo(() => parseMessageSegments(content), [content]);

  // Load server emoji map for :name: rendering (server context only)
  useEffect(() => {
    const serverId = currentServer?.id;
    if (!serverId) {
      setCustomEmojiMap(new Map());
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const load = async (attempt: number) => {
      try {
        const emojis = await fetchServerEmojis(serverId, { force: attempt > 0 });
        if (cancelled) return;
        const map = new Map<string, string>();
        emojis.forEach((e) => map.set(e.name, e.url));
        setCustomEmojiMap(map);
      } catch (e) {
        console.error('Failed to load server emojis for message rendering:', e);
        if (cancelled) return;
        setCustomEmojiMap(new Map());

        // Retry a few times on refresh/load: otherwise messages can remain as :name:
        // even if the failure was transient (network timing, offline->online, etc).
        if (attempt < 3) {
          const backoffMs = 750 * Math.pow(2, attempt);
          retryTimer = setTimeout(() => load(attempt + 1), backoffMs);
        }
      }
    };

    load(0);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [currentServer?.id]);
  
  // Build a map of userId -> user info for quick lookup
  const usersMap = useMemo(() => {
    const map = new Map<string, UserInfo>();
    
    // Add users from props (for DMs)
    if (users) {
      users.forEach(u => map.set(u.id, u));
    }
    
    // Add message user (important for system messages where user might not be a member)
    if (messageUser) {
      map.set(messageUser.id, {
        id: messageUser.id,
        username: messageUser.username,
        display_name: messageUser.display_name,
        nickname: undefined, // Message user doesn't have nickname context
      });
    }
    
    // Add members from server store (for channel messages)
    members.forEach(member => {
      if (member.user) {
        map.set(member.user_id, {
          id: member.user_id,
          username: member.user.username,
          display_name: member.user.display_name,
          nickname: member.nickname,
        });
      }
    });
    
    return map;
  }, [users, members, messageUser]);

  // Build a map of channelId -> channel info for quick lookup
  const channelsMap = useMemo(() => {
    const map = new Map<string, ChannelInfo>();
    channels.forEach(channel => {
      map.set(channel.id, {
        id: channel.id,
        name: channel.name,
      });
    });
    return map;
  }, [channels]);
  
  // Extract URLs for link previews (only from text segments, not code blocks)
  // Separate image URLs from regular URLs
  const { imageUrls, linkUrls } = useMemo(() => {
    const textContent = segments
      .filter(s => s.type === 'text')
      .map(s => s.content)
      .join(' ');
    const allUrls = extractUrls(textContent);
    
    return {
      imageUrls: allUrls.filter(url => isImageUrl(url)),
      linkUrls: allUrls.filter(url => !isImageUrl(url)),
    };
  }, [segments]);

  const inviteCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const url of linkUrls) {
      const match = url.match(/\/invite\/([A-Za-z0-9]{8})/);
      if (match?.[1]) codes.add(match[1].toUpperCase());
    }
    return Array.from(codes);
  }, [linkUrls]);

  const nonInviteLinkUrls = useMemo(() => {
    if (inviteCodes.length === 0) return linkUrls;
    return linkUrls.filter((url) => !/\/invite\/[A-Za-z0-9]{8}/.test(url));
  }, [inviteCodes, linkUrls]);
  
  // Handle click on mentions and channel tags using event delegation
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    
    // Handle inline image clicks
    if (target.tagName === 'IMG' && target.dataset.imageUrl) {
      e.preventDefault();
      e.stopPropagation();
      setLightboxImage(target.dataset.imageUrl);
      return;
    }
    
    if (target.classList.contains('mention-clickable') && target.dataset.userId) {
      e.preventDefault();
      e.stopPropagation();
      openModal('userProfile', { userId: target.dataset.userId });
    }
    if (target.classList.contains('channel-tag-clickable') && target.dataset.channelId) {
      e.preventDefault();
      e.stopPropagation();
      const channelId = target.dataset.channelId;
      const channel = channels.find(c => c.id === channelId);
      if (channel && currentServer) {
        setCurrentChannel(channel);
        navigate(`/app/servers/${currentServer.id}/channels/${channelId}`);
      }
    }
  }, [openModal, channels, currentServer, setCurrentChannel, navigate, setLightboxImage]);

  // Handle keyboard activation for accessibility
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const target = e.target as HTMLElement;
      if (target.classList.contains('mention-clickable') && target.dataset.userId) {
        e.preventDefault();
        openModal('userProfile', { userId: target.dataset.userId });
      }
      if (target.classList.contains('channel-tag-clickable') && target.dataset.channelId) {
        e.preventDefault();
        const channelId = target.dataset.channelId;
        const channel = channels.find(c => c.id === channelId);
        if (channel && currentServer) {
          setCurrentChannel(channel);
          navigate(`/app/servers/${currentServer.id}/channels/${channelId}`);
        }
      }
    }
  }, [openModal, channels, currentServer, setCurrentChannel, navigate]);
  
  return (
    <div className="!block break-words overflow-hidden max-w-full" onClick={handleClick} onKeyDown={handleKeyDown} data-message-id={messageId}>
      {/* Message text content */}
      <span className="inline">
        {segments.map((segment, index) => {
          switch (segment.type) {
            case 'code-block':
              return (
                <CodeBlock 
                  key={index} 
                  code={segment.content} 
                  language={segment.language} 
                />
              );
            case 'inline-code':
              return <InlineCode key={index}>{segment.content}</InlineCode>;
            case 'text':
              return (
                <span
                  key={index}
                  dangerouslySetInnerHTML={{
                    __html: parseTextContent(segment.content, currentUserId, usersMap, customEmojiMap, channelsMap),
                  }}
                />
              );
            default:
              return null;
          }
        })}
      </span>

      {/* Invite link previews */}
      {inviteCodes.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          {inviteCodes.slice(0, 3).map((code) => (
            <InviteLinkPreview key={code} inviteCode={code} />
          ))}
        </div>
      )}

      {/* Link previews (excluding image URLs) */}
      {linkPreviewsEnabled && !hideEmbeds && nonInviteLinkUrls.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          {nonInviteLinkUrls.slice(0, 3).map((url, index) => (
            <LinkPreview 
              key={`${url}-${index}`} 
              url={url} 
              disabled={!linkPreviewsEnabled}
              messageId={messageId}
            />
          ))}
        </div>
      )}

      {/* Image lightbox with all images for thumbnail navigation */}
      <ImageLightbox
        imageUrl={lightboxImage}
        imageUrls={imageUrls}
        onClose={() => setLightboxImage(null)}
      />
    </div>
  );
};

interface ReplyPreviewProps {
  content: string;
  maxLength?: number;
  usersMap?: Map<string, UserInfo>;
}

export const ReplyPreview = ({ content, maxLength = 50, usersMap }: ReplyPreviewProps) => {
  const { currentServer, members } = useServerStore();
  const [customEmojiMap, setCustomEmojiMap] = useState<Map<string, string>>(new Map());

  // Build users map from members if not provided
  const resolvedUsersMap = useMemo(() => {
    if (usersMap && usersMap.size > 0) return usersMap;
    
    const map = new Map<string, UserInfo>();
    members.forEach(member => {
      if (member.user) {
        map.set(member.user_id, {
          id: member.user_id,
          username: member.user.username,
          display_name: member.user.display_name,
          nickname: member.nickname,
        });
      }
    });
    return map;
  }, [usersMap, members]);

  // Load server emoji map for :name: rendering
  useEffect(() => {
    const serverId = currentServer?.id;
    if (!serverId) {
      setCustomEmojiMap(new Map());
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const emojis = await fetchServerEmojis(serverId);
        if (cancelled) return;
        const map = new Map<string, string>();
        emojis.forEach((e) => map.set(e.name, e.url));
        setCustomEmojiMap(map);
      } catch (e) {
        console.error('Failed to load server emojis for reply preview:', e);
        if (cancelled) return;
        setCustomEmojiMap(new Map());
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [currentServer?.id]);

  // Strip markdown and prepare content
  const stripped = useMemo(() => {
    let result = content
      .replace(/```[\s\S]*?```/g, '[code]')
      .replace(/`[^`]+`/g, '[code]')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/\|\|([^|]+)\|\|/g, '[spoiler]')
      .replace(/\n/g, ' ');
    
    // Convert <@userId> mentions to @username
    result = result.replace(
      /<@(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})>/g,
      (match, userId) => {
        const userInfo = resolvedUsersMap.get(userId);
        const displayName = userInfo?.nickname || userInfo?.display_name || userInfo?.username || 'user';
        return `@${displayName}`;
      }
    );

    // Convert <#channelId> to #channel
    result = result.replace(/<#\w{8}-\w{4}-\w{4}-\w{4}-\w{12}>/g, '#channel');
    
    result = result.trim();
    
    if (result.length > maxLength) {
      result = result.slice(0, maxLength - 3) + '...';
    }
    
    return result;
  }, [content, maxLength, resolvedUsersMap]);

  // Replace custom emojis
  const rendered = useMemo(() => {
    if (customEmojiMap.size === 0) return stripped;
    
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    const emojiRegex = /:([a-z0-9_]{2,32}):/g;
    let match;
    
    while ((match = emojiRegex.exec(stripped)) !== null) {
      // Add text before emoji
      if (match.index > lastIndex) {
        parts.push(stripped.slice(lastIndex, match.index));
      }
      
      // Add emoji if found
      const emojiName = match[1];
      const emojiUrl = customEmojiMap.get(emojiName);
      if (emojiUrl) {
        parts.push(
          <img
            key={`emoji-${match.index}`}
            src={emojiUrl}
            alt={`:${emojiName}:`}
            title={`:${emojiName}:`}
            className="inline-block w-4 h-4 align-text-bottom object-contain"
            loading="lazy"
          />
        );
      } else {
        parts.push(match[0]);
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < stripped.length) {
      parts.push(stripped.slice(lastIndex));
    }
    
    return parts.length > 0 ? parts : stripped;
  }, [stripped, customEmojiMap]);

  return <>{rendered}</>;
};