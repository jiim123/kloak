
# PostgREST Query Optimization Audit Report

## Executive Summary

After analyzing the entire codebase, I identified **81 instances of `supabase.from()` queries** and **460+ RPC calls** across 22 files. The primary causes of excessive PostgREST usage are:

1. **N+1 query patterns** in unread tracking and search
2. **Aggressive polling intervals** (15-30 seconds across multiple hooks)
3. **Duplicate polling mechanisms** (heartbeat + latency + presence + unread all polling)
4. **Refetch storms** triggered by visibility changes and realtime events

---

## Area 1: Critical Issues (High Impact)

### Issue 1: N+1 Query Pattern in Unread Tracking
**Location:** `src/hooks/useUnread.ts` (lines 86-135)
**Impact:** CRITICAL - Generates N queries per polling cycle

**Problem:**
```typescript
// For EACH channel, a separate query runs:
const tasks = serverChannelIds.map((channelId) => async () => {
  let query = supabase
    .from('messages')
    .select('id', { count: 'exact' })
    .eq('channel_id', channelId)
    // ... filters
});
```

A user in 5 servers with 10 channels each = 50 queries every 15 seconds = **200 queries/minute just for unread counts**.

**Fix:** Create a single RPC function `get_all_channel_unread_counts` that returns all unread counts in one query.

---

### Issue 2: Multiple Overlapping Polling Mechanisms
**Locations:**
- `useConnectionStatus.ts`: Heartbeat every 30s + Latency check every 60s
- `useUnread.ts`: Poll every 15s
- `useUnreadDMs.ts`: Poll every 30s  
- `useRealtimeUsers.ts`: Presence poll every 30s
- `usePresence.ts`: Last seen update every 30s

**Impact:** 4-6 queries per minute baseline, multiplied by concurrent hooks

**Problem:** Each hook independently polls the database. A user with the app open generates:
- 2 queries/minute (heartbeat)
- 1 query/minute (latency)
- 4 queries/minute (unread - but this is N queries)
- 2 queries/minute (DM unread)
- 2 queries/minute (presence)
- 2 queries/minute (last seen)

**Fix:** 
1. Consolidate heartbeat and latency into a single check
2. Increase unread polling to 30-60 seconds
3. Make presence polling only active when friends list is visible

---

### Issue 3: Search Results N+1 Pattern
**Location:** `src/components/modals/SearchModal.tsx` (lines 97-110)
**Impact:** HIGH - 50 queries per search (25 results x 2 queries each)

**Problem:**
```typescript
const enrichedResults = await Promise.all(
  (data || []).map(async (result) => {
    const [userRes, channelRes] = await Promise.all([
      supabase.from('users').select('...').eq('id', result.user_id).single(),
      supabase.from('channels').select('name').eq('id', result.channel_id).single(),
    ]);
    // ...
  })
);
```

**Fix:** Batch fetch all users and channels with `IN` clause:
```typescript
const userIds = [...new Set(data.map(r => r.user_id))];
const channelIds = [...new Set(data.map(r => r.channel_id))];
const [users, channels] = await Promise.all([
  supabase.from('users').select('id, username, ...').in('id', userIds),
  supabase.from('channels').select('id, name').in('id', channelIds),
]);
```

---

## Area 2: Medium Impact Issues

### Issue 4: Over-fetching with select('*')
**Locations:**
- `usePreferencesSync.ts` line 45: `select('*')` on user_preferences
- `serverStore.ts` line 1182: `select('*')` on server_roles
- `serverStore.ts` line 1376: `select('*')` on role_permissions
- `serverStore.ts` line 1406: `select('*')` on channel_permissions
- `UserProfilePopup.tsx` line 205: `select("*")` on users

**Fix:** Specify only required columns in each query.

---

### Issue 5: Visibility Change Refetch Storms
**Locations:**
- `useUnread.ts` lines 363-382
- `useUnreadDMs.ts` lines 162-167
- `useRealtimeUsers.ts` lines 155-161

**Problem:** Every tab switch triggers refetches from multiple hooks simultaneously.

**Fix:** Add a global "last refetch" timestamp and cooldown to prevent multiple hooks from refetching simultaneously.

---

### Issue 6: Realtime Event Handlers Triggering Full Refetches
**Location:** `useUnread.ts` lines 307-332

**Problem:**
```typescript
.on('postgres_changes', { event: '*', ... }, () => {
  channelIdsRef.current = []; // Reset to force refetch
  fetchUnreadCounts({ force: true });
})
```

Instead of using the realtime payload, it refetches all data.

**Fix:** Process the realtime payload directly when possible.

---

## Area 3: Well-Optimized Patterns (No Changes Needed)

These patterns are already efficient:

1. **Message caching** (`messageStore.ts`): 5-minute TTL cache prevents redundant fetches
2. **DM message caching** (`dmStore.ts`): Messages cached per conversation
3. **User cache in realtime** (`useRealtimeMessages.ts`): 60-second TTL prevents repeated user fetches
4. **Batch RPC for friends** (`friendStore.ts`): Single call fetches all friend data
5. **Batch RPC for servers** (`serverStore.ts`): `get_user_servers` returns all server data

---

## Implementation Plan

### Phase 1: Critical Fixes (Highest Impact)

#### Task 1.1: Create Batch Unread RPC Function
Create a new RPC function that returns unread counts for all channels in one query:

```sql
CREATE OR REPLACE FUNCTION get_all_channel_unread_counts(
  _user_id UUID,
  _channel_ids UUID[]
)
RETURNS TABLE(
  channel_id UUID,
  unread_count BIGINT,
  mention_count INTEGER,
  last_read_at TIMESTAMPTZ,
  last_read_message_id UUID,
  first_unread_message_id UUID
)
```

**Impact:** Reduces 50+ queries to 1 query per polling cycle.

#### Task 1.2: Update useUnread Hook
Refactor to use the new batch RPC instead of N individual queries.

#### Task 1.3: Batch Search Result Enrichment
Refactor `SearchModal.tsx` to batch user and channel fetches.

---

### Phase 2: Polling Optimization

#### Task 2.1: Consolidate Connection Monitoring
Merge heartbeat and latency checks into a single query every 60 seconds.

#### Task 2.2: Increase Polling Intervals
- `useUnread`: 15s -> 45s (or 60s)
- `useRealtimeUsers`: Keep 30s but only when friends panel is visible

#### Task 2.3: Add Global Refetch Coordination
Create a shared "last sync" timestamp to prevent multiple hooks from refetching simultaneously on visibility change.

---

### Phase 3: Query Efficiency

#### Task 3.1: Replace select('*') with Specific Columns
Update all queries to specify only needed columns:

| File | Table | Current | Should Be |
|------|-------|---------|-----------|
| usePreferencesSync.ts | user_preferences | * | theme, notifications_enabled, ... |
| serverStore.ts | server_roles | * | id, name, color, position, ... |
| serverStore.ts | role_permissions | * | id, role_id, permission, allowed |
| serverStore.ts | channel_permissions | * | id, channel_id, permission, allowed |
| UserProfilePopup.tsx | users | * | id, username, display_name, avatar_url, ... |

---

## Technical Details

### Database Migration: Batch Unread RPC

```sql
CREATE OR REPLACE FUNCTION public.get_all_channel_unread_counts(
  _user_id UUID,
  _channel_ids UUID[],
  _blocked_user_ids UUID[] DEFAULT '{}'::UUID[]
)
RETURNS TABLE(
  channel_id UUID,
  unread_count BIGINT,
  mention_count INTEGER,
  last_read_at TIMESTAMPTZ,
  last_read_message_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH channel_reads_data AS (
    SELECT 
      cr.channel_id,
      cr.last_read_at,
      cr.last_read_message_id,
      COALESCE(cr.mention_count, 0) AS mention_count
    FROM channel_reads cr
    WHERE cr.user_id = _user_id
      AND cr.channel_id = ANY(_channel_ids)
  ),
  unread_counts AS (
    SELECT 
      m.channel_id,
      COUNT(*) AS unread_count
    FROM messages m
    LEFT JOIN channel_reads_data crd ON crd.channel_id = m.channel_id
    WHERE m.channel_id = ANY(_channel_ids)
      AND m.user_id != _user_id
      AND (crd.last_read_at IS NULL OR m.created_at > crd.last_read_at)
      AND (array_length(_blocked_user_ids, 1) IS NULL 
           OR m.user_id != ALL(_blocked_user_ids))
    GROUP BY m.channel_id
  )
  SELECT 
    c.id AS channel_id,
    COALESCE(uc.unread_count, 0)::BIGINT AS unread_count,
    COALESCE(crd.mention_count, 0)::INTEGER AS mention_count,
    crd.last_read_at,
    crd.last_read_message_id
  FROM unnest(_channel_ids) AS c(id)
  LEFT JOIN channel_reads_data crd ON crd.channel_id = c.id
  LEFT JOIN unread_counts uc ON uc.channel_id = c.id;
END;
$$;
```

### Code Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/hooks/useUnread.ts` | Major refactor | Replace N queries with single RPC |
| `src/hooks/useConnectionStatus.ts` | Minor | Merge heartbeat/latency, increase interval |
| `src/components/modals/SearchModal.tsx` | Moderate | Batch user/channel fetches |
| `src/hooks/useRealtimeUsers.ts` | Minor | Add visibility check |
| `src/stores/serverStore.ts` | Minor | Specify columns in 3 queries |
| `src/hooks/usePreferencesSync.ts` | Minor | Specify columns |
| `src/components/modals/UserProfilePopup.tsx` | Minor | Specify columns |

---

## Expected Impact

| Optimization | Current Queries | After | Reduction |
|--------------|-----------------|-------|-----------|
| Unread tracking (50 channels) | 50/poll | 1/poll | 98% |
| Search (25 results) | 50/search | 2/search | 96% |
| Connection monitoring | 3/minute | 1/minute | 67% |
| Polling frequency reduction | 4 polls/min | 2 polls/min | 50% |

**Estimated total reduction: 70-85% fewer PostgREST requests**

---

## Files to Modify

1. **New migration:** Create `get_all_channel_unread_counts` RPC
2. `src/hooks/useUnread.ts` - Major refactor
3. `src/hooks/useConnectionStatus.ts` - Consolidate and increase interval
4. `src/components/modals/SearchModal.tsx` - Batch queries
5. `src/hooks/useRealtimeUsers.ts` - Add visibility gate
6. `src/stores/serverStore.ts` - Specify columns (3 locations)
7. `src/hooks/usePreferencesSync.ts` - Specify columns
8. `src/components/modals/UserProfilePopup.tsx` - Specify columns
