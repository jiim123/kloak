

# Fix: klipy-proxy 401 and broadcast-typing 400 errors

## Issue 1: klipy-proxy 401 — Missing `x-key-hash` header

**Root cause confirmed**: `src/lib/klipyApi.ts` uses a direct `fetch()` call that bypasses the Supabase client's custom fetch wrapper. The wrapper (in `client.ts`) automatically injects the `x-key-hash` header, but `callProxy` only sends `Authorization: Bearer <anon_key>` and `apikey`. The edge function calls `getAuthContext()` → `resolveRequestUserId()` which looks for `x-key-hash` — without it, `requestUserId` is null → returns 401.

**Fix**: Import `getKeyHashAsync` from the Supabase client and add the `x-key-hash` header to the direct fetch in `callProxy`. Guard against missing key hash (return null early if not authenticated).

## Issue 2: broadcast-typing 400 — Body parsing failure

**Root cause**: The edge function reads the body with `await req.json().catch(() => null)` on line 59. If body parsing fails for any reason, `body` becomes `null`, `body?.channel_id` is `undefined`, `channelId` becomes `""`, and the UUID regex fails → returns 400 "Invalid channel_id". 

`supabase.functions.invoke()` sends the body correctly, but the edge function reads `req.headers.get("x-key-hash")` before reading the body — this is fine. However, the repeated 400s suggest something systematic. The `useTyping` hook validates `channelId` is non-null but doesn't validate UUID format before calling.

**Fix**: 
1. In `useTyping.ts`, add UUID format validation before calling the edge function (using the existing `UUID_V4ish_RE` regex that's already defined but unused)
2. In the edge function, add a `console.warn` when body is null to help diagnose if there are parsing failures

## Changes

| File | Change |
|------|--------|
| `src/lib/klipyApi.ts` | Import `getKeyHashAsync`, add `x-key-hash` header to `callProxy` |
| `src/hooks/useTyping.ts` | Guard `publishTypingEvent` with `UUID_V4ish_RE.test(channelId)` before invoking |
| `supabase/functions/broadcast-typing/index.ts` | Add warning log when body parsing returns null |

