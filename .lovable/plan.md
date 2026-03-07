

# Security Review: IDOR and BAC Attack Surface

## Summary

All 50 tables have RLS enabled. The architecture is generally well-hardened with `requesting_user_id()` identity verification, SECURITY DEFINER RPCs for mutations, and restrictive policies. However, the scan and manual review found **4 actionable issues** ranging from medium to high severity.

---

## Finding 1 (HIGH): `users_public` View Bypasses Visibility Controls

The `users_public` view exposes profile data (username, bio, status, avatar, pronouns, banner, etc.) to anyone who can query it. While `security_invoker=true` is set, meaning the base `users` table RLS applies, the base table SELECT policy currently requires `CURRENT_USER = 'realtime'`. This means:

- Direct PostgREST queries by `anon` are blocked (good).
- However, any SECURITY DEFINER function that queries `users_public` internally runs as the function owner (typically `postgres`), bypassing RLS entirely.

**Risk**: If any existing or future RPC reads from `users_public` without its own access checks, all user profiles become readable regardless of relationship.

**Fix**: Add an explicit RLS-like check directly in the view definition, or create a permissive SELECT policy on `users` for the `public` role that enforces `can_view_user(id, requesting_user_id())` (without the `CURRENT_USER = 'realtime'` gate), so the view works correctly under security_invoker.

---

## Finding 2 (MEDIUM): `server_members` UPDATE Policy Has Self-Referential Bug

The "Users update own non-role data" policy contains:
```sql
server_members_1.server_id = server_members_1.server_id
```
This compares the column to itself (always TRUE). For users in multiple servers, the subquery returns multiple rows, causing a PostgreSQL error that **blocks all self-updates** (nickname changes, etc.).

More critically, the intended immutability guard for `role`, `is_banned`, and `is_muted` is non-functional -- the check doesn't properly scope to the current row's server.

**Fix**: Replace both occurrences with `server_members_1.server_id = server_members.server_id`.

---

## Finding 3 (MEDIUM): Four SECURITY DEFINER Helpers Accept Arbitrary User IDs

These functions can be called directly via PostgREST REST API by anyone:
- `is_member_in_same_server(_member_id, _user_id)`
- `is_message_channel_member(_message_id, _user_id)`
- `is_media_channel_member(_media_id, _user_id)`
- `is_category_server_member(_category_id, _user_id)`

Unlike their sibling functions (`is_server_member`, `is_channel_server_member`, etc.), they do **not** call `verify_request_identity(_user_id)`. An attacker can probe whether any user is a member of any server/channel by calling these with arbitrary UUIDs and observing the boolean result.

**Fix**: Add `IF NOT verify_request_identity(_user_id) THEN RETURN false; END IF;` at the top of each function. Convert them from SQL to PL/pgSQL to support the guard.

---

## Finding 4 (LOW): Leaked Password Protection Disabled

This is a Supabase Auth setting. Since Kloak uses a custom secret-key auth system (not passwords), this finding is a **false positive** in context.

**Action**: Ignore -- not applicable to the custom auth model.

---

## What Looks Good

- All 50 tables have RLS enabled
- Mutations (INSERT/UPDATE/DELETE) are locked down on sensitive tables and routed through SECURITY DEFINER RPCs
- `requesting_user_id()` + `verify_request_identity()` pattern is used consistently for identity
- Channel access checks (`can_access_channel`) gate message reads
- DM access properly scoped to participants
- Friend requests scoped to involved parties
- Notification reads scoped to owning user
- `user_auth` and `pow_challenges` tables deny all direct access
- Storage policies use `get_request_user_id()` for ownership checks

---

## Implementation Plan

### Migration 1: Fix `server_members` UPDATE policy
Replace the self-referential bug in the WITH CHECK clause.

### Migration 2: Add `verify_request_identity` to four helper functions
Convert from SQL to PL/pgSQL and add the identity guard.

### Migration 3: Harden `users_public` view access
Add a proper SELECT policy on `users` for the `public` role using `can_view_user()` without the `CURRENT_USER = 'realtime'` gate, so the security_invoker view correctly enforces visibility.

### Ignore Finding 4
Mark leaked password protection as not applicable.

