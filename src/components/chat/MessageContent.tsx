import { useMemo } from 'react';
import { CodeBlock, InlineCode } from './CodeBlock';
import { LinkPreview } from './LinkPreview';
import { useUIStore } from '@/stores/uiStore';

interface MessageContentProps {
  content: string;
  currentUserId?: string;
  messageId?: string;
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

// Parse text content (markdown, URLs, mentions)
const parseTextContent = (content: string, currentUserId?: string): string => {
  let parsed = escapeHtml(content);
  
  // Bold **text**
  parsed = parsed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Italic *text* (but not inside URLs)
  parsed = parsed.replace(/(?<![:/])\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  
  // Strikethrough ~~text~~
  parsed = parsed.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  
  // Underline __text__
  parsed = parsed.replace(/__([^_]+)__/g, '<u>$1</u>');
  
  // Spoiler ||text||
  parsed = parsed.replace(
    /\|\|([^|]+)\|\|/g,
    '<span class="spoiler">$1</span>'
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
  
  // User mentions <@userId>
  parsed = parsed.replace(
    /&lt;@(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})&gt;/g,
    (match, userId) => {
      const isSelf = userId === currentUserId;
      return `<span class="mention${isSelf ? ' mention-self' : ''}" data-user-id="${userId}">@user</span>`;
    }
  );
  
  // Convert newlines to <br>
  parsed = parsed.replace(/\n/g, '<br>');
  
  return parsed;
};

export const MessageContent = ({ content, currentUserId, messageId }: MessageContentProps) => {
  const { linkPreviewsEnabled } = useUIStore();
  const segments = useMemo(() => parseMessageSegments(content), [content]);
  
  // Extract URLs for link previews (only from text segments, not code blocks)
  const urls = useMemo(() => {
    const textContent = segments
      .filter(s => s.type === 'text')
      .map(s => s.content)
      .join(' ');
    return extractUrls(textContent);
  }, [segments]);
  
  return (
    <div className="break-words">
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
                  __html: parseTextContent(segment.content, currentUserId),
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