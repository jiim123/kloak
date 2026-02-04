

## Overview

This plan fixes the bug where group chats revert to 1:1 DM appearance in the sidebar. The root cause is that the `get_user_dm_conversations` RPC function was not updated to include the new `is_group` and `name` columns.

---

## Root Cause Analysis

### The Bug Flow

```text
1. User creates group via create_group_dm
   -> Returns {is_group: true, name: "My Group", participants: [...]}
   -> Sidebar displays correctly with stacked avatars

2. fetchConversations() is triggered by:
   - App initial load
   - Visibility change (tab switch back)
   - New participant added (realtime listener)

3. get_user_dm_conversations RPC returns:
   -> {id, created_at, participants, last_message}
   -> MISSING: is_group, name

4. Store maps: conv.is_group || false -> false
   -> Conversation treated as 1:1 DM
   -> Shows first other_user's avatar instead of stacked avatars
```

### Evidence

The `get_user_dm_conversations` function (in migration `20260123100000_add_dm_blocking.sql`) builds this JSON:

```sql
json_build_object(
  'id', dc.id,
  'created_at', dc.created_at,
  'participants', (...),
  'last_message', (...)
)
-- MISSING: 'is_group', dc.is_group
-- MISSING: 'name', dc.name
```

While `create_group_dm` (in migration `20260204132258`) correctly includes:

```sql
json_build_object(
  'id', dc.id,
  'created_at', dc.created_at,
  'is_group', dc.is_group,    -- Included
  'name', dc.name,            -- Included
  'participants', (...)
)
```

---

## The Fix

### Database Migration

Update the `get_user_dm_conversations` RPC to include the missing columns:

```sql
CREATE OR REPLACE FUNCTION public.get_user_dm_conversations(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT json_agg(conv)
    FROM (
      SELECT json_build_object(
        'id', dc.id,
        'created_at', dc.created_at,
        'is_group', dc.is_group,    -- ADD THIS
        'name', dc.name,            -- ADD THIS
        'participants', (...),
        'last_message', (...)
      ) as conv
      FROM dm_conversations dc
      WHERE ...
    ) sub
  );
END;
$$;
```

---

## Implementation Steps

### Step 1: Create Database Migration

Add a new migration that replaces the `get_user_dm_conversations` function with the updated version that includes `is_group` and `name` in the JSON output.

### Step 2: Verify Frontend Mapping

The frontend code in `dmStore.ts` already handles these fields correctly:

```typescript
return {
  id: conv.id,
  is_group: conv.is_group || false,  // Will now receive actual value
  name: conv.name || null,           // Will now receive actual value
  participants: conv.participants,
  // ...
};
```

No frontend changes needed - just the RPC fix.

---

## Technical Details

### Files to Change

| File | Change |
|------|--------|
| New migration file | Update `get_user_dm_conversations` RPC |

### Complete Updated RPC Function

The function will add two lines to the `json_build_object` call:

```sql
'is_group', COALESCE(dc.is_group, false),
'name', dc.name,
```

Using `COALESCE` ensures backward compatibility with existing 1:1 conversations that have `NULL` for `is_group`.

---

## Verification

After the fix:

1. Create a new group chat -> displays correctly
2. Switch tabs and return -> still displays correctly
3. Have another user send a message -> still displays correctly
4. Refresh the page -> still displays correctly

