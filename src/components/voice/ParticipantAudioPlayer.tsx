/**
 * Participant Audio Player using Agora's IRemoteAudioTrack API
 * Single owner of remote audio playback — calls track.play()/stop() and setVolume().
 */

import { useEffect, useRef } from 'react';
import type { IRemoteAudioTrack } from 'agora-rtc-sdk-ng';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';

interface ParticipantAudioPlayerProps {
  participantId: string;
  track: IRemoteAudioTrack;
  muted: boolean; // Global deafen state
}

export function ParticipantAudioPlayer({
  participantId,
  track,
  muted,
}: ParticipantAudioPlayerProps) {
  const userVolume = useVoiceSettingsStore((s) => s.getUserVolume(participantId));
  const outputVolume = useVoiceSettingsStore((s) => s.settings.outputVolume);
  const playingRef = useRef(false);

  // Own audio playback lifecycle
  useEffect(() => {
    if (!track) return;
    try {
      track.play();
      playingRef.current = true;
    } catch (e) {
      console.warn('[AudioPlayer] Failed to play track:', e);
    }
    return () => {
      try {
        track.stop();
      } catch { /* track may already be cleaned up */ }
      playingRef.current = false;
    };
  }, [track]);

  // Set volume reactively (Agora setVolume takes 0-100)
  useEffect(() => {
    if (!track) return;
    if (muted) {
      track.setVolume(0);
    } else {
      const vol = Math.min(100, Math.round((userVolume / 100) * (outputVolume / 100) * 100));
      track.setVolume(vol);
    }
  }, [track, userVolume, outputVolume, muted]);

  return null;
}
