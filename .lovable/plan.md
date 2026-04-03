

# Plan: Migrate Storage to Bunny CDN (Blob Proxy for Attachments)

## Summary

Replace all Supabase Storage usage with Bunny CDN. Public buckets use direct CDN URLs. Attachments use an Edge Function that proxies the file as binary — the client creates `blob:` object URLs and caches them with revocation on expiry/eviction.

## Step 1: Create `src/lib/bunny-upload.ts`

New file with three exports:
- **`uploadFile(bucket, filePath, file)`** — POSTs raw bytes to `${SUPABASE_URL}/functions/v1/upload-to-bunny` with `x-bucket`, `x-file-path`, `x-key-hash`, `Authorization` headers. Returns `{ url }`.
- **`deleteFile(bucket, filePath)`** — POSTs JSON to `/functions/v1/delete-from-bunny`. `// TODO: deploy Edge Function`
- **`getCdnUrl(bucket, filePath)`** — Returns `https://kloakcdn.b-cdn.net/${bucket}/${filePath}`.

## Step 2: Rewrite `src/lib/signedUrl.ts` (blob proxy → object URLs)

Keep all caching infrastructure (TTL, LRU, in-flight dedup, `_peekCache`, `invalidateCacheEntry`). Changes:
- **`getSignedAttachmentUrl`**: Replace `supabase.storage.from("attachments").createSignedUrl(...)` with `fetch` POST to `/functions/v1/sign-bunny-url` body `{ bucket: "attachments", path }`. Response is binary blob. Create `URL.createObjectURL(blob)` and cache it.
- **Eviction/expiry**: Call `URL.revokeObjectURL(entry.url)` when entries are evicted or expire.
- **`invalidateCacheEntry`**: Revoke object URL before deleting.
- **`getSignedAttachmentUrls` (batch)**: Loop individual `getSignedAttachmentUrl` calls (dedup already handled).
- **Keep** `isSupabaseAttachmentUrl`, `extractStoragePath` for backward compat with legacy DB URLs.
- **Remove** `import { supabase }`.

## Step 3: Rewrite `src/lib/storageUpload.ts`

Replace internals to use Bunny functions, same exports:
- `secureUpload` → calls `uploadFile` from bunny-upload.ts. For public buckets, `publicUrl` via `getCdnUrl`. For attachments, pre-warm via `getSignedAttachmentUrl`.
- `secureDelete` → calls `deleteFile`.
- `secureListAndDelete` → TODO comment for Bunny equivalent.
- SVG sanitization preserved.

## Step 4: Replace all `getPublicUrl` calls with `getCdnUrl`

6 files, all `server-emojis` bucket — replace `supabase.storage.from('server-emojis').getPublicUrl(path).data.publicUrl` with `getCdnUrl('server-emojis', path)`:

| File | Sites |
|------|-------|
| `src/components/chat/MessageContent.tsx` | 1 (`getServerEmojiPublicUrl`) |
| `src/components/modals/EmojiPicker.tsx` | 1 |
| `src/components/modals/ServerSettingsModal.tsx` | 1 |
| `src/components/settings/ServerSettingsPage.tsx` | 1 |
| `src/lib/globalEmojiResolver.ts` | 3 |
| `src/lib/serverEmojis.ts` | 2 |

Remove unused `supabase` imports where they become dead code (`EmojiPicker.tsx`, `serverEmojis.ts`). Keep `supabase` import in files that still use it for DB queries/Realtime.

## Step 5: Add deprecation comment to `supabase/functions/storage-upload/index.ts`

Add `// DEPRECATED: uploads now go through upload-to-bunny Edge Function` at the top. Do NOT change any logic or URL construction in this file.

## Files Not Changed

`UserSettingsModal.tsx`, `MessageItem.tsx`, `MessageInput.tsx`, `DMChatArea.tsx`, `MediaChannelArea.tsx`, `useSignedUrl.ts`, `useSignedUrls.ts` — all use the unchanged `secureUpload`/`secureDelete`/`signedUrl.ts` APIs.

## Files Modified

1. **New:** `src/lib/bunny-upload.ts`
2. **Rewritten:** `src/lib/signedUrl.ts`
3. **Rewritten:** `src/lib/storageUpload.ts`
4. **Updated:** `src/components/chat/MessageContent.tsx`
5. **Updated:** `src/components/modals/EmojiPicker.tsx`
6. **Updated:** `src/components/modals/ServerSettingsModal.tsx`
7. **Updated:** `src/components/settings/ServerSettingsPage.tsx`
8. **Updated:** `src/lib/globalEmojiResolver.ts`
9. **Updated:** `src/lib/serverEmojis.ts`
10. **Updated:** `supabase/functions/storage-upload/index.ts` (deprecation comment only)

