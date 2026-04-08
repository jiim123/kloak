

## Standardize Server Initials

### Problem
Server initials are generated inconsistently across 6 locations using 3 different approaches:
- **Two-word initials** (first letter of first 2 words): `ServerSidebar.tsx`, `HorizontalServerSidebar.tsx`, `ExploreServers.tsx`, `Invite.tsx`
- **Single first character**: `CustomEmojiPopover.tsx`, `ChannelInfoModal.tsx`

### Solution
Create a shared utility with both `getServerInitials` and `getServerColor`, then replace all inline implementations.

### New file: `src/lib/serverUtils.ts`
```typescript
export function getServerInitials(name: string): string {
  return (name || "?")
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function getServerColor(name: string): string {
  const colors = [
    "bg-indigo-500", "bg-purple-500", "bg-pink-500", "bg-red-500",
    "bg-orange-500", "bg-amber-500", "bg-emerald-500", "bg-teal-500",
    "bg-cyan-500", "bg-blue-500",
  ];
  const index = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
}
```

### Files to update (6 files)

1. **`src/components/layout/ServerSidebar.tsx`** — Remove local `getServerInitials` and `getServerColor` functions, import from `serverUtils`
2. **`src/components/layout/HorizontalServerSidebar.tsx`** — Same as above
3. **`src/components/home/ExploreServers.tsx`** — Remove local `getInitials`, import `getServerInitials`
4. **`src/pages/Invite.tsx`** — Replace inline `.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()` with `getServerInitials(server.name)`
5. **`src/components/chat/CustomEmojiPopover.tsx`** — Replace `emoji.serverName.charAt(0).toUpperCase()` with `getServerInitials(emoji.serverName)`
6. **`src/components/chat/ChannelInfoModal.tsx`** — Replace `server.name.charAt(0)` with `getServerInitials(server.name)`

No visual styling changes. The two-word initials approach (matching the sidebar) becomes the standard everywhere.

