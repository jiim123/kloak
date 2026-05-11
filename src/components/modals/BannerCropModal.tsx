import { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface BannerCropModalProps {
  open: boolean;
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob) => void;
  isUploading?: boolean;
}

const TARGET_WIDTH = 960;
const TARGET_HEIGHT = 540;
const ASPECT = 16 / 9;

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement("canvas");

  // Determine output size: downscale if larger, but don't upscale
  let outW = pixelCrop.width;
  let outH = pixelCrop.height;
  if (outW > TARGET_WIDTH || outH > TARGET_HEIGHT) {
    const scale = Math.min(TARGET_WIDTH / outW, TARGET_HEIGHT / outH);
    outW = Math.round(outW * scale);
    outH = Math.round(outH * scale);
  }

  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outW,
    outH,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob failed"));
      },
      "image/webp",
      0.9,
    );
  });
}

export const BannerCropModal = ({
  open,
  imageSrc,
  onClose,
  onCropComplete,
  isUploading,
}: BannerCropModalProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropCompleteInternal = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleApply = async () => {
    if (!croppedAreaPixels) return;
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(blob);
    } catch (err) {
      console.error("Failed to crop image:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-background/95 backdrop-blur-xl border-border/50 rounded-2xl sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Crop Banner</DialogTitle>
          <DialogDescription>
            Adjust the crop area. The banner will be saved at 16:9 aspect ratio (960×540 max).
          </DialogDescription>
        </DialogHeader>

        {/* Crop area */}
        <div className="relative w-full" style={{ height: 300 }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={ASPECT}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropCompleteInternal}
            style={{
              containerStyle: { borderRadius: 12, overflow: "hidden" },
            }}
          />
        </div>

        {/* Zoom control */}
        <div className="flex items-center gap-3 px-1">
          <ZoomOut className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.05}
            onValueChange={(v) => setZoom(v[0])}
            className="flex-1"
          />
          <ZoomIn className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </div>

        <DialogFooter>
          <Button variant="outline" rounded="xl" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button rounded="xl" onClick={handleApply} disabled={isUploading || !croppedAreaPixels}>
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading…
              </>
            ) : (
              "Crop & Upload"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
