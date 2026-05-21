## Why the error happens

The `update_server` RPC only allows two paths through its permission gate:

1. `servers.owner_id = _user_id` (server owner), OR
2. `server_members.role = 'admin'` (base role)

```sql
IF NOT _is_owner THEN
  IF _user_role IS NULL THEN ... 'Not a member'
  IF _user_role <> 'admin' THEN ... 'Insufficient permissions'
END IF;
```

So anyone who is not the `owner_id` owner and whose base role is `member` or `moderator` is rejected — even if they hold a custom role that grants `manage_server`, and even if their base role is `admin` only through a custom assignment. The rest of the app (see `src/lib/permissions.ts` and `useMemberPermissions`) evaluates `manage_server` via the full hierarchy (owner → user channel overrides → custom roles → @everyone → base role defaults), so the UI happily shows the "Save" button for users the RPC then rejects with `Insufficient permissions`.

That mismatch is the bug producing the console error. The user hitting Save is a member of the server who either:
- has a custom role with `manage_server` allowed, or
- has base role `moderator`/`member` but the UI gated on `hasPermission('manage_server')` (which returns true for admins/custom roles).

## Fix

Replace the hard-coded `_user_role <> 'admin'` check with a call to the existing `check_user_server_permission(_user_id, _server_id, 'manage_server')` helper (used elsewhere, e.g. the `channel_members` INSERT policy). That function already encodes the Discord-style hierarchy on the DB side and mirrors the frontend `evaluatePermission`.

Change in `update_server`:

```text
IF NOT _is_owner THEN
  IF _user_role IS NULL THEN
    return 'Not a member of this server'
  END IF;
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_server') THEN
    return 'Insufficient permissions'
  END IF;
END IF;
```

Owner-only operations stay owner-gated where they already are (e.g. publication eligibility already calls `get_server_publication_eligibility`, transfer ownership lives elsewhere). No other behavior changes.

## Steps

1. Write a migration that `CREATE OR REPLACE`s `public.update_server` with the same body, swapping only the permission gate to use `check_user_server_permission(..., 'manage_server')`.
2. Verify by having a non-owner admin / custom-role member with `manage_server` edit the server name; the call should now succeed and realtime should propagate.

## Out of scope

- No frontend changes — `serverStore.updateServer` and the settings page are correct.
- No change to which fields are editable or to publication rules.
