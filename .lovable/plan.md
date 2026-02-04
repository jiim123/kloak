
# Fix: DM Sidebar Sync Issues

## Problem Summary
When users create group chats or start DMs, the conversations don't appear in the sidebar for invited participants because the realtime subscription for `dm_participants` table events isn't working.

## Root Cause
The `dm_participants` table is missing from the Supabase Realtime publication, so INSERT/DELETE events are never broadcast to clients.

## Solution

### Database Migration
Add `dm_participants` and `dm_conversations` tables to the realtime publication with proper replica identity:

```text
+---------------------------+     +---------------------------+
|  dm_participants          |     |  dm_conversations         |
+---------------------------+     +---------------------------+
| REPLICA IDENTITY: FULL    |     | REPLICA IDENTITY: FULL    |
| Publication: supabase_    |     | Publication: supabase_    |
|             realtime      |     |             realtime      |
+---------------------------+     +---------------------------+
         |                                   |
         v                                   v
   Realtime events fire              Realtime events fire
   for INSERT/DELETE                 for UPDATE (name changes)
```

### SQL Changes Required
1. Set `REPLICA IDENTITY FULL` on both tables (required for filtered subscriptions)
2. Add both tables to the `supabase_realtime` publication

### Expected Behavior After Fix
- When User A creates a group with User B and C:
  - User A sees conversation immediately (local state update)
  - Users B and C receive realtime `dm_participants` INSERT event
  - Their `useRealtimeDMs` hook triggers `fetchConversations()`
  - Conversation appears in their sidebar

### Technical Details

**Migration SQL:**
```sql
-- Enable full replica identity for filtered subscriptions
ALTER TABLE dm_participants REPLICA IDENTITY FULL;
ALTER TABLE dm_conversations REPLICA IDENTITY FULL;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE dm_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE dm_conversations;
```

**No code changes required** - the `useRealtimeDMs` hook already has the correct subscription logic, it just wasn't receiving events.

### Files Affected
- New database migration only
- No frontend code changes needed

### Testing Verification
After the fix:
1. User A creates a group chat with User B
2. User B should see the conversation appear in their DM sidebar within 1-2 seconds
3. Same for 1-to-1 DMs initiated from profile popups
