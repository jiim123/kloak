

## Fix: Show image inline when message is only an image link

### Problem
When a user sends a message containing only an image URL (e.g., `https://i.imgur.com/abc.jpg`), it renders as a clickable text link instead of displaying the actual image. This is because `MessageContent` only renders images inline for "trusted" sources (same-origin, Supabase, Klipy).

### Solution
Modify `MessageContent.tsx` to detect image-only messages and render external image URLs inline with lightbox support when the entire message content is just a single image URL.

### Changes

**File: `src/components/chat/MessageContent.tsx`**

1. Import `isImageOnlyMessage` from `@/lib/message`
2. In the `parseTextContent` function (around line 367-379), update the URL replacement logic: when the URL is an image URL, render it as an inline `<img>` tag regardless of trust level (remove the `isTrustedInlineImageUrl` gate for image URLs). Add `data-image-url` attribute so lightbox clicks work.
3. Update the `imageUrls` memo (line 866) to include all image URLs, not just trusted ones, so the lightbox can navigate between them.

The key change is in the URL-to-HTML replacement (line 372-376):
- Currently: if `isImageUrl(url) && isTrustedInlineImageUrl(url)` → render `<img>`, else render `<a>`
- New: if `isImageUrl(url)` → always render `<img>` with `data-image-url` for lightbox support

This ensures any image link renders the actual image inline and is viewable in the lightbox.

