/**
 * Participant Audio Player using Agora's IRemoteAudioTrack API
 * Uses track.play() / track.stop() and track.setVolume() for per-user volume control.
 */

import { useEffect } from 'react';
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

  // Agora tracks are already playing from subscribe — we just manage volume here
  return null;
}
