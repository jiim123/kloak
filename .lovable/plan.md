# Fix MessageItem flicker on members sidebar toggle

## Root cause
In `src/pages/AppLayout.tsx` (lines ~957-960), the desktop members sidebar uses `transition-[width] duration-200` and toggles between `w-[304px]` and `w-0`. Because the panel sits in the same flex row as the chat area, animating its width forces the chat column to grow/shrink by 1px every frame. Inside `src/components/chat/MessageItem.tsx` the message body wrapper (lines 1140-1141: `overflow-hidden`, `max-w-[90%] sm:max-w-none`) is intrinsically sized by that column, so long-text messages re-wrap on every animation frame — that is the perceived "flicker." Short messages don't reflow, which is why only long ones jitter.

## Fix
Replace the width animation with a layout that does not change the chat column width while the panel moves:

1. **`src/pages/AppLayout.tsx`** — the desktop members sidebar container (around line 957):
   - Always reserve a fixed-width slot (`w-[304px]` when open, `w-0` when closed) but apply the change **without a CSS transition** so the chat column snaps once instead of reflowing 12 frames in a row.
   - Wrap the inner `MembersSidebar` in a child that is always `w-[304px]` and uses `transition-transform duration-200` to slide in/out (`translate-x-0` ↔ `translate-x-full`), with `overflow-hidden` on the outer slot to clip it.
   - Net effect: the sidebar still appears to animate, but the chat column width changes in a single layout step so message text wraps exactly once.

   Pseudocode:
   ```tsx
   <div className={cn("shrink-0 overflow-hidden", isMemberSidebarOpen ? "w-[304px]" : "w-0")}>
     <div
       className={cn(
         "h-full w-[304px] transition-transform duration-200 ease-out",
         isMemberSidebarOpen ? "translate-x-0" : "translate-x-full"
       )}
     >
       <MembersSidebar ... />
     </div>
   </div>
   ```

2. No changes needed in `MessageItem.tsx`. Its wrapping behavior is correct; it only looked wrong because it was being asked to reflow every frame.

## Out of scope
- Touching the mobile members drawer (it uses a Sheet and isn't affected).
- Refactoring `MessageItem` layout or its `max-w-[90%]` rule.
- Channel sidebar toggle (uses a different mechanism; report separately if it also jitters).

## Files touched
- `src/pages/AppLayout.tsx` (single container around the desktop `MembersSidebar`)
