

# Kloak Security Audit -- Full Report

---

## SEVERITY LEGEND

| Level | Meaning |
|-------|---------|
| P0 -- CRITICAL | Active exploitation possible right now. Data breach imminent. |
| P1 -- HIGH | Exploitable with moderate effort. Significant damage potential. |
| P2 -- MEDIUM | Exploitable in specific scenarios. Needs fixing before production hardening. |
| P3 -- LOW | Minor risk or defense-in-depth improvement. |

---

## VULNERABILITY LIST

### V1: key_hash Exposed via Public SELECT -- ACCOUNT TAKEOVER (P0 CRITICAL)

**What's happening:** The `users` table has an RLS SELECT policy of `true` (all rows readable by everyone). The `key_hash` column -- which is the SHA-256 hash of the user's secret key and serves as the **sole authentication credential** -- is included in this table.

**Proof:** Any anonymous client can run:
```sql
SELECT id, username, key_hash FROM users;
```
This returns every user's authentication hash. Since RPC functions like `update_user_profile(_user_id, ...)`, `update_user_status(_user_id, ...)`, and `send_message(_channel_id, _user_id, ...)` trust the `_user_id` parameter directly (see V2), an attacker doesn't even need the key_hash to impersonate users. But with the key_hash exposed, they can also set the `x-key-hash` header and pass storage policy checks.

**Impact:** Complete account takeover of every user on the platform.

**Fix strategy:**
1. Create a `users_public` view that excludes `key_hash` and `last_key_reset_at`
2. Revoke direct SELECT on the `users` table (set policy to `USING (false)`)
3. All application queries that currently read from `users` should read from `users_public` instead
4. RPC functions (SECURITY DEFINER) can still access the base table internally

---

### V2: RPC Functions Trust Client-Supplied _user_id -- BROKEN AUTHENTICATION (P0 CRITICAL)

**What's happening:** Every single mutation RPC function accepts `_user_id` as a parameter and trusts it blindly. None of them verify that the caller actually owns that user ID. The `get_request_user_id()` function exists (extracts user from `x-key-hash` header) but is only used in storage policies -- zero RPC functions call it.

**Affected functions (non-exhaustive):**
- `update_user_profile(_user_id, _updates)` -- edit ANY user's profile
- `update_user_status(_user_id, _status)` -- change ANY user's status
- `send_message(_channel_id, _user_id, ...)` -- send messages as ANY user
- `edit_message(_message_id, _user_id, ...)` -- edit another user's messages
- `delete_message(_message_id, _user_id, ...)` -- delete another user's messages
- `update_server(_server_id, _user_id, ...)` -- checks role but trusts _user_id
- `kick_member(_server_id, _user_id, ...)` -- kick as if you were an admin
- `ban_member(_server_id, _user_id, ...)` -- ban as if you were an admin
- `assign_role_to_member(_member_id, _role_id, _user_id)` -- assign roles as admin
- `send_dm(_conversation_id, _sender_id, ...)` -- send DMs as any user
- `join_server_by_invite(_, _user_id, ...)` -- join servers as any user
- `leave_server(_, _user_id)` -- force other users to leave servers

**Impact:** Any authenticated or even anonymous user can perform ANY action as ANY other user. This is equivalent to having no authentication at all.

**Fix strategy:**
Every RPC function must derive the caller's identity from the `x-key-hash` header instead of trusting the parameter:

```sql
CREATE OR REPLACE FUNCTION public.update_user_profile(
  _updates json
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user_id uuid;
  result json;
BEGIN
  _user_id := public.get_request_user_id();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  -- rest of function uses _user_id derived from header
  ...
END;
$$;
```

This must be done for ALL ~40+ RPC functions. The `_user_id` parameter should be removed entirely from function signatures.

---

### V3: No Server-Side Input Validation on Display Names (P1 HIGH)

**What's happening:** The `update_user_profile` RPC accepts arbitrary strings for `display_name`, `bio`, `custom_status`. There is no server-side validation for:
- Length limits (display_name could be thousands of characters)
- Character restrictions (allows control characters, zero-width joiners, RTL override characters)
- HTML/script injection (while React escapes by default, bio content is rendered with markdown)

The client-side `validateUsername` only applies to the initial username, not display_name.

**Impact:**
- UI injection via extremely long names or RTL override characters
- Potential XSS if any rendering path uses `dangerouslySetInnerHTML`
- Unicode homoglyph impersonation (display_name "admin" using Cyrillic characters)

**Fix strategy:** Add server-side validation in the `update_user_profile` RPC:
```sql
IF char_length(_updates->>'display_name') > 32 THEN
  RAISE EXCEPTION 'Display name too long';
END IF;
-- Strip control characters, zero-width joiners, RTL overrides
```

---

### V4: DM Messages Readable by Anyone (P0 CRITICAL)

**What's happening:** The `direct_messages` table has a SELECT policy `DMs are viewable` with `USING (true)`. While there are also more restrictive policies (`dm_select_members`), the permissive `true` policy overrides them because **all the policies shown are `Permissive: No`** (i.e., they are RESTRICTIVE policies). Multiple RESTRICTIVE policies are ANDed together, but a PERMISSIVE policy with `true` would override. However, looking more carefully, ALL policies are listed as `Permissive: No` which means they are RESTRICTIVE -- so they are ANDed. The `DMs are viewable` with `USING (true)` being RESTRICTIVE means it passes, and then `dm_select_members` must ALSO pass.

Wait -- re-examining: since `auth.uid()` is always NULL (custom auth, no Supabase Auth), the `dm_select_members` policy which checks `auth.uid() = sender_id` will ALWAYS fail. This means the combination of RESTRICTIVE policies would block ALL access via direct table queries. However, all mutations go through SECURITY DEFINER RPCs which bypass RLS entirely.

The actual risk: the `DMs are viewable` policy with `true` combined with the fact that `auth.uid()` is null means the restrictive policies that check `auth.uid()` would deny access. But SECURITY DEFINER RPCs bypass RLS, so the RPC functions are the actual access path. Since RPC functions trust `_user_id` (V2), an attacker can call `get_dm_messages(_conversation_id, _user_id)` with any conversation ID and any user ID to read private DMs.

**Impact:** All private DMs are accessible to anyone who knows (or guesses) a conversation ID.

**Fix:** Same as V2 -- derive `_user_id` from `x-key-hash` header in all DM-related RPCs.

---

### V5: Messages Table SELECT Policy Exposes All Server Messages (P2 MEDIUM)

**What's happening:** The `messages` table has `SELECT USING (true)`. Any client can query all messages from all channels across all servers, regardless of membership. While the UI only shows messages from channels the user belongs to, a direct PostgREST query like:

```
GET /rest/v1/messages?select=*&limit=1000
```

...returns messages from every server.

**Impact:** Private server messages, private channel messages, and NSFW channel messages are all accessible without membership.

**Fix:** Either:
1. Use `get_request_user_id()` in RLS to verify server membership
2. Or keep the permissive SELECT but ensure the view layer filters (less secure)

---

### V6: Rate Limiting is Client-Side Only (P1 HIGH)

**What's happening:** All rate limiters (`authRateLimiter`, `messageRateLimiter`, `inviteCodeRateLimiter`, etc.) are implemented in `src/lib/security.ts` as client-side JavaScript classes. An attacker using curl/Postman bypasses all rate limiting entirely.

**Impact:**
- Brute-force login attempts (try all possible key hashes)
- Message spam flooding
- Invite code enumeration
- Friend request spam

**Fix:** Implement rate limiting in the database (using a `rate_limits` table with timestamps) or in edge functions. The `send_message` RPC should check message frequency server-side.

---

### V7: update_user_status Has No Identity Check (P1 HIGH)

**What's happening:** `update_user_status(_user_id, _status)` accepts any user ID and changes their status. An attacker can set any user to "offline" or "dnd" to disrupt their experience, or set themselves to "online" to appear active.

**Impact:** Status manipulation for any user.

**Fix:** Remove `_user_id` parameter, derive from `get_request_user_id()`.

---

### V8: Storage Upload Edge Function CORS Allows All Origins (P3 LOW)

**What's happening:** `Access-Control-Allow-Origin: *` in the storage-upload edge function. While the function does verify identity via `x-key-hash`, the wildcard CORS allows any website to make requests if the user has their key_hash stored.

**Fix:** Restrict to your actual domain(s).

---

### V9: Secret Key Stored in localStorage in Plaintext (P2 MEDIUM)

**What's happening:** The user's 64-character secret key is stored in localStorage under `kloak-auth` in plaintext. Any XSS vulnerability or malicious browser extension can extract it.

**Impact:** Account takeover via XSS or browser extension.

**Mitigation:** This is somewhat inherent to the architecture (no server-side sessions), but could be improved with:
- HttpOnly cookie-based sessions via edge function
- Or encrypting the stored key with a user-provided PIN

---

### V10: No Audit Logging (P2 MEDIUM)

**What's happening:** There are no audit logs for sensitive operations:
- Profile changes
- Role assignments/removals
- Member kicks/bans
- Server setting changes
- Key resets

**Impact:** No forensic trail after a security incident.

**Fix:** Create an `audit_log` table and insert records from SECURITY DEFINER functions on sensitive operations.

---

## SECURE ARCHITECTURE DIAGRAM

```text
Current (BROKEN):
  Client ──[_user_id in body]──> Supabase RPC ──[trusts blindly]──> Database
  Client ──[SELECT *]──────────> PostgREST ──[RLS: true]──> All data including key_hash

Correct:
  Client ──[x-key-hash header]──> Supabase RPC ──[get_request_user_id()]──> Verified user_id ──> Database
  Client ──[x-key-hash header]──> PostgREST ──[RLS uses get_request_user_id()]──> Only authorized data
  Client ──[x-key-hash header]──> Edge Functions ──[resolveUser()]──> Verified user_id ──> Database
```

Key principle: The server NEVER trusts a user ID from the client. Identity is ALWAYS derived from the `x-key-hash` header via `get_request_user_id()`.

---

## "NEVER DO THIS" SECTION

1. **NEVER** accept `_user_id` as an RPC parameter for mutations. Derive it server-side.
2. **NEVER** expose authentication credentials (`key_hash`) in SELECT-able tables.
3. **NEVER** use `USING (true)` on tables containing private data (DMs, messages).
4. **NEVER** rely on client-side rate limiting as your only protection.
5. **NEVER** trust that the UI prevents unauthorized access -- always enforce server-side.
6. **NEVER** store authentication secrets in localStorage without encryption.
7. **NEVER** use `Access-Control-Allow-Origin: *` in production for authenticated endpoints.

---

## PRODUCTION SECURITY CHECKLIST

### Immediate (Before any more users join):
- [ ] Hide `key_hash` column: Create `users_public` view, set base table SELECT to `USING (false)`
- [ ] Fix ALL RPC functions to use `get_request_user_id()` instead of `_user_id` parameter
- [ ] Add server-side identity verification to every mutation RPC

### Short-term (Within 1 week):
- [ ] Add server-side rate limiting (database-backed or edge function)
- [ ] Add input validation in RPC functions (display_name length, bio length, content sanitization)
- [ ] Restrict message/DM SELECT policies to verified members only
- [ ] Add CORS domain restrictions to edge functions
- [ ] Create audit logging table and triggers

### Medium-term (Within 1 month):
- [ ] Implement session tokens (edge function issues short-lived JWT after key verification)
- [ ] Add IP-based throttling at the edge function level
- [ ] Add CAPTCHA or proof-of-work for account creation
- [ ] Implement content security headers (CSP, X-Frame-Options, etc.)
- [ ] Add anomaly detection for unusual API patterns

---

## IMPLEMENTATION PRIORITY

The fix for V1 (key_hash exposure) and V2 (trusted _user_id) must happen together as a single migration. The approach:

1. Create `users_public` view excluding `key_hash`
2. Update RLS on `users` base table to `USING (false)` for SELECT
3. Rewrite ALL RPC functions to call `get_request_user_id()` internally
4. Remove `_user_id` parameters from function signatures
5. Update all client-side store calls to stop passing `userId`

This is a large but essential change affecting ~40+ RPC functions and ~10+ store files. It should be done methodically, function by function, with testing after each batch.

