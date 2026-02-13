
# Storage Security and Image Compression Plan

## Build Errors to Fix First

Two pre-existing build errors must be fixed before proceeding:

1. **`src/lib/messageAnimation.ts`** imports from `@/types/dm` which doesn't exist. The `DirectMessage` type is exported from `@/types/index.ts`. Fix: change import to `@/types`.

2. **`supabase/functions/livekit-token/index.ts`** references `npm:livekit-server-sdk` which can't resolve. This is a Deno edge function issue -- needs the import specifier fixed in the function file.

---

## TASK 1: Storage Bucket RLS Policies

### Critical Constraint: Custom Auth

This project does NOT use Supabase Auth. It uses a custom secret-key-based authentication system where `auth.uid()` is always `NULL`. This means **standard storage RLS policies that rely on `auth.uid()` will break all uploads**.

The current policies are intentionally permissive (role = `public`) because mutations are secured via SECURITY DEFINER RPC functions at the table level. Storage buckets don't have an equivalent RPC layer.

### Current State

Five buckets exist, all public:
- `avatars` -- user avatars and profile banners (path: `{user_id}/...`)
- `server-icons` -- server icons and server banners (path: `{server_id}/...`)  
- `server-emojis` -- custom server emojis (path: `{server_id}/...`)
- `attachments` -- message attachments (path: `{user_id}/...`)
- `badges` -- badge icons

All have permissive INSERT/UPDATE/DELETE policies open to `public` role.

### Approach

Since `auth.uid()` is always NULL, we cannot use it in storage policies. Instead, we will create a SECURITY DEFINER helper function in the `public` schema that extracts the user ID from the custom `x-key-hash` header (already sent with every request via the Supabase client's `dynamicHeaders`). This function will look up the `users` table to verify the key hash and return the user ID.

Then storage policies will use this function instead of `auth.uid()`.

**New function:**
```sql
CREATE OR REPLACE FUNCTION public.get_request_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _key_hash text;
  _user_id uuid;
BEGIN
  _key_hash := current_setting('request.headers', true)::json->>'x-key-hash';
  IF _key_hash IS NULL OR _key_hash = '' THEN
    RETURN NULL;
  END IF;
  SELECT id INTO _user_id FROM users WHERE key_hash = _key_hash LIMIT 1;
  RETURN _user_id;
END;
$$;
```

**Policies for `avatars` bucket (user-owned):**
- SELECT: keep public
- INSERT: `WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = public.get_request_user_id()::text)`
- UPDATE: `USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = public.get_request_user_id()::text)`
- DELETE: `USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = public.get_request_user_id()::text)`

**Policies for `attachments` bucket (user-owned):**
- Same pattern as avatars, scoped to user folder.

**Policies for `server-icons` bucket (server-owned):**
- INSERT/UPDATE/DELETE: check that the user is the server owner or has admin/owner role in `server_members`, using the `get_request_user_id()` function and the first folder segment as server_id.

**Policies for `server-emojis` bucket (server-owned):**
- Same pattern as server-icons.

**Policies for `badges` bucket:**
- Keep SELECT public. No INSERT/UPDATE/DELETE for regular users (admin-only, managed outside the app).

### Migration SQL

A single migration will:
1. Create `public.get_request_user_id()` function
2. Drop all 12 existing insecure INSERT/UPDATE/DELETE policies
3. Create new scoped policies for all 5 buckets

---

## TASK 2: Client-Side Image Compression

### New Dependency

Install `browser-image-compression`.

### New Utility File

Create `src/lib/imageCompression.ts` with:
- Type `ImageType = 'avatar' | 'profile-banner' | 'server-icon' | 'server-banner'`
- Preset compression configs per type
- `compressImage(file, type)` function that compresses to WebP
- GIF files are NOT used for avatars/banners/icons (only emojis), so no special GIF handling needed

### Files to Update (add compression before upload)

1. **`src/components/modals/UserSettingsModal.tsx`**
   - `handleAvatarUpload` -- compress with `'avatar'` preset before upload
   - `handleBannerUpload` -- compress with `'profile-banner'` preset before upload

2. **`src/components/modals/ServerSettingsModal.tsx`**
   - `uploadIcon` -- compress with `'server-icon'` preset before upload
   - `uploadBanner` / `handleCropComplete` -- banner already produces a WebP blob from the crop modal, but add compression with `'server-banner'` preset for size reduction

3. **`src/components/modals/CreateServerModal.tsx`**
   - Icon upload function -- compress with `'server-icon'` preset before upload

4. **NOT compressing:** message attachments (arbitrary images from users, compressing could degrade quality unexpectedly), emoji uploads (they can be GIFs and are already small).

### Changes per upload site

- Call `compressImage(file, type)` before the `supabase.storage.from().upload()` call
- The compressed file is already WebP with `.webp` extension
- Update `contentType` to `'image/webp'` in upload options where not already set
- File paths already use dynamic extensions from `file.name.split('.').pop()`, so they will naturally become `.webp`

### Edge Cases

- Compression failure falls back to original file (built into the utility)
- File size limits remain as-is (5MB for avatars, 8MB for banners, 2MB for server icons) -- these are pre-compression limits
- No animated GIF handling needed since GIFs are only accepted for emoji uploads, which are not being compressed

---

## Summary of All File Changes

| File | Change |
|------|--------|
| `src/lib/messageAnimation.ts` | Fix import `@/types/dm` to `@/types` |
| `src/lib/imageCompression.ts` | **New file** -- compression utility |
| `src/components/modals/UserSettingsModal.tsx` | Add compression to avatar and banner uploads |
| `src/components/modals/ServerSettingsModal.tsx` | Add compression to icon and banner uploads |
| `src/components/modals/CreateServerModal.tsx` | Add compression to icon upload |
| Database migration | Create `get_request_user_id()` function; drop old policies; create new scoped storage policies |
