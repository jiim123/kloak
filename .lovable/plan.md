
# Comprehensive Real-Time & Egress Audit Report

## Executive Summary

The audit reveals **critical issues** with real-time subscription architecture that are likely the primary drivers of high egress costs. The most impactful finding is an **unfiltered global user subscription** that broadcasts every user update to every connected client. Combined with frequent polling and over-fetching patterns, these issues compound to create unnecessary bandwidth usage.

---

## AREA ONE: Real-Time Subscription Issues

### Issue 1.1: CRITICAL - Global Unfiltered User Updates
**Severity: CRITICAL** | **Impact: VERY HIGH**

**Location**: `src/hooks/useRealtimeUsers.ts` (lines 86-168)

**Problem**: The `useRealtimeUsers` hook subscribes to ALL updates on the `users` table with no filter:

```typescript
const channel = supabase
  .channel('users-status-global')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'users',
      // NO FILTER - receives EVERY user update platform-wide
    },
    (payload) => { ... }
  )
```

**Why It's Critical**: 
- Every `last_seen` heartbeat (every 30 seconds per user) broadcasts to ALL connected clients
- Every status change broadcasts to ALL clients
- If you have 1,000 users online, that's ~33 user updates per second globally
- Each client receives ALL 33 updates per second, even for users they don't care about
- This creates O(n²) scaling: users × updates × payload size

**Estimated Egress Impact**: With typical User row size (~500-800 bytes) and 1,000 online users:
- 33 updates/second × 700 bytes × 1,000 clients = **23 MB/second** just for presence updates

### Issue 1.2: HIGH - Presence Polling Fallback
**Severity: HIGH** | **Impact: MODERATE**

**Location**: `src/hooks/useRealtimeUsers.ts` (lines 170-216)

**Problem**: A polling fallback runs every 15 seconds that fetches presence data for all friends and DM participants:

```typescript
const pollInterval = setInterval(pollPresence, 15000);

const pollPresence = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('id, status, last_seen')
    .in('id', Array.from(userIds));
  // ...
};
```

**Why It's Problematic**:
- Runs regardless of whether realtime is working
- With 50 friends, queries 50 user rows every 15 seconds
- Duplicates data already received via realtime (when it works)

### Issue 1.3: MEDIUM - Reactions Subscription Architecture
**Severity: MEDIUM** | **Impact: MODERATE**

**Location**: `src/hooks/useRealtimeReactions.ts`

**Current Implementation**: Correctly filtered by channel_id, but subscribes to ALL events ('*') instead of just INSERT/DELETE on reactions table.

**Issue**: Full row payloads are broadcast. The reactions table may contain data beyond what's needed (though it's relatively small).

### Issue 1.4: LOW - Duplicate Channel Subscriptions Risk
**Severity: LOW** | **Impact: LOW**

**Locations**: Multiple hooks create subscriptions that could overlap:
- `useRealtimeMessages` creates `messages:{channelId}`
- `useRealtimeReactions` creates `reactions:{channelId}` 
- `useRealtimePinnedMessages` creates `pinned:{channelId}`

**Good Finding**: Each has proper cleanup in useEffect returns.

---

## AREA TWO: Database Query Inefficiencies

### Issue 2.1: HIGH - Over-Fetching with SELECT *
**Severity: HIGH** | **Impact: MODERATE**

**Locations** (12 files with 140+ instances):
- `src/hooks/useUnread.ts` - channel_reads
- `src/hooks/useRealtimeDMs.ts` - dm_reactions
- `src/stores/dmStore.ts` - dm_reactions
- `src/stores/notificationStore.ts` - notifications
- `src/stores/pollStore.ts` - polls
- `src/components/forum/ForumChannelArea.tsx` - threads, users, thread_reactions
- `src/components/media/MediaComments.tsx` - users, media_comment_reactions
- `src/components/announcement/*.tsx` - users, reactions

**Example**:
```typescript
const { data: channelReads } = await supabase
  .from('channel_reads')
  .select('*')  // Fetches ALL columns
  .eq('user_id', user.id)
  .in('channel_id', serverChannelIds);
```

**Why It's Problematic**: Fetching all columns when only 2-3 are needed wastes bandwidth on every request.

### Issue 2.2: MEDIUM - Unread Count Per-Channel Queries
**Severity: MEDIUM** | **Impact: MODERATE**

**Location**: `src/hooks/useUnread.ts` (lines 86-133)

**Problem**: For each channel, a separate query is made to count unread messages:

```typescript
const tasks = serverChannelIds.map((channelId) => async () => {
  // One query per channel to count unread messages
  let query = supabase
    .from('messages')
    .select('id', { count: 'exact' })
    .eq('channel_id', channelId)
    // ...
});
```

**Why It's Problematic**:
- A server with 50 channels = 50 queries every time unread counts are fetched
- Polling runs every 15 seconds, plus on focus/visibility changes
- Could be consolidated into a single RPC call

### Issue 2.3: MEDIUM - N+1 Pattern in Search Results
**Severity: MEDIUM** | **Impact: LOW** (settings page, low frequency)

**Location**: `src/components/modals/SearchModal.tsx` (lines 98-102)

```typescript
(data || []).map(async (result: SearchResult) => {
  const [userRes, channelRes] = await Promise.all([
    supabase.from('users').select('username, display_name, avatar_url, banner_color').eq('id', result.user_id).single(),
    supabase.from('channels').select('name').eq('id', result.channel_id).single(),
  ]);
```

**Problem**: For each search result, two additional queries are made.

---

## AREA THREE: Polling & Refresh Patterns

### Issue 3.1: HIGH - Multiple Competing Polling Systems
**Severity: HIGH** | **Impact: MODERATE**

**Polling Intervals Found**:

| Hook | Interval | Purpose |
|------|----------|---------|
| `usePresence` | 30s | Update own last_seen |
| `useRealtimeUsers` | 15s | Fetch friend/DM presence |
| `useUnread` | 15s | Fetch unread counts |
| `useUnreadDMs` | 15s | Fetch DM unread counts |
| `useBackgroundSync` | 60s | Refresh all data |
| `useConnectionStatus` | Heartbeat | Check connection |

**Problem**: These overlap and create redundant queries:
- Presence data is both polled AND received via realtime
- Unread counts are both polled AND updated via realtime subscription
- Multiple hooks may query the same data simultaneously

### Issue 3.2: MEDIUM - Aggressive Refetch on Focus/Visibility
**Severity: MEDIUM** | **Impact: MODERATE**

**Location**: `src/hooks/useUnread.ts` (lines 361-374)

```typescript
useEffect(() => {
  const handleFocus = () => fetchUnreadCounts({ force: true });
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') fetchUnreadCounts({ force: true });
  };

  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', handleVisibility);
```

**Problem**: Both 'focus' AND 'visibilitychange' trigger refetches. A single tab switch can trigger both events, causing duplicate fetches.

---

## AREA FOUR: Real-Time Payload Size

### Issue 4.1: MEDIUM - Full User Rows in Member Lists
**Severity: MEDIUM** | **Impact: MODERATE**

**Location**: `src/stores/serverStore.ts` - fetchMembers uses RPC that returns full user data:

The `get_server_members_with_roles` RPC returns complete user objects including:
- bio (potentially large text)
- banner_url
- avatar_decoration
- profile_effect
- All status fields

When broadcast via realtime (useRealtimeMembers), the full member data is transmitted.

### Issue 4.2: LOW - Message Payloads Include Full User Data
**Severity: LOW** | **Impact: LOW** (already well-optimized)

**Good Finding**: The `useRealtimeMessages` hook fetches user data separately via `getCachedUser()` with a 60-second cache, avoiding redundant fetches. This is well-implemented.

---

## AREA FIVE: Edge Functions

### Issue 5.1: LOW - No Response Caching Headers
**Severity: LOW** | **Impact: LOW**

**Location**: `supabase/functions/fetch-link-preview/index.ts`

**Problem**: Link preview responses don't include cache headers:
```typescript
return new Response(
  JSON.stringify(preview),
  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  // No Cache-Control header
);
```

**Impact**: Same links previewed multiple times require fresh edge function calls.

---

## AREA SIX: Image Handling

### Good Finding: Lazy Loading Implemented
Images across the application use `loading="lazy"` (130 instances found). This is correctly implemented.

### Good Finding: Image Size Limits
The link preview edge function limits HTML parsing to 512KB to prevent memory issues.

---

## Prioritized Fix Recommendations

### Priority 1: CRITICAL - Fix Global User Subscription
**Estimated Impact: 70-80% egress reduction**

**Solution Options**:

**Option A (Recommended)**: Remove global subscription entirely, rely on targeted presence
- Remove the unfiltered `users-status-global` channel
- Keep the polling fallback (but optimize it)
- Users only see presence for people in their current context

**Option B**: Filter by relevant user IDs
- Build a list of user IDs the client cares about (friends, current server members, DM participants)
- Use row-level filtering (though Supabase has limits on filter complexity)

**Option C**: Use Supabase Presence instead of postgres_changes
- Presence is ephemeral and doesn't broadcast full rows
- Only track minimal data (user_id, status)

### Priority 2: HIGH - Consolidate Polling Systems
**Estimated Impact: 10-15% egress reduction**

1. Create a single unified polling manager
2. Deduplicate overlapping data fetches
3. Reduce polling frequency where realtime is reliable
4. Remove double-firing on focus + visibility change

### Priority 3: HIGH - Optimize Query Column Selection
**Estimated Impact: 5-10% egress reduction**

Replace `select('*')` with specific columns:

```typescript
// Before
.select('*')

// After
.select('id, last_read_at, last_read_message_id, mention_count')
```

### Priority 4: MEDIUM - Batch Unread Count Queries
**Estimated Impact: 5% egress reduction**

Create an RPC function to get all unread counts in one query:

```sql
CREATE FUNCTION get_channel_unread_counts(_user_id uuid, _channel_ids uuid[])
RETURNS TABLE (channel_id uuid, unread_count int, mention_count int)
```

### Priority 5: MEDIUM - Add Edge Function Cache Headers
**Estimated Impact: 1-2% egress reduction**

```typescript
return new Response(
  JSON.stringify(preview),
  { 
    headers: { 
      ...corsHeaders, 
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    } 
  }
);
```

---

## Summary of Findings

| Area | Severity | Estimated Impact |
|------|----------|------------------|
| Global user subscription | CRITICAL | 70-80% of excess egress |
| Competing polling systems | HIGH | 10-15% of excess egress |
| SELECT * over-fetching | HIGH | 5-10% of excess egress |
| Per-channel unread queries | MEDIUM | 5% of excess egress |
| Edge function caching | LOW | 1-2% of excess egress |

**Total Estimated Reducible Egress: 85-95% of current excess**

---

## Implementation Plan

### Phase 1: Critical Fix (Immediate)
1. Modify `useRealtimeUsers` to remove unfiltered global subscription
2. Implement targeted presence updates only for visible users

### Phase 2: Query Optimization (Week 1)
1. Audit all `select('*')` calls and replace with specific columns
2. Create batch RPC for unread counts

### Phase 3: Polling Consolidation (Week 2)
1. Create unified background sync manager
2. Remove redundant polling
3. Fix double-trigger on focus events

### Phase 4: Edge Function Optimization (Week 2)
1. Add cache headers to link preview responses
2. Consider caching frequently-previewed URLs
