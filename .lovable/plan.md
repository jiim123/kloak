

## Plan: Format Announcement Previews in Server Overview

### Problem
Line 295 in `ServerOverviewView.tsx` renders `announcement.content` as raw text, so `**bold**`, `<@uuid>`, `<#uuid>` all show unformatted.

### Solution
Use `stripMarkdown()` from `src/lib/message.ts` to clean the content for the preview cards. This function already handles:
- Stripping `**bold**`, `*italic*`, `~~strikethrough~~`, `__underline__`, `` `code` ``, `||spoiler||`
- Converting `<@userId>` → `@username`
- Converting `<#channelId>` → `#channelname`

### Changes

**`src/components/layout/ServerOverviewView.tsx`**

1. Import `stripMarkdown` from `@/lib/message`
2. Build a `usersMap` from the `members` array (Map of userId → {username, display_name, nickname})
3. Build a `channelsMap` from the `channels` array (Map of channelId → {name})
4. On line 87 where the announcement title is extracted, and on line 295 where content is rendered, apply `stripMarkdown(content, usersMap, channelsMap)` so previews show clean, readable text

No new files needed. Single file change.

