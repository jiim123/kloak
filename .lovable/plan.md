

## Overview

This plan improves the group chat UI by creating distinct visual elements for group conversations, including stacked avatars in the sidebar and a proper group chat header with intro message.

---

## What Will Change

### For Users
- Group chats in the DM sidebar show 3 stacked avatars (first 3 participants) instead of a generic icon
- Group chat header displays stacked avatars of participants
- Intro message is contextual: shows group name or participant names
- Clear visual distinction between 1:1 DMs and group conversations

---

## Implementation Steps

### Step 1: Create Stacked Avatars Component

A reusable component that displays 2-3 overlapping avatars:

| Props | Type | Description |
|-------|------|-------------|
| users | User[] | Array of users to display (max 3) |
| size | 'sm' \| 'md' \| 'lg' | Avatar size variant |
| className | string | Additional styling |

Visual layout: Avatars overlap horizontally with slight offset, creating a "stack" effect.

### Step 2: Create Group Chat Header Component

A new `GroupChatHeader` component specifically for group conversations:

- Displays stacked avatars (no status dot - groups don't have presence)
- Shows group name OR comma-separated participant names
- "More Options" menu adapted for groups (no "Call User", has "Leave Group")
- Mobile sidebar toggle support

### Step 3: Update DMSidebar for Group Display

Replace the generic `Users` icon with stacked avatars:

- Extract first 3 participants (excluding current user)
- Use `StackedAvatars` component with `size="sm"`
- Keep existing name display logic (group name or participant names)

### Step 4: Update DMChatArea for Group Detection

Add conditional rendering based on `is_group`:

- Use `DMHeader` for 1:1 conversations
- Use `GroupChatHeader` for group conversations
- Show appropriate intro section based on conversation type

### Step 5: Create Group Chat Intro Section

For group conversations, the intro shows:

- Stacked avatars (larger size)
- Group name as heading (or "Group Chat" if no name)
- Text: "This is the beginning of your group chat with [name/participants]."

---

## Technical Details

### New Files

| File | Purpose |
|------|---------|
| `src/components/ui/stacked-avatars.tsx` | Reusable stacked avatar component |
| `src/components/dm/GroupChatHeader.tsx` | Header component for group conversations |

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/dm/DMSidebar.tsx` | Use StackedAvatars for group rows |
| `src/components/dm/DMChatArea.tsx` | Conditional header/intro for groups |
| `src/components/dm/index.ts` | Export new components |

### StackedAvatars Component Structure

```text
Container (relative, flex)
├── Avatar 1 (z-30, no offset)
├── Avatar 2 (z-20, offset -8px left)
└── Avatar 3 (z-10, offset -16px left)
```

Size variants:
- sm: 24x24px (sidebar)
- md: 32x32px (header)
- lg: 48x48px (intro section)

### GroupChatHeader Props

```text
interface GroupChatHeaderProps {
  conversation: DMConversation;
  participants: User[];  // Other participants (excluding current user)
}
```

### DMChatArea Conditional Logic

```text
if (currentConversation.is_group) {
  // Extract other participants
  const otherParticipants = participants.filter(p => p.user_id !== user.id)
  
  // Render GroupChatHeader
  // Render group intro section
} else {
  // Render DMHeader (existing)
  // Render 1:1 intro section (existing)
}
```

### Group Intro Text Logic

```text
if (conversation.name) {
  "This is the beginning of your group chat with {name}."
} else {
  "This is the beginning of your group chat with {participant1}, {participant2}, and {participant3}."
}
```

---

## Data Flow

```text
DMSidebar renders conversations
        |
        v
For each group conversation:
  - Extract first 3 other participants
  - Render StackedAvatars component
  - Display group name or participant names
        |
        v
User clicks group conversation
        |
        v
DMChatArea detects is_group = true
        |
        v
Renders GroupChatHeader + Group Intro
        |
        v
Messages display as normal
```

---

## Edge Cases

- Group with only 1 other participant: Show single avatar (fallback)
- Group with 2 participants: Show 2 stacked avatars
- Participant with no avatar: Show initial letter fallback
- Very long group name: Truncate with ellipsis
- Many participants (>3): Show first 3 avatars, name shows "+X more"

