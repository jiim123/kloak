

## Voice Channel Audit -- Bugs Found

### Bug 1: Sidebar Disconnect Button Unreliable (CRITICAL)

**Root cause:** In `VoiceChannelArea.tsx` (line 174), the `kloak:voice:leave` event listener depends on `voice` in its dependency array. But `useAgoraRoom` returns a **new object literal every render** (lines 579-597), so `voice` is a new reference on every render. This causes the `useEffect` to tear down and re-register the listener constantly, creating a race window where the event fires between removal and re-addition.

**Fix:** Replace `voice` in the dependency array with the stable `voice.leave` callback reference. Same fix needed for the mute/deafen listeners (line 194).

```text
Before: }, [channel.id, voice]);
After:  }, [channel.id, voice.leave]);
```

---

### Bug 2: Per-User Volume Above 100% Has No Effect (CRITICAL)

**Root cause:** In `ParticipantAudioPlayer.tsx` (line 33), the volume calculation is:

```typescript
const vol = Math.min(100, Math.round((userVolume / 100) * (outputVolume / 100) * 100));
```

Agora's `setVolume()` accepts 0-100. The `Math.min(100, ...)` hard-caps the result, so even if a user sets volume to 200%, the actual applied volume is still 100. The slider goes up to 200% but has zero effect above 100%.

**Fix:** Agora remote audio tracks actually support `setVolume(0-100)` only. To support boost above 100%, we'd need to use the Web Audio API (GainNode) instead. However, the immediate fix is to expand the Agora range -- Agora's `setVolume` actually accepts **0-1000** on `IRemoteAudioTrack`, not 0-100 as documented for some older APIs. We should pass the computed percentage directly without capping at 100:

```typescript
// Map combined volume (0-400 theoretical max) to Agora's 0-1000 range
const vol = Math.round((userVolume / 100) * (outputVolume / 100) * 100);
track.setVolume(Math.min(vol, 400)); // cap at 4x boost for safety
```

---

### Bug 3: Deafen/Undeafen Bypasses Per-User Volume (MODERATE)

**Root cause:** In `useAgoraRoom.ts` (lines 438-442), `toggleDeafen` directly calls `remoteUser.audioTrack.setVolume()` on all remote tracks. But `ParticipantAudioPlayer` is supposed to be the **single owner** of remote audio playback (as stated in its own documentation). When undeafening, `toggleDeafen` resets all volumes to `100`, wiping out any per-user volume overrides.

```typescript
// Current code in toggleDeafen -- conflicts with ParticipantAudioPlayer
for (const remoteUser of client.remoteUsers) {
  if (remoteUser.audioTrack) {
    remoteUser.audioTrack.setVolume(newDeafened ? 0 : 100);  // <-- ignores per-user overrides
  }
}
```

**Fix:** Remove the direct volume manipulation from `toggleDeafen`. The `ParticipantAudioPlayer` component already reacts to the `deafened` state via the `muted` prop and applies volume correctly (including per-user overrides). The `toggleDeafen` code is redundant and harmful.

---

### Bug 4: Event Listener Instability for Mute/Deafen (MINOR)

Same issue as Bug 1 -- the mute/deafen event listeners (lines 177-194) also depend on `voice`, causing the same constant re-registration problem. Fix by depending on `voice.toggleMute` and `voice.toggleDeafen` respectively.

---

### Summary of Changes

| File | Change |
|------|--------|
| `src/components/voice/VoiceChannelArea.tsx` | Fix event listener deps: use `voice.leave`, `voice.toggleMute`, `voice.toggleDeafen` instead of `voice` |
| `src/components/voice/ParticipantAudioPlayer.tsx` | Remove `Math.min(100, ...)` cap, allow volumes above 100 for Agora's `setVolume` |
| `src/hooks/useAgoraRoom.ts` | Remove direct `setVolume` calls from `toggleDeafen` -- let ParticipantAudioPlayer handle it |

