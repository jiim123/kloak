/**
 * Voice Mode Selector Component
 * Toggle between Voice Activity and Push-to-Talk modes
 */

import { motion } from 'framer-motion';
import { Mic, Hand } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VoiceMode, PTTMode } from '@/types/voiceSettings';
import { SettingsSlider } from './SettingsSlider';
import { PTTKeybindCapture } from './PTTKeybindCapture';

interface VoiceModeSelectorProps {
  voiceMode: VoiceMode;
  voiceActivityThreshold: number;
  pttKeybind: string;
  pttMode: PTTMode;
  onVoiceModeChange: (mode: VoiceMode) => void;
  onThresholdChange: (threshold: number) => void;
  onKeybindChange: (keybind: string) => void;
  onPttModeChange: (mode: PTTMode) => void;
  className?: string;
}

export function VoiceModeSelector({
  voiceMode,
  voiceActivityThreshold,
  pttKeybind,
  pttMode,
  onVoiceModeChange,
  onThresholdChange,
  onKeybindChange,
  onPttModeChange,
  className,
}: VoiceModeSelectorProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Mode Cards */}
      <div className="grid grid-cols-2 gap-3">
        <ModeCard
          icon={<Mic className="h-5 w-5" />}
          title="Voice Activity"
          description="Speak freely, mic activates automatically"
          isSelected={voiceMode === 'voice_activity'}
          onClick={() => onVoiceModeChange('voice_activity')}
        />
        <ModeCard
          icon={<Hand className="h-5 w-5" />}
          title="Push to Talk"
          description="Hold a key to transmit"
          isSelected={voiceMode === 'push_to_talk'}
          onClick={() => onVoiceModeChange('push_to_talk')}
        />
      </div>

      {/* Voice Activity Settings */}
      {voiceMode === 'voice_activity' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-4 pt-2"
        >
          <SettingsSlider
            value={voiceActivityThreshold}
            onChange={onThresholdChange}
            min={0}
            max={100}
            label="Sensitivity"
            description="Lower = more sensitive (picks up quieter sounds)"
            valueFormatter={(v) => {
              if (v < 30) return 'High';
              if (v < 70) return 'Medium';
              return 'Low';
            }}
          />
        </motion.div>
      )}

      {/* Push to Talk Settings */}
      {voiceMode === 'push_to_talk' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-4 pt-2"
        >
          <PTTKeybindCapture
            keybind={pttKeybind}
            onChange={onKeybindChange}
          />

          {/* PTT Mode Toggle */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Mode</label>
            <div className="flex rounded-lg bg-muted p-1">
              <button
                onClick={() => onPttModeChange('hold')}
                className={cn(
                  'flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  pttMode === 'hold'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Hold
              </button>
              <button
                onClick={() => onPttModeChange('toggle')}
                className={cn(
                  'flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  pttMode === 'toggle'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Toggle
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {pttMode === 'hold'
                ? 'Hold the key to transmit, release to stop'
                : 'Press once to start, press again to stop'}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

interface ModeCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  isSelected: boolean;
  onClick: () => void;
}

function ModeCard({ icon, title, description, isSelected, onClick }: ModeCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200',
        'hover:bg-white/5',
        isSelected
          ? 'border-primary bg-primary/10'
          : 'border-border/50 bg-transparent'
      )}
    >
      <div
        className={cn(
          'p-2 rounded-lg transition-colors',
          isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        )}
      >
        {icon}
      </div>
      <div className="text-center">
        <p className={cn('text-sm font-medium', isSelected && 'text-primary')}>
          {title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
          {description}
        </p>
      </div>
      {isSelected && (
        <motion.div
          layoutId="voice-mode-indicator"
          className="absolute inset-0 rounded-xl border-2 border-primary pointer-events-none"
        />
      )}
    </button>
  );
}
