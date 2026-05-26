## Bug

Typing `@` in a DM or Group Chat never opens the mention popover. Root cause is in `MessageInput.tsx`:

- **Line 647**: `if (!isDM) { detectAutocomplete(val, e.target.selectionStart); }` — autocomplete detection is gated behind `!isDM`, so the `@` trigger never fires in DMs.
- **Line 1030**: `if (!isDM) { ... autocompleteKeys ... }` — keyboard navigation for the popover (ArrowUp/Down/Enter/Tab/Escape) is also DM-gated. Even if the popover were opened, arrow keys and Enter wouldn't navigate/select it.

The autocomplete component, `MessageMapsProvider` participants wiring, and `dmConfig.participants` are all already in place from the previous turn — they just never get invoked because of these two guards.

## Fix

`src/components/chat/MessageInput.tsx`

1. **Line ~647**: remove the `!isDM` guard so `detectAutocomplete(val, e.target.selectionStart)` runs in DMs too. Keep `!isForum` if it was implied; current code only excludes DMs, so just drop the guard.

2. **Line ~1030**: remove the `!isDM` guard around the autocomplete keyboard-handling block so ArrowUp/ArrowDown/Enter/Tab/Escape are intercepted when the mention popover is open in DMs.

3. **Side note — `#channel` autocomplete in DMs**: `detectAutocomplete` also opens the `#channel` popover. `ChannelAutocomplete` itself is server-only and renders nothing in DMs, but `detectAutocomplete` will still set `showChannels = true`. That's harmless (no options → no UI), but to keep things clean, scope the channel branch of `detectAutocomplete` to non-DM mode (early-return the `#` half inside `detectAutocomplete` when `isDM`). Pass `isDM` into the callback or read it from a ref.

## Out of scope

- All previous DM mention plumbing (autocomplete participants prop, MessageMapsProvider participants, `convertMentionsForSend` for DMs, GIF picker enable) is already implemented and stays.
- No changes to permissions, send path, or storage.

## Files touched

- `src/components/chat/MessageInput.tsx` (two guards + small `detectAutocomplete` tweak)
