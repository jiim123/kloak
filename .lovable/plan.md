

## Fix Agora "INVALID_VENDOR_KEY" Error

### Problem
The `agora-token` edge function returns the correct App ID, but Agora's servers reject it with `CAN_NOT_GET_GATEWAY_SERVER: invalid vendor key`. The App ID and secrets appear correct in the Agora Console.

### Root Causes to Address

**1. Hidden whitespace in secrets**
When pasting secrets into Supabase, invisible characters (spaces, newlines, tabs) can be included. The App ID `956e8322444c42e5b4f8de9f6f9971a9` could actually be stored as `" 956e8322444c42e5b4f8de9f6f9971a9\n"` — which Agora would reject.

**2. Custom token builder may have a signing bug**
The current edge function uses a hand-rolled AccessToken2 (v007) implementation. A subtle bug in the byte encoding or HMAC signing would produce a token that Agora cannot validate — and Agora's SDK surfaces this as "invalid vendor key" even though the real issue is an invalid token signature.

### Solution

**Step 1: Trim secrets** — Add `.trim()` to both `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` when reading from env vars. This eliminates any hidden whitespace.

**Step 2: Add diagnostic logging** — Log the exact length of the App ID and certificate so we can confirm there are no hidden characters. A valid App ID is exactly 32 characters; a valid certificate is exactly 32 characters.

**Step 3: Replace custom token builder with the official Agora package** — Instead of the hand-rolled signing algorithm, use Agora's official `agora-token` npm package via esm.sh CDN (compatible with Deno). This eliminates any possibility of a signing bug.

### Technical Details

#### File: `supabase/functions/agora-token/index.ts`

Changes:
- Import `RtcTokenBuilder` and `RtcRole` from `agora-token` via esm.sh (Deno-compatible CDN)
- Replace the entire custom `buildToken()` function and all helper functions with the official `RtcTokenBuilder.buildTokenWithUid()` call
- Add `.trim()` when reading `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` from environment
- Add `console.log` with the lengths of both secrets for diagnostics
- Keep existing CORS headers and error handling

The official package call looks like:
```typescript
const token = RtcTokenBuilder.buildTokenWithUid(
  appId, appCert, channelName, uid, RtcRole.PUBLISHER, expireSeconds, expireSeconds
);
```

This is a single-file change to the edge function. No client-side changes needed — the response format (`{ token, appId }`) stays identical.

