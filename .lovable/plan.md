

## Fix MessageList Scroll and Layout Issues

Four interconnected changes to eliminate scroll jumps, layout shifts, and unreliable scroll behavior.

---

### 1. CSS Scroll Anchoring (replace manual anchor restoration)

**File: `src/components/chat/MessageList.tsx`**

- Add `style={{ overflowAnchor: 'auto' }}` to the scroll container div (line ~686)
- Simplify `handleLoadOlder` to just fetch without manual anchor tracking — remove the anchor measurement block (lines 411-431), the `prependRequestIdRef`/`setPrependComplete` calls
- Remove the prepend anchor restoration `useLayoutEffect` (lines 441-462)
- Remove unused refs/state: `pendingPrependAnchorRef`, `prependRequestIdRef`, `prependComplete`/`setPrependComplete`

### 2. Reserve Space for Images and Embeds

**File: `src/components/chat/MessageContent.tsx`**
- For attachment images (line ~343): add `min-height: 40px; max-height: 350px; background: rgb(24 24 24 / 40%)` to the inline style, plus an `onload` handler to clear the background
- For trusted inline images (lines ~328, ~362): add `min-height: 40px` and placeholder background

**File: `src/components/chat/LinkPreview.tsx`**
- Wrap preview images in containers with `min-height: 80px`
- For YouTube/Vimeo iframes: wrap in `aspect-ratio: 16/9` containers instead of fixed width/height
- For Spotify/SoundCloud: ensure fixed-height containers

### 3. Simplify Scroll-to-Bottom (remove setTimeout cascade)

**File: `src/components/chat/MessageList.tsx`**

- **New message nudge** (lines 291-338): Replace the `setTimeout` cascade (50ms, 150ms, 300ms) with a single immediate `scrollTop = scrollHeight`. The ResizeObserver already handles subsequent size changes from async content.
- **Initial bottom scroll** (lines 498-523): Replace the 4-retry cascade with `scrollDown()` + one `requestAnimationFrame(scrollDown)`
- **`scrollToBottom`** (lines 351-376): Remove the `setTimeout` retry, just do one immediate scroll

### 4. Remove `isProgrammaticScrollRef` Guard

**File: `src/components/chat/MessageList.tsx`**

- Remove `isProgrammaticScrollRef` declaration (line 184)
- Remove all assignments to it (lines 314, 331, 355, 361, 502, 521)
- Remove the early return in `handleScroll` that checks it (line 467)
- The `isNearBottomRef` logic already correctly tracks scroll position

---

### What stays unchanged
- Message grouping, date dividers, deduplication, unread divider logic
- `useScrollToMessage`, `useRealtimePolls`
- ResizeObserver/MutationObserver setup (kept as-is, it's the correct approach)
- No new dependencies

