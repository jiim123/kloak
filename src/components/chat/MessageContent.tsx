import { useMemo, useCallback } from 'react';
import { CodeBlock, InlineCode } from './CodeBlock';
import { LinkPreview } from './LinkPreview';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';

interface UserInfo {
  id: string;
  username: string;
  display_name?: string | null;
  nickname?: string | null;
}

interface MessageContentProps {
  content: string;
  currentUserId?: string;
  messageId?: string;
  users?: UserInfo[];
}

interface ParsedSegment {
  type: 'text' | 'code-block' | 'inline-code';
  content: string;
  language?: string;
}

// Extract URLs from content
const extractUrls = (content: string): string[] => {
  const urlPattern = /https?:\/\/[^\s<>`\]]+/g;
  const matches = content.match(urlPattern) || [];
  // Return unique URLs
  return [...new Set(matches)];
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

// Parse text content (markdown, URLs, mentions, colors)
const parseTextContent = (content: string, currentUserId?: string, usersMap?: Map<string, UserInfo>): string => {
  let parsed = escapeHtml(content);
  
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
  
  // URLs
  const urlPattern = /https?:\/\/[^\s<]+/g;
  parsed = parsed.replace(
    urlPattern,
    (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="message-link">${url}</a>`
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
  
  // Convert newlines to <br>
  parsed = parsed.replace(/\n/g, '<br>');
  
  return parsed;
};

export const MessageContent = ({ content, currentUserId, messageId, users }: MessageContentProps) => {
  const { linkPreviewsEnabled, openModal } = useUIStore();
  const { members } = useServerStore();
  const segments = useMemo(() => parseMessageSegments(content), [content]);
  
  // Build a map of userId -> user info for quick lookup
  const usersMap = useMemo(() => {
    const map = new Map<string, UserInfo>();
    
    // Add users from props (for DMs)
    if (users) {
      users.forEach(u => map.set(u.id, u));
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
  }, [users, members]);
  
  // Extract URLs for link previews (only from text segments, not code blocks)
  const urls = useMemo(() => {
    const textContent = segments
      .filter(s => s.type === 'text')
      .map(s => s.content)
      .join(' ');
    return extractUrls(textContent);
  }, [segments]);
  // Handle click on mentions using event delegation
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('mention-clickable') && target.dataset.userId) {
      e.preventDefault();
      e.stopPropagation();
      openModal('userProfile', { userId: target.dataset.userId });
    }
  }, [openModal]);

  // Handle keyboard activation for accessibility
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const target = e.target as HTMLElement;
      if (target.classList.contains('mention-clickable') && target.dataset.userId) {
        e.preventDefault();
        openModal('userProfile', { userId: target.dataset.userId });
      }
    }
  }, [openModal]);
  
  return (
    <div className="break-words" onClick={handleClick} onKeyDown={handleKeyDown}>
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
                  __html: parseTextContent(segment.content, currentUserId, usersMap),
                }}
              />
            );
          default:
            return null;
        }
      })}
      
      {/* Link previews */}
      {linkPreviewsEnabled && urls.length > 0 && (
        <div className="flex flex-col gap-2">
          {urls.slice(0, 3).map((url, index) => (
            <LinkPreview 
              key={`${url}-${index}`} 
              url={url} 
              disabled={!linkPreviewsEnabled}
              messageId={messageId}
            />
          ))}
        </div>
      )}
    </div>
  );
};