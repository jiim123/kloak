

## Fix: Banned Users Can Still Join Servers

### Root Cause

There are **two copies** of `join_server_by_invite` in the database with different signatures:
- **Old version** (2 params): `_invite_code text, _user_id uuid` 
- **New version** (3 params): `_invite_code text, _user_id uuid, _join_source text DEFAULT 'invite_link'`

When the frontend calls `supabase.rpc('join_server_by_invite', {...})` with 3 parameters, PostgREST may route to the wrong overload or encounter ambiguity due to the DEFAULT parameter. This can cause the ban check to be bypassed entirely.

Additionally, `get_server_channels` has **no membership or ban check** -- it returns all channels for any server ID, meaning if a banned user somehow reaches the server page, they see everything.

### Fix (3 steps)

**Step 1: Database migration**
- DROP the old 2-parameter overload of `join_server_by_invite` to eliminate ambiguity
- Update `get_server_channels` to verify the calling user is a non-banned member before returning channels (return empty array if banned or not a member)
- Update `get_server_categories` similarly

**Step 2: Add server-level ban guard in `serverStore.ts`**
- In the `joinServer` function, add a secondary safeguard: after the RPC returns successfully, verify the user is NOT banned before returning the server object
- This is a defense-in-depth measure in case the RPC somehow returns data for a banned user

**Step 3: Add route-level guard in `AppLayout.tsx`**
- When a server is selected via URL (`urlServerId`), add a check: fetch the user's membership status for that server and redirect to `/app` if banned
- This prevents direct URL navigation to a banned server

### Technical Details

```text
Database Changes:
  1. DROP FUNCTION public.join_server_by_invite(text, uuid)  -- remove old overload
  2. ALTER get_server_channels to check membership + ban status
  3. ALTER get_server_categories to check membership + ban status

Frontend Changes:
  1. serverStore.ts - add post-RPC ban verification in joinServer()
  2. AppLayout.tsx - add membership verification when loading server from URL
```

### Result
- Only one version of the join function exists, eliminating routing ambiguity
- Banned users are blocked at the database level (RPC exception), store level (post-check), and route level (URL guard)
- Even if somehow bypassed, `get_server_channels` returns no data for banned users
