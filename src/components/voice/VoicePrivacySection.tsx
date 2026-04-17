/**
 * Voice Privacy Section Component
 * Privacy-focused settings: mute on join, auto-disconnect, hide activity
 */

import { Shield } from 'lucide-react';
import { SettingsToggle } from './SettingsToggle';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface VoicePrivacySectionProps {
  muteOnJoin: boolean;
  autoDisconnectMinutes: number;
  hideVoiceActivity: boolean;
  onMuteOnJoinChange: (enabled: boolean) => void;
  onAutoDisconnectChange: (minutes: number) => void;
  onHideVoiceActivityChange: (enabled: boolean) => void;
  className?: string;
}

const AUTO_DISCONNECT_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '60 minutes' },
];

export function VoicePrivacySection({
  muteOnJoin,
  autoDisconnectMinutes,
  hideVoiceActivity,
  onMuteOnJoinChange,
  onAutoDisconnectChange,
  onHideVoiceActivityChange,
  className,
}: VoicePrivacySectionProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2 mb-3">
        <Shield className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium text-primary">Privacy</h3>
      </div>

      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
        <SettingsToggle
          checked={muteOnJoin}
          onChange={onMuteOnJoinChange}
          label="Mute on Join"
          description="Always join voice channels muted. Unmute manually when you're ready to speak"
        />

        <div className="space-y-2 py-2">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">Auto-Disconnect</label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automatically disconnect from voice after being idle
              </p>
            </div>
            <Select
              value={String(autoDisconnectMinutes)}
              onValueChange={(v) => onAutoDisconnectChange(Number(v))}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTO_DISCONNECT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <SettingsToggle
          checked={hideVoiceActivity}
          onChange={onHideVoiceActivityChange}
          label="Hide Voice Activity"
          description="Prevent others from seeing your speaking indicator. Your audio still transmits normally"
        />
      </div>
    </div>
  );
}
