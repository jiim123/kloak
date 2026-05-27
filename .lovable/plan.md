# Discord-style attachment optimizations

Audit of `src/components/chat/MessageItem.tsx` → `AttachmentItem` (lines 200–378), `src/lib/signedUrl.ts`, `src/hooks/useSignedUrl.ts`, `src/lib/storageUpload.ts`, `src/lib/bunny-upload.ts`. Bunny Optimizer is enabled on the Pull Zone, so transform URLs are viable.

## What's already in place

- Aspect-ratio slot reservation from `attachment.width`/`height` (zero-CLS when dims are known).
- IntersectionObserver gating via `useInView` (`rootMargin: 600px`, `once: true`) — proxy fetch only fires when the slot is near the viewport.
- Ghost placeholder + fade-in on decode, `loading="lazy"`, `decoding="async"`.
- Signed-URL refresh-on-error (`useSignedUrl({ withRefresh: true })`).
- Per-path object-URL LRU (300 entries, 30 min TTL, 5 min refresh buffer) with in-flight dedup and 404 negative cache in `src/lib/signedUrl.ts`.
- `message_attachments` already stores `width` / `height`.

## What's missing vs. spec

1. No `placeholder` (BlurHash), no `is_spoiler`, no `is_voice_message`, no `waveform` columns.
2. The proxy returns raw bytes — no transform pipeline even though Bunny Optimizer is on.
3. No gallery grid for 2–4 image messages.
4. No decoded-image LRU above the browser cache.
5. `rootMargin` is 600px (spec wants 200px).
6. Enrichment is synchronous inside the send flow; no `AFTER INSERT` worker, no EXIF strip.

## Phases

### Phase A — Schema + async enrichment

Single migration on `public.message_attachments`:

```text
ADD COLUMN placeholder      text,
ADD COLUMN is_spoiler       boolean NOT NULL DEFAULT false,
ADD COLUMN is_voice_message boolean NOT NULL DEFAULT false,
ADD COLUMN waveform         jsonb,
ADD COLUMN enriched_at      timestamptz;
```

- `REPLICA IDENTITY FULL` + add to `supabase_realtime` so enriched rows hydrate live.
- New edge function `enrich-attachment` (≤10 KB, follows project edge limit):
  - Pull original from Bunny → decode → 32×32 downscale → BlurHash 4×3.
  - Re-encode WebP, EXIF stripped, overwrite original path.
  - Backfill `width`/`height` if null, write `placeholder`, set `enriched_at`.
  - For `is_voice_message`: decode audio → 128 sample peaks → write `waveform`.
  - For video: capture first-frame poster (sibling object), BlurHash of poster.
- Trigger: fire-and-forget client call after `send_message` returns (no `pg_net` dependency). Backfill script iterates rows where `enriched_at IS NULL`.
- `messageStore` realtime handler patches the matching attachment in place on `message_attachments` UPDATE — re-renders only the affected `AttachmentItem`.

### Phase B — Renderer upgrades in `AttachmentItem`

- `useBlurhash(hash, w, h)` hook: memoise per `attachment.id`, decode to 32×32 canvas → data URL, apply as `background-image` on the slot. Real `<img>` stays stacked on top, fades in on `onLoad` (already wired).
- Drop `rootMargin` to `200px` per spec.
- Module-level decoded LRU (~50 entries) keyed by attachment id: on mount, if cached, skip the network and reuse the cached object URL + decoded state.
- Video branch: `preload="none"` until `pointerenter` / `touchstart`, then upgrade to `preload="metadata"`.
- Spoiler branch: render BlurHash with extra `filter: blur(20px)` + "SPOILER" pill; **gate `useSignedUrl` behind a `revealed` click**, not just `inView`.
- Plain ghost slot remains the fallback when `enriched_at` is null but `width`/`height` are known.

### Phase C — Gallery grid for 2–4 images

- New `AttachmentGallery` consumes the message's image attachments:
  - 2 → 1×2, 3 → 1 tall left + 2 stacked right, 4 → 2×2.
  - Cells share ~350 px combined height; cell `AttachmentItem`s switch to `object-cover` and drop their own max-width.
- Mixed messages: images go into the grid, videos/audio/files render below as today.
- Single image keeps the current natural-aspect cap (400×300).

### Phase D — Bunny transform URLs + tighter TTLs

Bunny Optimizer is on, so:

- Extend `sign-bunny-url` edge function to accept `transform?: { width?, height?, format?, quality? }`. When present, append `?width=…&format=webp&quality=…` to the upstream Bunny URL before streaming the response back.
- New helpers in `src/lib/signedUrl.ts`:
  - `getProxyUrl(path, { width, height, format })` — used for **all** inline previews. Width = rendered slot width × `devicePixelRatio` (cap at lane width), format `webp`, quality 80.
  - `getSourceUrl(path)` — used only for downloads and lightbox; lightbox transform caps at 1920 px.
- Cache key becomes `${path}::${transformSig}` (so a slot and the lightbox can both be cached without trampling each other).
- TTLs: inline proxy 1 h, source/download 15 min generated lazily on click.
- `onError` (401/403) already refreshes; extend to invalidate only the failing `${path}::${transformSig}` entry rather than the whole path.
- `useSignedUrl` gains a `transform` option; `AttachmentItem` measures its slot (via `ResizeObserver` or the already-computed `reservedStyle.width`) and passes that to the hook.

### Phase E — Voice messages (optional, ship only if you want it now)

- `MessageInput` gains a hold-to-record control producing a single audio attachment with `is_voice_message=true`, no text, no other attachments.
- Server guard in `send_message` RPC: when any attachment has `is_voice_message=true`, require exactly one attachment and empty `content`.
- `VoiceMessagePlayer` renders the stored `waveform` as inline `<svg><rect/></svg>` bars using `currentColor`, played/unplayed opacity 1 / 0.4, click-to-scrub.

## Technical notes

- `is_spoiler` UI to set the flag at upload time is not required for Phase B — the column can sit unused until the attachment preview bar gets a toggle.
- `useInView` stays `once: true`; the decoded LRU absorbs re-mount cost.
- `useSignedUrls` (batch) remains unused by `AttachmentItem`; the per-slot transform width makes per-item resolution simpler than a batch.
- `MessageMapsContext.tsx` may need a one-line touch if the attachment shape change ripples into its maps — to verify during Phase B.
- All new colors/effects use semantic tokens (no hardcoded colors) per Core memory.
- Animations use `framer-motion` only.

## Out of scope

- Upload flow (`useAttachmentQueue`, `secureUpload`, `bunny-upload.ts`).
- RLS, bucket config, auth model for `sign-bunny-url` (only the transform payload is added).
- `src/integrations/supabase/types.ts` (regenerates after the migration).

## Suggested execution order

A → B → C → D → (E if requested). Each phase ships on its own and is safe to deploy independently; the renderer gracefully handles missing `placeholder` / `enriched_at` throughout.
