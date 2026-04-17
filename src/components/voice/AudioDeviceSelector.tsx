import { ArrowsClockwise, Microphone, SpeakerHigh, WarningCircle } from "@phosphor-icons/react";
/**
 * Audio Device Selector Component
 * Dropdown for selecting audio input/output devices with mic test
 */

import { useState, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import { useAudioDevices } from '@/hooks/useAudioDevices';
import { useAudioLevel } from '@/hooks/useAudioLevel';
import { MicLevelMeter } from './MicLevelMeter';
import { SettingsSlider } from './SettingsSlider';
import { cn } from '@/lib/utils';

interface AudioDeviceSelectorProps {
 inputDeviceId: string | null;
 outputDeviceId: string | null;
 inputGain: number;
 outputVolume: number;
 onInputDeviceChange: (deviceId: string | null) => void;
 onOutputDeviceChange: (deviceId: string | null) => void;
 onInputGainChange: (gain: number) => void;
 onOutputVolumeChange: (volume: number) => void;
 voiceActivityThreshold?: number;
 showThreshold?: boolean;
 className?: string;
}

export function AudioDeviceSelector({
 inputDeviceId,
 outputDeviceId,
 inputGain,
 outputVolume,
 onInputDeviceChange,
 onOutputDeviceChange,
 onInputGainChange,
 onOutputVolumeChange,
 voiceActivityThreshold,
 showThreshold = false,
 className,
}: AudioDeviceSelectorProps) {
 const {
 inputDevices,
 outputDevices,
 isLoading,
 error: deviceError,
 hasPermission,
 supportsOutputSelection,
 requestPermission,
 refreshDevices,
 } = useAudioDevices();

 const {
 level,
 isTesting,
 error: testError,
 startTest,
 stopTest,
 } = useAudioLevel({ deviceId: inputDeviceId });

 const [isRefreshing, setIsRefreshing] = useState(false);

 const handleRefresh = useCallback(async () => {
 setIsRefreshing(true);
 await refreshDevices();
 setTimeout(() => setIsRefreshing(false), 500);
 }, [refreshDevices]);

 const handleRequestPermission = useCallback(async () => {
 await requestPermission();
 }, [requestPermission]);

 const toggleTest = useCallback(() => {
 if (isTesting) {
 stopTest();
 } else {
 startTest();
 }
 }, [isTesting, startTest, stopTest]);

 const error = deviceError || testError;

 return (
 <div className={cn('space-y-6', className)}>
 {/* Permission required notice */}
 {!hasPermission && !isLoading && (
 <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
 <WarningCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
 <div className="flex-1 text-sm">
 <p className="text-amber-500 font-medium">Microphone access required</p>
 <p className="text-muted-foreground text-xs mt-0.5">
 Grant permission to see your audio devices
 </p>
 </div>
 <Button
 size="sm"
 variant="outline"
 onClick={handleRequestPermission}
 className="flex-shrink-0"
 >
 Grant Access
 </Button>
 </div>
 )}

 {/* Error display */}
 {error && (
 <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
 <WarningCircle className="h-4 w-4 text-destructive" />
 <p className="text-sm text-destructive">{error}</p>
 </div>
 )}

 {/* Input Device */}
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Microphone className="h-4 w-4 text-muted-foreground" />
 <label className="text-sm font-medium text-foreground">Input Device</label>
 </div>
 <Button
 variant="ghost"
 size="icon"
 className="h-7 w-7"
 onClick={handleRefresh}
 disabled={isLoading || isRefreshing}
 >
 <ArrowsClockwise className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
 </Button>
 </div>

 <Select
 value={inputDeviceId || (inputDevices.length > 0 ? inputDevices[0].deviceId : 'default')}
 onValueChange={(v) => onInputDeviceChange(v)}
 disabled={isLoading || !hasPermission}
 >
 <SelectTrigger className="w-full [&>span]:truncate [&>span]:max-w-[calc(100%-24px)]">
 <SelectValue placeholder="Select microphone" />
 </SelectTrigger>
 <SelectContent>
 {inputDevices.filter(d => d.deviceId).map((device) => (
 <SelectItem key={device.deviceId} value={device.deviceId}>
 <span className="truncate">{device.label}</span>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>

 {/* Microphone Test */}
 <div className="space-y-2">
 <div className="flex items-center gap-2">
 <Button
 size="sm"
 variant={isTesting ? 'default' : 'outline'}
 onClick={toggleTest}
 disabled={!hasPermission}
 className="gap-2"
 >
 <Microphone className={cn('h-3.5 w-3.5', isTesting && 'animate-pulse')} />
 {isTesting ? 'Stop Test' : 'Test Microphone'}
 </Button>
 {isTesting && (
 <span className="text-xs text-muted-foreground">Listening...</span>
 )}
 </div>
 {(isTesting || hasPermission) && (
 <MicLevelMeter 
 level={level} 
 threshold={voiceActivityThreshold ? voiceActivityThreshold / 100 : undefined}
 showThreshold={showThreshold && isTesting}
 />
 )}
 </div>

 {/* Input Gain */}
 <SettingsSlider
 value={inputGain}
 onChange={onInputGainChange}
 min={0}
 max={200}
 label="Input Gain"
 description="Adjust your microphone volume"
 />
 </div>

 {/* Output Device */}
 <div className="space-y-3">
 <div className="flex items-center gap-2">
 <SpeakerHigh className="h-4 w-4 text-muted-foreground" />
 <label className="text-sm font-medium text-foreground">Output Device</label>
 </div>

 {supportsOutputSelection ? (
 <Select
 value={outputDeviceId || (outputDevices.length > 0 ? outputDevices[0].deviceId : 'default')}
 onValueChange={(v) => onOutputDeviceChange(v)}
 disabled={isLoading || !hasPermission}
 >
 <SelectTrigger className="w-full [&>span]:truncate [&>span]:max-w-[calc(100%-24px)]">
 <SelectValue placeholder="Select speaker" />
 </SelectTrigger>
 <SelectContent>
 {outputDevices.filter(d => d.deviceId).map((device) => (
 <SelectItem key={device.deviceId} value={device.deviceId}>
 <span className="truncate">{device.label}</span>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 ) : (
 <p className="text-xs text-muted-foreground">
 Output device selection is not supported in this browser
 </p>
 )}

 {/* Output Volume */}
 <SettingsSlider
 value={outputVolume}
 onChange={onOutputVolumeChange}
 min={0}
 max={100}
 label="Output Volume"
 description="Adjust the volume of other users"
 />
 </div>
 </div>
 );
}
