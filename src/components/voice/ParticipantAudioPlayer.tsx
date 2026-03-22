/**
 * Participant Audio Player using LiveKit RemoteAudioTrack
 * Single owner of remote audio playback — attaches/detaches an <audio> element and sets volume/output device.
 */

import { useEffect, useRef } from 'react';
import type { RemoteAudioTrack } from 'livekit-client';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';

interface ParticipantAudioPlayerProps {
  participantId: string;
  track: RemoteAudioTrack;
  muted: boolean; // Global deafen state
}

export function ParticipantAudioPlayer({
  participantId,
  track,
  muted,
}: ParticipantAudioPlayerProps) {
  const userVolume = useVoiceSettingsStore((s) => s.getUserVolume(participantId));
  const outputVolume = useVoiceSettingsStore((s) => s.settings.outputVolume);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Own audio playback lifecycle
  useEffect(() => {
    if (!track) return;
    const el = audioRef.current;
    try {
      if (el) track.attach(el);
    } catch (e) {
      console.warn('[AudioPlayer] Failed to play track:', e);
    }
    return () => {
      try {
        if (el) track.detach(el);
        else track.detach();
      } catch { /* track may already be cleaned up */ }
    };
  }, [track]);

  // Set volume reactively
  useEffect(() => {
    if (!track) return;
    if (muted) {
      track.setVolume(0);
    } else {
      // LiveKit RemoteAudioTrack.setVolume ultimately drives HTMLMediaElement.volume (range 0..1).
      // Clamp hard to avoid IndexSizeError crashes for users who set >100% volumes.
      const vol = (userVolume / 100) * (outputVolume / 100);
      track.setVolume(Math.min(Math.max(vol, 0), 1));
    }
  }, [track, userVolume, outputVolume, muted]);

  // Output device routing is handled centrally via room.switchActiveDevice("audiooutput", ...).
  // Avoid per-track setSinkId to prevent races when tracks are replaced during participant joins.

  return <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />;
}
