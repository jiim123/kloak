

## Overview

This plan implements full group DM functionality, extending the existing 1:1 direct messaging system to support multi-user group conversations.

---

## What Will Change

### For Users
- Create group conversations with 2+ friends
- Set optional group names
- See group conversations in the DM sidebar with a distinct group icon
- Send and receive messages in groups just like regular DMs

### Technical Summary
1. Database schema updates to support groups
2. New RPC function for group creation
3. Updated RPC to return group metadata
4. Frontend store, types, and UI updates

---

## Implementation Steps

### Step 1: Database Schema Updates

Add two columns to `dm_conversations` table:

```text
dm_conversations
+---------------+----------+---------+
| Column        | Type     | Default |
+---------------+----------+---------+
| is_group      | boolean  | false   |
| name          | text     | null    |
+---------------+----------+---------+
```

This allows existing 1:1 conversations to continue working while enabling group support.

### Step 2: Create `create_group_dm` RPC Function

A new SECURITY DEFINER function that:
- Accepts creator user ID, array of participant IDs, and optional group name
- Validates that creator is friends with all participants (or skip for MVP)
- Creates a new conversation with `is_group = true`
- Adds creator + all participants to `dm_participants`
- Returns the new conversation with all participants

### Step 3: Update `get_user_dm_conversations` RPC

Modify to include:
- `is_group` field
- `name` field
- For groups: return all participants (not just "other_user")

### Step 4: Update TypeScript Types

Extend `DMConversation` interface:

```text
DMConversation
+---------------+--------------------+
| Field         | Type               |
+---------------+--------------------+
| is_group      | boolean (optional) |
| name          | string (optional)  |
| participants  | DMParticipant[]    |
+---------------+--------------------+
```

### Step 5: Update dmStore

Add new method:

```text
createGroupConversation(
  userId: string,
  participantIds: string[],
  name?: string
) => Promise<DMConversation | null>
```

### Step 6: Update CreateGroupModal

- Connect to the new `createGroupConversation` store method
- On success: navigate to the new group conversation
- Show appropriate loading/error states

### Step 7: Update DMSidebar UI

For group conversations:
- Display group icon (Users) or stacked avatars
- Show group name (or "Group with X, Y, Z" if no name)
- No individual status indicator (groups don't have presence)

---

## Technical Details

### Database Migration SQL

```sql
-- Add group support columns
ALTER TABLE dm_conversations
ADD COLUMN is_group boolean DEFAULT false,
ADD COLUMN name text;

-- Create group DM function
CREATE OR REPLACE FUNCTION create_group_dm(
  _creator_id uuid,
  _participant_ids uuid[],
  _name text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_conv_id uuid;
  result json;
BEGIN
  -- Validate at least 2 other participants
  IF array_length(_participant_ids, 1) < 2 THEN
    RAISE EXCEPTION 'Groups require at least 2 other participants';
  END IF;

  -- Create group conversation
  INSERT INTO dm_conversations (is_group, name)
  VALUES (true, _name)
  RETURNING id INTO new_conv_id;

  -- Add creator as participant
  INSERT INTO dm_participants (conversation_id, user_id)
  VALUES (new_conv_id, _creator_id);

  -- Add all other participants
  INSERT INTO dm_participants (conversation_id, user_id)
  SELECT new_conv_id, unnest(_participant_ids);

  -- Return conversation with participants
  SELECT json_build_object(
    'id', dc.id,
    'created_at', dc.created_at,
    'is_group', dc.is_group,
    'name', dc.name,
    'participants', (
      SELECT json_agg(json_build_object(
        'user_id', dp.user_id,
        'user', json_build_object(
          'id', u.id,
          'username', u.username,
          'display_name', u.display_name,
          'avatar_url', u.avatar_url
        )
      ))
      FROM dm_participants dp
      JOIN users u ON u.id = dp.user_id
      WHERE dp.conversation_id = dc.id
    )
  ) INTO result
  FROM dm_conversations dc
  WHERE dc.id = new_conv_id;

  RETURN result;
END;
$$;
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/types/index.ts` | Add `is_group` and `name` to `DMConversation` |
| `src/stores/dmStore.ts` | Add `createGroupConversation` method |
| `src/components/dm/CreateGroupModal.tsx` | Connect to store, handle success/error |
| `src/components/dm/DMSidebar.tsx` | Display groups differently (icon, name) |

---

## Data Flow

```text
User clicks "Create Group"
        |
        v
CreateGroupModal opens
        |
        v
User selects friends + optional name
        |
        v
dmStore.createGroupConversation()
        |
        v
Supabase RPC: create_group_dm
        |
        v
New conversation returned
        |
        v
Store updated, navigate to group
        |
        v
Group appears in sidebar
```

---

## Edge Cases Handled

- Groups require minimum 2 other participants (3 total including creator)
- Group name is optional (UI will show participant names if empty)
- Existing 1:1 DMs unaffected (`is_group = false` by default)
- Groups have no presence status (no green dot)

