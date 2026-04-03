

# Fix: Store CDN URLs instead of kloak-attachment:// for attachment file_url

## Problem

Three upload sites construct `kloak-attachment://${result.path}` instead of using the CDN URL returned by `secureUpload` (`result.publicUrl`). This affects both the `file_url` stored in `message_attachments`/`dm_attachments` tables AND the URL embedded in message content.

## Changes

### 1. `src/components/chat/MessageInput.tsx` (line 585)

Replace `kloak-attachment://${res.path}` with `res.publicUrl`.

### 2. `src/hooks/useAttachmentQueue.ts` (line 156)

Replace `kloak-attachment://${result.path}` with `result.publicUrl`.

### 3. `src/components/forum/ForumChannelArea.tsx` (line 641)

Replace `kloak-attachment://${result.path}` with `result.publicUrl`.

### 4. `src/components/chat/MessageItem.tsx` (line 373-374) — content stripping

CDN attachment URLs will now appear in message content. Add a regex to strip `https://kloakcdn.b-cdn.net/attachments/` URLs alongside the existing Supabase and kloak-attachment patterns. The existing `att.file_url` loop (line 367-371) already handles exact matches, but a fallback regex ensures no CDN URLs leak into displayed content.

## Files Modified

1. `src/components/chat/MessageInput.tsx` — 1 line
2. `src/hooks/useAttachmentQueue.ts` — 1 line
3. `src/components/forum/ForumChannelArea.tsx` — 1 line
4. `src/components/chat/MessageItem.tsx` — add CDN URL stripping regex

## Not Changed

`bunny-upload.ts`, `signedUrl.ts`, Edge Functions (per instructions). The `useSignedUrl` hook already passes non-attachment https URLs through as-is (line 88-91), so CDN URLs will work without modification.

