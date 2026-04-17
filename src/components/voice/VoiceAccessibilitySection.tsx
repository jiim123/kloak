import { PersonArmsSpread } from "@phosphor-icons/react";
/**
 * Voice PersonArmsSpread Section Component
 * PersonArmsSpread options: visual indicators, mono audio
 */


import { SettingsToggle } from './SettingsToggle';
import { cn } from '@/lib/utils';

interface VoiceAccessibilitySectionProps {
 visualVoiceIndicators: boolean;
 monoAudio: boolean;
 onVisualVoiceIndicatorsChange: (enabled: boolean) => void;
 onMonoAudioChange: (enabled: boolean) => void;
 className?: string;
}

export function VoiceAccessibilitySection({
 visualVoiceIndicators,
 monoAudio,
 onVisualVoiceIndicatorsChange,
 onMonoAudioChange,
 className,
}: VoiceAccessibilitySectionProps) {
 return (
 <div className={cn('space-y-1', className)}>
 <div className="flex items-center gap-2 mb-3">
 <PersonArmsSpread className="h-4 w-4 text-muted-foreground" />
 <h3 className="text-sm font-medium text-foreground">PersonArmsSpread</h3>
 </div>

 <SettingsToggle
 checked={visualVoiceIndicators}
 onChange={onVisualVoiceIndicatorsChange}
 label="Visual Voice Indicators"
 description="Show visual indicators when users are speaking. Helpful for hearing-impaired users"
 />

 <SettingsToggle
 checked={monoAudio}
 onChange={onMonoAudioChange}
 label="Mono Audio"
 description="Combine stereo audio into a single channel. Useful if you're using one earbud"
 />
 </div>
 );
}
