

# Color-Themed Notifications with Enhanced Actions

## Overview
Enhance the notification bell component with color-coded notification types, separate "Mark all as read" and "Clear all" buttons, and ensure proper click-to-navigate behavior.

## Current State Analysis
- Notifications already have icons based on type (AtSign, MessageCircle, etc.)
- `handleNotificationClick` already navigates using `notification.link` - this works for mentions/DMs
- ScrollArea is implemented but needs verification
- Only one button exists that calls `markAllAsRead` but is labeled "Clear all" (bug!)

## Changes Required

### 1. Color Theme System
Create a helper function that returns theme-specific classes based on notification type:

| Type | Detection | Icon BG | Text Color | Indicator Bar |
|------|-----------|---------|------------|---------------|
| mention | `type === "mention"` | `bg-amber-500/10` | `text-amber-500` | `bg-amber-500` |
| dm | `type === "dm"` | `bg-emerald-500/10` | `text-emerald-500` | `bg-emerald-500` |
| warning | title contains "kicked"/"banned" | `bg-red-500/10` | `text-red-500` | `bg-red-500` |
| friend_request | `type === "friend_request"` | `bg-blue-500/10` | `text-blue-500` | `bg-blue-500` |
| server_invite | `type === "server_invite"` | `bg-violet-500/10` | `text-violet-500` | `bg-violet-500` |

### 2. Warning Icon
Import `AlertTriangle` from lucide-react and add to the icon switch for warning notifications.

### 3. Header Buttons - Split Actions
Replace single button with two separate buttons:

```text
[Notifications (3)]          [CheckCheck Mark as read] [Trash2 Clear all]
```

| Button | Icon | Action | When Visible |
|--------|------|--------|--------------|
| Mark as read | `CheckCheck` | `markAllAsRead(userId)` | `unreadCount > 0` |
| Clear all | `Trash2` | `clearAllNotifications(userId)` | `notifications.length > 0` |

### 4. Add `clearAllNotifications` to Store
**File:** `src/stores/notificationStore.ts`

Add new function to delete all notifications:

```typescript
clearAllNotifications: async (userId: string) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
    set({ notifications: [], unreadCount: 0 });
  } catch (error) {
    console.error('Failed to clear notifications:', error);
  }
},
```

### 5. Apply Color Theme to Notification Items
Update the notification item rendering:

- **Unread background:** Use theme-specific subtle background (e.g., `bg-amber-500/5` for mentions)
- **Icon container:** Use theme-specific background and text colors
- **Unread indicator bar:** Use theme-specific color instead of generic `bg-primary`

### 6. Navigation on Click
The existing `handleNotificationClick` function already:
1. Marks the notification as read
2. Navigates to `notification.link` using React Router
3. Closes the popover

This should work correctly as long as notifications are created with proper `link` values:
- Mentions: `/app?server={serverId}&channel={channelId}&message={messageId}`
- DMs: `/app?conversation={conversationId}`

No changes needed here - the click handling is already implemented correctly.

## Files to Modify

| File | Changes |
|------|---------|
| `src/stores/notificationStore.ts` | Add `clearAllNotifications` function to interface and implementation |
| `src/components/notifications/NotificationBell.tsx` | Add color theming helper, split header buttons, import AlertTriangle and CheckCheck icons, apply themed colors to notification items |

## Technical Details

### New Helper Function
```typescript
type NotificationTheme = 'amber' | 'emerald' | 'red' | 'blue' | 'violet' | 'default';

const getNotificationTheme = (notification: Notification): NotificationTheme => {
  // Check for warning (kick/ban) based on title
  const title = notification.title?.toLowerCase() || '';
  if (title.includes('kicked') || title.includes('banned')) {
    return 'red';
  }
  
  switch (notification.type) {
    case 'mention': return 'amber';
    case 'dm': return 'emerald';
    case 'friend_request': return 'blue';
    case 'server_invite': return 'violet';
    default: return 'default';
  }
};

const themeClasses = {
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-500', indicator: 'bg-amber-500', bgUnread: 'bg-amber-500/5' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', indicator: 'bg-emerald-500', bgUnread: 'bg-emerald-500/5' },
  red: { bg: 'bg-red-500/10', text: 'text-red-500', indicator: 'bg-red-500', bgUnread: 'bg-red-500/5' },
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-500', indicator: 'bg-blue-500', bgUnread: 'bg-blue-500/5' },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-500', indicator: 'bg-violet-500', bgUnread: 'bg-violet-500/5' },
  default: { bg: 'bg-primary/10', text: 'text-primary', indicator: 'bg-primary', bgUnread: 'bg-primary/5' },
};
```

### Updated Icon Function
```typescript
const getNotificationIcon = (notification: Notification) => {
  // Check for warning first
  const title = notification.title?.toLowerCase() || '';
  if (title.includes('kicked') || title.includes('banned')) {
    return <AlertTriangle className="w-4 h-4" />;
  }
  
  switch (notification.type) {
    case "mention": return <AtSign className="w-4 h-4" />;
    case "dm": return <MessageCircle className="w-4 h-4" />;
    case "friend_request": return <UserPlus className="w-4 h-4" />;
    case "server_invite": return <Mail className="w-4 h-4" />;
    default: return <Bell className="w-4 h-4" />;
  }
};
```

## Visual Result
- Mention notifications: Amber-themed with @ icon
- DM notifications: Emerald-themed with chat bubble icon  
- Kick/Ban warnings: Red-themed with alert triangle icon
- Friend requests: Blue-themed with user plus icon
- Server invites: Violet-themed with mail icon

