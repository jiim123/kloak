

## Auto-scroll fix — root cause and solution

### Root causes identified

After tracing the full pipeline across `MessageList.tsx`, `messageStore.ts`, and `useRealtimeMessages.ts`:

**1. `isNearBottomRef` gets corrupted by scroll events triggered by the nudge itself.**
When `useLayoutEffect` sets `node.scrollTop = n.scrollHeight`, the browser fires a synchronous scroll event. The `handleScroll` callback runs and recalculates `distanceFromBottom`. Between the immediate nudge and the 100ms/250ms retry nudges, intermediate scroll events from layout reflows can momentarily push `distanceFromBottom > 300`, flipping `isNearBottomRef` to `false`. The next message then sees `isNearBottomRef = false` and the `actualDistanceFromBottom` check may also fail if the new content is large enough.

**2. The nudge's `setTimeout` callbacks are not guarded by `isProgrammaticScrollRef`.**
`isProgrammaticScrollRef` is only set in `scrollToBottom()` (the Jump to Present handler), but NOT during the `useLayoutEffect` nudge. So scroll events from the nudge's `scrollTop` writes are treated as user scrolls, corrupting `isNearBottomRef`.

**3. ResizeObserver observes the wrong elements.**
It observes `node` (scroll container — fixed viewport size, never resizes) and `node.firstElementChild` (the header div — static). The actual message content wrapper (`<div key={channelId}>`, the third child) is never observed. This means async content growth (images, embeds) doesn't trigger auto-scroll.

### Fix plan (all in `MessageList.tsx`)

**A. Guard the nudge with `isProgrammaticScrollRef`.**
Set `isProgrammaticScrollRef.current = true` before the immediate nudge in `useLayoutEffect`, and reset it in the last `setTimeout`. This prevents `handleScroll` from corrupting `isNearBottomRef` during programmatic scroll adjustments.

**B. Skip `handleScroll` logic during programmatic scrolls.**
Add an early return in `handleScroll` when `isProgrammaticScrollRef.current` is true. This eliminates ALL interference from layout-triggered scroll events during nudges.

**C. Fix ResizeObserver to observe the message content wrapper.**
Instead of `node.firstElementChild` (header), find and observe the `<div key={channelId}>` wrapper that contains the actual messages. Use a `data-messages-container` attribute on that div for reliable selection.

**D. Add a dedicated ref for the messages wrapper div.**
Add `messagesWrapperRef` to the inner `<div key={channelId}>` so the ResizeObserver can directly observe the element whose size actually changes with new messages/images/embeds.

**E. Make the `useLayoutEffect` nudge unconditionally scroll when `actualDistanceFromBottom` is reasonable.**
Keep the 400px threshold but also add `isProgrammaticScrollRef` protection so the nudge is never undermined by concurrent scroll events.

### Summary of changes

One file: `src/components/chat/MessageList.tsx`
- `handleScroll`: early return when `isProgrammaticScrollRef.current` is true
- `useLayoutEffect` nudge: wrap in `isProgrammaticScrollRef` guard
- ResizeObserver: add `messagesWrapperRef`, observe the correct content div
- JSX: add ref to the messages wrapper div

