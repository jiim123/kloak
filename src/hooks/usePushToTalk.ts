/**
 * Push to Talk Hook
 * Handles global keyboard events for PTT functionality
 */

import { useEffect, useCallback, useRef } from 'react';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';
import { playPTTActivateSound, playPTTDeactivateSound } from '@/lib/voiceSounds';
import type { Room } from 'livekit-client';

interface UsePushToTalkOptions {
  room: Room | null;
  isConnected: boolean;
  onMuteChange?: (muted: boolean) => void;
}

// Parse keybind string to match keyboard event
function matchesKeybind(event: KeyboardEvent, keybind: string): boolean {
  const parts = keybind.split('+').map(p => p.trim().toLowerCase());
  const key = parts[parts.length - 1];
  const needsCtrl = parts.includes('ctrl') || parts.includes('control');
  const needsAlt = parts.includes('alt');
  const needsShift = parts.includes('shift');
  const needsMeta = parts.includes('meta') || parts.includes('cmd') || parts.includes('command');

  // Check modifiers
  if (needsCtrl !== event.ctrlKey) return false;
  if (needsAlt !== event.altKey) return false;
  if (needsShift !== event.shiftKey) return false;
  if (needsMeta !== event.metaKey) return false;

  // Check key
  const eventKey = event.key.toLowerCase();
  const eventCode = event.code.toLowerCase();
  
  // Handle special key names
  if (key === 'space') return eventCode === 'space' || eventKey === ' ';
  if (key === 'enter') return eventKey === 'enter';
  if (key === 'escape' || key === 'esc') return eventKey === 'escape';
  if (key === 'backspace') return eventKey === 'backspace';
  if (key === 'tab') return eventKey === 'tab';
  
  return eventKey === key || eventCode === `key${key}`;
}

export function usePushToTalk({ room, isConnected, onMuteChange }: UsePushToTalkOptions) {
  const settings = useVoiceSettingsStore((s) => s.settings);
  const isPTTMode = settings.voiceMode === 'push_to_talk';
  const isToggleMode = settings.pttMode === 'toggle';
  const keybind = settings.pttKeybind;
  
  // Track PTT state for toggle mode
  const isPTTActiveRef = useRef(false);
  const isHoldingRef = useRef(false);

  const setMicEnabled = useCallback(async (enabled: boolean) => {
    if (!room?.localParticipant) return;
    
    try {
      await room.localParticipant.setMicrophoneEnabled(enabled);
      onMuteChange?.(!enabled);

      // Play PTT activation/deactivation sound if enabled
      const settings = useVoiceSettingsStore.getState().settings;
      if (settings.pttActivationSound && !settings.visualOnlyMode) {
        if (enabled) {
          playPTTActivateSound();
        } else {
          playPTTDeactivateSound();
        }
      }
    } catch (err) {
      console.error('Failed to set microphone state:', err);
    }
  }, [room, onMuteChange]);

  useEffect(() => {
    if (!isConnected || !isPTTMode || !room) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in an input
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (!matchesKeybind(event, keybind)) return;

      event.preventDefault();

      if (isToggleMode) {
        // Toggle mode: press to toggle on/off
        if (!event.repeat) {
          isPTTActiveRef.current = !isPTTActiveRef.current;
          setMicEnabled(isPTTActiveRef.current);
        }
      } else {
        // Hold mode: key down = mic on
        if (!isHoldingRef.current) {
          isHoldingRef.current = true;
          setMicEnabled(true);
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!matchesKeybind(event, keybind)) return;

      if (!isToggleMode && isHoldingRef.current) {
        // Hold mode: key up = mic off
        isHoldingRef.current = false;
        setMicEnabled(false);
      }
    };

    // When entering PTT mode while connected, ensure mic starts muted
    if (isPTTMode && !isPTTActiveRef.current && !isHoldingRef.current) {
      setMicEnabled(false);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      // Reset state on cleanup
      isHoldingRef.current = false;
    };
  }, [isConnected, isPTTMode, isToggleMode, keybind, room, setMicEnabled]);

  // Reset PTT state when disconnecting
  useEffect(() => {
    if (!isConnected) {
      isPTTActiveRef.current = false;
      isHoldingRef.current = false;
    }
  }, [isConnected]);

  return {
    isPTTMode,
    isPTTActive: isPTTActiveRef.current,
  };
}
