## Goal
Make attachment upload/send feel quiet and seamless by stopping the repeated `sign-bunny-url` 404 loop while keeping media/file rendering intact once the attachment is actually ready.

## What’s causing it
The 404 spam is not one single bad call — it’s several attachment consumers all trying to resolve a signed URL before the uploaded file is fully available.

Current call chain I verified:
- `MessageInput.waitForAttachmentReady()` polls attachment readiness after send.
- `useSignedUrl()` immediately calls `getSignedAttachmentUrl()` for attachment URLs / `kloak-attachment://...` refs.
- `FileAttachmentCard` auto-refreshes missing signed URLs on a timer.
- `MessageContent` retries inline attachment resolution on its own timer.
- `messageStore`, `dmStore`, and `useRealtimeMessages` all pre-warm signed URLs in the background.

So one fresh attachment can trigger multiple overlapping requests, and each 404 gets surfaced in the console.

## Plan
1. **Separate “not ready yet” from “real failure” in the client**
   - Update signed URL helpers so expected early-miss cases do not behave like hard errors.
   - Add short-lived negative/in-flight dedupe around readiness/signing paths so one attachment path produces one retry sequence, not many.

2. **Stop eager signing during upload/finalization**
   - Prevent upload-preview / optimistic attachment flows from calling `sign-bunny-url` until the attachment has actually been finalized and is expected to resolve.
   - Keep the UI in a pending/loading state instead of bouncing between unresolved URL attempts.

3. **Remove redundant background pre-warming for fresh attachments**
   - Audit and trim the `resolveSignedUrls(...)` prewarm calls in message list / DM / realtime paths that currently amplify the same miss.
   - Keep prewarm only where it helps already-persisted attachments, not newly-uploaded ones.

4. **Unify retry ownership**
   - Choose one place to retry attachment readiness/signing instead of `useSignedUrl`, `FileAttachmentCard`, and `MessageContent` each running their own timers.
   - Use a bounded backoff and stop retrying once the attachment is marked unavailable or the component unmounts.

5. **Validate the noisy path**
   - Re-test attach → upload → send for file, audio, and video attachments.
   - Confirm the console is no longer spammed with repeated 404s and that the attachment resolves once storage propagation finishes.

## Technical notes
Files most likely involved:
- `src/lib/signedUrl.ts`
- `src/hooks/useSignedUrl.ts`
- `src/components/chat/FileAttachmentCard.tsx`
- `src/components/chat/MessageContent.tsx`
- `src/stores/messageStore.ts`
- `src/stores/dmStore.ts`
- `src/hooks/useRealtimeMessages.ts`
- `src/components/chat/MessageInput.tsx`

Expected outcome:
- No repeated `POST /functions/v1/sign-bunny-url 404` spam during attach/upload.
- Attachment cards stay in a stable pending state while the file propagates.
- Media/files appear once ready without redundant retries from multiple layers.