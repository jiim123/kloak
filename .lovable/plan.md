

# Storage Implementation Audit Report

## Executive Summary

This audit identifies several inefficiencies in the storage URL handling that are likely contributing to elevated Supabase egress costs. The good news: **no signed URLs are being used**, and all buckets are correctly configured as public. However, there are critical issues with **cache-busting patterns** and **URL generation inside render loops** that defeat browser caching.

---

## Part One: Audit Findings

### 1. Storage Bucket Inventory

| Bucket | Visibility | Content Type | Status |
|--------|-----------|--------------|--------|
| `avatars` | PUBLIC | User avatars and banners | Correct |
| `server-icons` | PUBLIC | Server icons and banners | Correct |
| `attachments` | PUBLIC | Message file attachments | Correct |
| `server-emojis` | PUBLIC | Custom server emojis | Correct |

**Assessment**: All buckets are correctly configured as public. Content stored in these buckets (avatars, server icons, attachments, custom emojis) is meant to be publicly accessible, so no change is needed to bucket visibility.

---

### 2. Signed URL Usage

**Result**: No instances of `createSignedUrl` found in the codebase.

This is excellent - the application correctly uses `getPublicUrl` for all storage access, which generates static, cacheable URLs.

---

### 3. Cache-Busting Patterns (CRITICAL)

**Severity: HIGH** - These patterns completely defeat browser caching.

#### Issue 3.1: Server Settings Modal
**File**: `src/components/modals/ServerSettingsModal.tsx`

```typescript
// Line 882 - uploadIcon function
return `${publicUrl}?t=${Date.now()}`;

// Line 929 - uploadBanner function  
return `${publicUrl}?t=${Date.now()}`;
```

**Impact**: Every time a server icon or banner is uploaded, the URL stored in the database includes a timestamp parameter. While the intention is to force a cache refresh after upload, this means:
- The cached URL will never match subsequent requests
- Every user seeing this server icon/banner downloads a fresh copy
- The timestamp becomes permanent part of the stored URL

#### Issue 3.2: Server Settings Page
**File**: `src/components/settings/ServerSettingsPage.tsx`

```typescript
// Line 1104 - uploadIcon function
return `${publicUrl}?t=${Date.now()}`;

// Line 1154 - uploadBanner function
return `${publicUrl}?t=${Date.now()}`;
```

**Impact**: Same as above - duplicate implementation with same cache-busting problem.

**Estimated Impact**: HIGH - Server icons appear in:
- Server sidebar (visible constantly)
- Server headers
- Invite previews
- Explore servers page
- Quick switcher

A single server icon with a cache-busting URL could be downloaded thousands of times when it should be cached once.

---

### 4. URL Generation Inside Render Loops (CRITICAL)

**Severity: HIGH** - These patterns generate URLs on every render cycle.

#### Issue 4.1: ServerSettingsModal - Emoji List (Mobile View)
**File**: `src/components/modals/ServerSettingsModal.tsx`
**Lines**: 2278-2282

```typescript
{serverEmojis.map((emoji) => {
  const { data: urlData } = supabase.storage
    .from("server-emojis")
    .getPublicUrl(emoji.file_path);
  const url = urlData.publicUrl;
  // ... renders image
})}
```

**Impact**: Every render of this component regenerates URLs for ALL server emojis. While `getPublicUrl` doesn't make network requests, this pattern:
- Creates unnecessary work on every render
- Is inconsistent with the proper caching pattern used elsewhere (see `fetchServerEmojis`)
- Could interact poorly with React's reconciliation

#### Issue 4.2: ServerSettingsModal - Emoji List (Desktop View)
**File**: `src/components/modals/ServerSettingsModal.tsx`
**Lines**: 3147-3151

Same pattern as above - duplicate code in desktop view.

#### Issue 4.3: ServerSettingsPage - Emoji List
**File**: `src/components/settings/ServerSettingsPage.tsx`
**Lines**: 2943-2947

```typescript
{serverEmojis.map((emoji) => {
  const { data: urlData } = supabase.storage
    .from('server-emojis')
    .getPublicUrl(emoji.file_path);
  const url = urlData.publicUrl;
  // ... renders image
})}
```

Same pattern - URL generation inside map function.

---

### 5. Good Patterns Found (Reference for Fixes)

#### 5.1: Centralized Emoji Caching
**File**: `src/lib/serverEmojis.ts`

This file implements the correct pattern:
- In-memory cache with TTL (60 seconds)
- URLs are generated once and cached
- Deduplication of concurrent requests
- Proper error handling with retry

```typescript
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

export async function fetchServerEmojis(serverId: string): Promise<ServerEmoji[]> {
  // ... proper caching implementation
}
```

#### 5.2: EmojiPicker Component
**File**: `src/components/modals/EmojiPicker.tsx`

Uses the centralized `fetchServerEmojis` function - this is correct.

#### 5.3: MessageContent Component
**File**: `src/components/chat/MessageContent.tsx`

Properly uses `fetchServerEmojis` with caching.

---

### 6. URL Storage Pattern Analysis

The application stores full URLs in the database after upload:

```typescript
// UserSettingsModal.tsx - avatar upload
const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
await updateUser({ avatar_url: publicUrl });
```

This is generally fine, BUT the cache-busting URLs (with `?t=...`) are being stored permanently, causing ongoing cache misses.

---

### 7. Other Patterns Reviewed

#### 7.1: File Naming with Timestamps
**Files**: Multiple upload handlers

```typescript
// MessageInput.tsx
const timestamp = Date.now();
const fileName = `${user.id}/${timestamp}-${crypto.randomUUID()}.${fileExt}`;
```

**Assessment**: This is FINE - timestamps in file NAMES (not URLs) don't affect caching. They're used for uniqueness and cleanup tracking.

#### 7.2: Random Filenames in Forum/Announcements
**Files**: `ForumChannelArea.tsx`, `AnnouncementChannelArea.tsx`

```typescript
const fileName = `${Math.random()}.${fileExt}`;
```

**Assessment**: This is FINE - random names for uploaded files don't affect caching of retrievals.

---

## Part Two: Proposed Fix Strategy

### Fix 1: Remove Cache-Busting from Upload Functions

**Files to modify**:
- `src/components/modals/ServerSettingsModal.tsx`
- `src/components/settings/ServerSettingsPage.tsx`

**Change**: Remove `?t=${Date.now()}` from returned URLs.

**Alternative approach**: Instead of cache-busting, use a version number in the file path itself (e.g., `{serverId}/icon-v{timestamp}.png`) so that:
- New uploads get a new path
- Old cached URLs remain valid for their content
- Browser naturally fetches new version when path changes

### Fix 2: Centralize Server Emoji URL Handling

**Current problem**: ServerSettingsModal and ServerSettingsPage generate URLs inline instead of using the cached `fetchServerEmojis`.

**Fix**: Create a utility hook that provides emoji URLs from the cache:

```typescript
// Proposed: src/hooks/useServerEmojiUrls.ts
export function useServerEmojiUrls(serverId: string) {
  const [emojis, setEmojis] = useState<ServerEmoji[]>([]);
  
  useEffect(() => {
    if (serverId) {
      fetchServerEmojis(serverId).then(setEmojis);
    }
  }, [serverId]);
  
  return emojis;
}
```

Then update the settings components to use this hook instead of inline URL generation.

### Fix 3: Memoize Any Remaining URL Generation

For any component that still needs to generate URLs, wrap in `useMemo`:

```typescript
const emojiUrls = useMemo(() => {
  return serverEmojis.map(emoji => ({
    ...emoji,
    url: supabase.storage.from('server-emojis').getPublicUrl(emoji.file_path).data.publicUrl
  }));
}, [serverEmojis]);
```

### Fix 4: Database URL Cleanup (Optional)

Existing URLs in the database with `?t=...` parameters will continue causing cache misses until they're updated. Options:

1. **Do nothing**: URLs will be fixed when users next update their icons
2. **Migration script**: Remove query parameters from existing URLs

---

## Part Three: Implementation Plan

### Phase 1: Fix Cache-Busting (Highest Priority)

1. **ServerSettingsModal.tsx**
   - Remove `?t=${Date.now()}` from `uploadIcon` return (line 882)
   - Remove `?t=${Date.now()}` from `uploadBanner` return (line 929)

2. **ServerSettingsPage.tsx**
   - Remove `?t=${Date.now()}` from `uploadIcon` return (line 1104)
   - Remove `?t=${Date.now()}` from `uploadBanner` return (line 1154)

### Phase 2: Fix Inline URL Generation

1. **Create new hook**: `src/hooks/useServerEmojis.ts`
   - Wraps existing `fetchServerEmojis` 
   - Provides React-friendly state management

2. **Update ServerSettingsModal.tsx**
   - Use the new hook instead of inline `getPublicUrl` calls
   - Affects lines 2278-2308 and 3147-3180

3. **Update ServerSettingsPage.tsx**
   - Use the new hook instead of inline `getPublicUrl` calls  
   - Affects lines 2943-2980

### Phase 3: Verification

1. Search codebase for any remaining `?t=${Date.now()}` patterns
2. Search for any remaining inline `getPublicUrl` calls in render functions
3. Test that image loading still works correctly after changes

---

## Risk Assessment

| Change | Risk Level | Mitigation |
|--------|-----------|------------|
| Remove cache-busting | LOW | Images already cached will still work; new uploads get clean URLs |
| Centralize emoji URLs | LOW | Using existing proven caching mechanism |
| Database cleanup | MEDIUM | Optional - only needed for perfectionism |

---

## Expected Impact

After implementing these fixes:

1. **Server icons/banners**: Will be cached by browsers, reducing repeated downloads
2. **Custom emojis in settings**: Will use cached URLs instead of regenerating
3. **Overall egress**: Should see significant reduction for repeat visitors

---

## Files to Modify Summary

| File | Changes |
|------|---------|
| `src/components/modals/ServerSettingsModal.tsx` | Remove cache-busting (2 locations), use cached emoji URLs (2 locations) |
| `src/components/settings/ServerSettingsPage.tsx` | Remove cache-busting (2 locations), use cached emoji URLs (1 location) |
| `src/hooks/useServerEmojis.ts` | **NEW FILE** - React hook for cached emoji access |

---

## Questions for Review

1. **Cache-busting intent**: The cache-busting was likely added to force immediate refresh after upload. After removing it, users may need to hard-refresh to see their new icon. Is this acceptable, or should we implement the versioned filename approach?

2. **Database cleanup**: Should we create a migration to clean up existing URLs with `?t=...` parameters? This would prevent cache misses for existing server icons until they're re-uploaded.

3. **Scope confirmation**: This audit focused on storage URL handling. Should we also review other potential sources of high egress (e.g., large database queries, realtime subscriptions)?

