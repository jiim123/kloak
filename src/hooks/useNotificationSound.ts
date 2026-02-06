import { useCallback, useRef } from 'react';
import { useUIStore } from '@/stores/uiStore';
import notificationSound from '@/assets/notification-sound.mp3';

export type NotificationType = 'server_mention' | 'user_mention' | 'reply' | 'dm' | 'general';

/**
 * Hook for playing notification sounds with volume control and type-based filtering.
 * The sound will only play if the main sound toggle is enabled AND the specific type toggle is enabled.
 */
export const useNotificationSound = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const {
    notificationSoundEnabled,
    notificationSoundServerMentions,
    notificationSoundUserMentions,
    notificationSoundReplies,
    notificationVolume,
  } = useUIStore();

  const playSound = useCallback((type: NotificationType = 'general') => {
    // Master toggle check
    if (!notificationSoundEnabled) return;

    // Type-specific checks
    switch (type) {
      case 'server_mention':
        if (!notificationSoundServerMentions) return;
        break;
      case 'user_mention':
        if (!notificationSoundUserMentions) return;
        break;
      case 'reply':
        if (!notificationSoundReplies) return;
        break;
      case 'dm':
      case 'general':
        // These always play if master toggle is on
        break;
    }

    try {
      // Create new audio instance for each play to allow overlapping sounds
      const audio = new Audio(notificationSound);
      audio.volume = notificationVolume / 100;
      audioRef.current = audio;
      
      audio.play().catch((error) => {
        // Silently fail if autoplay is blocked
        console.debug('Notification sound blocked:', error);
      });
    } catch (error) {
      console.debug('Failed to play notification sound:', error);
    }
  }, [
    notificationSoundEnabled,
    notificationSoundServerMentions,
    notificationSoundUserMentions,
    notificationSoundReplies,
    notificationVolume,
  ]);

  const playTestSound = useCallback(() => {
    try {
      const audio = new Audio(notificationSound);
      audio.volume = notificationVolume / 100;
      audioRef.current = audio;
      audio.play().catch((error) => {
        console.debug('Test sound blocked:', error);
      });
    } catch (error) {
      console.debug('Failed to play test sound:', error);
    }
  }, [notificationVolume]);

  return { playSound, playTestSound };
};

/**
 * Play notification sound directly without hook (for use outside components)
 */
export const playNotificationSound = (type: NotificationType = 'general') => {
  const state = useUIStore.getState();
  
  if (!state.notificationSoundEnabled) return;

  switch (type) {
    case 'server_mention':
      if (!state.notificationSoundServerMentions) return;
      break;
    case 'user_mention':
      if (!state.notificationSoundUserMentions) return;
      break;
    case 'reply':
      if (!state.notificationSoundReplies) return;
      break;
  }

  try {
    const audio = new Audio(notificationSound);
    audio.volume = state.notificationVolume / 100;
    audio.play().catch(() => {});
  } catch {
    // Silently fail
  }
};
