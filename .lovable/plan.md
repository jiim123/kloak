

## Fix @mention notification click-to-message + add server name

### Change 1: Remove fixed timeout in NotificationBell click handler
**File:** `src/components/notifications/NotificationBell.tsx` (lines 184-198)

Remove the inner `setTimeout` that dispatches the `scrollToMessage` custom event after 500ms. The `?message=` URL param already triggers `useScrollToMessage` via `useSearchParams` — the custom event is redundant and introduces a timing race.

Replace:
```typescript
if (notificationType === "mention" && serverId && channelId) {
  const path = `/app/servers/${serverId}/channels/${channelId}`;
  const params = messageId ? `?message=${messageId}` : '';
  setIsOpen(false);
  setTimeout(() => {
    navigate(path + params);
    if (messageId) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("scrollToMessage", { detail: { messageId } }));
      }, 500);
    }
  }, 100);
  return;
}
```

With:
```typescript
if (notificationType === "mention" && serverId && channelId) {
  setIsOpen(false);
  const path = `/app/servers/${serverId}/channels/${channelId}`;
  const params = messageId ? `?message=${messageId}` : '';
  setTimeout(() => navigate(path + params), 50);
  return;
}
```

### Change 2: Guard empty messages in useScrollToMessage
**File:** `src/hooks/useScrollToMessage.ts` (lines 92-109)

The fetch-older-messages effect (line 100-101) bails when `messages[0]` is undefined (empty array), silently failing. Add an early return at line 93 so the effect simply waits for messages to populate:

```typescript
// Existing guards...
if (!targetMessageId || isLoading || hasScrolledRef.current || isFetchingRef.current) return;
if (!currentChannelId) return;
if (messages.length === 0) return; // NEW: wait for initial load
```

This lets the effect re-trigger naturally when `messages` populates (it's in the dependency array).

### Change 3: Replace rAF retry loop with setTimeout + increasing delay
**File:** `src/hooks/useScrollToMessage.ts` (lines 127-143)

The current `centerWithRetry` uses double-`requestAnimationFrame` which fires too fast (~32ms) and gives up quickly. Replace with `setTimeout` using increasing delays (100ms, 200ms, ... up to 500ms cap), giving the virtual list more time to render:

```typescript
const centerWithRetry = useCallback((targetId: string, attempt = 0) => {
  const maxAttempts = 15;
  const found = centerMessageInView(targetId, attempt > 0);
  if (found) {
    applyHighlight(targetId);
    return;
  }
  if (attempt < maxAttempts) {
    const delay = Math.min(100 * (attempt + 1), 500);
    rafRef.current = window.setTimeout(() => {
      centerWithRetry(targetId, attempt + 1);
    }, delay) as unknown as number;
  }
}, [applyHighlight]);
```

Also update cleanup to use `clearTimeout` instead of `cancelAnimationFrame` for `rafRef`.

### Change 4: Add server name to mention notification rendering
**File:** `src/components/notifications/NotificationBell.tsx` (lines 388-427)

Add a helper function that extracts the server name from the notification's `link` field using `useServerStore`:

```typescript
const getServerNameFromLink = (link: string | null): string | null => {
  if (!link) return null;
  try {
    const url = new URL(link, window.location.origin);
    const serverId = url.searchParams.get('server');
    if (!serverId) return null;
    return useServerStore.getState().servers.find(s => s.id === serverId)?.name || null;
  } catch { return null; }
};
```

Then in the notification content area (line 389-391), for mention type notifications, prepend the server name before the title:

```tsx
<p className={cn("text-sm line-clamp-2 break-words", isUnread && "font-medium")}>
  {notification.type === 'mention' && (() => {
    const serverName = getServerNameFromLink(notification.link);
    return serverName ? (
      <span className="text-xs text-muted-foreground font-normal mr-1.5">{serverName} ·</span>
    ) : null;
  })()}
  {notification.title}
</p>
```

### Files changed
- `src/components/notifications/NotificationBell.tsx` — simplify click handler, add server name display
- `src/hooks/useScrollToMessage.ts` — empty-messages guard, robust retry timing

### What is NOT changed
- Notification table schema, triggers, or RPC functions
- DM/friend request notification behavior
- Bell icon, badge count, realtime delivery
- `fetchMessages` in messageStore
- The `?message=` URL param mechanism (kept as primary)

