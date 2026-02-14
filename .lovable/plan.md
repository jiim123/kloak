

## Fix: Voice Channel Area Not Updating After Sidebar Disconnect

### Problem
When the user clicks the sidebar disconnect button while viewing the voice channel, the Agora connection is actually terminated but the VoiceChannelArea UI still shows the connected state (participants, controls). The in-channel disconnect button works correctly.

### Root Cause
The sidebar disconnect triggers a custom DOM event that calls `voice.leave()`. This updates the Zustand store (`connection.status = "idle"`, `joinedChannelId = null`) and the local React state (`status = "idle"`). However, a race condition between two `VoicePersistentHost` instances (desktop + mobile, both always mounted) and the async nature of `leave()` can cause the active `VoiceChannelArea` to unmount before its local state propagates, and the replacement instance may not render correctly.

### Solution
Make `VoiceChannelArea` subscribe directly to the Zustand store's `connection.status` and use it as a secondary source of truth. If the store says "idle", treat the component as disconnected regardless of the local `voice.isJoined` state.

### Changes

**File: `src/components/voice/VoiceChannelArea.tsx`**

1. Add a Zustand subscription to `connection.status`:
```typescript
const connectionStatus = useVoiceStore((s) => s.connection.status);
```

2. Create a derived `effectivelyJoined` value:
```typescript
const effectivelyJoined = voice.isJoined && connectionStatus === "joined";
```

3. Replace all references to `voice.isJoined` with `effectivelyJoined`:
   - The "Voice connected" / "Not connected" header text (line 238)
   - The join card vs participant grid conditional (line 258)
   - The bottom control bar visibility (line 345)
   - The `setJoinedChannel` effect (line 157)
   - The auto-disconnect hook (line 145)

This ensures that when `leave()` updates the Zustand store (which happens synchronously), the VoiceChannelArea immediately reflects the disconnected state, even if its own local `useAgoraRoom` hook state hasn't caught up due to async cleanup or component remounting.

