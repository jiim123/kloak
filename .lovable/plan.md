## Plan — Stop IP leak when rendering media-channel items

### The leak

In `src/components/media/MediaChannelArea.tsx`, items uploaded as **URL** (and YouTube thumbnails from `img.youtube.com`) end up rendered as `<img src={item.media_url}>` (line 980, lightbox) and `<img src={thumbnailSrc}>` (line 853, grid card). The browser then fetches the image **directly from the attacker-controlled origin**, exposing every viewer's real IP / `User-Agent` / referrer.

The crawler-side flow already proxies link-preview images through `supabase/functions/fetch-link-preview-asset/index.ts` using a signed-token URL (`{u, exp, sig}`), but that signed URL is only generated server-side inside `fetch-link-preview` and is never produced for media-channel items, so the client has no way to obtain one.

File-uploads (Bunny CDN / Supabase Storage) are first-party and not affected. The leak only applies to:
- `media_type === "image" | "gif"` items inserted via the **URL** tab (`item.media_url`).
- `media_type === "youtube"` items, whose `item.thumbnail_url` always points to `img.youtube.com`.

### Fix overview

Route every external media URL in the media-channel view through the existing signed proxy (`fetch-link-preview-asset`). Generate the signed URL on demand from a tiny new edge function so the HMAC secret stays server-side.

### Steps

**1. New edge function `sign-asset-proxy`** (`supabase/functions/sign-asset-proxy/index.ts`)
   - Accepts `POST { urls: string[] }` (cap at 24 URLs / request).
   - Validates auth via the shared `resolveRequestUserId` helper already used by `fetch-link-preview-asset` (`_shared/edgeSecurity.ts`).
   - For each URL:
     - Reject non-`http(s)` and already-proxied URLs (return them unchanged).
     - Reuse `isUrlSafe()` from the link-preview asset module so the same SSRF allow/deny rules apply.
     - Build the signed proxy URL with HMAC of `${exp}:${targetUrl}` using `LINK_PREVIEW_PROXY_SECRET` (TTL 24h, matching the existing function).
   - Returns `{ results: Record<originalUrl, proxiedUrl | null> }`.
   - Strict 10 KB body limit, CORS via `corsHeaders` in the file, no `supabase/config.toml` changes (default `verify_jwt = false`, identity verified in code).

**2. Client helper `src/lib/proxyAssetUrl.ts`**
   - `getProxiedAssetUrl(url: string): Promise<string>` and `getProxiedAssetUrls(urls: string[]): Promise<Map<string,string>>`.
   - In-memory cache keyed by original URL with ~22h TTL (under the 24h server TTL so we refresh before expiry).
   - In-flight deduplication and small batching window (50 ms) so a grid renders one batch call.
   - Skip URLs that are first-party (Supabase / Bunny CDN host); return them unchanged.
   - Falls back to a 1×1 transparent data URI if signing fails, so we never accidentally render the raw external URL.

**3. Wire `MediaChannelArea.tsx`**
   - Replace the direct `<img src={thumbnailSrc}>` in `MediaCard` and `<img src={item.media_url}>` in `MediaLightbox` with a small wrapper that uses `getProxiedAssetUrl` (loading state = current `bg-muted` skeleton).
   - For `media_type === "youtube"`, proxy `thumbnail_url` only. The YouTube embed iframe itself is left as-is (loading youtube.com inside an iframe is the documented behavior of any YouTube embed and out of scope for this fix — note this in code comment).
   - File-uploaded items (Bunny / Supabase URLs) bypass the proxy via the host check, so existing behavior is unchanged.

**4. Optional but recommended:** also proxy the same fields inside the message-channel image renderer (`MessageContent.tsx` lines 361 / 394) — same class of leak. Listed as out of scope for this ticket unless the user wants it included; flagged in the final response.

### Verification

1. Send a media-channel item with `https://attacker.example/track.gif` via the URL tab — open DevTools Network and confirm the request goes to `…/functions/v1/fetch-link-preview-asset?...` and never to `attacker.example` from the browser.
2. Same for YouTube items: confirm `img.youtube.com` is not requested from the browser; the thumbnail loads via the proxy.
3. File-uploaded items still load from Bunny CDN directly (no behavior change).
4. Click delete on a URL-uploaded item: confirm only the RPC fires and no request hits the external host.
5. Confirm signed URL TTL: after >22h the helper refreshes silently before the server-side 24h expiry.

### Out of scope

- Proxying message-attachment images in `MessageContent.tsx` (same fix is straightforward but separate surface).
- YouTube iframe player IP exposure.
- Pre-signing at insert time / storing proxy URLs in DB (TTL would force refresh anyway).
- Changing the `fetch-link-preview-asset` proxy itself or its TTL.
