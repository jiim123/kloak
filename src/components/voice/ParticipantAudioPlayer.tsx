/**
 * Participant Audio Player with Per-User Volume Control
 * Uses Web Audio API GainNode to apply individual volume overrides
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Get per-user volume from settings store
  const userVolume = useVoiceSettingsStore((s) => s.getUserVolume(participantId));
  const outputVolume = useVoiceSettingsStore((s) => s.settings.outputVolume);

  // Calculate the final gain value (both per-user and global output volume)
  const calculateGain = useCallback(() => {
    if (muted) return 0;
    // Both values are 0-200 percentages, so normalize to 0-2 and multiply
    return (userVolume / 100) * (outputVolume / 100);
  }, [userVolume, outputVolume, muted]);

  // Set up Web Audio API pipeline
  useEffect(() => {
    if (!track) return;

    // Create audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioContext;

    // Create stream from track
    const stream = new MediaStream([track]);

    // Create source node from stream
    const sourceNode = audioContext.createMediaStreamSource(stream);
    sourceNodeRef.current = sourceNode;

    // Create gain node for volume control
    const gainNode = audioContext.createGain();
    gainNode.gain.value = calculateGain();
    gainNodeRef.current = gainNode;

    // Connect: source -> gain -> destination
    sourceNode.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Resume context if suspended (browsers require user interaction)
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }

    return () => {
      // Cleanup
      try {
        sourceNode.disconnect();
        gainNode.disconnect();
        audioContext.close();
      } catch {
        // Ignore cleanup errors
      }
      audioContextRef.current = null;
      gainNodeRef.current = null;
      sourceNodeRef.current = null;
    };
  }, [track]);

  // Update gain when volume changes
  useEffect(() => {
    const gainNode = gainNodeRef.current;
    if (!gainNode) return;

    const newGain = calculateGain();
    
    // Smooth transition to avoid clicks
    gainNode.gain.setTargetAtTime(
      newGain,
      audioContextRef.current?.currentTime ?? 0,
      0.015 // 15ms time constant for smooth transition
    );
  }, [calculateGain]);

  // Handle mute state changes
  useEffect(() => {
    const gainNode = gainNodeRef.current;
    if (!gainNode) return;

    const newGain = calculateGain();
    gainNode.gain.setTargetAtTime(
      newGain,
      audioContextRef.current?.currentTime ?? 0,
      0.015
    );
  }, [muted, calculateGain]);

  // This component doesn't render anything visible - it just processes audio
  return null;
}
