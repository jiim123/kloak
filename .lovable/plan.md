

## Voice Channel Issues - Diagnosis and Fixes

### What's Actually Happening

**Good news first:** Agora IS working. The logs confirm `CONNECTED` state and successful channel joins. The token generation matches the official Agora AccessToken2 spec exactly. The `ERR_BLOCKED_BY_CLIENT` errors on `statscollector` are from an ad-blocker in the browser -- they don't affect voice functionality.

### Root Causes Identified

**1. "Realtime send() falling back to REST API" -- causing lag**
The Supabase Broadcast channel (used for UID mapping and hide-voice-activity) is failing to use WebSocket and falling back to HTTP POST. This means every identity broadcast goes through a slower REST round-trip instead of instant WebSocket delivery. This directly causes:
- Delay in resolving user names (seeing numbers temporarily)
- Lag in the participant list updating

The fix: Subscribe to the broadcast channel and **wait for the SUBSCRIBED status** before calling `client.join()` on Agora. Currently the Agora join happens first, and the broadcast channel subscribes after -- meaning early events (like user-joined) fire before the broadcast channel is ready to receive identity mappings.

**2. No voice heard sometimes**
The `user-published` handler calls `track.play()` immediately after subscribe. But the `ParticipantAudioPlayer` component also manages the same track's volume. There's a race condition: if `ParticipantAudioPlayer` mounts and sets volume before the track is fully initialized, or if the participant list rebuilds and the component remounts, audio can get lost. Also, Agora's `track.play()` in the event handler may conflict with volume management in `ParticipantAudioPlayer`.

The fix: Remove `track.play()` from the `user-published` handler and let `ParticipantAudioPlayer` be the single owner of remote audio playback. Update `ParticipantAudioPlayer` to call `track.play()` on mount and `track.stop()` on unmount.

**3. Dialog accessibility warning**
The `ScreenShareQualityModal` uses `DialogContent` without a `DialogDescription`, which triggers the Radix UI warning.

### Plan

#### Step 1: Fix broadcast channel initialization order
Restructure the `join()` function in `useAgoraRoom.ts` so the Supabase broadcast channel subscribes and reaches SUBSCRIBED state **before** calling `client.join()`. This ensures identity mappings can be exchanged immediately when peers connect.

#### Step 2: Fix audio playback ownership
- Remove `user.audioTrack.play()` from the `user-published` event handler in `useAgoraRoom.ts`
- Update `ParticipantAudioPlayer` to call `track.play()` on mount and `track.stop()` on unmount, making it the single source of truth for remote audio playback
- Add proper cleanup to prevent audio leaks

#### Step 3: Fix dialog accessibility warning
Add `DialogDescription` (visually hidden) to `ScreenShareQualityModal.tsx` to satisfy Radix UI's accessibility requirements.

### Technical Details

**File: `src/hooks/useAgoraRoom.ts`**
- Move broadcast channel setup before `client.join()` and await SUBSCRIBED
- Remove `user.audioTrack.play()` from `user-published` handler
- Keep volume management in `ParticipantAudioPlayer` only

**File: `src/components/voice/ParticipantAudioPlayer.tsx`**
- Add `useEffect` to call `track.play()` on mount and `track.stop()` on unmount
- Keep existing volume management logic

**File: `src/components/voice/ScreenShareQualityModal.tsx`**
- Add visually hidden `DialogDescription` inside `DialogHeader`

