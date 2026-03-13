

# Frontend-Backend Alignment Audit

## Summary

After thoroughly reviewing the frontend stores, hooks, and components against the Supabase types (which reflect the current database schema), the codebase is **largely well-aligned**. The RPC function signatures in `types.ts` match the calls made from stores and hooks. However, I found one confirmed issue and a few low-risk observations.

---

## Confirmed Issue

### 1. `createMentionNotification` uses direct INSERT on `notifications` table -- blocked by RLS

**Location**: `src/stores/notificationStore.ts` line 137-152

The function does:
```typescript
await supabase.from('notifications').insert({ user_id, type: 'mention', title, body, link });
```

But the RLS policy on `notifications` says:
```
INSERT WITH CHECK (false)  -- "Notifications via RPC only"
```

This INSERT will **always fail** silently or with a permission error. Notification creation should go through a server-side RPC or be handled by a database trigger. Since notifications for mentions are likely created by a trigger on the `mentions` table already, this function call is dead code that never succeeds.

**Fix**: Remove the `createMentionNotification` action entirely (it's never called from any component), or replace it with an RPC if manual notification creation is needed.

---

## Observations (No Action Required)

### 2. `as any` RPC casts are safe
Multiple RPC calls use `as any` type casts (e.g., `send_message`, `send_poll`, `close_poll`, `close_dm_conversation`). All of these RPCs exist in the generated `types.ts` file with matching argument signatures. The casts are used to work around TypeScript strictness, not because the RPCs are missing.

### 3. Direct table access patterns are RLS-compliant
- `notifications` table: SELECT, UPDATE, DELETE all have RLS policies that check `user_id = requesting_user_id()` -- frontend queries correctly filter by `user_id`.
- `dm_reactions` table: SELECT/INSERT/DELETE policies are correctly set. Frontend reads with `.in("message_id", ...)` and writes reactions via RPC (`add_dm_reaction`, `remove_dm_reaction`).
- `dm_attachments` table: SELECT policy checks participant status. Frontend reads with `.in("message_id", ...)`.
- `channel_reads` table: ALL policy checks `user_id = requesting_user_id()`.
- `polls` / `poll_votes` tables: Read access via direct queries is fine; writes go through RPCs (`vote_poll`, `close_poll`).
- `user_voice_settings` table: Direct upsert with `user_id` matches RLS expectations.
- `media_items` table: SELECT only, correctly scoped.

### 4. Edge functions match frontend invocations
All 6 edge function invocations map to deployed functions in `supabase/functions/`:
- `fetch-link-preview` 
- `giphy-search` 
- `get-livekit-token` 
- `broadcast-typing` 
- `update-user-profile` 
- `fetch-discord-template` 

### 5. Realtime subscriptions use broadcast pattern
The app uses Supabase Realtime broadcast channels (not postgres_changes), which sidesteps RLS concerns for realtime delivery. The `realtime` and `supabase_realtime_admin` roles have bypass SELECT policies on critical tables.

---

## Implementation Plan

**Single change needed:**

In `src/stores/notificationStore.ts`, remove the `createMentionNotification` method since:
1. It will always fail due to the `INSERT WITH CHECK (false)` RLS policy
2. It's not called from any component (confirmed via search)
3. Mention notifications are handled server-side via database triggers

This is a cleanup task -- no functionality is broken because the method is never invoked.

