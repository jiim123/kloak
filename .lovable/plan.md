

# Fix Profile Status Synchronization Across Platform

## Problem Summary

Profile statuses (online/offline/idle/dnd), avatars, and display names are not updating in real-time across three key areas:
1. **MembersSidebar** - Status dots remain stale after users go online/offline
2. **DMSidebar** - Conversation partner status not updating in real-time  
3. **FriendsList** - Friends' online status and avatars not syncing

## Root Cause Analysis

The `useRealtimeUsers` hook was previously optimized to remove a global unfiltered subscription to the `users` table (which caused O(n^2) egress scaling). It was replaced with a 45-second polling interval, which is too slow for a "live" presence feel.

**Current state:**
- `useRealtimeMembers` - Only listens for `server_members` and `server_roles` changes, NOT `users` table updates
- `useRealtimeDMs` - Only listens for `dm_participants` changes, NOT user profile updates
- `patchUserAcrossStores` - Correctly patches all stores, but only called during 45-second polls

## Solution Architecture

Add **targeted** realtime subscriptions that only listen to users the client cares about:

```text
+----------------------+     +------------------------+     +---------------------+
|  MembersSidebar      |     |  DMSidebar/Chat        |     |  FriendsList        |
+----------------------+     +------------------------+     +---------------------+
         |                            |                              |
         v                            v                              v
+----------------------+     +------------------------+     +---------------------+
| useRealtimeMembers   |     | useRealtimeDMs         |     | useRealtimeUsers    |
| (ENHANCED)           |     | (ENHANCED)             |     | (ENHANCED)          |
+----------------------+     +------------------------+     +---------------------+
         |                            |                              |
         |  Subscribe to users        |  Subscribe to users          | Reduce polling
         |  WHERE id IN               |  WHERE id IN                 | from 45s to 15s
         |  (current server           |  (active conversation        |
         |   member user_ids)         |   participant user_ids)      |
         |                            |                              |
         +----------------------------+------------------------------+
                                      |
                                      v
                         +------------------------+
                         | patchUserAcrossStores  |
                         | (existing function)    |
                         +------------------------+
```

## Implementation Details

### 1. Enhance useRealtimeMembers Hook

**File:** `src/hooks/useRealtimeMembers.ts`

Add a subscription to the `users` table filtered by current server member IDs:

- Extract user IDs from current members list
- Subscribe to `users` table with `filter: id=in.(user_id_1,user_id_2,...)`
- On UPDATE event, call `patchUserAcrossStores` to update status/avatar across all stores
- Re-subscribe when member list changes (new members join/leave)

**Technical consideration:** Supabase Realtime supports `in` filters, but with a limit. For servers with many members (100+), we may need to batch or use a different approach. For most servers, this works well.

### 2. Enhance useRealtimeDMs Hook  

**File:** `src/hooks/useRealtimeDMs.ts`

Add a subscription for the current conversation's participants:

- When `currentConversation` changes, subscribe to user updates for participants
- For 1-to-1 DMs: subscribe to `other_user.id`
- For group chats: subscribe to all participant user IDs
- On UPDATE event, patch the `dmStore` conversations and `currentConversation`

### 3. Reduce Polling Interval for Friends

**File:** `src/hooks/useRealtimeUsers.ts`

- Reduce `PRESENCE_POLL_INTERVAL_MS` from 45 seconds to 15 seconds
- This provides faster fallback updates for friends list while targeted subscriptions handle immediate updates elsewhere

### 4. Create Shared User Subscription Utility

**File:** `src/hooks/useRealtimeUserUpdates.ts` (new file)

Create a reusable hook for subscribing to specific user updates:

```typescript
export const useRealtimeUserUpdates = (
  userIds: string[],
  channelName: string,
  onUpdate?: (user: User) => void
) => {
  // Subscribe to users table filtered by provided IDs
  // Call patchUserAcrossStores + optional callback on updates
};
```

This utility can be used by both `useRealtimeMembers` and `useRealtimeDMs`.

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/useRealtimeUserUpdates.ts` | Create | Shared utility for targeted user subscriptions |
| `src/hooks/useRealtimeMembers.ts` | Modify | Add user update subscription for server members |
| `src/hooks/useRealtimeDMs.ts` | Modify | Add user update subscription for conversation participants |
| `src/hooks/useRealtimeUsers.ts` | Modify | Reduce polling interval from 45s to 15s |
| `src/hooks/index.ts` | Modify | Export new hook |

## Edge Cases Handled

1. **Large servers (100+ members):** The filter will include up to ~100 user IDs. For larger servers, we fall back to polling.
2. **Channel cleanup:** Subscriptions are properly cleaned up when switching servers/conversations.
3. **Blocked users:** Continue to filter blocked users from the patched data.
4. **Tab visibility:** Subscriptions remain active but polling pauses when tab is hidden.

## Performance Impact

- **Egress:** Minimal increase. We only subscribe to users the client needs (10-50 users typically vs. platform-wide before)
- **CPU:** Slight increase from additional subscription processing
- **Memory:** Minimal (one additional channel per active view)

## Testing Checklist

After implementation:
1. Open MembersSidebar, have another user change their status - should update within 1-2 seconds
2. Open a DM conversation, have the other user go offline - status should update immediately
3. Open Friends list, have a friend change their avatar - should reflect within 15 seconds (polling) or immediately if actively viewing their DM
4. Switch between servers - member statuses should be fresh for each server
5. Check browser DevTools Network tab - verify no global unfiltered subscriptions

