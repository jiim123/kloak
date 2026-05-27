## What's actually happening

The card has two unrelated bugs that produce the two screenshots you sent.

### Bug 1 — Permanent loading spinner (image 1)

When you send a file:

1. `MessageInput.prepareAttachmentsForMessage` (line 711) builds an **optimistic** attachment with `file_url = "kloak-attachment://<path>"` and pushes it into the message **before** the file finishes uploading to Bunny.
2. `FileAttachmentCard` mounts immediately and calls `useSignedUrl(...)`, which calls the `sign-bunny-url` edge function.
3. Because the file isn't on the CDN yet, the edge function returns 404.
4. `src/lib/signedUrl.ts` then adds that path to `notFoundCache` (the "skip permanently-missing paths" guard) — every later attempt for the same path returns `null` without re-checking.
5. The upload completes a moment later, but the resolver never retries, so `signedUrl` stays `null` forever and the button stays on the spinner.

So the spinner isn't telling you "still uploading" — it's telling you "I asked for the file once, got 404, and gave up." The same code path works for images only because the image-render branch refreshes on its own `onError`.

### Bug 2 — Card collapses to a raw URL (image 2)

This is the more architectural one:

1. `MessageInput.handleSubmit` (lines 843–848) appends every attachment URL into `message.content` as a text fallback (`urlBlock`).
2. The `message_attachments` row is inserted **later**, in a fire-and-forget async block (line 863). If anything in that block fails — `waitForAttachmentReady` returns false, the Bunny upload throws, `insertAttachmentsWithRetry` fails, or the message survives a reload before the insert lands — **no attachment row is ever created**.
3. On render, `MessageItem.displayContent` (line 497) only strips attachment URLs from content **when `message.attachments.length > 0`**. With no row, the strip is skipped entirely and the `kloak-attachment://…` URL is rendered as a plain link by the message-content linkifier. There is no `FileAttachmentCard` to render because `message.attachments` is empty.

The two old messages in your second screenshot are messages whose attachment rows never landed; only the URL-in-content fallback survives.

## Fix plan

Two small, targeted changes that address both bugs without touching upload, schema, storage, or the enrichment pipeline.

### 1. Make optimistic attachments survive their own "not ready yet" 404s

In `src/lib/signedUrl.ts`, stop poisoning the negative cache for paths that are still in flight, and let the consumer retry.

- Only add to `notFoundCache` after a short grace period (e.g. only after the path has been failing for >30s), OR
- Skip `notFoundCache` entirely for paths matching the `<userId>/<timestamp>-<uuid>.<ext>` shape that the upload uses (these are by definition fresh uploads), OR
- Simplest: when `FileAttachmentCard` sees `signedUrl === null`, periodically call `refresh()` (e.g. every 2s, capped at ~30s) so the card recovers once the upload finishes. The card already gets `refresh` from `useSignedUrl({ withRefresh: true })`.

I'll go with option 3 as the primary fix — it's the smallest change and isolated to the card. I'll also add a small carve-out in `signedUrl.ts` so the first few 404s on a path don't get negative-cached, so the retries actually work.

### 2. Stop relying on URL-in-content as a fallback for files

The "append URL to content" trick exists so images embedded via markdown still render even if the attachment row is missing. For non-image files it has no upside and is exactly what produces the raw-URL bug.

- In `MessageInput.handleSubmit` (around line 844), only include image/GIF URLs in the `urlBlock`. Skip generic-file attachment URLs — they don't need to be inline in content; the attachment row alone drives the card.
- In `MessageItem.displayContent`, drop the `message.attachments.length > 0` gate so the `kloak-attachment://` and signed-URL regex strips run even when no attachment row exists. This way, if a row ever fails to land, the user sees no message body instead of an ugly raw URL.
- (Optional follow-up, not in scope here) Surface a small "attachment failed to attach" affordance when content was sent but no row arrives within N seconds.

### 3. Tighten the card's visual states

While we're in there, make the three card states unambiguous and aligned with what the UI is actually doing:

- `signedUrl == null && attachment is still optimistic` → spinner + tooltip "Uploading…"
- `signedUrl == null && not optimistic` → spinner + tooltip "Preparing…", auto-retry via `refresh()`
- `signedUrl != null` → download icon, fully enabled
- During click → spinner + "Downloading…"
- After click → check + "Downloaded"

Optimistic detection: attachment `id` starts with `temp-att-` (the convention already in `messageStore.ts:118`).

### Files touched

- `src/lib/signedUrl.ts` — relax `notFoundCache` for first few failures (or for fresh upload-shaped paths)
- `src/components/chat/FileAttachmentCard.tsx` — auto-retry `refresh()` while signed URL is null, refine the three tooltip/state cases, treat `temp-att-` as "Uploading…"
- `src/components/chat/MessageInput.tsx` — skip appending generic-file URLs into `content`
- `src/components/chat/MessageItem.tsx` — run the attachment-URL strip regardless of whether attachments are present

### Out of scope

Upload flow itself, Bunny CDN proxy, `attachmentEnrich.ts`, `attachmentLru.ts`, `AttachmentGallery`, image/video/voice renderers, schema, edge functions, lightbox.