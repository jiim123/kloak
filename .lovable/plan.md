

## Plan: Fix 4 XSS vulnerabilities (minimum changes)

### Fix 1 — `MessageContent.tsx`: Sanitize `role.color` before HTML interpolation
- Add module-level constants and helper near top of file (above `roleMentionStyle`):
  ```ts
  const SAFE_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
  const SAFE_GRADIENT_REGEX = /^linear-gradient\([^"'<>;{}()]*\)$/;
  const sanitizeRoleColor = (color: string | undefined | null): string | null => {
    if (!color) return null;
    if (SAFE_COLOR_REGEX.test(color) || SAFE_GRADIENT_REGEX.test(color)) return color;
    return null;
  };
  ```
- Update `roleMentionStyle` (~line 55-62): call `sanitizeRoleColor(role.color)`. If null → return empty string (omit `style` attribute). Otherwise use the sanitized value.
- Search the file for all other `role.color` interpolations into HTML strings/style attributes and apply the same sanitizer (replace raw `role.color` with sanitized variable; fall back to default or omit).

### Fix 2 — `MessageContent.tsx`: Validate emoji URL protocol
- Add helper near top:
  ```ts
  const isSafeEmojiUrl = (url: string): boolean => {
    try {
      const p = new URL(url);
      return p.protocol === 'https:' || p.protocol === 'http:';
    } catch { return false; }
  };
  ```
- In `parseTextContent` custom emoji substitution (~lines 409-445): before emitting `<img src="${escapeHtml(url)}">`, check `isSafeEmojiUrl(url)`. If false, emit the original `:name:` text (HTML-escaped) instead.
- Apply to every emoji URL resolution path inside the parser (custom map, global map, server emoji resolver paths).

### Fix 3 — `MessageItem.tsx`: Validate emoji URL in reaction nodes
- In the `reactionEmojiNode` and `reactionEmojiNodeLarge` callbacks, after resolving URL via `resolveCustomEmojiUrl`, gate the `<img src={url}>` render with the same `isSafeEmojiUrl` check (import or inline duplicate the helper). If invalid, render `:name:` text fallback.

### Fix 4 — `AudioPlayer.tsx`: Protocol-check `window.open`
- At ~line 143 in the `handleDownload` catch fallback, add before `window.open(src, "_blank")`:
  ```ts
  if (!/^https?:\/\//i.test(src)) return;
  ```

### Fix 5 — `PersistentEmbedContainer.tsx`: Validate Twitch channel/video ID
- Add at top of file:
  ```ts
  const SAFE_EMBED_ID = /^[A-Za-z0-9_-]{1,64}$/;
  ```
- In `renderEmbedIframe`, return `null` early if `!SAFE_EMBED_ID.test(embed.channelOrVideoId)`. Apply for all Twitch + Kick cases that interpolate the ID.

### Files modified
- `src/components/chat/MessageContent.tsx` (Fix 1 + Fix 2)
- `src/components/chat/MessageItem.tsx` (Fix 3)
- `src/components/chat/AudioPlayer.tsx` (Fix 4)
- `src/components/chat/PersistentEmbedContainer.tsx` (Fix 5)

### Verification (post-implementation)
- Role mentions with valid `#RRGGBB` and `linear-gradient(...)` colors still render styled; invalid colors render unstyled (no broken layout).
- Server custom emojis render in messages and reactions; emoji with non-http(s) URL falls back to `:name:` text.
- Audio download fallback still opens for normal `https://` URLs.
- Twitch/Kick embeds load for valid IDs; malformed IDs render nothing instead of a broken iframe.

No other code touched.

