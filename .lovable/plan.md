

## Mobile Channel Context Menu as Bottom Drawer

### Problem
On mobile, channel context menus appear as standard context menus (long-press popups), which are awkward to use on touch devices. They should appear as bottom drawers, matching the existing mobile drawer pattern used elsewhere (e.g., message actions).

### Approach
On mobile, replace all three context menus in `ChannelSidebar.tsx` with long-press-triggered bottom drawers. On desktop, keep the existing context menu behavior unchanged.

### Changes

**1. Create `ChannelContextDrawer` component** (`src/components/layout/ChannelContextDrawer.tsx`)
- A new bottom Drawer component that renders the same menu items as `ChannelContextMenu` but in a mobile-friendly drawer format
- Uses the existing `Drawer` component from `src/components/ui/drawer.tsx`
- Accepts an `open` / `onOpenChange` prop pair, plus the same props as `ChannelContextMenu` (channel, isAdmin, categories, onEdit, onDelete, onCopyLink, onMarkAsRead)
- Menu items styled with the standardized `hover:bg-secondary/40 active:bg-secondary/60` pattern (matching mobile message actions drawer)
- Groups items with visual separators, each item having an icon + label row

**2. Update `SortableChannel` in `ChannelSidebar.tsx`**
- Add state: `const [drawerOpen, setDrawerOpen] = useState(false)`
- On mobile (non-sort, non-drag): replace `<ContextMenu>` wrapper with a long-press handler on the button that opens the drawer, plus render `<ChannelContextDrawer>` alongside
- On desktop: keep existing `<ContextMenu>` + `<ChannelContextMenu>` unchanged
- Long-press detection: use `onContextMenu` (which fires on long-press on mobile) to `preventDefault` and open the drawer

**3. Update `SortableCategory` in `ChannelSidebar.tsx`**
- Same pattern: on mobile, the category header long-press opens a small drawer with "Edit Category" and "Delete Category" options (admin only)
- On desktop: keep existing context menu

**4. Update background context menu (line ~1279)**
- On mobile: replace with a long-press drawer containing "Create Category", "Create Channel", "Sort Channels" options
- On desktop: keep existing context menu

### Technical Details
- The `onContextMenu` event fires on mobile long-press, so we intercept it with `e.preventDefault()` and `setDrawerOpen(true)` on mobile
- The Drawer uses `direction="bottom"` (default) with the standard drag handle
- Channel name displayed in the drawer header for context
- All drawer items close the drawer after action via `onOpenChange(false)` before executing the callback

