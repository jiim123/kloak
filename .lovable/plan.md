

# Fix Invisible Status Leaking as Online to Other Users

## Problem

When a user sets their status to Invisible, other users still see them as Online. This happens because:

1. The database function `update_user_status` always updates `last_seen = now()` -- even when setting status to `offline` (Invisible)
2. The presence logic (`getEffectivePresence`) sees "status is offline but last_seen is recent" and assumes the status is stale, overriding it to Online
3. This means Invisible is purely cosmetic -- it only affects the local user's UI

## Solution

### 1. Fix the database RPC: Don't update `last_seen` when going offline/invisible

**New migration file**: Create a migration that updates `update_user_status` to skip updating `last_seen` when the new status is `'offline'`. This ensures invisible users' `last_seen` stays stale, so `getEffectivePresence` correctly treats them as offline.

```sql
CREATE OR REPLACE FUNCTION public.update_user_status(
  _user_id uuid, _status user_status
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _status = 'offline' THEN
    UPDATE users SET status = _status WHERE id = _user_id;
  ELSE
    UPDATE users SET status = _status, last_seen = now() WHERE id = _user_id;
  END IF;
  RETURN true;
END;
$$;
```

### 2. Fix the login RPC: Don't set status to online (let the client decide)

**Same migration**: Update `login_user` to NOT force `status = 'online'` in the database. The client already re-applies persisted `manualStatus` after login, but there's a brief window where the DB says "online" and other users see it. Instead, the login RPC should only update `last_seen` without changing status, and the client will set the correct status afterward.

Actually, on closer look, login should set to online for normal users. The client re-applies invisible/DND right after. The brief flash is acceptable. We'll leave `login_user` as-is but ensure the client re-apply happens quickly (it already does).

### 3. Add distinct "Invisible" indicator for the local user

**File: `src/components/layout/LoggedInUserPanel.tsx`**

When the current user's `manualStatus === 'offline'`, show a distinct hollow/outlined gray circle instead of the solid gray offline dot. This lets the user know they're invisible (not truly offline).

```
- Invisible: hollow gray circle (ring only, no fill)
- Offline: solid gray circle (current behavior)
```

### 4. Update StatusSelector invisible icon for clarity

**File: `src/components/StatusSelector.tsx`**

The Invisible option already uses an Eye icon, which is fine. No change needed here.

### 5. Update MembersSidebar StatusIndicator for invisible (self only)

**File: `src/components/layout/MembersSidebar.tsx`**

When the current user views their own entry in the member list while invisible, show the hollow circle. Other users will see them as offline (gray dot) thanks to the DB fix. Add a check: if `member.user_id === currentUserId && manualStatus === 'offline'`, render the hollow invisible indicator.

### 6. Ensure MessageInput activity doesn't leak presence while invisible

**File: `src/components/chat/MessageInput.tsx`** (check if similar pattern exists)

The `DMMessageInput.tsx` already checks `manualStatus !== 'offline'` before updating `last_seen` on send. Verify the same guard exists in `MessageInput.tsx`.

## Technical Details

- **No new database columns or enums needed** -- we keep using `'offline'` in the DB for invisible; the distinction is client-side only via `manualStatus`
- **No changes to realtime subscriptions** -- other clients already read `status` from the DB and run `getEffectivePresence`, which will now correctly show offline because `last_seen` won't be freshly updated
- **The `usePresence` hook already stops heartbeating `last_seen` when invisible** -- this is correct and stays unchanged
- **Files to modify**: 1 new migration, `LoggedInUserPanel.tsx`, `MembersSidebar.tsx`, and verify `MessageInput.tsx`

