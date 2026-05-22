## Problem

The composer is one tall horizontal row: `Plus | textarea | GIF | Emoji | Send`, all in a single `flex items-stretch` container with `min-h-[44px]`. When the textarea grows past one line (up to 160px), the whole row stretches with it, so the side buttons get pushed into awkward positions and the bar becomes visually unbalanced. On mobile the send button (32px) and the action icons are also too small for comfortable tapping.

## Goal

- Textarea grows independently — the action buttons stay anchored in a fixed-height row below the text.
- All tappable elements meet a comfortable touch target size on mobile (≥44px).
- Compact, neat single-line resting state; clean multi-line expanded state.

## Changes (all in `src/components/chat/MessageInput.tsx`)

### 1. Two-row layout for `ActionBar`

Replace the current single-row stretch flex with a column:

```text
┌───────────────────────────────────────────┐
│  textarea (1..N lines, grows MIN..MAX)    │  ← only this row resizes
├───────────────────────────────────────────┤
│ [+]  [Poll]      [GIF] [😊] [123] [➤]    │  ← fixed-height action row
└───────────────────────────────────────────┘
```

- Outer wrapper becomes `flex flex-col`.
- Top row: just the textarea, full width, with comfortable horizontal padding.
- Bottom row: fixed height (`h-12` mobile / `h-11` desktop), contains the Plus dropdown trigger on the left and GIF / Emoji / character counter / Send on the right.
- Remove the vertical divider currently rendered by `border-r` on the Plus button (no longer makes sense in a two-row layout); use spacing instead.
- The reply / edit / mentions / attachment-preview slots above remain unchanged — they continue to live in the outer wrapper.

### 2. Mobile-friendly sizing

Use `useIsMobile` (already imported) plus Tailwind responsive classes:

- Icon buttons (`iconBtnClass`): `h-10 w-10` desktop → `h-11 w-11` mobile.
- Plus trigger: keep `h-11 w-11` but drop the right border.
- Send button: `h-9 w-9` desktop → `h-11 w-11` mobile, still rounded-full.
- Inner padding around the action row: `px-2 sm:px-1.5`.
- Outer composer padding: `px-3 sm:px-5 pb-4 sm:pb-5` so the bar isn't flush to the screen edge on mobile.
- Textarea base `font-size`: bump to `16px` on mobile (prevents iOS auto-zoom on focus) and keep `15px` on desktop.

### 3. Textarea size constraints

- `MIN_TEXTAREA_HEIGHT`: stay at 40px so a one-line input is compact.
- `MAX_TEXTAREA_HEIGHT`: cap at `120px` on mobile, keep `160px` on desktop. Implemented by reading `useIsMobile` in `resizeTextarea` and the inline `style.maxHeight` write sites (lines ~457, ~468, ~558).
- Add vertical padding (`py-2.5 sm:py-2`) so the caret isn't crammed against the top edge.

### 4. Container rounding / focus styling

- Keep `rounded-lg` resting; no change to the squared-top behavior when reply / edit / mention bars are open.
- Focus border stays the same — only the internal layout changes.

### 5. Validation

After the edit:
- One-line state matches the screenshot's height visually (slightly taller on mobile only).
- Typing many lines grows only the textarea; Plus, GIF, Emoji and Send stay put at the bottom.
- Tap targets on mobile measure ≥44px in the rendered preview.

No DB, store, or RPC changes. No behavioral changes to send / paste / mentions / attachments.
