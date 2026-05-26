## Problem

When editing a message that contains `<@uuid>` mentions or `<#uuid>` channel tags, the raw UUID format is loaded into the edit textarea instead of the readable `@username` / `#channel-name` form.

## Root cause

`handleStartEditing` in `src/components/chat/MessageItem.tsx` (line ~836) passes `message.content` directly into `editStore.startEditing(...)`, which `MessageInput.tsx` then loads verbatim into the textarea (line 443: `setContent(editingMessage!.content)`).

The save path already calls `convertMentionsForSend(trimmed)` (line 728) which converts `@name`/`#name` back to `<@uuid>`/`<#uuid>`, so converting at start of edit is round-trip safe.

## Fix

### `src/components/chat/MessageItem.tsx`
In `handleStartEditing`, replace `content: message.content` with `content: convertMentionsToReadable(message.content, usersMap, channelsMap)`. `convertMentionsToReadable` is already imported (line 57) and `usersMap` / `channelsMap` are already in scope via `useMessageMaps()`.

Add `usersMap` and `channelsMap` to the `useCallback` dependency array.

That's the entire change — one file, ~3 lines.

## Out of scope

- DM edits: DMs have no server members/channels context, so mentions in DMs are unusual; the existing DM save path (`dmEditMessage(..., trimmed)`) doesn't run `convertMentionsForSend`, so converting the prefilled content there would break round-trip. No change for DM edits.
- No changes to MessageInput, editStore, save logic, or other components.