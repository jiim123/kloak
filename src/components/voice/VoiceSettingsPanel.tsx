/**
 * Voice Settings Panel Component
 * Main settings panel for voice chat configuration
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';
import { AudioDeviceSelector } from './AudioDeviceSelector';
import { VoiceModeSelector } from './VoiceModeSelector';
import { AudioProcessingSection } from './AudioProcessingSection';
import { VoiceNotificationsSection } from './VoiceNotificationsSection';
import { VoicePrivacySection } from './VoicePrivacySection';
import { VoiceAccessibilitySection } from './VoiceAccessibilitySection';
import { cn } from '@/lib/utils';

interface VoiceSettingsPanelProps {
  className?: string;
}

export function VoiceSettingsPanel({ className }: VoiceSettingsPanelProps) {
  const { settings, isLoading, updateSetting, resetToDefaults } = useVoiceSettingsStore();
  const [showSaved, setShowSaved] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Show saved indicator briefly after changes
  const triggerSavedIndicator = useCallback(() => {
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 1500);
  }, []);

  const handleReset = useCallback(async () => {
    setIsResetting(true);
    await resetToDefaults();
    setIsResetting(false);
    triggerSavedIndicator();
  }, [resetToDefaults, triggerSavedIndicator]);

  // Wrapper to trigger saved indicator on changes
  const update = useCallback(<K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    updateSetting(key, value);
    triggerSavedIndicator();
  }, [updateSetting, triggerSavedIndicator]);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Saved Indicator */}
      <AnimatePresence>
        {showSaved && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground shadow-lg"
          >
            <Check className="h-4 w-4" />
            <span className="text-sm font-medium">Saved</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section: Audio Devices */}
      <section className="p-4 rounded-xl bg-secondary/30 border border-border/50">
        <h2 className="text-sm font-medium text-foreground mb-4">Audio Devices</h2>
        <AudioDeviceSelector
          inputDeviceId={settings.inputDeviceId}
          outputDeviceId={settings.outputDeviceId}
          inputGain={settings.inputGain}
          outputVolume={settings.outputVolume}
          voiceActivityThreshold={settings.voiceActivityThreshold}
          showThreshold={settings.voiceMode === 'voice_activity'}
          onInputDeviceChange={(v) => update('inputDeviceId', v)}
          onOutputDeviceChange={(v) => update('outputDeviceId', v)}
          onInputGainChange={(v) => update('inputGain', v)}
          onOutputVolumeChange={(v) => update('outputVolume', v)}
        />
      </section>

      {/* Section: Voice Mode */}
      <section className="p-4 rounded-xl bg-secondary/30 border border-border/50">
        <h2 className="text-sm font-medium text-foreground mb-4">Voice Mode</h2>
        <VoiceModeSelector
          voiceMode={settings.voiceMode}
          voiceActivityThreshold={settings.voiceActivityThreshold}
          pttKeybind={settings.pttKeybind}
          pttMode={settings.pttMode}
          onVoiceModeChange={(v) => update('voiceMode', v)}
          onThresholdChange={(v) => update('voiceActivityThreshold', v)}
          onKeybindChange={(v) => update('pttKeybind', v)}
          onPttModeChange={(v) => update('pttMode', v)}
        />
      </section>

      {/* Section: Audio Processing */}
      <section className="p-4 rounded-xl bg-secondary/30 border border-border/50">
        <AudioProcessingSection
          noiseSuppression={settings.noiseSuppression}
          echoCancellation={settings.echoCancellation}
          autoGainControl={settings.autoGainControl}
          onNoiseSuppressionChange={(v) => update('noiseSuppression', v)}
          onEchoCancellationChange={(v) => update('echoCancellation', v)}
          onAutoGainControlChange={(v) => update('autoGainControl', v)}
        />
      </section>

      {/* Section: Notifications */}
      <section className="p-4 rounded-xl bg-secondary/30 border border-border/50">
        <VoiceNotificationsSection
          joinLeaveSound={settings.joinLeaveSound}
          pttActivationSound={settings.pttActivationSound}
          visualOnlyMode={settings.visualOnlyMode}
          voiceMode={settings.voiceMode}
          onJoinLeaveSoundChange={(v) => update('joinLeaveSound', v)}
          onPttActivationSoundChange={(v) => update('pttActivationSound', v)}
          onVisualOnlyModeChange={(v) => update('visualOnlyMode', v)}
        />
      </section>

      {/* Section: Privacy */}
      <section className="p-4 rounded-xl bg-secondary/30 border border-border/50">
        <VoicePrivacySection
          muteOnJoin={settings.muteOnJoin}
          autoDisconnectMinutes={settings.autoDisconnectMinutes}
          hideVoiceActivity={settings.hideVoiceActivity}
          onMuteOnJoinChange={(v) => update('muteOnJoin', v)}
          onAutoDisconnectChange={(v) => update('autoDisconnectMinutes', v)}
          onHideVoiceActivityChange={(v) => update('hideVoiceActivity', v)}
        />
      </section>

      {/* Section: Accessibility */}
      <section className="p-4 rounded-xl bg-secondary/30 border border-border/50">
        <VoiceAccessibilitySection
          visualVoiceIndicators={settings.visualVoiceIndicators}
          monoAudio={settings.monoAudio}
          onVisualVoiceIndicatorsChange={(v) => update('visualVoiceIndicators', v)}
          onMonoAudioChange={(v) => update('monoAudio', v)}
        />
      </section>

      {/* Reset to Defaults */}
      <div className="flex justify-end pt-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={isResetting}
            >
              {isResetting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Reset to Defaults
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Voice Settings?</AlertDialogTitle>
              <AlertDialogDescription>
                This will reset all voice settings to their default values. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReset}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Reset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
