## Problem

When switching channels/servers, `MessageList` unmounts and remounts, so every `AttachmentItem` is a fresh DOM node. Even though `useSignedUrl` synchronously returns a cached blob URL via `_peekCache` (so the network request is not repeated), the newly-mounted `<img>` element still has to decode and paint, which causes the visible "flash of nothing → image pops in" flicker. For uncached images (cache miss, eviction past 300 entries, or first visit), the loader spinner appears and then snaps to the image — also janky.

There is no smooth placeholder-to-image transition today: the component swaps between a centered spinner block and the raw `<img>` with no fade, and the `<img>` itself has no background while decoding.

## Goal

Render a stable, neutral "ghost" placeholder in the exact reserved dimensions for every media attachment, and fade the real media in on top of it once decoded. The placeholder must look identical whether the URL is cached or being fetched, so channel switches feel seamless.

## Changes

### 1. `src/components/chat/MessageItem.tsx` — `AttachmentItem`

- Add a local `isLoaded` state per attachment (default `false`, reset when `signedUrl` changes).
- Always render the reserved-size container (use existing `reservedStyle`) with a shimmer/ghost background using semantic tokens (`bg-muted/40` + a subtle `animate-pulse` shimmer overlay). This ghost is shown whenever `!signedUrl || !isLoaded`.
- When `signedUrl` is available, render the `<img>` absolutely positioned inside the same container with `opacity-0 transition-opacity duration-200`, flipping to `opacity-100` on `onLoad`. Once `isLoaded`, drop the shimmer animation but keep the muted backdrop until the image fully covers it.
- Use `img.decode()` (via a ref + `useEffect`) when the browser supports it to ensure the fade-in only triggers after the bitmap is decoded — eliminates the white frame on remount even when the blob URL is cached.
- Apply the same pattern to the video branch by passing a `poster`/wrapper skeleton to `VideoPlayer` (or wrap it locally) so videos also get a ghost frame at reserved dimensions.
- Remove the `Loader2` spinner branch — the ghost placeholder replaces it.
- Keep the existing `reservedStyle` fallback (300×200) for images without known width/height so the layout never jumps.

### 2. `src/components/chat/VideoPlayer.tsx` (minor)

- Accept an optional `width`/`height` prop and apply it to the outer wrapper so the ghost reserved size matches when a video is rendered.
- Add an internal `loadeddata` listener that fades the `<video>` in over the ghost background.

### 3. `src/components/chat/MessageContent.tsx` — inline image URLs (per memory `inline-media-rendering-standards`)

- Apply the same ghost-fade treatment to the `<img>` tags rendered for inline image URLs so the behavior is consistent across attachment-bound and inline media.

### 4. No backend, hook, or cache changes

- `useSignedUrl` and `src/lib/signedUrl.ts` stay as-is; they already cache blob URLs for 30 minutes and dedupe in-flight requests. The flicker is purely a paint/decoding problem, fixed in the rendering layer.

## Out of scope

- Persisting `MessageList` across channel switches (bigger architectural change).
- Increasing `MAX_CACHE_ENTRIES` beyond 300 — can revisit if eviction is observed in practice.
- Audio attachments (no visual flicker concern).

## Files touched

- `src/components/chat/MessageItem.tsx`
- `src/components/chat/VideoPlayer.tsx`
- `src/components/chat/MessageContent.tsx`
