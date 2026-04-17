/**
 * Audio Processing Section Component
 * Toggles for noise suppression, echo cancellation, and auto gain control
 */

import { Wand2 } from 'lucide-react';
import { SettingsToggle } from './SettingsToggle';
import { cn } from '@/lib/utils';

interface AudioProcessingSectionProps {
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  onNoiseSuppressionChange: (enabled: boolean) => void;
  onEchoCancellationChange: (enabled: boolean) => void;
  onAutoGainControlChange: (enabled: boolean) => void;
  className?: string;
}

export function AudioProcessingSection({
  noiseSuppression,
  echoCancellation,
  autoGainControl,
  onNoiseSuppressionChange,
  onEchoCancellationChange,
  onAutoGainControlChange,
  className,
}: AudioProcessingSectionProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center gap-2 mb-3">
        <Wand2 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-foreground">Audio Processing</h3>
      </div>

      <SettingsToggle
        checked={noiseSuppression}
        onChange={onNoiseSuppressionChange}
        label="Noise Suppression"
        description="Reduces background noise like fans, keyboards, and ambient sound"
      />

      <SettingsToggle
        checked={echoCancellation}
        onChange={onEchoCancellationChange}
        label="Echo Cancellation"
        description="Prevents your speakers from creating echo feedback"
      />

      <SettingsToggle
        checked={autoGainControl}
        onChange={onAutoGainControlChange}
        label="Auto Gain Control"
        description="Automatically adjusts your mic volume for consistent levels"
      />
    </div>
  );
}
