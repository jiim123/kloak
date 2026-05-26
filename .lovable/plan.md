## Goal

Bring DMs and Group DMs to feature parity with channel messages in `MessageInput`: enable **@mentions** (of conversation participants) and the **GIF picker**. No changes to UI or other inputs.

## Current behavior (audited)

`MessageInput.tsx` already supports a `dmConfig` branch (`isDM = !!dmConfig`), but several capabilities are explicitly disabled when `isDM` is true:

1. **GIF picker** — Lines 1287–1288 + 1318 pass `undefined` for `showGifPicker` / `setShowGifPicker` / `handleGifSelect` when `isDM`, so the GIF button never renders.
2. **Mentions are not converted on send** — Line 760: `const contentToSend = isDM ? content.trim() : convertMentionsForSend(...)`. Even if the user types `@name`, it's stored as plain text instead of `<@uuid>`, so it's not a real mention and doesn't render styled in `MessageContent`.
3. **MentionAutocomplete shows nothing in DMs** — `MentionAutocomplete.tsx` (lines 41–47) early-returns when there's no `currentServer`. DMs/Groups have no server, so the popover is always empty.
4. **MessageMapsProvider returns empty maps for DMs** — `MessageMapsContext.tsx` returns empty `usersMap` when `isDM`. Even if mentions were stored as `<@uuid>`, `MessageContent` would render the raw UUID.
5. **Edit-mode prefill in DMs uses raw content** — `MessageItem.handleStartEditing` already converts mentions for channel messages; DM edits would need the same once mentions are real.

`ChannelAutocomplete` (the `#channel` popover) is correctly server-only and stays disabled in DMs — channel tagging is not meaningful in a DM context.

## Plan

### 1. Enable GIF picker in DMs
`src/components/chat/MessageInput.tsx`

- Remove the `isDM ||` guard around `showGifPicker` / `setShowGifPicker` / `handleGifSelect` (keep the `isForum` guard).
- The GIF flow already attaches a remote URL as a pending attachment and goes through the standard send path, which already works for DMs.

### 2. Support participant mentions in DMs

**`src/components/chat/MentionAutocomplete.tsx`** — add an optional `participants?: User[]` prop. When provided (DM/Group mode), skip the server RPC and filter `participants` by query against `display_name` / `username`. `@everyone` / `@here` / roles are omitted in DM mode.

**`src/components/chat/MessageInput.tsx`**
- Extend `DMInputConfig` with `participants?: User[]` (passed in from `DMChatArea` / `DMHeader` consumer).
- Pass `participants={dmConfig?.participants}` into `<MentionAutocomplete>` when `isDM`.
- Remove the `isDM ?` short-circuit on line 760 so `convertMentionsForSend(...)` runs for DMs too. The existing `mentionMappingsRef` populated by autocomplete selection drives the `@name → <@uuid>` conversion uniformly.
- Keep the channel-only permission checks (`canMentionEveryone`, `canMentionRoles`, etc.) gated behind `if (!isDM)` as today — DM mentions are always allowed between participants.

**`src/components/dm/DMChatArea.tsx`**
- Build a `participants: User[]` array (1:1 → `[otherUser]`; group → `otherParticipants` already computed) and pass it via `dmConfig.participants` to `<MessageInput>`.

### 3. Render mentions correctly in DM messages

**`src/components/chat/MessageMapsContext.tsx`** — when `isDM`, instead of returning empty maps, accept an optional `participants` prop on `MessageMapsProvider` and build `usersMap` from them so `MessageContent` resolves `<@uuid>` → `@displayname`. `channelsMap` stays empty.

**`src/components/dm/DMChatArea.tsx`** — pass the same `participants` list into `<MessageMapsProvider isDM participants={...}>`. (Find where the provider currently wraps the DM message list; if it doesn't, wrap it.)

### 4. Edit-mode parity for DMs

**`src/components/chat/MessageItem.tsx`** — in `handleStartEditing`, when the message is a DM, also pass through `convertMentionsToReadable(message.content, usersMap, channelsMap)` (channelsMap will be empty, harmless). With step 3 in place, `usersMap` is now populated for DMs.

## Out of scope

- `ChannelAutocomplete` (`#channel`) in DMs — not meaningful, stays disabled.
- Role/`@everyone`/`@here` in DMs — not applicable.
- Poll modal, chat-notice, slowmode, link-blocking — already correctly disabled for DMs.
- Custom server emoji picker behavior in DMs (no change requested).
- Backend: no schema or RPC changes; DM messages already store free-form content.

## Files touched

- `src/components/chat/MessageInput.tsx`
- `src/components/chat/MentionAutocomplete.tsx`
- `src/components/chat/MessageMapsContext.tsx`
- `src/components/chat/MessageItem.tsx`
- `src/components/dm/DMChatArea.tsx`
