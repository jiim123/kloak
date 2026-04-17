import { useState } from "react";
import { Monitor, ChevronDown, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ScreenShareResolution = "720p" | "1080p";
export type ScreenShareFrameRate = 15 | 30 | 60;

export type ScreenShareQuality = {
  resolution: ScreenShareResolution;
  frameRate: ScreenShareFrameRate;
};

const resolutionOptions: { value: ScreenShareResolution; label: string; width: number; height: number }[] = [
  { value: "720p", label: "720p", width: 1280, height: 720 },
  { value: "1080p", label: "1080p", width: 1920, height: 1080 },
];

const frameRateOptions: { value: ScreenShareFrameRate; label: string }[] = [
  { value: 15, label: "15 FPS" },
  { value: 30, label: "30 FPS" },
  { value: 60, label: "60 FPS" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (quality: ScreenShareQuality) => void;
};

export function ScreenShareQualityModal({ open, onClose, onConfirm }: Props) {
  const [resolution, setResolution] = useState<ScreenShareResolution>("720p");
  const [frameRate, setFrameRate] = useState<ScreenShareFrameRate>(30);

  const handleShare = () => {
    onConfirm({ resolution, frameRate });
  };

  const selectedResolution = resolutionOptions.find((r) => r.value === resolution)!;
  const selectedFrameRate = frameRateOptions.find((f) => f.value === frameRate)!;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            Screen Share Quality
          </DialogTitle>
          <DialogDescription className="sr-only">Choose resolution and frame rate for screen sharing</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Resolution Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Resolution</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span>{selectedResolution.label}</span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
                {resolutionOptions.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => setResolution(opt.value)}
                    className="flex items-center justify-between"
                  >
                    <span>{opt.label}</span>
                    {resolution === opt.value && <Check className="w-4 h-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Frame Rate Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Frame Rate</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span>{selectedFrameRate.label}</span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
                {frameRateOptions.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => setFrameRate(opt.value)}
                    className="flex items-center justify-between"
                  >
                    <span>{opt.label}</span>
                    {frameRate === opt.value && <Check className="w-4 h-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Preview info */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Resolution:</span>
              <span className="font-medium text-foreground">{selectedResolution.width}×{selectedResolution.height}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span>Frame rate:</span>
              <span className="font-medium text-foreground">{frameRate} fps</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleShare}>
              Go Live
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper to get constraints from quality settings
export function getScreenShareConstraints(quality: ScreenShareQuality): DisplayMediaStreamOptions {
  const resConfig = resolutionOptions.find((r) => r.value === quality.resolution)!;
  
  return {
    video: {
      width: { ideal: resConfig.width, max: resConfig.width },
      height: { ideal: resConfig.height, max: resConfig.height },
      frameRate: { ideal: quality.frameRate, max: quality.frameRate },
    },
    audio: true,
  };
}
