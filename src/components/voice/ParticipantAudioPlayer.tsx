/**
 * Participant Audio Player with Per-User Volume Control
 * Uses a standard <audio> element for reliable cross-browser playback
 * and controls volume via the HTMLAudioElement.volume property.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';

interface ParticipantAudioPlayerProps {
  participantId: string;
  track: MediaStreamTrack;
  muted: boolean; // Global deafen state
}

export function ParticipantAudioPlayer({
  participantId,
  track,
  muted,
}: ParticipantAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Get per-user volume from settings store
  const userVolume = useVoiceSettingsStore((s) => s.getUserVolume(participantId));
  const outputVolume = useVoiceSettingsStore((s) => s.settings.outputVolume);

  // Calculate the final volume (0-1 range for HTMLAudioElement)
  const calculateVolume = useCallback(() => {
    if (muted) return 0;
    // Both values are 0-200 percentages; cap the result at 1.0 for the audio element
    // (values above 100% are best-effort – browsers clamp volume to 1.0)
    return Math.min(1, (userVolume / 100) * (outputVolume / 100));
  }, [userVolume, outputVolume, muted]);

  // Attach the track to the audio element
  useEffect(() => {
    if (!track) return;

    const audio = new Audio();
    audio.autoplay = true;
    // Some browsers need the element in the DOM to play
    audio.style.display = 'none';
    document.body.appendChild(audio);

    const stream = new MediaStream([track]);
    audio.srcObject = stream;
    audio.volume = calculateVolume();
    audio.play().catch(() => {});

    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      audioRef.current = null;
    };
  }, [track]);

  // Update volume when settings change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = calculateVolume();
    }
  }, [calculateVolume]);

  // This component doesn't render anything visible
  return null;
}
