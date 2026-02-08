/**
 * Audio Devices Hook
 * Manages audio device enumeration and selection
 */

import { useState, useEffect, useCallback } from 'react';
import { AudioDevice } from '@/types/voiceSettings';

interface UseAudioDevicesReturn {
  inputDevices: AudioDevice[];
  outputDevices: AudioDevice[];
  isLoading: boolean;
  error: string | null;
  hasPermission: boolean;
  supportsOutputSelection: boolean;
  requestPermission: () => Promise<boolean>;
  refreshDevices: () => Promise<void>;
}

export function useAudioDevices(): UseAudioDevicesReturn {
  const [inputDevices, setInputDevices] = useState<AudioDevice[]>([]);
  const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  // Check if browser supports output device selection
  const supportsOutputSelection = typeof HTMLMediaElement !== 'undefined' && 
    'setSinkId' in HTMLMediaElement.prototype;

  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const inputs: AudioDevice[] = [];
      const outputs: AudioDevice[] = [];

      // Check if we have permission (labels are only available with permission)
      const hasLabels = devices.some(d => d.label && d.label.length > 0);
      setHasPermission(hasLabels);

      // Clean device label: strip trailing hardware IDs like "(1b1c:0a69)"
      const cleanLabel = (label: string): string =>
        label.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*/gi, '').trim();

      // Track seen labels to deduplicate
      const seenInputLabels = new Set<string>();
      const seenOutputLabels = new Set<string>();

      devices.forEach((device, index) => {
        if (device.kind === 'audioinput') {
          const label = cleanLabel(device.label) || `Microphone ${index + 1}`;
          if (!seenInputLabels.has(label)) {
            seenInputLabels.add(label);
            inputs.push({
              deviceId: device.deviceId,
              label,
              kind: 'audioinput',
              isDefault: device.deviceId === 'default' || index === 0,
            });
          }
        } else if (device.kind === 'audiooutput') {
          const label = cleanLabel(device.label) || `Speaker ${index + 1}`;
          if (!seenOutputLabels.has(label)) {
            seenOutputLabels.add(label);
            outputs.push({
              deviceId: device.deviceId,
              label,
              kind: 'audiooutput',
              isDefault: device.deviceId === 'default' || index === 0,
            });
          }
        }
      });

      setInputDevices(inputs);
      setOutputDevices(outputs);
      setError(null);
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
      setError(err instanceof Error ? err.message : 'Failed to get audio devices');
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop all tracks immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());
      setHasPermission(true);
      await enumerateDevices();
      return true;
    } catch (err) {
      console.error('Failed to get microphone permission:', err);
      setError('Microphone access denied');
      return false;
    }
  }, [enumerateDevices]);

  const refreshDevices = useCallback(async () => {
    setIsLoading(true);
    await enumerateDevices();
    setIsLoading(false);
  }, [enumerateDevices]);

  // Initial enumeration
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await enumerateDevices();
      setIsLoading(false);
    };
    init();
  }, [enumerateDevices]);

  // Listen for device changes
  useEffect(() => {
    const handleDeviceChange = () => {
      enumerateDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [enumerateDevices]);

  return {
    inputDevices,
    outputDevices,
    isLoading,
    error,
    hasPermission,
    supportsOutputSelection,
    requestPermission,
    refreshDevices,
  };
}
