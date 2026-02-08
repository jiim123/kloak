/**
 * Hide Voice Activity Hook
 * Manages the hideVoiceActivity setting via LiveKit participant metadata
 */

import { useEffect, useCallback, useMemo } from 'react';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';
import type { Room, Participant } from 'livekit-client';

interface UseHideVoiceActivityOptions {
  room: Room | null;
  isConnected: boolean;
}

interface VoiceMetadata {
  hideVoiceActivity?: boolean;
}

// Parse participant metadata safely
function parseMetadata(participant: Participant): VoiceMetadata {
  try {
    if (!participant.metadata) return {};
    return JSON.parse(participant.metadata) as VoiceMetadata;
  } catch {
    return {};
  }
}

export function useHideVoiceActivity({ room, isConnected }: UseHideVoiceActivityOptions) {
  const hideVoiceActivity = useVoiceSettingsStore((s) => s.settings.hideVoiceActivity);

  // Update local participant metadata when setting changes
  const updateMetadata = useCallback(async () => {
    if (!room?.localParticipant || !isConnected) return;

    try {
      const currentMetadata = parseMetadata(room.localParticipant);
      const newMetadata: VoiceMetadata = {
        ...currentMetadata,
        hideVoiceActivity,
      };
      await room.localParticipant.setMetadata(JSON.stringify(newMetadata));
    } catch (err) {
      console.error('Failed to update voice activity metadata:', err);
    }
  }, [room, isConnected, hideVoiceActivity]);

  // Update metadata when connected or when setting changes
  useEffect(() => {
    if (isConnected && room) {
      updateMetadata();
    }
  }, [isConnected, hideVoiceActivity, updateMetadata]);

  return { updateMetadata };
}

/**
 * Check if a participant has hidden their voice activity
 */
export function shouldShowSpeakingIndicator(
  participant: Participant,
  isSpeaking: boolean,
  localUserId?: string
): boolean {
  // Always show for the local user (they can see their own indicator)
  if (participant.identity === localUserId) {
    return isSpeaking;
  }

  // Check if participant has hidden their voice activity
  const metadata = parseMetadata(participant);
  if (metadata.hideVoiceActivity) {
    return false;
  }

  return isSpeaking;
}

/**
 * Hook to get whether voice activity should be shown for a participant
 */
export function useParticipantSpeaking(
  participant: Participant | null,
  localUserId?: string
): boolean {
  return useMemo(() => {
    if (!participant) return false;
    return shouldShowSpeakingIndicator(participant, participant.isSpeaking, localUserId);
  }, [participant, participant?.isSpeaking, participant?.metadata, localUserId]);
}
