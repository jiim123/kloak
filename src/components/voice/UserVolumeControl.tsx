import { ArrowCounterClockwise, SpeakerHigh, SpeakerSlash, User } from "@phosphor-icons/react";
/**
 * User Volume Control Component
 * Per-user volume slider for voice channels (context menu)
 */

import { useState, useCallback } from 'react';

import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';
import { cn } from '@/lib/utils';

interface UserVolumeControlProps {
 userId: string;
 userName: string;
 className?: string;
 onClose?: () => void;
}

export function UserVolumeControl({
 userId,
 userName,
 className,
 onClose,
}: UserVolumeControlProps) {
 const { getUserVolume, setUserVolume } = useVoiceSettingsStore();
 const currentVolume = getUserVolume(userId);
 const [localVolume, setLocalVolume] = useState(currentVolume);

 const handleVolumeChange = useCallback((value: number) => {
 setLocalVolume(value);
 setUserVolume(userId, value);
 }, [userId, setUserVolume]);

 const handleReset = useCallback(() => {
 setLocalVolume(100);
 setUserVolume(userId, 100);
 }, [userId, setUserVolume]);

 const isMuted = localVolume === 0;
 const isModified = localVolume !== 100;

 return (
 <div className={cn('p-3 space-y-3 min-w-[200px]', className)}>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 {isMuted ? (
 <SpeakerSlash className="h-4 w-4 text-destructive" />
 ) : (
 <SpeakerHigh className="h-4 w-4 text-muted-foreground" />
 )}
 <span className="text-sm font-medium text-foreground truncate max-w-[120px]">
 {userName}
 </span>
 </div>
 <span className="text-sm font-mono text-muted-foreground tabular-nums">
 {localVolume}%
 </span>
 </div>

 <Slider
 value={[localVolume]}
 onValueChange={([v]) => handleVolumeChange(v)}
 min={0}
 max={100}
 step={5}
 className="w-full"
 />

 <div className="flex items-center justify-between text-xs text-muted-foreground">
 <span>0%</span>
 <span>100%</span>
 </div>

 {isModified && (
 <Button
 variant="ghost"
 size="sm"
 className="w-full gap-2 text-xs"
 onClick={handleReset}
 >
 <ArrowCounterClockwise className="h-3 w-3" />
 Reset to default
 </Button>
 )}
 </div>
 );
}

/**
 * Volume indicator icon for participant list
 * Shows modified icon if user has custom volume
 */
interface VolumeIndicatorProps {
 userId: string;
 className?: string;
}

export function VolumeIndicator({ userId, className }: VolumeIndicatorProps) {
 const { getUserVolume } = useVoiceSettingsStore();
 const volume = getUserVolume(userId);

 if (volume === 100) return null;

 const isMuted = volume === 0;
 const isLow = volume < 100;
 const isHigh = false;

 return (
 <div
 className={cn(
 'flex items-center gap-0.5 text-xs',
 isMuted && 'text-destructive',
 isLow && !isMuted && 'text-amber-500',
 className
 )}
 >
 {isMuted ? (
 <SpeakerSlash className="h-3 w-3" />
 ) : (
 <>
 <SpeakerHigh className="h-3 w-3" />
 <span className="font-mono">{volume}%</span>
 </>
 )}
 </div>
 );
}
