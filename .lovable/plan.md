## Goal

Make the Delete Message modal friendlier:
- Resolve `<@uuid>` mentions to `@displayname` and `<#uuid>` channel tags to `#channelname` in the preview (no UUIDs, no generic `@user` fallback when data is available).
- Simplify the modal hierarchy to: title → confirmation sentence → message preview → Cancel / Delete Message buttons.

## Changes

### `src/components/modals/DeleteMessageModal.tsx`

1. **Resolve mentions for the preview.** Pull `members` and `channels` from `useServerStore`, plus the DM/forum participant data already available via `useMessageUser`, and build:
   - `usersMap: Map<userId, { username, display_name, nickname }>` from server members. For the message author (covers DM case where members list is empty), also seed the map with `displayUser`.
   - `channelsMap: Map<channelId, { name }>` from server channels.
   Pass both into `getMessagePreview(content, 200, usersMap)` and add a small wrapper that also calls `stripMarkdown(content, usersMap, channelsMap)` (since `getMessagePreview` doesn't currently accept a channels map — easiest fix: inline `stripMarkdown(...).slice(...)` here, or extend `getMessagePreview` to accept `channelsMap`). Preferred: extend `getMessagePreview` signature in `src/lib/message.ts` to accept an optional `channelsMap` and forward it to `stripMarkdown`.

2. **Simplify modal layout.** Replace the current body with:
   ```
   <header>Delete Message</header>            // unchanged styling
   <body>
     <p>Are you sure you want to delete this message?</p>
     <div class="preview">
       {resolved caption text}
       {image thumbnails grid, unchanged behavior}
     </div>
   </body>
   <footer> Cancel | Delete Message </footer>  // unchanged
   ```
   Remove the "Selected message" label, the author name line, and the `@username` line. Preview container keeps the existing `border border-border bg-muted p-3` styling so it still reads as a quoted preview. Drop "This action cannot be undone." per the requested hierarchy (only the single confirmation sentence remains).

3. **Poll variant** keeps existing copy ("Delete Poll" title, poll-specific sentence, `pollLabel` preview) but follows the same simplified hierarchy (no author block).

4. **Empty preview guard.** If resolved caption is empty and there are no images (e.g. message was only a mention that resolved to nothing), fall back to showing the resolved text from `stripMarkdown(displayContent, usersMap, channelsMap)` so the preview is never blank when content exists.

### `src/lib/message.ts`

- Extend `getMessagePreview` to accept an optional `channelsMap` parameter and pass it through to `stripMarkdown`. Backwards compatible (optional 4th arg).

## Out of scope

- No changes to message rendering, edit flow, or any other modal.
- No changes to delete logic, RPCs, or stores.
- No restyle beyond removing the now-unused author header block inside the preview card.