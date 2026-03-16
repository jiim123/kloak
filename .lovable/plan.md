

## Show toast when mentions are suppressed

### What
After `sendMessage` returns, check the RPC response for `mentions_suppressed` and `suppressed_types` fields. If mentions were suppressed, show informational toasts.

### Changes

**1. `src/stores/messageStore.ts`** (~line 650-692)
- Include `mentions_suppressed` and `suppressed_types` in the returned message object (or return them separately). The simplest approach: add these fields to the returned object from `sendMessage`.

Update the return around line 650-692 to pass through suppression info:
```typescript
const message: Message = { ... };
// Attach suppression metadata for the caller
(message as any)._mentions_suppressed = (data as any).mentions_suppressed;
(message as any)._suppressed_types = (data as any).suppressed_types;
```

**2. `src/components/chat/MessageInput.tsx`** (~line 364)
- After `sendMessage` returns, check for suppression fields and show toast:

```typescript
const sentMessage = await sendMessage(channelId, user.id, finalContent, replyingTo?.id);

if (sentMessage) {
  const suppressedTypes: string[] = (sentMessage as any)?._suppressed_types || [];
  if ((sentMessage as any)?._mentions_suppressed) {
    if (suppressedTypes.includes('everyone')) {
      toast.info("You don't have permission to mention @everyone in this channel");
    }
    if (suppressedTypes.includes('roles')) {
      toast.info("You don't have permission to mention roles in this channel");
    }
  }
}
```

### What stays unchanged
- No backend/RPC changes
- No changes to other toasts or message sending flow
- Message still sends successfully, mentions are just silently suppressed

