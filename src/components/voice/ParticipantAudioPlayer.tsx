/**
 * Participant Audio Player using LiveKit's track.attach() API
 * Uses LiveKit's built-in audio element creation for reliable playback
 * and setVolume() for per-user volume control.
 */

import { useEffect, useRef, useCallback } from 'react';
import type { RemoteTrack } from 'livekit-client';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';

interface ParticipantAudioPlayerProps {
  participantId: string;
  track: RemoteTrack;
  muted: boolean; // Global deafen state
}

export function ParticipantAudioPlayer({
  participantId,
  track,
  muted,
}: ParticipantAudioPlayerProps) {
  const elementRef = useRef<HTMLMediaElement | null>(null);

  const userVolume = useVoiceSettingsStore((s) => s.getUserVolume(participantId));
  const outputVolume = useVoiceSettingsStore((s) => s.settings.outputVolume);

  const calculateVolume = useCallback(() => {
    if (muted) return 0;
    return Math.min(1, (userVolume / 100) * (outputVolume / 100));
  }, [userVolume, outputVolume, muted]);

  // Attach/detach the LiveKit track
  useEffect(() => {
    if (!track) return;

    // LiveKit's attach() creates an <audio> element and handles playback
    const element = track.attach();
    element.volume = calculateVolume();
    elementRef.current = element;

    return () => {
      track.detach(element);
      element.remove();
      elementRef.current = null;
    };
  }, [track]);

  // Update volume reactively
  useEffect(() => {
    if (elementRef.current) {
      elementRef.current.volume = calculateVolume();
    }
  }, [calculateVolume]);

  return null;
}
