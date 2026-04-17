import { Bell } from "@phosphor-icons/react";
/**
 * Voice Notifications Section Component
 * Toggles for join/leave sounds, PTT activation, and visual-only mode
 */


import { SettingsToggle } from './SettingsToggle';
import { cn } from '@/lib/utils';

interface VoiceNotificationsSectionProps {
 joinLeaveSound: boolean;
 pttActivationSound: boolean;
 visualOnlyMode: boolean;
 voiceMode: 'voice_activity' | 'push_to_talk';
 onJoinLeaveSoundChange: (enabled: boolean) => void;
 onPttActivationSoundChange: (enabled: boolean) => void;
 onVisualOnlyModeChange: (enabled: boolean) => void;
 className?: string;
}

export function VoiceNotificationsSection({
 joinLeaveSound,
 pttActivationSound,
 visualOnlyMode,
 voiceMode,
 onJoinLeaveSoundChange,
 onPttActivationSoundChange,
 onVisualOnlyModeChange,
 className,
}: VoiceNotificationsSectionProps) {
 return (
 <div className={cn('space-y-1', className)}>
 <div className="flex items-center gap-2 mb-3">
 <Bell className="h-4 w-4 text-muted-foreground" />
 <h3 className="text-sm font-medium text-foreground">Notifications & Feedback</h3>
 </div>

 <SettingsToggle
 checked={joinLeaveSound}
 onChange={onJoinLeaveSoundChange}
 label="Join/Leave Sounds"
 description="Play a sound when users join or leave the voice channel"
 disabled={visualOnlyMode}
 />

 {voiceMode === 'push_to_talk' && (
 <SettingsToggle
 checked={pttActivationSound}
 onChange={onPttActivationSoundChange}
 label="PTT Activation Sound"
 description="Play a short sound when your mic activates via Push to Talk"
 disabled={visualOnlyMode}
 />
 )}

 <SettingsToggle
 checked={visualOnlyMode}
 onChange={onVisualOnlyModeChange}
 label="Visual Only Mode"
 description="Mute all voice notification sounds. You'll still see visual indicators"
 />
 </div>
 );
}
