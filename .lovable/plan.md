

## Auto-scroll bug analysis and fix plan

### Root cause analysis

After auditing the full scroll pipeline (`handleScroll` → `isNearBottomRef` → new-message nudge effect → `scrollToBottom`), I identified **three compounding issues**:

**1. The scroll handler never sets `isNearBottomRef = true` when `atBottom && wasAtBottom`.**
The transition-only logic (lines 453-466) only calls `handleAtBottomStateChange(true)` when transitioning FROM not-at-bottom TO at-bottom. But when the user is already at the bottom and minor scroll events fire (from browser reflows, content height changes, image loads), the handler enters no branch. If a brief scroll jitter pushes `distanceFromBottom` above 300 for a single frame, `isNearBottomRef` flips to `false` (line 459) and **never flips back** unless the user scrolls enough to trigger the `atBottom && !wasAtBottom` transition. Meanwhile the nudge effect checks `isNearBottomRef` and may skip auto-scroll.

**2. The nudge effect (`useEffect`) runs after paint, creating a visible gap.**
The new-message nudge (lines 281-309) uses `useEffect` + `requestAnimationFrame`. The browser may paint the new message at the old scroll position before the nudge fires, causing a brief flash. More critically, between the React commit and the rAF callback, other scroll events or layout reflows can fire, corrupting `isNearBottomRef`.

**3. No `ResizeObserver` safety net for async content.**
Images, link previews, and embeds load asynchronously and increase `scrollHeight` after the nudge has already fired. The 200ms `setTimeout` retry partially helps but doesn't cover all cases. Once the content finishes loading, the user is no longer at the bottom with no mechanism to re-scroll.

### Fix plan

**A. Always sync `isNearBottomRef` in the scroll handler (remove transition-only guard for the ref).**
Keep the transition-only optimization for state updates (`setShowJumpToPresent`, `setNewMessageCount`) to avoid re-renders, but always set `isNearBottomRef.current = atBottom`. This prevents the ref from getting "stuck" at false after a brief jitter.

```text
handleScroll:
  distanceFromBottom = scrollHeight - scrollTop - clientHeight
  atBottom = distanceFromBottom <= 300
  wasAtBottom = isNearBottomRef.current
  isNearBottomRef.current = atBottom          ← ALWAYS sync
  
  if atBottom && !wasAtBottom → clear jump/count state
  if !atBottom && distance >= 600 → show jump button
```

**B. Switch the new-message nudge from `useEffect` to `useLayoutEffect`.**
`useLayoutEffect` fires synchronously after DOM commit but before paint, so the scroll adjustment happens before the user sees anything. This also eliminates the window where scroll events from reflows can corrupt the ref between commit and nudge.

**C. Add a `ResizeObserver` on the scroll container to catch async content growth.**
When `scrollHeight` increases while `isNearBottomRef` is `true`, auto-scroll to the new bottom. This covers image loads, embed expansions, and any other async height changes. The observer will be guarded by a `lastScrollHeightRef` to only fire on actual growth.

**D. Make the nudge more resilient with a multi-frame retry.**
Replace the single `rAF` + 200ms `setTimeout` with a small retry loop (3 attempts at 0/100/250ms) that checks if the scroll actually landed at the bottom after each attempt.

### Files to modify

- `src/components/chat/MessageList.tsx` — all four changes above (scroll handler, nudge effect, ResizeObserver, retry logic)

### Technical details

The `handleScroll` callback dependency on `showJumpToPresent` (for the jump-button guard) will be replaced with a ref to eliminate unnecessary callback recreation, which reduces the chance of stale closure issues during rapid message delivery.

The `ResizeObserver` will be attached/detached alongside the container div lifecycle and will only trigger auto-scroll when `isNearBottomRef.current` is `true`, so it won't interfere when the user has intentionally scrolled up.

