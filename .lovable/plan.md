
# Convert Server Sidebar to Horizontal Top Bar (Desktop Only)

## Overview
Transform the current vertical server sidebar (72px wide, left side) into a horizontal server bar at the top of the application. The channel sidebar will move to where the server sidebar was. Mobile layout remains unchanged.

## Current vs. Proposed Layout

### Current Desktop Layout
```text
┌─────────────────────────────────────────────────┐
│               Desktop Title Bar                  │
├─────────────────────────────────────────────────┤
│ Server │ Channel  │                    │ Members │
│  Bar   │ Sidebar  │      Chat Area     │ Sidebar │
│ (72px) │(resizable)│                   │(resizable)│
│vertical│          │                    │         │
└─────────────────────────────────────────────────┘
```

### Proposed Desktop Layout
```text
┌─────────────────────────────────────────────────┐
│               Desktop Title Bar                  │
├─────────────────────────────────────────────────┤
│    Server Bar (horizontal, ~56px height)         │
├─────────────────────────────────────────────────┤
│ Channel │                              │ Members │
│ Sidebar │         Chat Area            │ Sidebar │
│ (72px)  │       (resizable)            │(resizable)│
│ fixed   │                              │         │
└─────────────────────────────────────────────────┘
```

## Implementation

### Phase 1: Create Horizontal Server Sidebar Component

**New File:** `src/components/layout/HorizontalServerSidebar.tsx`

This component will be a horizontal variant of ServerSidebar with these key differences:

1. **Container Layout**
   - Change from `flex flex-col` to `flex flex-row`
   - Height constraint (~56-72px) instead of width
   - Full width of viewport
   - Horizontal scrolling with `overflow-x-auto`

2. **Server Icons**
   - Same 48x48 size icons
   - Arranged horizontally with `gap-2`
   - Indicator pill moves from left side to bottom of icon
   - Tooltips appear below (`side="bottom"`) instead of right

3. **Home Button & Add Server**
   - Home button on the left
   - Add server button on the right (or after servers)
   - Settings button on the far right

4. **Folder System**
   - Folders expand downward as a dropdown instead of inline
   - Or simplified to just show folder icon with server icons appearing in a dropdown

5. **Drag and Drop**
   - Same dnd-kit system but horizontal orientation
   - Droppable areas adjusted for horizontal layout

### Phase 2: Update AppLayout for Desktop

**File:** `src/pages/AppLayout.tsx`

Modify the desktop layout section:

```typescript
{/* Desktop layout */}
<div className="hidden md:flex flex-col flex-1 overflow-hidden">
  {/* Horizontal Server Bar - NEW */}
  <HorizontalServerSidebar />
  
  <div className="flex flex-1 overflow-hidden">
    {/* Channel sidebar - now in fixed left position */}
    {!isServerSettingsOpen && activeModal !== 'user-settings' && activeModal !== 'edit-channel' && (
      <div className="w-[72px] flex-shrink-0 bg-layout-sidebar-secondary">
        {isDMView ? (
          <DMSidebar variant="narrow" ... />
        ) : (
          <ChannelSidebar variant="narrow" />
        )}
      </div>
    )}
    
    {/* Rest of the layout (settings pages or ResizablePanelGroup) */}
    ...
  </div>
</div>
```

### Phase 3: Adapt ChannelSidebar for New Position

**File:** `src/components/layout/ChannelSidebar.tsx`

The ChannelSidebar needs to work in the narrower 72px space:
- Add a `variant="narrow"` prop for compact display
- In narrow mode: show only channel icons/abbreviations
- Expand on hover or click to show full channel names
- Or keep full width with the ResizablePanelGroup

**Alternative approach**: Keep ChannelSidebar in the ResizablePanel as-is, and place a minimal "server context indicator" in the 72px left bar when a server is selected.

### Phase 4: Mobile Layout (No Changes)

The mobile layout continues to use:
- MobileHeader
- MobileSidebar (includes vertical ServerSidebar functionality)
- MobileMembersSidebar

## Technical Details

### HorizontalServerSidebar Key Changes

| Feature | Vertical (current) | Horizontal (new) |
|---------|-------------------|------------------|
| Container | `flex flex-col w-[72px]` | `flex flex-row h-[56px]` |
| Scroll | `overflow-y-auto` | `overflow-x-auto` |
| Pill position | `-left-3` | `-bottom-3` |
| Tooltip side | `side="right"` | `side="bottom"` |
| Gap direction | vertical `gap-2` | horizontal `gap-2` |
| Settings icon | Bottom of sidebar | Right end of bar |

### Animation Variant Updates

```typescript
// Pill variants - updated for horizontal
const pillVariants = {
  hidden: { width: 0, opacity: 0 },   // Changed from height to width
  hover: { width: 20, opacity: 1 },
  unread: { width: 8, opacity: 1 },
  active: { width: 40, opacity: 1 },
};
```

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/layout/HorizontalServerSidebar.tsx` | Create (based on ServerSidebar) |
| `src/pages/AppLayout.tsx` | Modify desktop layout structure |
| `src/components/layout/ChannelSidebar.tsx` | Minor adjustments if needed |

### Folder Handling Options

Since horizontal space is limited, folders can be handled by:
1. **Dropdown approach**: Folder icon shows a dropdown menu with contained servers
2. **Inline approach**: Folder acts as a visual separator between server groups
3. **Simplify**: Remove folder support in horizontal mode (servers always flat)

Recommendation: **Dropdown approach** - clicking a folder icon opens a popover showing the servers inside.

## Testing Checklist
- Horizontal server bar displays correctly at full width
- Server icons are clickable and navigate properly
- Indicator pills appear below active/hovered servers
- Tooltips appear below server icons
- Home and Add Server buttons work
- Drag-and-drop for folder organization works (if kept)
- Unread badges and mention counts display correctly
- Context menus (Mark as Read, Mute, Leave) work
- Settings button opens user settings
- Mobile layout is completely unchanged
- Responsive breakpoint (md:) correctly switches layouts
