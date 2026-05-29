/**
 * Message parsing and processing utilities for Kloak
 * Handles markdown, mentions, URLs, and content extraction
 */

export interface Mention {
  type: 'user' | 'everyone' | 'here' | 'role';
  id?: string;
  raw: string;
}

/**
 * Check if a URL is an image URL
 */
export const isImageUrl = (url: string): boolean => {
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
    /supabase\.co\/storage/i, // Supabase storage
    /klipy/i, // Klipy GIF CDN
  ];
  
  return imageHosts.some(pattern => pattern.test(url));
};

/**
 * Check if message content is image-only (single image URL with no other text)
 */
export const isImageOnlyMessage = (content: string): boolean => {
  const trimmed = content.trim();
  // Must be a single URL with no other content
  const urlPattern = /^https?:\/\/[^\s]+$/;
  if (!urlPattern.test(trimmed)) return false;
  return isImageUrl(trimmed);
};

/**
 * Extract image URL from image-only message content
 */
export const getImageUrlFromContent = (content: string): string | null => {
  if (!isImageOnlyMessage(content)) return null;
  return content.trim();
};

/**
 * Extract mentions from message content
 * Supports @username, @everyone, @here patterns
 */
export const extractMentions = (content: string): Mention[] => {
  const mentions: Mention[] = [];
  
  // Match @everyone
  if (/@everyone\b/gi.test(content)) {
    mentions.push({ type: 'everyone', raw: '@everyone' });
  }
  
  // Match @here
  if (/@here\b/gi.test(content)) {
    mentions.push({ type: 'here', raw: '@here' });
  }
  
  // Match user mentions: @username or <@userId>
  const userMentionPattern = /<@(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})>/g;
  let match;
  while ((match = userMentionPattern.exec(content)) !== null) {
    mentions.push({ type: 'user', id: match[1], raw: match[0] });
  }
  
  return mentions;
};

/**
 * Escape HTML entities
 */
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

/**
 * Parse message content and convert to HTML
 * - Markdown: **bold**, *italic*, `code`, ```codeblock```
 * - URLs: Convert to clickable links
 * - Mentions: Highlight @mentions
 */
export const parseMessageContent = (
  content: string,
  options: {
    highlightMentions?: boolean;
    currentUserId?: string;
    usersMap?: Map<string, { username: string; display_name?: string | null; nickname?: string | null }>;
  } = {}
): string => {
  const { highlightMentions = true, currentUserId, usersMap } = options;
  
  // First escape HTML
  let parsed = escapeHtml(content);
  
  // Code blocks (must be done first to prevent other parsing inside code)
  // Multi-line code blocks ```code```
  parsed = parsed.replace(
    /```(\w+)?\n?([\s\S]*?)```/g,
    '<pre class="code-block"><code class="language-$1">$2</code></pre>'
  );
  
  // Inline code `code`
  parsed = parsed.replace(
    /`([^`]+)`/g,
    '<code class="inline-code">$1</code>'
  );
  
  // Bold **text**
  parsed = parsed.replace(
    /\*\*([^*]+)\*\*/g,
    '<strong>$1</strong>'
  );
  
  // Italic *text* (but not inside URLs or after certain characters)
  parsed = parsed.replace(
    /(?<![:/])\*([^*]+)\*(?!\*)/g,
    '<em>$1</em>'
  );
  
  // Strikethrough ~~text~~
  parsed = parsed.replace(
    /~~([^~]+)~~/g,
    '<del>$1</del>'
  );
  
  // Underline __text__
  parsed = parsed.replace(
    /__([^_]+)__/g,
    '<u>$1</u>'
  );
  
  // Spoiler ||text||
  parsed = parsed.replace(
    /\|\|([^|]+)\|\|/g,
    '<span class="spoiler">$1</span>'
  );
  
  // URLs - convert to clickable links
  const urlPattern = /https?:\/\/[^\s<]+/g;
  parsed = parsed.replace(
    urlPattern,
    (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="message-link">${url}</a>`
  );
  
  // Mentions
  if (highlightMentions) {
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
        const userInfo = usersMap?.get(userId);
        // Use nickname first, then display_name, then username, fallback to 'user'
        const displayName = userInfo?.nickname || userInfo?.display_name || userInfo?.username || 'user';
        return `<span class="mention${isSelf ? ' mention-self' : ''}" data-user-id="${userId}">@${escapeHtml(displayName)}</span>`;
      }
    );

    // Role mentions <@&roleId> (ampersand is escaped to &amp;)
    parsed = parsed.replace(
      /&lt;@&amp;(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})&gt;/g,
      () => `<span class="mention mention-role">@role</span>`
    );
  }
  
  // Convert newlines to <br>
  parsed = parsed.replace(/\n/g, '<br>');
  
  return parsed;
};

/**
 * Strip markdown and HTML from message content for previews
 * Optionally converts <@userId> mentions to @username using a usersMap
 * Optionally converts <#channelId> tags to #channelname using a channelsMap
 */
export const stripMarkdown = (
  content: string,
  usersMap?: Map<string, { username: string; display_name?: string | null; nickname?: string | null }>,
  channelsMap?: Map<string, { name: string }>
): string => {
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
  if (usersMap) {
    result = result.replace(
      /<@(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})>/g,
      (match, userId) => {
        const userInfo = usersMap.get(userId);
        const displayName = userInfo?.nickname || userInfo?.display_name || userInfo?.username || 'user';
        return `@${displayName}`;
      }
    );
  } else {
    // Without usersMap, just remove the UUID format but keep a generic placeholder
    result = result.replace(/<@\w{8}-\w{4}-\w{4}-\w{4}-\w{12}>/g, '@user');
  }

  // Convert <#channelId> tags to #channelname
  if (channelsMap) {
    result = result.replace(
      /<#(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})>/g,
      (match, channelId) => {
        const channelInfo = channelsMap.get(channelId);
        const channelName = channelInfo?.name || 'channel';
        return `#${channelName}`;
      }
    );
  } else {
    // Without channelsMap, just remove the UUID format but keep a generic placeholder
    result = result.replace(/<#\w{8}-\w{4}-\w{4}-\w{4}-\w{12}>/g, '#channel');
  }
  
  return result.trim();
};

/**
 * Get plain text preview of message content
 * Optionally converts <@userId> mentions to @username using a usersMap
 */
export const getMessagePreview = (
  content: string,
  maxLength = 100,
  usersMap?: Map<string, { username: string; display_name?: string | null; nickname?: string | null }>,
  channelsMap?: Map<string, { name: string }>
): string => {
  const stripped = stripMarkdown(content, usersMap, channelsMap);
  if (stripped.length <= maxLength) return stripped;
  return stripped.slice(0, maxLength - 3) + '...'
};

/**
 * Convert raw message content with UUID mentions and channel tags to readable format for editing
 * Converts <@userId> to @username and <#channelId> to #channelname
 */
export const convertMentionsToReadable = (
  content: string,
  usersMap: Map<string, { username: string; display_name?: string | null; nickname?: string | null }>,
  channelsMap?: Map<string, { name: string }>
): string => {
  let result = content.replace(
    /<@(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})>/g,
    (match, userId) => {
      const userInfo = usersMap.get(userId);
      const displayName = userInfo?.nickname || userInfo?.display_name || userInfo?.username;
      return displayName ? `@${displayName}` : match;
    }
  );
  
  if (channelsMap) {
    result = result.replace(
      /<#(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})>/g,
      (match, channelId) => {
        const channelInfo = channelsMap.get(channelId);
        return channelInfo ? `#${channelInfo.name}` : match;
      }
    );
  }
  
  return result;
};

/**
 * Convert readable mentions and channel tags back to UUID format for saving
 * Converts @username to <@userId> and #channelname to <#channelId>
 */
export const convertMentionsToRaw = (
  content: string,
  usersMap: Map<string, { username: string; display_name?: string | null; nickname?: string | null }>,
  channelsMap?: Map<string, { name: string }>
): string => {
  // Build reverse lookup: username/display_name/nickname -> userId
  const namesToId = new Map<string, string>();
  usersMap.forEach((info, id) => {
    if (info.username) namesToId.set(info.username.toLowerCase(), id);
    if (info.display_name) namesToId.set(info.display_name.toLowerCase(), id);
    if (info.nickname) namesToId.set(info.nickname.toLowerCase(), id);
  });

  // Build reverse lookup for channels: channelname -> channelId
  const channelNamesToId = new Map<string, string>();
  if (channelsMap) {
    channelsMap.forEach((info, id) => {
      if (info.name) channelNamesToId.set(info.name.toLowerCase(), id);
    });
  }
  
  // Protect kloak-attachment:// references and existing <@uuid>/<#uuid> from being mangled
  const placeholders: string[] = [];
  let result = content.replace(
    /kloak-attachment:\/\/[^\s]+|<@[\w-]+>|<#[\w-]+>/g,
    (match) => {
      placeholders.push(match);
      return `\x00PLACEHOLDER_${placeholders.length - 1}\x00`;
    }
  );

  // Match @mentions
  result = result.replace(
    /@(\w+)/g,
    (match, name) => {
      if (name.toLowerCase() === 'everyone' || name.toLowerCase() === 'here') {
        return match;
      }
      const userId = namesToId.get(name.toLowerCase());
      return userId ? `<@${userId}>` : match;
    }
  );

  // Match #channels that are not already in <#uuid> format
  if (channelsMap) {
    result = result.replace(
      /#([\w-]+)/g,
      (match, name) => {
        const channelId = channelNamesToId.get(name.toLowerCase());
        return channelId ? `<#${channelId}>` : match;
      }
    );
  }

  // Restore protected references
  result = result.replace(/\x00PLACEHOLDER_(\d+)\x00/g, (_, idx) => placeholders[parseInt(idx)]);

  return result;
};
