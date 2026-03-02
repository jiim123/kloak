/**
 * Fluent Emoji 3D from Microsoft - CDN-backed emoji rendering.
 *
 * Uses @lobehub/fluent-emoji-3d package served via jsdelivr CDN.
 * Each emoji is a high-quality 3D-style webp image.
 */

const FLUENT_CDN_BASE = 'https://cdn.jsdelivr.net/npm/@lobehub/fluent-emoji-3d@1.1.0/assets';

/**
 * Convert an emoji character (or multi-codepoint sequence) to its CDN URL.
 * Codepoints are lowercase hex joined by hyphens, matching the lobehub package naming.
 */
export function getFluentEmojiUrl(emoji: string): string {
  const codepoints = [...emoji]
    .map(char => char.codePointAt(0)!.toString(16))
    .join('-');
  return `${FLUENT_CDN_BASE}/${codepoints}.webp`;
}

/**
 * Get a URL without the variation selector (FE0F) as fallback.
 * Some emojis in the package omit FE0F from the filename.
 */
export function getFluentEmojiUrlNoVS16(emoji: string): string {
  const codepoints = [...emoji]
    .map(char => char.codePointAt(0)!)
    .filter(cp => cp !== 0xFE0F)
    .map(cp => cp.toString(16))
    .join('-');
  return `${FLUENT_CDN_BASE}/${codepoints}.webp`;
}

/**
 * Regex to match native emoji characters in text.
 * Catches emoji presentation characters, variation selectors, ZWJ sequences,
 * skin tone modifiers, and keycap sequences.
 */
export const NATIVE_EMOJI_REGEX =
  /(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)[\uFE00-\uFE0F\u200D\u20E3\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Component}]*/gu;

/**
 * Check if a string is a single emoji (no other text).
 */
export function isSingleEmoji(str: string): boolean {
  const trimmed = str.trim();
  NATIVE_EMOJI_REGEX.lastIndex = 0;
  const match = NATIVE_EMOJI_REGEX.exec(trimmed);
  return match !== null && match[0] === trimmed;
}

/**
 * Replace native emoji characters in a DOM element's text nodes with
 * Fluent Emoji 3D <img> elements. Skips nodes inside <img>, <code>, <pre>.
 */
export function replaceNativeEmojisInElement(element: HTMLElement, sizePx = 20): void {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_SKIP;
      const tag = parent.tagName;
      // Skip code blocks, pre, and already-replaced images
      if (tag === 'CODE' || tag === 'PRE' || tag === 'IMG' || tag === 'SCRIPT') {
        return NodeFilter.FILTER_REJECT;
      }
      // Skip nodes that have already been processed
      if (parent.dataset.fluentProcessed) return NodeFilter.FILTER_SKIP;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent || '';
    NATIVE_EMOJI_REGEX.lastIndex = 0;
    if (NATIVE_EMOJI_REGEX.test(text)) {
      textNodes.push(node);
    }
  }

  for (const textNode of textNodes) {
    const text = textNode.textContent || '';
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    NATIVE_EMOJI_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = NATIVE_EMOJI_REGEX.exec(text)) !== null) {
      // Add any text before this emoji
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }

      const emojiChar = match[0];
      const img = document.createElement('img');
      img.src = getFluentEmojiUrl(emojiChar);
      img.alt = emojiChar;
      img.width = sizePx;
      img.height = sizePx;
      img.className = 'inline-block align-text-bottom object-contain fluent-emoji';
      img.loading = 'lazy';
      img.draggable = false;
      // On error, try without variation selector; if that also fails, show native text
      img.onerror = () => {
        const fallbackUrl = getFluentEmojiUrlNoVS16(emojiChar);
        if (img.src !== fallbackUrl) {
          img.src = fallbackUrl;
        } else {
          const span = document.createElement('span');
          span.textContent = emojiChar;
          img.replaceWith(span);
        }
      };
      fragment.appendChild(img);

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after last emoji
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  }

  // Mark as processed to prevent double-processing
  element.dataset.fluentProcessed = '1';
}
