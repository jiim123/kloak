import { useMemo, useCallback, useEffect, useState, useRef } from "react";
import { isSupabaseAttachmentUrl, resolveSignedUrl } from "@/lib/signedUrl";
import { replaceNativeEmojisInElement } from "@/lib/fluentEmoji";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CodeBlock, InlineCode } from "./CodeBlock";
import { LinkPreview } from "./LinkPreview";
import { InviteLinkPreview } from "./InviteLinkPreview";
import { ImageLightbox } from "@/components/modals/ImageLightbox";
import { CustomEmojiPopover } from "./CustomEmojiPopover";
import { useUIStore } from "@/stores/uiStore";
import { useServerStore } from "@/stores/serverStore";
import { fetchServerEmojis } from "@/lib/serverEmojis";
import { getUserFromCache, getOrFetchUser } from "@/stores/userCacheStore";
import { getGifStillPreview, isGifUrl } from "@/lib/gifPreview";
import {
  getGlobalEmojiMap,
  getGlobalEmojiDuplicates,
  resolveQualifiedEmoji,
  resolveEmojisByNameFallback,
  resolveQualifiedEmojisByNameFallback,
  type ResolvedEmoji,
} from "@/lib/globalEmojiResolver";
import { openUserProfileModal, SIDE_ALIGNED_USER_PROFILE_POPOVER } from "@/lib/userProfilePopover";

interface UserInfo {
  id: string;
  username: string;
  display_name?: string | null;
  nickname?: string | null;
}

interface ChannelInfo {
  id: string;
  name: string;
  type?: string;
}

interface MessageContentProps {
  content: string;
  currentUserId?: string;
  messageId?: string;
  users?: UserInfo[];
  messageUser?: UserInfo | null;
  hideEmbeds?: boolean;
  customEmojiMap?: Map<string, string>;
  globalEmojiMap?: Map<string, ResolvedEmoji>;
}

interface ParsedSegment {
  type: "text" | "code-block" | "inline-code";
  content: string;
  language?: string;
}

const INLINE_CUSTOM_EMOJI_TOKEN_REGEX = /:ce\[([a-z0-9_]{2,12})\|([a-z0-9/_\.-]{1,300})\]:/g;
const CUSTOM_EMOJI_TEXT_REGEX = /:([a-z0-9_]{2,12})(?:~([^:]{1,50}))?:/g;
const CUSTOM_EMOJI_RENDER_REGEX =
  /:ce\[([a-z0-9_]{2,12})\|([a-z0-9/_\.-]{1,300})\]:|:([a-z0-9_]{2,12})(?:~([^:]{1,50}))?:/g;

const getServerEmojiPublicUrl = (filePath: string): string => {
  const { data } = supabase.storage.from("server-emojis").getPublicUrl(filePath);
  return data.publicUrl;
};

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
    /klipy/i, // Klipy GIF CDN
  ];

  return imageHosts.some((pattern) => pattern.test(url));
};

// Validate URL is safe (only http/https protocols)
const isSafeUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const shouldWarnForExternalUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    return parsed.origin !== window.location.origin;
  } catch {
    return false;
  }
};

const getSupabaseHost = (): string | null => {
  try {
    const raw = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (!raw) return null;
    return new URL(raw).host.toLowerCase();
  } catch {
    return null;
  }
};

const SUPABASE_HOST = getSupabaseHost();

// Only inline images that are first-party/trusted; external image links remain non-inline.
const isTrustedInlineImageUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;

    const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
    if (currentOrigin && parsed.origin === currentOrigin) return true;

    if (SUPABASE_HOST && parsed.host.toLowerCase() === SUPABASE_HOST) {
      if (parsed.pathname.includes("/storage/v1/object/")) return true;
      if (parsed.pathname.endsWith("/functions/v1/fetch-link-preview-asset")) return true;
    }

    // Trust Klipy GIF CDN URLs
    if (/klipy/i.test(parsed.host)) return true;

    return false;
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
  const remaining = content;

  // Match code blocks first: ```language\ncode``` or ```code```
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(remaining)) !== null) {
    // Add text before this code block
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: remaining.slice(lastIndex, match.index),
      });
    }

    // Add code block
    segments.push({
      type: "code-block",
      content: match[2].trim(),
      language: match[1] || undefined,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last code block
  if (lastIndex < remaining.length) {
    segments.push({
      type: "text",
      content: remaining.slice(lastIndex),
    });
  }

  // Now parse inline code within text segments
  const finalSegments: ParsedSegment[] = [];

  for (const segment of segments) {
    if (segment.type === "text") {
      const inlineCodeRegex = /`([^`]+)`/g;
      const textRemaining = segment.content;
      let textLastIndex = 0;
      let inlineMatch;

      while ((inlineMatch = inlineCodeRegex.exec(textRemaining)) !== null) {
        // Add text before inline code
        if (inlineMatch.index > textLastIndex) {
          finalSegments.push({
            type: "text",
            content: textRemaining.slice(textLastIndex, inlineMatch.index),
          });
        }

        // Add inline code
        finalSegments.push({
          type: "inline-code",
          content: inlineMatch[1],
        });

        textLastIndex = inlineMatch.index + inlineMatch[0].length;
      }

      // Add remaining text
      if (textLastIndex < textRemaining.length) {
        finalSegments.push({
          type: "text",
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
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => entities[char]);
};

// Parse text content (markdown, URLs, mentions, channels, colors)
export const parseTextContent = (
  content: string,
  currentUserId?: string,
  usersMap?: Map<string, UserInfo>,
  customEmojiMap?: Map<string, string>,
  channelsMap?: Map<string, ChannelInfo>,
  globalEmojiMap?: Map<string, ResolvedEmoji>,
): string => {
  // Process separator - use a unique placeholder that won't be escaped
  const SEPARATOR_PLACEHOLDER = "___SEPARATOR_DOTS_PLACEHOLDER___";
  const lines = content.split("\n");
  const processedLines = lines.map((line) => {
    // Check if this line is a separator (--- with optional whitespace)
    if (/^\s*---\s*$/.test(line)) {
      return SEPARATOR_PLACEHOLDER;
    }
    return line;
  });

  // Rejoin and escape HTML
  let parsed = escapeHtml(processedLines.join("\n"));

  // Replace placeholder with actual separator HTML (after escaping, so it won't be escaped again)
  parsed = parsed.replace(
    new RegExp(escapeHtml(SEPARATOR_PLACEHOLDER), "g"),
    '<div class="separator-dots my-4 text-center text-muted-foreground" style="font-size: 1.5rem; letter-spacing: 0.5rem;">•••</div>',
  );

  // Bold **text**
  parsed = parsed.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Italic *text* (but not inside URLs)
  parsed = parsed.replace(/(?<![:/])\*([^*]+)\*(?!\*)/g, "<em>$1</em>");

  // Strikethrough ~~text~~
  parsed = parsed.replace(/~~([^~]+)~~/g, "<del>$1</del>");

  // Underline __text__
  parsed = parsed.replace(/__([^_]+)__/g, "<u>$1</u>");

  // Spoiler ||text|| - interactive reveal on click
  parsed = parsed.replace(
    /\|\|([^|]+)\|\|/g,
    '<span class="spoiler" data-spoiler="true" role="button" tabindex="0">$1</span>',
  );

  // Color syntax [color:text] - supports red, orange, yellow, green, blue, purple, pink
  parsed = parsed.replace(
    /\[(red|orange|yellow|green|blue|purple|pink):([^\]]+)\]/gi,
    (_, color, text) => `<span class="text-color-${color.toLowerCase()}">${text}</span>`,
  );

  // Images with custom format [img:align:width:url]
  parsed = parsed.replace(/\[img:(\w+):([^:]+):([^\]]+)\]/g, (match, align, width, url) => {
    if (!isSafeUrl(url)) return escapeHtml(match);
    const alignClass = align === "center" ? "mx-auto block" : align === "right" ? "ml-auto block" : "mr-auto block";
    if (isTrustedInlineImageUrl(url)) {
      const widthStyle = width !== "auto" ? `width="${escapeHtml(width)}"` : "";
      return `<img src="${escapeHtml(url)}" alt="Image" ${widthStyle} class="${alignClass} max-w-full rounded-lg my-2 cursor-pointer hover:opacity-90" loading="lazy" data-image-url="${escapeHtml(url)}" data-align="${align}" />`;
    }
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="${alignClass} message-link">View image</a>`;
  });

  // URLs - render image URLs inline, others as links (only safe URLs)
  const urlPattern = /https?:\/\/[^\s<]+/g;
  parsed = parsed.replace(urlPattern, (url) => {
    // Validate URL is safe before linkifying
    if (!isSafeUrl(url)) {
      return escapeHtml(url); // Don't linkify unsafe URLs
    }
    if (isImageUrl(url)) {
      if (isTrustedInlineImageUrl(url)) {
        return `<img src="${escapeHtml(url)}" alt="Image" class="block mr-auto max-w-[320px] sm:max-w-[400px] max-h-80 rounded-lg my-2 cursor-pointer hover:opacity-90 object-contain" loading="lazy" data-image-url="${escapeHtml(url)}" />`;
      }
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="message-link">${escapeHtml(url)}</a>`;
    }
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="message-link">${escapeHtml(url)}</a>`;
  });

  // @everyone and @here
  parsed = parsed.replace(/@(everyone|here)\b/gi, '<span class="mention mention-everyone">@$1</span>');

  // User mentions <@userId> - make them clickable with cursor pointer
  parsed = parsed.replace(/&lt;@(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})&gt;/g, (match, userId) => {
    const isSelf = userId === currentUserId;
    const userInfo = usersMap?.get(userId);
    // Use nickname first, then display_name, then username, fallback to 'user'
    const displayName = userInfo?.nickname || userInfo?.display_name || userInfo?.username || "user";
    return `<span class="mention mention-clickable${isSelf ? " mention-self" : ""}" data-user-id="${userId}" role="button" tabindex="0">@${escapeHtml(displayName)}</span>`;
  });

  // Channel tags <#channelId> - make them clickable with cursor pointer
  parsed = parsed.replace(/&lt;#(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})&gt;/g, (match, channelId) => {
    const channelInfo = channelsMap?.get(channelId);
    const channelName = channelInfo?.name || "channel";
    return `<span class="channel-tag channel-tag-clickable" data-channel-id="${channelId}" role="button" tabindex="0">#${escapeHtml(channelName)}</span>`;
  });

  // Custom emojis :name: or :name~ServerName: — check current server first, then global (cross-server)
  parsed = parsed.replace(CUSTOM_EMOJI_TEXT_REGEX, (full, name: string, qualifier?: string) => {
    // 1. Current server emoji (no popup needed) — only for unqualified names
    if (!qualifier) {
      const localUrl = customEmojiMap?.get(name);
      if (localUrl) {
        const safeUrl = escapeHtml(localUrl);
        const safeName = escapeHtml(name);
        return `<img src="${safeUrl}" alt=":${safeName}:" title=":${safeName}:" class="inline-block w-8 h-8 align-middle object-contain" loading="lazy" />`;
      }
    }
    // 2. Qualified name :name~ServerName: — look up specific server
    if (qualifier) {
      const resolved = resolveQualifiedEmoji(`${name}~${qualifier}`);
      if (resolved) {
        const safeUrl = escapeHtml(resolved.url);
        const safeName = escapeHtml(name);
        const safeServer = escapeHtml(qualifier);
        return `<img src="${safeUrl}" alt=":${safeName}~${safeServer}:" title=":${safeName}~${safeServer}:" class="inline-block w-8 h-8 align-middle object-contain cursor-pointer hover:scale-110 transition-transform" loading="lazy" data-cross-emoji="${safeName}" data-cross-emoji-server="${safeServer}" />`;
      }
      return full;
    }
    // 3. Unqualified cross-server emoji
    const global = globalEmojiMap?.get(name);
    if (global) {
      const safeUrl = escapeHtml(global.url);
      const safeName = escapeHtml(name);
      return `<img src="${safeUrl}" alt=":${safeName}:" title=":${safeName}:" class="inline-block w-8 h-8 align-middle object-contain cursor-pointer hover:scale-110 transition-transform" loading="lazy" data-cross-emoji="${safeName}" />`;
    }
    return full;
  });

  // Inline custom emoji token with embedded file path:
  // :ce[name|server_id/file-name.ext]:
  // Run this after the normal :name: pass so the `alt`/`title` attributes we generate
  // do not get re-matched and corrupt the emitted <img> HTML.
  parsed = parsed.replace(INLINE_CUSTOM_EMOJI_TOKEN_REGEX, (_full, name: string, filePath: string) => {
    const safeName = escapeHtml(name);
    const safeUrl = escapeHtml(getServerEmojiPublicUrl(filePath));
    return `<img src="${safeUrl}" alt=":${safeName}:" title=":${safeName}:" class="inline-block w-8 h-8 align-middle object-contain cursor-pointer hover:scale-110 transition-transform" loading="lazy" data-cross-emoji="${safeName}" data-cross-emoji-file-path="${escapeHtml(filePath)}" />`;
  });

  // Convert newlines to <br>
  parsed = parsed.replace(/\n/g, "<br>");

  return parsed;
};

export const MessageContent = ({
  content,
  currentUserId,
  messageId,
  users,
  messageUser,
  hideEmbeds = false,
  customEmojiMap: providedCustomEmojiMap,
  globalEmojiMap: providedGlobalEmojiMap,
}: MessageContentProps) => {
  const navigate = useNavigate();
  const { linkPreviewsEnabled, openModal } = useUIStore();
  const { members, currentServer, channels, setCurrentChannel } = useServerStore();
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [localCustomEmojiMap, setLocalCustomEmojiMap] = useState<Map<string, string>>(new Map());
  const [localGlobalEmojiMap, setLocalGlobalEmojiMap] = useState<Map<string, ResolvedEmoji>>(new Map());
  const [emojiPopover, setEmojiPopover] = useState<{ emoji: ResolvedEmoji; rect: DOMRect } | null>(null);
  const [mentionedUsersMap, setMentionedUsersMap] = useState<Map<string, UserInfo>>(new Map());
  const contentRef = useRef<HTMLDivElement>(null);
  const segments = useMemo(() => parseMessageSegments(content), [content]);
  const effectiveCustomEmojiMap = providedCustomEmojiMap ?? localCustomEmojiMap;
  const effectiveGlobalEmojiMap = providedGlobalEmojiMap ?? localGlobalEmojiMap;

  const mentionedUserIds = useMemo(() => {
    const ids = new Set<string>();
    const mentionRegex = /<@(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})>/g;
    let match: RegExpExecArray | null;
    while ((match = mentionRegex.exec(content)) !== null) {
      if (match[1]) ids.add(match[1]);
    }
    return Array.from(ids);
  }, [content]);

  // Load server emoji map for :name: rendering (server context only)
  useEffect(() => {
    if (providedCustomEmojiMap) return;
    const serverId = currentServer?.id;
    if (!serverId) {
      setLocalCustomEmojiMap(new Map());
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
        setLocalCustomEmojiMap(map);
      } catch (e) {
        console.error("Failed to load server emojis for message rendering:", e);
        if (cancelled) return;
        setLocalCustomEmojiMap(new Map());

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
  }, [currentServer?.id, providedCustomEmojiMap]);

  // Load global cross-server emoji map
  useEffect(() => {
    if (providedGlobalEmojiMap) return;
    let cancelled = false;
    getGlobalEmojiMap()
      .then((map) => {
        if (!cancelled) setLocalGlobalEmojiMap(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentServer?.id, providedGlobalEmojiMap]); // re-resolve when server changes

  // Note: we intentionally avoid per-message global event listeners here.
  // Emoji changes are handled via cache invalidation + in-flight request coalescing.

  // Fallback: resolve unresolved :emojiname: from DB for emojis from servers the viewer isn't in
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    // Find all text nodes that still contain unresolved :emojiname: patterns
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode(textNode) {
        const parent = textNode.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.tagName === "CODE" || parent.tagName === "PRE" || parent.tagName === "IMG" || parent.tagName === "SCRIPT") {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodesToProcess = new Set<Text>();
    const simpleNames = new Set<string>();
    const qualifiedPairs = new Set<string>(); // "name~ServerName"

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const text = node.textContent || "";
      let m: RegExpExecArray | null;
      CUSTOM_EMOJI_RENDER_REGEX.lastIndex = 0;
      while ((m = CUSTOM_EMOJI_RENDER_REGEX.exec(text)) !== null) {
        const name = m[1] || m[3];
        const qualifier = m[4];
        nodesToProcess.add(node);
        if (!m[1] && qualifier) {
          qualifiedPairs.add(`${name}~${qualifier}`);
        } else if (!m[1]) {
          simpleNames.add(name);
        }
      }
    }

    if (nodesToProcess.size === 0) return;

    let cancelled = false;

    (async () => {
      const resolvedSimple = await resolveEmojisByNameFallback(Array.from(simpleNames));
      const resolvedQualified = await resolveQualifiedEmojisByNameFallback(Array.from(qualifiedPairs));

      for (const textNode of nodesToProcess) {
        if (cancelled) return;
        if (!textNode.parentNode) continue;

        const text = textNode.textContent || "";
        CUSTOM_EMOJI_RENDER_REGEX.lastIndex = 0;
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        const frag = document.createDocumentFragment();

        while ((match = CUSTOM_EMOJI_RENDER_REGEX.exec(text)) !== null) {
          const full = match[0];
          const tokenName = match[1];
          const tokenFilePath = match[2];
          const name = tokenName || match[3];
          const qualifier = match[4];
          const start = match.index;

          if (start > lastIndex) {
            frag.appendChild(document.createTextNode(text.slice(lastIndex, start)));
          }

          const url = tokenFilePath
            ? getServerEmojiPublicUrl(tokenFilePath)
            : qualifier
              ? resolvedQualified.get(`${name}~${qualifier}`)
              : resolvedSimple.get(name);

          if (url) {
            const img = document.createElement("img");
            img.src = url;
            img.alt = full;
            img.title = full;
            img.className =
              "inline-block w-8 h-8 align-middle object-contain cursor-pointer";
            img.decoding = "async";
            img.dataset.crossEmoji = name;
            if (tokenFilePath) img.dataset.crossEmojiFilePath = tokenFilePath;
            if (qualifier) img.dataset.crossEmojiServer = qualifier;
            frag.appendChild(img);
          } else {
            frag.appendChild(document.createTextNode(full));
          }

          lastIndex = start + full.length;
        }

        if (lastIndex < text.length) {
          frag.appendChild(document.createTextNode(text.slice(lastIndex)));
        }

        textNode.parentNode.replaceChild(frag, textNode);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [content, effectiveCustomEmojiMap, effectiveGlobalEmojiMap, mentionedUsersMap]);

  // Replace native emoji characters with Fluent Emoji 3D images.
  // Must also depend on usersMap so it re-runs after mention display names resolve
  // (React's dangerouslySetInnerHTML re-writes the DOM, undoing previous replacements).
  // Use requestAnimationFrame instead of setTimeout to avoid scheduling dozens of
  // competing 50ms timers when scrolling through many messages.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    let rafId: number;
    const run = () => {
      rafId = requestAnimationFrame(() => {
        if (!el) return;
        delete el.dataset.fluentProcessed;
        replaceNativeEmojisInElement(el);
      });
    };
    // Delay slightly to let the custom emoji fallback pass run first
    const timer = setTimeout(run, 30);
    return () => { clearTimeout(timer); cancelAnimationFrame(rafId); };
  }, [content, effectiveCustomEmojiMap, effectiveGlobalEmojiMap, mentionedUsersMap]);

  // Resolve signed URLs for inline Supabase attachment images.
  // After dangerouslySetInnerHTML renders <img> tags with public URLs (which now 403),
  // this effect swaps their src to freshly signed URLs.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    let cancelled = false;
    const cleanupCallbacks: Array<() => void> = [];

    const attachGifHoverBehavior = async (img: HTMLImageElement, url: string) => {
      if (!isGifUrl(url)) return;

      const previewUrl = await getGifStillPreview(url);
      if (cancelled || !previewUrl) return;

      const animatedUrl = url;
      img.src = previewUrl;

      const playGif = () => {
        img.src = animatedUrl;
      };
      const pauseGif = () => {
        img.src = previewUrl;
      };

      img.addEventListener("mouseenter", playGif);
      img.addEventListener("mouseleave", pauseGif);
      img.addEventListener("focus", playGif);
      img.addEventListener("blur", pauseGif);

      cleanupCallbacks.push(() => {
        img.removeEventListener("mouseenter", playGif);
        img.removeEventListener("mouseleave", pauseGif);
        img.removeEventListener("focus", playGif);
        img.removeEventListener("blur", pauseGif);
      });
    };

    const imgs = el.querySelectorAll<HTMLImageElement>("img[data-image-url]");
    imgs.forEach((img) => {
      const originalUrl = img.dataset.imageUrl;
      if (!originalUrl || !isSupabaseAttachmentUrl(originalUrl)) return;

      img.style.visibility = "hidden";

      resolveSignedUrl(originalUrl).then((signedUrl) => {
        if (cancelled || !signedUrl) return;

        const preloadImg = new Image();
        preloadImg.onload = () => {
          if (cancelled) return;
          img.src = signedUrl;
          img.dataset.imageUrl = signedUrl;
          img.style.visibility = "visible";
          void attachGifHoverBehavior(img, signedUrl);
        };
        preloadImg.src = signedUrl;
      });
    });

    imgs.forEach((img) => {
      const originalUrl = img.dataset.imageUrl;
      if (!originalUrl || isSupabaseAttachmentUrl(originalUrl)) return;
      void attachGifHoverBehavior(img, originalUrl);
    });

    return () => {
      cancelled = true;
      cleanupCallbacks.forEach((cleanup) => cleanup());
    };
  }, [content]);

  // Ensure mention display names resolve even when members list is online-filtered.
  useEffect(() => {
    if (mentionedUserIds.length === 0) {
      setMentionedUsersMap(new Map());
      return;
    }

    let cancelled = false;

    (async () => {
      const results = await Promise.all(
        mentionedUserIds.map(async (id) => {
          const user = await getOrFetchUser(id);
          return { id, user };
        }),
      );

      if (cancelled) return;

      const map = new Map<string, UserInfo>();
      results.forEach(({ id, user }) => {
        if (!user) return;
        map.set(id, {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          nickname: undefined,
        });
      });
      setMentionedUsersMap(map);
    })();

    return () => {
      cancelled = true;
    };
  }, [mentionedUserIds]);

  // Build a map of userId -> user info for quick lookup
  const usersMap = useMemo(() => {
    const map = new Map<string, UserInfo>();

    // Add users from props (for DMs)
    if (users) {
      users.forEach((u) => map.set(u.id, u));
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
    members.forEach((member) => {
      if (member.user) {
        map.set(member.user_id, {
          id: member.user_id,
          username: member.user.username,
          display_name: member.user.display_name,
          nickname: member.nickname,
        });
      }
    });

    // Add users resolved from mention IDs in message content (offline-safe fallback).
    mentionedUsersMap.forEach((userInfo, userId) => {
      if (!map.has(userId)) {
        map.set(userId, userInfo);
      }
    });

    return map;
  }, [users, members, messageUser, mentionedUsersMap]);

  // Build a map of channelId -> channel info for quick lookup
  const channelsMap = useMemo(() => {
    const map = new Map<string, ChannelInfo>();
    channels.forEach((channel) => {
      map.set(channel.id, {
        id: channel.id,
        name: channel.name,
        type: channel.type,
      });
    });
    return map;
  }, [channels]);

  // Extract URLs for link previews (only from text segments, not code blocks)
  const allUrls = useMemo(() => {
    const textContent = segments
      .filter((s) => s.type === "text")
      .map((s) => s.content)
      .join(" ");
    return extractUrls(textContent);
  }, [segments]);

  const imageUrls = useMemo(() => allUrls.filter((url) => isImageUrl(url) && isTrustedInlineImageUrl(url)), [allUrls]);

  const inviteCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const url of allUrls) {
      const match = url.match(/\/invite\/([A-Za-z0-9]{8})/);
      if (match?.[1]) codes.add(match[1].toUpperCase());
    }
    return Array.from(codes);
  }, [allUrls]);

  const previewUrls = useMemo(() => {
    // Filter out image URLs (already rendered inline) and invite links (handled separately)
    return allUrls.filter((url) => {
      if (isImageUrl(url) && isTrustedInlineImageUrl(url)) return false;
      if (/\/invite\/[A-Za-z0-9]{8}/.test(url)) return false;
      return true;
    });
  }, [allUrls]);

  // Handle click on mentions and channel tags using event delegation
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;

      // Handle inline image clicks
      if (target.tagName === "IMG" && target.dataset.imageUrl) {
        e.preventDefault();
        e.stopPropagation();
        setLightboxImage(target.dataset.imageUrl);
        return;
      }

      // Handle cross-server emoji clicks
      if (target.tagName === "IMG" && target.dataset.crossEmoji) {
        e.preventDefault();
        e.stopPropagation();
        const emojiName = target.dataset.crossEmoji;
        const serverQualifier = target.dataset.crossEmojiServer;
        let resolved: ResolvedEmoji | undefined;
        if (serverQualifier) {
          resolved = resolveQualifiedEmoji(`${emojiName}~${serverQualifier}`);
        }
        if (!resolved) {
          resolved = effectiveGlobalEmojiMap.get(emojiName);
        }
        // Fallback: build a minimal ResolvedEmoji from the img element itself (for DB-fallback resolved emojis)
        if (!resolved && target instanceof HTMLImageElement && target.src) {
          resolved = {
            name: emojiName,
            url: target.src,
            serverId: "",
            serverName: "",
            serverIcon: null,
            isPublished: false,
          };
        }
        if (resolved) {
          setEmojiPopover({ emoji: resolved, rect: target.getBoundingClientRect() });
        }
        return;
      }

      // Handle spoiler reveal toggle
      if (target.dataset.spoiler === "true") {
        e.preventDefault();
        e.stopPropagation();
        target.classList.toggle("revealed");
        return;
      }

      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (anchor && shouldWarnForExternalUrl(anchor.href)) {
        e.preventDefault();
        e.stopPropagation();
        openModal("external-link-warning", { url: anchor.href });
        return;
      }

      if (target.classList.contains("mention-clickable") && target.dataset.userId) {
        e.preventDefault();
        e.stopPropagation();
        openUserProfileModal(openModal, target.dataset.userId, target, SIDE_ALIGNED_USER_PROFILE_POPOVER);
      }
      if (target.classList.contains("channel-tag-clickable") && target.dataset.channelId) {
        e.preventDefault();
        e.stopPropagation();
        const channelId = target.dataset.channelId;
        const channel = channels.find((c) => c.id === channelId);
        if (channel && currentServer) {
          setCurrentChannel(channel);
          navigate(`/app/servers/${currentServer.id}/channels/${channelId}`);
        }
      }
    },
    [openModal, channels, currentServer, setCurrentChannel, navigate, setLightboxImage, effectiveGlobalEmojiMap],
  );

  // Handle keyboard activation for accessibility
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        const target = e.target as HTMLElement;
        // Handle spoiler reveal toggle via keyboard
        if (target.dataset.spoiler === "true") {
          e.preventDefault();
          target.classList.toggle("revealed");
          return;
        }
        if (target.classList.contains("mention-clickable") && target.dataset.userId) {
          e.preventDefault();
          openUserProfileModal(openModal, target.dataset.userId, target, SIDE_ALIGNED_USER_PROFILE_POPOVER);
        }
        if (target.classList.contains("channel-tag-clickable") && target.dataset.channelId) {
          e.preventDefault();
          const channelId = target.dataset.channelId;
          const channel = channels.find((c) => c.id === channelId);
          if (channel && currentServer) {
            setCurrentChannel(channel);
            navigate(`/app/servers/${currentServer.id}/channels/${channelId}`);
          }
        }
      }
    },
    [openModal, channels, currentServer, setCurrentChannel, navigate],
  );

  return (
    <div
      ref={contentRef}
      className="!block break-words overflow-hidden max-w-full"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-message-id={messageId}
    >
      {/* Message text content */}
      <span className="inline">
        {segments.map((segment, index) => {
          switch (segment.type) {
            case "code-block":
              return <CodeBlock key={index} code={segment.content} language={segment.language} />;
            case "inline-code":
              return <InlineCode key={index}>{segment.content}</InlineCode>;
            case "text":
              return (
                <span
                  key={index}
                  dangerouslySetInnerHTML={{
                    __html: parseTextContent(
                      segment.content,
                      currentUserId,
                      usersMap,
                      effectiveCustomEmojiMap,
                      channelsMap,
                      effectiveGlobalEmojiMap,
                    ),
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

      {/* Link previews (image assets are proxied server-side) */}
      {linkPreviewsEnabled && !hideEmbeds && previewUrls.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          {previewUrls.slice(0, 3).map((url, index) => (
            <LinkPreview key={`${url}-${index}`} url={url} disabled={!linkPreviewsEnabled} messageId={messageId} />
          ))}
        </div>
      )}

      {/* Image lightbox with all images for thumbnail navigation */}
      <ImageLightbox imageUrl={lightboxImage} imageUrls={imageUrls} onClose={() => setLightboxImage(null)} />

      {/* Cross-server emoji info popover */}
      {emojiPopover && (
        <CustomEmojiPopover
          emoji={emojiPopover.emoji}
          anchorRect={emojiPopover.rect}
          onClose={() => setEmojiPopover(null)}
        />
      )}
    </div>
  );
};

interface ReplyPreviewProps {
  content: string;
  maxLength?: number;
  usersMap?: Map<string, UserInfo>;
  customEmojiMap?: Map<string, string>;
  globalEmojiMap?: Map<string, ResolvedEmoji>;
}

export const ReplyPreview = ({
  content,
  maxLength = 50,
  usersMap,
  customEmojiMap: providedCustomEmojiMap,
  globalEmojiMap: providedGlobalEmojiMap,
}: ReplyPreviewProps) => {
  const { currentServer, members } = useServerStore();
  const [localCustomEmojiMap, setLocalCustomEmojiMap] = useState<Map<string, string>>(new Map());
  const [localGlobalEmojis, setLocalGlobalEmojis] = useState<Map<string, ResolvedEmoji>>(new Map());
  const customEmojiMap = providedCustomEmojiMap ?? localCustomEmojiMap;
  const globalEmojis = providedGlobalEmojiMap ?? localGlobalEmojis;

  // Build users map from members if not provided
  const resolvedUsersMap = useMemo(() => {
    if (usersMap && usersMap.size > 0) return usersMap;

    const map = new Map<string, UserInfo>();
    members.forEach((member) => {
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
    if (providedCustomEmojiMap) return;
    const serverId = currentServer?.id;
    if (!serverId) {
      setLocalCustomEmojiMap(new Map());
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const emojis = await fetchServerEmojis(serverId);
        if (cancelled) return;
        const map = new Map<string, string>();
        emojis.forEach((e) => map.set(e.name, e.url));
        setLocalCustomEmojiMap(map);
      } catch (e) {
        console.error("Failed to load server emojis for reply preview:", e);
        if (cancelled) return;
        setLocalCustomEmojiMap(new Map());
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [currentServer?.id, providedCustomEmojiMap]);

  // Load global emoji map for cross-server rendering in replies
  useEffect(() => {
    if (providedGlobalEmojiMap) return;
    let cancelled = false;
    getGlobalEmojiMap()
      .then((map) => {
        if (!cancelled) setLocalGlobalEmojis(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentServer?.id, providedGlobalEmojiMap]);

  // Strip markdown and prepare content
  const stripped = useMemo(() => {
    let result = content
      .replace(/```[\s\S]*?```/g, "[code]")
      .replace(/`[^`]+`/g, "[code]")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/~~([^~]+)~~/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/\|\|([^|]+)\|\|/g, "[spoiler]")
      .replace(/\n/g, " ");

    // Convert <@userId> mentions to display_name or username
    result = result.replace(/<@(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})>/g, (match, userId) => {
      const userInfo = resolvedUsersMap.get(userId);
      if (userInfo) {
        const displayName = userInfo.display_name || userInfo.username || "user";
        return `@${displayName}`;
      }
      // Fallback: check global user cache
      const cached = getUserFromCache(userId);
      if (cached) {
        return `@${cached.display_name || cached.username || "user"}`;
      }
      return match; // keep raw so re-render after cache populates can resolve it
    });

    // Convert <#channelId> to #channel
    result = result.replace(/<#\w{8}-\w{4}-\w{4}-\w{4}-\w{12}>/g, "#channel");

    result = result.trim();

    if (result.length > maxLength) {
      result = result.slice(0, maxLength - 3) + "...";
    }

    return result;
  }, [content, maxLength, resolvedUsersMap]);

  // Replace custom emojis
  const rendered = useMemo(() => {
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    const inlineTokenRegex = /:ce\[([a-z0-9_]{2,12})\|([a-z0-9/_\.-]{1,300})\]:/g;
    let tokenMatch: RegExpExecArray | null;

    while ((tokenMatch = inlineTokenRegex.exec(stripped)) !== null) {
      if (tokenMatch.index > lastIndex) {
        parts.push(stripped.slice(lastIndex, tokenMatch.index));
      }

      const emojiName = tokenMatch[1];
      const filePath = tokenMatch[2];
      const emojiUrl = getServerEmojiPublicUrl(filePath);
      parts.push(
        <img
          key={`token-emoji-${tokenMatch.index}`}
          src={emojiUrl}
          alt={`:${emojiName}:`}
          title={`:${emojiName}:`}
          className="inline-block w-4 h-4 align-text-bottom object-contain"
          loading="lazy"
        />,
      );

      lastIndex = tokenMatch.index + tokenMatch[0].length;
    }

    const remaining = stripped.slice(lastIndex);
    if (!remaining) {
      return parts.length > 0 ? parts : stripped;
    }

    lastIndex = 0;
    const emojiRegex = /:([a-z0-9_]{2,12}):/g;
    let match;

    while ((match = emojiRegex.exec(remaining)) !== null) {
      // Add text before emoji
      if (match.index > lastIndex) {
        parts.push(remaining.slice(lastIndex, match.index));
      }

      // Add emoji if found (check local first, then global)
      const emojiName = match[1];
      const emojiUrl = customEmojiMap.get(emojiName) || globalEmojis.get(emojiName)?.url;
      if (emojiUrl) {
        parts.push(
          <img
            key={`emoji-${match.index}`}
            src={emojiUrl}
            alt={`:${emojiName}:`}
            title={`:${emojiName}:`}
            className="inline-block w-4 h-4 align-text-bottom object-contain"
            loading="lazy"
          />,
        );
      } else {
        parts.push(match[0]);
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < remaining.length) {
      parts.push(remaining.slice(lastIndex));
    }

    return parts.length > 0 ? parts : stripped;
  }, [stripped, customEmojiMap, globalEmojis]);

  return <>{rendered}</>;
};
