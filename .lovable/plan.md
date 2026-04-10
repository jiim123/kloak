
What I found

- The zip importer is already uploading each emoji file to Bunny CDN successfully.
- The failure happens on the next step, when the app calls `upload_server_emoji`.
- The current flow in all emoji upload paths is:
  1. upload file with `secureUpload("server-emojis", ...)`
  2. register it with `supabase.rpc("upload_server_emoji", ...)`
- Your network logs prove the Bunny upload is returning `200`, but the RPC returns `400` with `Emoji file not found in storage`.
- I traced that error to the database function: the latest `upload_server_emoji` SQL still checks `storage.objects`, which only works for legacy Supabase Storage. Bunny uploads never create a `storage.objects` row, so every import fails.

Plan

1. Add a new Supabase migration to replace `public.upload_server_emoji` with a Bunny-aware version.
   - Keep the existing identity check, permission check, emoji name validation, safe path validation, and 50-emoji limit.
   - Remove the legacy `storage.objects` existence check that throws `Emoji file not found in storage`.
   - Keep storing the relative Bunny path in `server_emojis.file_path`, because the frontend already resolves it with `getCdnUrl("server-emojis", file_path)`.

2. Harden the frontend upload callers.
   - Update:
     - `src/components/modals/ImportEmojiPackModal.tsx`
     - `src/components/settings/ServerSettingsPage.tsx`
     - `src/components/modals/ServerSettingsModal.tsx`
   - Use the `path` returned by `secureUpload(...)` when calling the RPC and when cleaning up failed uploads, instead of assuming the requested path and stored path will always be identical.

3. Verify the full flow end to end.
   - Import an `emoji.gg` zip pack
   - Upload a single emoji manually
   - Confirm `upload-to-bunny` succeeds
   - Confirm `upload_server_emoji` returns `200` instead of `400`
   - Confirm rows appear in `server_emojis`
   - Confirm emojis show in the server settings list and emoji picker
   - Confirm failed inserts still delete the Bunny file correctly

Technical details

- The actual broken piece is not the UI uploader; it is the database RPC still tied to Supabase Storage.
- That means this fix is primarily a migration, not a storage library rewrite.
- The migration must be a new file after the latest emoji migration, because the newest SQL still recreates `upload_server_emoji` with the bad `storage.objects` check.

Files likely involved

- `supabase/migrations/<new migration>.sql`
- `src/components/modals/ImportEmojiPackModal.tsx`
- `src/components/settings/ServerSettingsPage.tsx`
- `src/components/modals/ServerSettingsModal.tsx`

Expected outcome

- Zip emoji imports will work
- Single emoji uploads will work again too
- The emoji registration path will no longer depend on Supabase Storage
