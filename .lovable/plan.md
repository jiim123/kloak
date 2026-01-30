
# Plan: Mobile Sort Mode for Channel Sidebar

## Overview
Replace the problematic mobile drag-and-drop behavior with a dedicated "Sort Mode" that completely separates sorting from normal channel navigation. This will fix scrolling issues and provide a more intuitive experience for admins.

## Current Issues
1. **Scrolling conflicts**: The TouchSensor with 1000ms delay still interferes with scrolling because drag listeners are attached to channel buttons
2. **Accidental drags**: Users trigger reordering when trying to scroll
3. **New channels not appearing**: Need to verify the store update and realtime subscription are working correctly

## Implementation

### Phase 1: Add Sort Mode State and Header

**File: `src/components/layout/ChannelSidebar.tsx`**

1. Add new state variable for sorting mode:
```typescript
const [isSortingMode, setIsSortingMode] = useState(false);
```

2. Add `ArrowUpDown` or `GripVertical` icon import from lucide-react

3. Create a sorting mode header component that appears at the top of the channel list when in sorting mode:
   - Shows "Sorting Mode" text
   - Has a "Done" button to exit
   - Uses a subtle background color to indicate the mode change

### Phase 2: Modify Context Menu

**File: `src/components/layout/ChannelSidebar.tsx`**

Add "Sort Channels" option to the existing admin context menu (around line 1192-1206):
- Add `ArrowUpDown` icon
- Only visible for admins
- Only visible on mobile (use `isMobile` check)
- Clicking sets `isSortingMode` to `true`

### Phase 3: Remove Mobile Drag from Normal State

**File: `src/components/layout/ChannelSidebar.tsx`**

1. Update `SortableChannel` component:
   - Remove `mobileDragProps` attachment when NOT in sorting mode
   - Only attach drag listeners when `isSortingMode` is true on mobile
   - Remove the `touch-action: pan-y` style when not sorting
   - Show visible drag handle on each item when in sorting mode

2. Update `SortableCategory` component:
   - Same changes as SortableChannel
   - Visible drag handle when in sorting mode

3. Update sensor configuration:
   - When in sorting mode on mobile: use PointerSensor with minimal activation distance (immediate drag)
   - When not in sorting mode on mobile: completely disable TouchSensor

### Phase 4: Disable Normal Interactions in Sort Mode

When `isSortingMode` is true:
1. Disable tap-to-select on channels (clicking should not navigate)
2. Disable context menus on individual channels/categories
3. Show drag handles visibly on all items
4. Keep scrolling functional (ensure touch-action allows scrolling between items)

### Phase 5: Visual Feedback for Sort Mode

1. Add a subtle background tint or border to the channel list area
2. Show visible drag handles (two-dot pattern or grip icon) on each item
3. Animate the header bar appearing/disappearing

### Phase 6: Fix New Channels Not Appearing Bug

**File: `src/stores/serverStore.ts`**

The `createChannel` function already updates the store (line 598-600). However, the issue could be:
1. The RPC not returning all required channel fields
2. A timing issue with the state update

Add logging to debug:
```typescript
console.log('[createChannel] New channel data:', channel);
```

**File: `src/hooks/useRealtimeServer.ts`**

The realtime subscription for channel INSERT (lines 98-130) also updates the store. Need to ensure:
1. The subscription is active when creating channels
2. No duplicate entries when both store update and realtime trigger

Add a check to prevent duplicates:
```typescript
useServerStore.setState((state) => {
  // Prevent duplicate if already added optimistically
  if (state.channels.some(c => c.id === newChannel.id)) {
    return state;
  }
  return {
    channels: [...state.channels, { /* channel data */ }],
  };
});
```

## Code Changes Summary

| File | Changes |
|------|---------|
| `src/components/layout/ChannelSidebar.tsx` | Add `isSortingMode` state, sorting header, modify context menu, conditionally attach drag listeners, show visible drag handles in sort mode |
| `src/hooks/useRealtimeServer.ts` | Add duplicate prevention check for channel INSERT |

## Desktop Behavior
No changes - the existing hover-to-reveal drag handle continues to work as-is.

## Technical Details

### Sensor Configuration Changes
```typescript
const sensors = useSensors(
  // Only use PointerSensor on mobile when in sorting mode
  useSensor(PointerSensor, {
    activationConstraint: { 
      distance: isMobile && isSortingMode ? 5 : 10 
    },
  }),
  // Disable TouchSensor on mobile when not in sorting mode
  ...(isMobile && !isSortingMode ? [] : [
    useSensor(TouchSensor, {
      activationConstraint: { delay: 100, tolerance: 5 },
    }),
  ]),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  }),
);
```

### Sort Mode Header UI
```tsx
{isSortingMode && (
  <div className="flex items-center justify-between px-3 py-2 bg-primary/10 border-b border-primary/20">
    <div className="flex items-center gap-2">
      <GripVertical className="w-4 h-4 text-primary" />
      <span className="text-sm font-medium text-primary">Sorting Mode</span>
    </div>
    <Button 
      size="sm" 
      variant="ghost" 
      onClick={() => setIsSortingMode(false)}
      className="h-7 px-2 text-xs"
    >
      Done
    </Button>
  </div>
)}
```

### Visible Drag Handle (Sort Mode)
```tsx
{isSortingMode && (
  <div {...attributes} {...listeners} className="p-1 cursor-grab active:cursor-grabbing">
    <GripVertical className="w-4 h-4 text-muted-foreground" />
  </div>
)}
```
