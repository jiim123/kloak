

## Fix Forum Post Replies Showing "Unknown" Users on Thread Switch

### Problem

When switching between forum posts, reply authors display as "Unknown" because:

1. **Stale cache skip** (`ForumChannelArea.tsx` line 1492): `if (!threadMessages[threadId])` — when a thread was previously loaded, switching back to it skips the fetch entirely. If the `userCacheStore` has evicted those users (1000 entry cap or 5-min TTL), `getUserFromCache()` returns `undefined` and `getDisplayName()` falls back to "Unknown".

2. **No auto-fetch for missing users**: The `getDisplayName` callback (line 386) uses `getUserFromCache()` which is a synchronous, non-reactive lookup. Unlike `useMessageUser()` (which auto-triggers batch fetches for missing users), `getUserFromCache` silently returns `undefined` without scheduling any fetch.

3. **Thread messages don't carry user objects**: After the normalized data migration, messages stored in `threadMessages` state only carry `user_id` — no embedded user data. So `_messageUser` parameter in `getDisplayName` is always `null` for cached thread messages.

### Solution

Two changes in `src/components/forum/ForumChannelArea.tsx`:

**Fix 1: Always re-fetch thread messages on thread selection**

In the `handleThreadSelect` callback (~line 1492), remove the `if (!threadMessages[threadId])` guard so thread messages are always fetched when selecting a thread. This ensures `bulkSetUsersInCache` runs with fresh user data from the `get_thread_messages` RPC every time. Keep existing messages visible while the fetch runs (don't clear them first) to avoid flicker.

```typescript
// Before
if (!threadMessages[threadId]) {
  try {
    await fetchThreadMessagesById(threadId);
  } catch (error) {
    handleError(error, "Failed to fetch thread messages");
  }
}

// After — always fetch to ensure user cache is populated
try {
  await fetchThreadMessagesById(threadId);
} catch (error) {
  handleError(error, "Failed to fetch thread messages");
}
```

**Fix 2: Add a safety net — batch-fetch missing users for displayed thread replies**

Add a `useEffect` that runs when `selectedThreadId` or `threadMessages` changes. It collects all `user_id` values from the current thread's messages, checks if they exist in the user cache, and batch-fetches any missing ones via `getOrFetchUser` (which uses the batched RPC). This handles edge cases where the RPC response doesn't include user data or the cache is evicted between the fetch and render.

```typescript
useEffect(() => {
  if (!selectedThreadId) return;
  const messages = threadMessages[selectedThreadId];
  if (!messages?.length) return;

  const missingIds = new Set<string>();
  for (const msg of messages) {
    if (msg.user_id && !getUserFromCache(msg.user_id)) {
      missingIds.add(msg.user_id);
    }
  }
  missingIds.forEach((id) => void getOrFetchUser(id));
}, [selectedThreadId, threadMessages]);
```

`getOrFetchUser` deduplicates in-flight requests and populates the user cache, which `getDisplayName` reads from on the next render cycle.

### Files Changed

| File | Change |
|---|---|
| `src/components/forum/ForumChannelArea.tsx` | Remove conditional skip on thread message fetch; add missing-user batch-fetch effect |

### What stays the same

- No changes to `getDisplayName` logic, store structure, RPC calls, or realtime subscriptions
- No changes to `get_thread_messages` RPC
- Thread messages remain cached in local state for instant display; the re-fetch updates them in the background

