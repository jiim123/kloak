

## Fix Server Role Data Leaking into DM View

### Problem
When switching from a server to DMs, `MessageItem` still reads `members` and `roles` from `serverStore` (which retains the last server's data). This causes DM messages to show server role colors, role icons, and nicknames from the previously viewed server. The `authorStyleFallback` prop also passes server role data through unguarded.

### Changes

**File: `src/components/chat/MessageItem.tsx`**

All changes use the existing `isDM` constant (line 298: `const isDM = !!dmActions`).

1. **Add `effectiveAuthorStyle` guard** — after line 298:
```typescript
const effectiveAuthorStyle = isDM ? undefined : authorStyleFallback;
```

2. **Guard `messageMember` and `currentMember`** (lines 392-415): When `isDM`, skip the `members.find()` lookups — set both to `undefined`. The `usersMap` and `channelsMap` can also be empty maps in DM mode since they're for server mention resolution.

3. **Guard `messageRoles` and `messageBaseRole`** (lines 417-421): Replace `authorStyleFallback` with `effectiveAuthorStyle`:
   - `messageMember?.roles ?? effectiveAuthorStyle?.roles ?? []` — and force to `[]` when `isDM`
   - `messageMember?.role ?? effectiveAuthorStyle?.role` — and force to `undefined` when `isDM`

4. **Guard `priorityRoleWithIcon`** (lines 425-455): When `isDM`, return `null` immediately — no role icons in DMs.

5. **Guard `topCustomRoleColor`** (lines 1018-1036): When `isDM`, return `null` — no custom role color in DMs.

6. **Guard `usernameColorClass`** (lines 1038-1042): When `isDM`, always return `"text-foreground"`.

7. **Guard `displayName`** (lines 1052-1059): When `isDM`, skip `messageMember?.nickname` and `effectiveAuthorStyle?.nickname` — use only `messageUser?.display_name` or `messageUser?.username`.

### What stays unchanged
- Server store is not cleared on DM switch
- Role color logic within servers unchanged
- DM message sending/receiving unchanged
- Avatar and user-level display names unchanged
- All scroll/layout fixes from Plan 1 (already implemented)

