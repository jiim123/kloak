## Root cause

`AttachmentItem` calls `useSignedUrl(attachment.file_url, …)` on mount, which kicks off the Edge Function blob fetch for **every** attachment in the channel at once — even ones 50 screens below the viewport. The `<img loading="lazy">` attribute does not help because the blob is downloaded by our own fetch, not the browser's image loader, so by the time the user scrolls, the network is saturated and the visible images flicker through their decode cycle.

## Fix

Gate the signed-URL fetch (and the `<img>`/`<video>` mount) behind an `IntersectionObserver`. Each `AttachmentItem` reserves its space immediately with the existing ghost placeholder, but only requests its blob once the wrapper enters (or is within ~600px of) the scroll viewport. Once loaded, it stays loaded so scrolling back up doesn't re-fetch.

### Changes

1. **`src/hooks/useInView.ts`** (new, ~25 lines)
   - Tiny hook: `const [ref, inView] = useInView({ rootMargin: '600px', once: true })`.
   - Uses a single `IntersectionObserver` per element, disconnects after first intersect when `once`.

2. **`src/components/chat/MessageItem.tsx` — `AttachmentItem`**
   - Wrap the existing reserved-size container with a ref tied to `useInView`.
   - Pass `inView ? attachment.file_url : null` into `useSignedUrl` so the fetch is deferred until the user is about to see it.
   - Ghost placeholder stays exactly as it is today; it now also covers the "not yet requested" state, which is what the user perceives as flicker.
   - Keep the `_peekCache` synchronous read in `useSignedUrl`, so already-cached attachments (e.g. recently viewed) reveal instantly without waiting for intersection.

3. **No backend / hook signature changes** beyond accepting a nullable input (already supported by `useSignedUrl`).

### Out of scope

- Full message-list virtualization (bigger refactor; not needed to fix the flicker).
- Changes to inline image rendering in `MessageContent.tsx` — those already use `loading="lazy"` on raw URLs and don't go through our blob proxy.

### Files touched

- `src/hooks/useInView.ts` (new)
- `src/components/chat/MessageItem.tsx`
