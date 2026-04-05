

## Console Error Audit: Fix All Warnings and Failed API Calls

### Issues Found

**1. `X-Frame-Options` meta tag ignored by browsers**
- `index.html` line 34: `<meta http-equiv="X-Frame-Options" content="DENY" />`
- Browsers only respect X-Frame-Options via HTTP headers, not meta tags. This fires a console error on every page load.
- **Fix**: Remove the meta tag entirely. The CSP `frame-ancestors` directive (if needed) is the modern replacement and can be set via HTTP header on the hosting side.

**2. Tooltip controlled/uncontrolled switching warning (repeated ~10x)**
- Pattern: `<Tooltip open={tooltipsEnabled ? undefined : false}>` in `ServerSidebar.tsx` and `HorizontalServerSidebar.tsx`
- When `tooltipsEnabled` is `false`, `open` is `false` (controlled). When `true`, `open` is `undefined` (uncontrolled). React warns about this switch.
- **Fix**: Always pass a defined `open` value. When tooltips are disabled, pass `open={false}`. When enabled, omit the `open` prop entirely by conditionally rendering. Simplest approach: render the Tooltip with `open` never set when enabled — use a wrapper pattern or simply never pass `undefined`. The cleanest fix: `open={tooltipsEnabled ? undefined : false}` → remove the `open` prop and instead wrap content in a condition:
  ```tsx
  // Before (causes warning):
  <Tooltip open={tooltipsEnabled ? undefined : false}>
  
  // After (no warning — always uncontrolled, just disabled via pointer-events or skip render):
  <Tooltip open={!tooltipsEnabled ? false : undefined}>
  ```
  Actually the issue is the *switch*. The fix is to always keep it controlled: `open={tooltipOpen}` where `tooltipOpen` is managed via state. But that's too invasive. Simpler: extract a small wrapper component `<ConditionalTooltip enabled={tooltipsEnabled}>` that either renders the full `<Tooltip>` (uncontrolled) or just renders children directly (no Tooltip at all). This avoids ever switching.

**3. `ServerAuthGuard` forwardRef warning**
- `App.tsx` line 16: `const ServerAuthGuard = lazy(() => ...)` — used as a route wrapper, React Router's `Outlet` passes a ref to it.
- `ServerAuthGuard` is a plain function component, not wrapped in `forwardRef`.
- **Fix**: Wrap the export in `React.forwardRef` in `ServerAuthGuard.tsx`. Since the component doesn't use the ref, just accept and ignore it.

**4. Link previews fetched for CDN attachment URLs (wasteful 400s/undefined results)**
- Edge function logs show repeated calls to `fetch-link-preview` for `kloakcdn.b-cdn.net` attachment URLs (`.wav`, etc.). These return `undefined` since CDN files have no OG tags.
- Also causes 404s on `fetch-link-preview-asset` trying to get favicons for `kloakcdn.b-cdn.net`.
- **Fix**: In `LinkPreview.tsx` or `MessageContent.tsx` where URLs are extracted, skip URLs whose host is `kloakcdn.b-cdn.net` (the Bunny CDN). These are already rendered as inline attachments.

**5. `get_voice_channel_meta_for_token` permission denied**
- Edge function `get-livekit-token` calls an RPC `get_voice_channel_meta_for_token` but gets `permission denied for function`.
- **Fix**: Create a migration to `GRANT EXECUTE` on this function to the appropriate role (`anon` or `authenticated`, matching how the edge function calls it — likely via service role client, so grant to `service_role` if not already, or check if the function exists and has correct permissions).

### Files to Change

| File | Change |
|---|---|
| `index.html` | Remove line 34 (`X-Frame-Options` meta tag) |
| `src/components/auth/ServerAuthGuard.tsx` | Wrap in `forwardRef` |
| `src/components/layout/ServerSidebar.tsx` | Replace `open={tooltipsEnabled ? undefined : false}` pattern with a `ConditionalTooltip` wrapper |
| `src/components/layout/HorizontalServerSidebar.tsx` | Same tooltip fix |
| New: `src/components/ui/ConditionalTooltip.tsx` | Small wrapper: if `enabled`, render `<Tooltip>` (no `open` prop); if not, render children only |
| `src/components/chat/MessageContent.tsx` | Skip link preview for `kloakcdn.b-cdn.net` URLs in `extractUrls` or where `LinkPreview` is rendered |
| Migration SQL | `GRANT EXECUTE ON FUNCTION get_voice_channel_meta_for_token TO service_role` |

### What stays unchanged
- `postMessage` warnings from `lovable.js` — this is Lovable platform infrastructure, not project code
- `site.webmanifest` CORS redirect — also Lovable platform infrastructure
- All existing functionality (tooltips still appear on hover when enabled, link previews still work for real URLs)

