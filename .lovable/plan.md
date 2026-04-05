

## Fix: CSP Violations for Klipy and hCaptcha

### Analysis

**Klipy domains found in codebase:**
- `api.klipy.com` — used in the edge function (`klipy-proxy/index.ts`), never called directly from the browser. No CSP change needed.
- `static.klipy.com` — serves GIF media files. Referenced in API response URLs, loaded by `<img>` tags in `GifPicker.tsx`. The `img-src` directive already includes `https:` which covers this. However, `connect-src` does NOT include it, so if the browser pre-fetches or if any `fetch()` call hits this domain, it gets blocked.
- `klipy.com` — only used as an attribution link (`<a href>`), no CSP impact.

**hCaptcha:** The inline handler warning is cosmetic. hCaptcha loads in an iframe (`frame-src` already allows `https://hcaptcha.com https://*.hcaptcha.com`), and the captcha functions correctly. Adding `'unsafe-inline'` or `'unsafe-hashes'` is unnecessary and would weaken security.

### Changes

**1. `index.html`** (CSP meta tag, lines 40-53)
- Add `https://static.klipy.com` to `connect-src`
- Add a comment above the CSP meta tag explaining the hCaptcha inline handler warning is expected and harmless

**2. `src-tauri/tauri.conf.json`** (CSP string, line 30)
- Add `https://static.klipy.com` to `connect-src`

No JavaScript files modified. No existing CSP entries removed.

