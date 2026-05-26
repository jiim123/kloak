# Plan

## 1. MessageInput keyboard shortcut

`src/components/chat/MessageInput.tsx` (line ~1050) currently maps:
- `Ctrl+C` → inline `code` (conflicts with copy)
- `Ctrl+K` → `codeblock`

Change `formatMap` to:
- Remove the `c` entry (so Ctrl+C copies normally).
- Map `k` → `code` (inline code), matching the user's request.

Note: this removes the existing Ctrl+K → codeblock binding. Codeblock will still be reachable via the selection format toolbar and the ``` ``` ``` syntax. (Flag this in the response so the user can request a replacement shortcut if desired.)

## 2. CreateChannelModal redesign

File: `src/components/modals/CreateChannelModal.tsx`

Restructure the channel-mode form into a cleaner, more modern layout:

```
┌────────────────────────────────────────┐
│ Create a channel                       │
├────────────────────────────────────────┤
│ Channel name                           │
│ [ input ──────────────────────────── ] │
│                                        │
│ Channel type                           │
│ [ # Chat                          ▾ ]  │  ← shadcn Select dropdown
│ A place for everyone to have …         │  ← description of selected type
│                                        │
│ ─────────────────────────────────────  │
│ 🔒 Private channel               [○]   │  ← toggle (default OFF)
│ Only selected members and roles will   │
│ be able to view this channel.          │
├────────────────────────────────────────┤
│                    Cancel   [ Create ] │
└────────────────────────────────────────┘
```

Changes:
- **Channel type picker**: replace the `RadioGroup` + icon grid + `ChannelTypePreview` block with a shadcn `Select`. Each `SelectItem` shows the type's icon + label. Below the trigger, render the selected type's description (reusing `selectedTypeMeta.description`).
- Remove the now-unused `ChannelTypePreview` component, `ChannelIconButton` component, `RadioGroup`/`RadioGroupItem` imports.
- **Privacy toggle**: replace the "Make channel public" row with a "Private channel" row.
  - State stays as `isPrivate` (default `false`).
  - `<Switch checked={isPrivate} onCheckedChange={setIsPrivate} />` (inverted from current).
  - Copy: title "Private channel", description "Only selected members and roles will be able to view this channel."
- Keep the existing modal chrome, category mode, submit logic, and `createChannel(..., isPrivate, false)` call unchanged.
- Keep using the existing color tokens already in the file (no broader theming refactor).

## Out of scope
- No changes to channel-settings privacy controls (already exist there).
- No changes to category-creation flow.
- No DB/RPC changes.
