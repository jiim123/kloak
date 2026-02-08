/**
 * Audio Level Hook
 * Real-time audio level monitoring for mic testing
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseAudioLevelOptions {
  deviceId?: string | null;
  smoothingTimeConstant?: number;
  fftSize?: number;
}

interface UseAudioLevelReturn {
  level: number; // 0-1
  isTesting: boolean;
  error: string | null;
  startTest: () => Promise<void>;
  stopTest: () => void;
}

export function useAudioLevel(options: UseAudioLevelOptions = {}): UseAudioLevelReturn {
  const { deviceId, smoothingTimeConstant = 0.8, fftSize = 256 } = options;

  const [level, setLevel] = useState(0);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    dataArrayRef.current = null;
    setLevel(0);
  }, []);

  const updateLevel = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    analyserRef.current.getByteFrequencyData(dataArrayRef.current as any);

    // Calculate RMS (root mean square) for more accurate level
    let sum = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      const value = dataArrayRef.current[i] / 255;
      sum += value * value;
    }
    const rms = Math.sqrt(sum / dataArrayRef.current.length);

    // Apply a curve for better visual representation
    const normalizedLevel = Math.min(1, rms * 2);
    setLevel(normalizedLevel);

    animationFrameRef.current = requestAnimationFrame(updateLevel);
  }, []);

  const startTest = useCallback(async () => {
    cleanup();
    setError(null);

    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.smoothingTimeConstant = smoothingTimeConstant;
      analyser.fftSize = fftSize;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(analyser);

      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      setIsTesting(true);
      updateLevel();
    } catch (err) {
      console.error('Failed to start audio level test:', err);
      const message = err instanceof Error ? err.message : 'Failed to access microphone';
      setError(message);
      cleanup();
    }
  }, [deviceId, smoothingTimeConstant, fftSize, cleanup, updateLevel]);

  const stopTest = useCallback(() => {
    cleanup();
    setIsTesting(false);
    setError(null);
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Restart test if device changes while testing
  useEffect(() => {
    if (isTesting && deviceId !== undefined) {
      startTest();
    }
  }, [deviceId]); // Only re-run when deviceId changes

  return {
    level,
    isTesting,
    error,
    startTest,
    stopTest,
  };
}
