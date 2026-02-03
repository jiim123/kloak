
# Query Performance Analysis & Optimization Plan

## Analysis of pg_stat_statements Results

The query statistics reveal several critical performance bottlenecks that explain the high database load:

### Top Query Concerns

| Rank | Query | Calls | Mean Time | Issue |
|------|-------|-------|-----------|-------|
| 1 | `realtime.list_changes` | 12.5M | 5.9ms | Supabase internal - indicates high realtime volume |
| 2 | `realtime subscription insert` | 2.3M | 1.6ms | Massive subscription churn |
| 5 | `update_user_last_seen` | 50K | 3.5ms | Presence heartbeat every 30s |
| 6 | `update_user_status` | 24K | 3.4ms | Status changes |
| 14 | `dm_participants SELECT` | 487K | 0.09ms | **Extremely high call count** |
| 19 | `messages count (unread)` | 147K | 0.25ms | Per-channel unread counting |

---

## Critical Issues Identified

### Issue 1: DM Unread Hook Over-Fetching (HIGH PRIORITY)
**Location**: `src/hooks/useUnreadDMs.ts`

**Problems Found**:
1. **N+1 Query Pattern**: For each conversation, a separate count query runs (lines 44-67)
2. **Duplicate Event Listeners**: Both `focus` AND `visibilitychange` trigger refetch (lines 152-158) - same issue we fixed in `useUnread.ts` but not here
3. **30-second Polling**: Runs every 30 seconds regardless of realtime
4. **Self-Triggering Loop**: Subscribes to dm_participants changes, but marking as read also triggers a change, causing a refetch cycle

**Evidence**: 487K calls to dm_participants + 147K message count queries

### Issue 2: Presence Heartbeat Frequency
**Location**: `src/hooks/usePresence.ts`

**Current Behavior**: Updates `last_seen` every 30 seconds (50K calls recorded)

**Assessment**: This is expected behavior, but the frequency could be reduced if needed. The 30-second interval is reasonable for presence accuracy.

### Issue 3: High Realtime Subscription Volume
**Evidence**: 12.5M realtime list_changes + 2.3M subscription inserts

**Root Cause**: Multiple overlapping subscriptions per user:
- `all-dms:{userId}` for DM messages
- `dm-reactions:{userId}` for DM reactions  
- `dm-participants:{userId}` for new conversations
- `dm-unreads:{userId}` for unread tracking
- Plus all channel/server subscriptions

---

## Optimization Plan

### Phase 1: Fix useUnreadDMs Hook (HIGH IMPACT)

**Changes**:

1. **Remove duplicate focus listener** (same fix applied to useUnread.ts):
```typescript
// REMOVE this duplicate handler
window.addEventListener('focus', handleFocus);

// KEEP only visibilitychange with cooldown
```

2. **Batch the count queries with a single RPC call**:
```sql
-- New RPC function
CREATE OR REPLACE FUNCTION get_dm_unread_counts(_user_id uuid)
RETURNS TABLE (
  conversation_id uuid,
  unread_count bigint,
  last_read_at timestamptz
)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT 
    dp.conversation_id,
    COUNT(dm.id) FILTER (
      WHERE dm.sender_id != _user_id 
      AND (dp.last_read_at IS NULL OR dm.created_at > dp.last_read_at)
    ) as unread_count,
    dp.last_read_at
  FROM dm_participants dp
  LEFT JOIN direct_messages dm ON dm.conversation_id = dp.conversation_id
  WHERE dp.user_id = _user_id
  GROUP BY dp.conversation_id, dp.last_read_at;
$$;
```

3. **Add refetch cooldown** (same pattern as useUnread.ts):
```typescript
const REFETCH_COOLDOWN_MS = 5000;
const lastFetchRef = useRef(0);

const fetchUnreadCounts = useCallback(async ({ force = false } = {}) => {
  const now = Date.now();
  if (!force && now - lastFetchRef.current < REFETCH_COOLDOWN_MS) return;
  lastFetchRef.current = now;
  // ... rest of function
}, [userId]);
```

4. **Prevent self-triggered refetch loop**:
```typescript
// In the realtime subscription, ignore last_read_at updates
// since we update local state optimistically
.on('postgres_changes', {
  event: 'INSERT', // Only new participants, not updates
  schema: 'public',
  table: 'dm_participants',
  filter: `user_id=eq.${userId}`,
}, () => {
  fetchUnreadCounts({ force: true });
})
```

### Phase 2: Create Composite Database Indexes

**Migration**:
```sql
-- Message pagination (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_channel_created 
ON public.messages(channel_id, created_at DESC);

-- DM pagination (high frequency)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_direct_messages_conv_created 
ON public.direct_messages(conversation_id, created_at DESC);
```

### Phase 3: Consolidate DM Realtime Subscriptions

**Current**: 4 separate subscriptions for DM functionality
**Proposed**: Consolidate into fewer channels where possible

---

## Expected Impact

| Optimization | Estimated Reduction |
|-------------|-------------------|
| Batch DM unread queries | 90% fewer dm_participants queries |
| Remove duplicate focus handler | 50% fewer redundant refetches |
| Add refetch cooldown | Prevent burst queries on tab switch |
| Composite indexes | 30-50% faster message pagination |

**Total Estimated Query Reduction**: 60-70% fewer database calls

---

## Implementation Summary

### Files to Modify:

1. **`src/hooks/useUnreadDMs.ts`**
   - Remove duplicate `focus` event listener
   - Add refetch cooldown mechanism
   - Change realtime subscription from `*` to `INSERT` only
   - Replace N+1 loop with single RPC call

2. **New Database Migration**
   - Create `get_dm_unread_counts` RPC function
   - Create composite indexes for pagination

### Files Already Fixed (from previous work):
- `src/hooks/useUnread.ts` - Fixed duplicate handlers
- `src/hooks/useRealtimeUsers.ts` - Removed global subscription
- `supabase/functions/fetch-link-preview/index.ts` - Added cache headers

---

## Technical Details

### New RPC Function Specification

```sql
CREATE OR REPLACE FUNCTION get_dm_unread_counts(_user_id uuid)
RETURNS TABLE (
  conversation_id uuid,
  unread_count bigint,
  last_read_at timestamptz
)
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    dp.conversation_id,
    COALESCE(COUNT(dm.id) FILTER (
      WHERE dm.sender_id != _user_id 
      AND (dp.last_read_at IS NULL OR dm.created_at > dp.last_read_at)
    ), 0) as unread_count,
    dp.last_read_at
  FROM dm_participants dp
  LEFT JOIN direct_messages dm ON dm.conversation_id = dp.conversation_id
  WHERE dp.user_id = _user_id
  GROUP BY dp.conversation_id, dp.last_read_at;
$$;

GRANT EXECUTE ON FUNCTION get_dm_unread_counts TO anon, authenticated;
```

### Updated useUnreadDMs Hook Pattern

```typescript
const fetchUnreadCounts = useCallback(async ({ force = false } = {}) => {
  if (!userId) return;
  
  const now = Date.now();
  if (!force && now - lastFetchRef.current < REFETCH_COOLDOWN_MS) return;
  lastFetchRef.current = now;

  const { data, error } = await supabase.rpc('get_dm_unread_counts', {
    _user_id: userId,
  });

  if (error) {
    console.error('Failed to fetch DM unread counts:', error);
    return;
  }

  const newState: UnreadDMState = {};
  (data || []).forEach((row) => {
    newState[row.conversation_id] = {
      conversationId: row.conversation_id,
      unreadCount: Number(row.unread_count),
      lastReadAt: row.last_read_at,
    };
  });
  
  setUnreadState(newState);
}, [userId]);
```

This replaces the N+1 loop with a single database call, dramatically reducing query volume.
