

# Replace LiveKit with Agora.io for Voice and Screen Sharing

## Overview

Replace the current LiveKit-based voice system with Agora.io's hosted SFU to take advantage of 10,000 free minutes per month. No external server needed -- Agora is a fully hosted service like LiveKit. The architecture stays nearly identical: an edge function generates tokens, and the client SDK handles all WebRTC media.

## Prerequisites (Your Responsibility)

1. **Create an Agora account** at [agora.io](https://www.agora.io)
2. **Create a project** in the Agora Console
3. **Enable App Certificate** in the project's security settings
4. **Copy your App ID and App Certificate**
5. **Add two secrets** to the Lovable project: `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE`

## Edge Function (You Create Manually)

Since you'll create edge functions yourself, here is the complete code for the token generator:

**File: `supabase/functions/agora-token/index.ts`**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Agora token generation implemented inline (no npm dependency needed in Deno)
// Uses AccessToken2 / RtcTokenBuilder2 logic

const VERSION = "007";
const PRIVILEGES = {
  joinChannel: 1,
  publishAudioStream: 2,
  publishVideoStream: 3,
  publishDataStream: 4,
};

function encodeUint16(val: number): Uint8Array {
  const buf = new Uint8Array(2);
  buf[0] = val & 0xff;
  buf[1] = (val >> 8) & 0xff;
  return buf;
}

function encodeUint32(val: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = val & 0xff;
  buf[1] = (val >> 8) & 0xff;
  buf[2] = (val >> 16) & 0xff;
  buf[3] = (val >> 24) & 0xff;
  return buf;
}

function encodeString(str: string): Uint8Array {
  const encoded = new TextEncoder().encode(str);
  const lenBytes = encodeUint16(encoded.length);
  const result = new Uint8Array(lenBytes.length + encoded.length);
  result.set(lenBytes);
  result.set(encoded, lenBytes.length);
  return result;
}

function encodeMapUint32(map: Record<number, number>): Uint8Array {
  const parts: Uint8Array[] = [];
  const entries = Object.entries(map);
  parts.push(encodeUint16(entries.length));
  for (const [k, v] of entries) {
    parts.push(encodeUint16(Number(k)));
    parts.push(encodeUint32(v));
  }
  const total = parts.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  return result;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

async function hmacSign(
  key: Uint8Array,
  data: Uint8Array
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, data);
  return new Uint8Array(sig);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function buildToken(
  appId: string,
  appCert: string,
  channelName: string,
  uid: number,
  expireSeconds: number
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expireTs = expireSeconds > 0 ? now + expireSeconds : 0;

  // Build service: RTC
  const privileges: Record<number, number> = {};
  privileges[PRIVILEGES.joinChannel] = expireTs;
  privileges[PRIVILEGES.publishAudioStream] = expireTs;
  privileges[PRIVILEGES.publishVideoStream] = expireTs;
  privileges[PRIVILEGES.publishDataStream] = expireTs;

  const serviceName = "rtc";
  const serviceContent = concatBytes(
    encodeString(channelName),
    encodeString(String(uid))
  );
  const servicePrivileges = encodeMapUint32(privileges);
  const serviceBytes = concatBytes(
    encodeUint16(1), // service count
    encodeString(serviceName),
    serviceContent,
    servicePrivileges
  );

  // Build message
  const salt = Math.floor(Math.random() * 0xffffffff);
  const issueTs = now;
  const message = concatBytes(
    encodeUint32(salt),
    encodeUint32(issueTs),
    encodeUint32(expireSeconds),
    serviceBytes
  );

  // Sign
  const signing = concatBytes(
    new TextEncoder().encode(appId),
    encodeUint32(issueTs),
    encodeUint32(salt),
    message
  );
  const key = await hmacSign(new TextEncoder().encode(appCert), signing);

  // Compose token
  const compressed = message; // no compression in Deno, message is small
  const compressedLen = encodeUint32(compressed.length);
  const tokenBytes = concatBytes(key, compressedLen, compressed);

  return VERSION + toBase64(tokenBytes);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const AGORA_APP_ID = Deno.env.get("AGORA_APP_ID");
    const AGORA_APP_CERTIFICATE = Deno.env.get("AGORA_APP_CERTIFICATE");

    if (!AGORA_APP_ID || !AGORA_APP_CERTIFICATE) {
      throw new Error("Agora credentials not configured");
    }

    const { channelName, uid } = await req.json();

    if (!channelName || typeof channelName !== "string") {
      return new Response(
        JSON.stringify({ error: "channelName is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!uid || typeof uid !== "number") {
      return new Response(
        JSON.stringify({ error: "uid (number) is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Token valid for 6 hours
    const token = await buildToken(
      AGORA_APP_ID,
      AGORA_APP_CERTIFICATE,
      channelName,
      uid,
      6 * 60 * 60
    );

    return new Response(
      JSON.stringify({ token, appId: AGORA_APP_ID }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating Agora token:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

**Add to `supabase/config.toml`:**
```toml
[functions.agora-token]
verify_jwt = false
```

**Important note about the token generation:** The inline token builder above implements Agora's AccessToken signing algorithm using Web Crypto (available in Deno). This avoids the need for the `agora-token` npm package which has Node.js-specific dependencies. If you encounter any token validation issues, you can alternatively use `npm:agora-token` in the import -- but the inline approach is more reliable in Deno Edge Functions.

**Add secrets:**
- `AGORA_APP_ID` -- from Agora Console
- `AGORA_APP_CERTIFICATE` -- from Agora Console (enable "App Certificate" in project security settings)

## Client-Side Changes (Lovable Will Implement)

### Dependencies
- **Remove:** `livekit-client`, `@livekit/components-react`
- **Add:** `agora-rtc-sdk-ng`

### Files to Create

**`src/hooks/useAgoraRoom.ts`** -- Core replacement for `useLiveKitRoom.ts`

This hook will:
- Call the `agora-token` edge function to get a token and App ID
- Create an Agora RTC client via `AgoraRTC.createClient({ mode: "rtc", codec: "vp8" })`
- Join the channel with `client.join(appId, channelName, token, numericUid)`
- Create a microphone audio track with the user's voice settings (device ID, echo cancellation, noise suppression, AGC, mono audio)
- Publish the local audio track
- Listen for `"user-published"` and `"user-unpublished"` events to subscribe/unsubscribe remote tracks
- Listen for `"user-joined"` and `"user-left"` for join/leave sounds
- Enable `client.enableAudioVolumeIndicator()` for speaking detection
- Handle screen share via `AgoraRTC.createScreenVideoTrack()` with quality presets
- Manage Supabase Presence for sidebar visibility (same as current)
- Expose the exact same return interface as `useLiveKitRoom`:
  - `status`, `error`, `isJoined`, `participants`
  - `localState: { muted, deafened, sharing, shareQuality }`
  - `join`, `leave`, `toggleMute`, `toggleDeafen`
  - `startScreenShare`, `stopScreenShare`, `room`

The participant type will change from `LiveKitParticipant` to `AgoraParticipant` but keep the same shape:
```typescript
export type AgoraParticipant = {
  identity: string;
  name: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isScreenSharing: boolean;
  audioTrack: IRemoteAudioTrack | null;
  screenTrack: MediaStreamTrack | null;
  joinedAt: number;
  hideVoiceActivity: boolean;
};
```

Key Agora API mappings:
- Mute/unmute: `localAudioTrack.setEnabled(bool)`
- Deafen: `remoteAudioTrack.setVolume(0)` / restore volume
- Device switch (input): `localAudioTrack.setDevice(deviceId)`
- Device switch (output): `remoteAudioTrack.setPlaybackDevice(deviceId)`
- Audio processing: applied via `AgoraRTC.createMicrophoneAudioTrack({ AEC, ANS, AGC })` config
- Screen share: `AgoraRTC.createScreenVideoTrack(config, "auto")` returns video + audio tracks
- Speaking detection: `client.enableAudioVolumeIndicator()` + `"volume-indicator"` event

**UID mapping:** Agora uses numeric UIDs. We'll generate a deterministic numeric UID from the user's UUID using a hash function (e.g., first 8 hex chars of UUID parsed as int32). The actual identity mapping (numeric UID to UUID) is tracked client-side and via Supabase Presence.

### Files to Modify

| File | Change |
|---|---|
| `src/components/voice/VoiceChannelArea.tsx` | Change import from `useLiveKitRoom`/`LiveKitParticipant` to `useAgoraRoom`/`AgoraParticipant`. Everything else stays the same. |
| `src/components/voice/ParticipantAudioPlayer.tsx` | Replace LiveKit's `RemoteTrack` type with Agora's `IRemoteAudioTrack`. Use `track.play()` / `track.stop()` and `track.setVolume()` instead of `track.attach()` / element.volume. |
| `src/hooks/usePushToTalk.ts` | Replace `import type { Room } from 'livekit-client'` with a generic `VoiceRoomHandle` interface. The hook receives a `setMicEnabled` callback instead of a Room object. |
| `src/hooks/useHideVoiceActivity.ts` | Replace LiveKit `Room`/`Participant` types with Supabase Broadcast for metadata sync. The `useAgoraRoom` hook will manage a broadcast channel for hideVoiceActivity state. |
| `src/hooks/index.ts` | Replace `useLiveKitRoom` export with `useAgoraRoom`. Remove `usePushToTalk` Room type dependency. |
| `supabase/config.toml` | Remove `[functions.livekit-token]` section |

### Files to Delete

| File | Reason |
|---|---|
| `src/hooks/useLiveKitRoom.ts` | Replaced by `useAgoraRoom.ts` |
| `supabase/functions/livekit-token/index.ts` | Replaced by `agora-token` (created manually) |

### Files That Stay Unchanged

All voice settings UI components, stores, and utility hooks have zero LiveKit dependencies:
- VoiceSettingsPanel, AudioDeviceSelector, VoiceModeSelector, AudioProcessingSection
- VoiceNotificationsSection, VoicePrivacySection, VoiceAccessibilitySection
- ScreenShareQualityModal, UserVolumeControl, MicLevelMeter, PTTKeybindCapture
- SettingsSlider, SettingsToggle, VoicePersistentHost, VoiceConnectedBanner
- voiceStore, voiceSettingsStore, voiceSounds
- useAudioDevices, useAudioLevel, useAutoDisconnect, useVoicePresenceWatchers

## Feature Compatibility

| Feature | How it works with Agora |
|---|---|
| Join/leave voice | `client.join()` / `client.leave()` |
| Mute/unmute | `localAudioTrack.setEnabled(bool)` |
| Deafen | Set all remote track volumes to 0, auto-mute |
| Screen sharing | `AgoraRTC.createScreenVideoTrack()` with quality presets |
| Per-user volume | `remoteAudioTrack.setVolume(0-100)` (native Agora API) |
| Push-to-talk | Same keyboard hooks, calls `setMicEnabled` callback |
| Voice activity / speaking | `enableAudioVolumeIndicator()` + `"volume-indicator"` event |
| Audio device selection | `setDevice()` / `setPlaybackDevice()` |
| Audio processing (NS/EC/AGC) | `createMicrophoneAudioTrack({ AEC, ANS, AGC })` |
| Mono audio | `channelCount: 1` in track config |
| Join/leave sounds | `"user-joined"` / `"user-left"` events |
| Hide voice activity | Supabase Broadcast (same channel used for typing) |
| Auto-disconnect | Same hook, no changes |
| Presence in sidebar | Same Supabase Presence, no changes |
| Screen share quality presets | Same resolution/framerate constraints |
| Mute on join | Track starts disabled |
| PTT sounds | Same sound utility |

## Implementation Order

1. Install `agora-rtc-sdk-ng`, remove `livekit-client` and `@livekit/components-react`
2. Create `src/hooks/useAgoraRoom.ts` with full implementation
3. Update `ParticipantAudioPlayer.tsx` for Agora track API
4. Update `usePushToTalk.ts` to use generic interface
5. Update `useHideVoiceActivity.ts` to use Supabase Broadcast
6. Update `VoiceChannelArea.tsx` imports
7. Update `src/hooks/index.ts` exports
8. Delete `src/hooks/useLiveKitRoom.ts`
9. Delete `supabase/functions/livekit-token/index.ts`
10. Remove livekit-token from `supabase/config.toml`

