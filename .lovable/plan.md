## Poll UX fixes

### 1. "View results" with no vote leaves no way back
`src/components/chat/PollMessage.tsx`: in the `showResults` branch the only buttons are **Edit response** (hidden when `userResponseCount === 0`), so a user who taps **View results** without voting is stranded. Add a **Back to poll** button in that branch when `!isClosed && showResultsOverride && !hasVoted`, mirroring the existing toggle that already exists in the voting branch.

### 2. Pinned messages panel shows raw `__kloak_poll__:<id>`
`PinnedMessagesPanel.tsx` already branches on `getPollIdFromContent`, so the raw string only leaks when the helper returns null. Make detection robust:
- In `src/lib/poll.ts`, accept the prefix anywhere via regex and trim surrounding whitespace/newlines before slicing, so content like `\n__kloak_poll__:<uuid>` or `__kloak_poll__:<uuid> ` still resolves.
- Add a `formatPollLabel(pollId)` helper that returns `Poll: <question>` from `usePollStore.getState().pollsById[id]?.question`, falling back to `Poll`. Used by previews below.
- Keep the existing `<PollMessage />` render in the panel.

### 3. Right-click → Edit on own poll loads raw `__kloak_poll__:<id>`
`src/components/chat/MessageItem.tsx`: hide **Edit Message** (dropdown line ~1711 and context menu line ~1754) when `pollId` is truthy. For own poll messages, add two new items:
- **End poll** → `usePollStore.getState().closePoll(pollId)`; disabled when `poll.is_closed`.
- **Delete poll** → reuse the existing `handleDelete`/DeleteMessageModal flow (the DB cascade already removes the poll row when the message is deleted).

### 4. Reply / delete previews render the raw id
- `MessageItem.tsx` line ~1255: already prints italic "poll" — upgrade to `formatPollLabel(pollId)` so it reads `poll: <question>` (truncated).
- `src/components/modals/DeleteMessageModal.tsx` (~line 122): when `isPollMessageContent(displayContent)`, render `formatPollLabel(pollId)` instead of the raw string.
- `src/components/forum/ForumChannelArea.tsx` (lines ~2898 and ~3511): same upgrade for forum reply previews.

### Files
- `src/lib/poll.ts` — relax matcher, add `formatPollLabel`.
- `src/components/chat/PollMessage.tsx` — Back to poll button in results view.
- `src/components/chat/MessageItem.tsx` — hide Edit on polls, add End poll + Delete poll, enrich reply label.
- `src/components/modals/DeleteMessageModal.tsx` — poll-aware preview.
- `src/components/forum/ForumChannelArea.tsx` — poll-aware reply preview.

No DB, RPC, or realtime changes — `closePoll` already broadcasts and the delete path already removes the poll row.
