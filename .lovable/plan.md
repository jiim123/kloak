

## Plan: Isolate Announcement Channels into Separate Components

### Goal
Extract announcement channel rendering into its own dedicated component that looks and behaves identically to the current text channel flow, but is fully independent so future text channel changes don't affect announcements.

### What changes

**1. Create `src/components/announcement/AnnouncementChatArea.tsx`**
- A self-contained component that replicates the current text channel rendering from `ChatArea.tsx`
- Uses its own imports of `ChannelHeader`, `MessageList`, `MessageInput`, `TypingIndicator`
- Includes its own `PinnedMessageBar` (copied from ChatArea or imported as shared)
- Has its own hooks: `useTyping`, `useSwipeGestureRef`, emoji loading, slowmode state, pinned message computation
- Accepts `showHeader` prop, identical interface to other channel area components

**2. Update `src/components/layout/ChatArea.tsx`**
- Add `import { AnnouncementChatArea }` from the new component
- Add early return for `channelType === "announcement"` routing to `<AnnouncementChatArea showHeader={showHeader} />`, alongside the existing forum/media/tasks routing
- This fully decouples announcement channels from the text channel code path

**3. Clean up unused legacy announcement files**
- Delete `AnnouncementView.tsx`, `TiptapEditor.tsx`, `RichTextEditor.tsx`, `AnnouncementPreview.tsx` (all unused)
- Keep the existing `AnnouncementChannelArea.tsx` as-is or replace it with the new component

### Technical details
- The new component will duplicate the ~80 lines of state/hooks/rendering from ChatArea's text channel path (channels, messages, typing, pinned bar, swipe gestures, slowmode, emoji map)
- `PinnedMessageBar` will be extracted to a shared file or duplicated into the new component to avoid cross-dependency
- No visual or behavioral changes — the announcement channel will render pixel-identically to how it does today

