
# Add "Mark as Read" to Server Context Menu

## Overview
Add a "Mark as Read" function to the server context menu in `ServerSidebar.tsx` that marks all channels in that server as read, clearing unread indicators and mention badges.

## Implementation

### 1. Extend the `useUnread` Hook
**File:** `src/hooks/useUnread.ts`

Add a new `markServerAsRead` function that accepts an array of channel IDs and marks them all as read in parallel:

```typescript
const markServerAsRead = useCallback(
  async (channelIds: string[]) => {
    if (!user || channelIds.length === 0) return;
    
    // Mark all channels in parallel
    await Promise.all(channelIds.map(channelId => markAsRead(channelId)));
  },
  [user, markAsRead]
);
```

Update the return object to include `markServerAsRead`.

### 2. Update `DraggableServerItem` Component
**File:** `src/components/layout/ServerSidebar.tsx`

Add a new prop `onMarkAsRead` to the component interface:

```typescript
interface DraggableServerItemProps {
  // ... existing props
  onMarkAsRead?: () => void;
}
```

Add a new context menu item with the CheckCheck icon (matching the notification bell styling):

```typescript
<ContextMenuContent>
  <ContextMenuItem
    onSelect={(e) => {
      e.preventDefault();
      onMarkAsRead?.();
    }}
  >
    <CheckCheck className="w-4 h-4 mr-2" />
    Mark as Read
  </ContextMenuItem>
  {/* existing items */}
</ContextMenuContent>
```

### 3. Wire Up in ServerSidebar
**File:** `src/components/layout/ServerSidebar.tsx`

Update the `useUnread` hook destructure to include the new function:

```typescript
const { getServerUnreadInfo, markServerAsRead } = useUnread(allChannelIds);
```

Pass the handler to each `DraggableServerItem`:

```typescript
<DraggableServerItem
  // ... existing props
  onMarkAsRead={() => {
    const channelIds = serverChannels[server.id] || [];
    if (channelIds.length > 0) {
      markServerAsRead(channelIds);
    }
  }}
/>
```

### 4. Add Import for Icon
Add `CheckCheck` to the existing Lucide imports in ServerSidebar.tsx.

## Technical Details

### How It Works

```text
User right-clicks server → Selects "Mark as Read"
         ↓
onMarkAsRead() called with server's channel IDs
         ↓
markServerAsRead() calls markAsRead() for each channel (parallel)
         ↓
Each markAsRead() call:
  1. Calls mark_channel_read RPC
  2. Updates local unreadState
  3. Broadcasts CHANNEL_READ_EVENT
         ↓
UI immediately updates:
  - Server unread pill disappears
  - Mention badge clears
  - Channel bold text in sidebar clears
```

### Performance Considerations
- Uses `Promise.all` for parallel execution
- Existing `CHANNEL_READ_EVENT` broadcast ensures cross-component sync
- Typical servers have <50 channels, so parallel calls complete quickly
- Optimistic UI update via local state + event broadcast

### Files to Modify
| File | Changes |
|------|---------|
| `src/hooks/useUnread.ts` | Add `markServerAsRead` function |
| `src/components/layout/ServerSidebar.tsx` | Add context menu item, wire up handler, add icon import |

## Testing Checklist
- [ ] Right-click server shows "Mark as Read" option
- [ ] Clicking "Mark as Read" clears unread indicator pill
- [ ] Mention badge (red number) is cleared
- [ ] Channel sidebar bold text is cleared for all channels
- [ ] Works for servers in folders and root servers
- [ ] Multiple rapid clicks don't cause issues
