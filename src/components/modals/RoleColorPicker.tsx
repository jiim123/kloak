import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface RoleColorPickerProps {
  colorType: 'solid' | 'gradient';
  onColorTypeChange: (type: 'solid' | 'gradient') => void;
  color: string;
  onColorChange: (color: string) => void;
  gradientColors: string[];
  onGradientColorsChange: (colors: string[]) => void;
  gradientAngle: number;
  onGradientAngleChange: (angle: number) => void;
}

const PRESET_COLORS = [
  { name: 'Teal', color: '#1ABC9C' },
  { name: 'Green', color: '#2ECC71' },
  { name: 'Blue', color: '#3498DB' },
  { name: 'Purple', color: '#9B59B6' },
  { name: 'Pink', color: '#E91E63' },
  { name: 'Yellow', color: '#F1C40F' },
  { name: 'Orange', color: '#E67E22' },
  { name: 'Red', color: '#E74C3C' },
  { name: 'Silver', color: '#BCC0C0' },
  { name: 'Slate', color: '#607D8B' },
  { name: 'Dark Teal', color: '#11806A' },
  { name: 'Dark Green', color: '#1F8B4C' },
  { name: 'Dark Blue', color: '#206694' },
  { name: 'Dark Purple', color: '#71368A' },
  { name: 'Magenta', color: '#AD1457' },
  { name: 'Gold', color: '#C27C0E' },
  { name: 'Brown', color: '#A84300' },
  { name: 'Maroon', color: '#992D22' },
  { name: 'Gray', color: '#979C9F' },
  { name: 'Deep Slate', color: '#546E7A' },
];

const GRADIENT_PRESETS = [
  { name: 'Aurora', colors: ['#a855f7', '#5865f2'], angle: 135 },
  { name: 'Tropic', colors: ['#f4d03f', '#16a085'], angle: 135 },
  { name: 'Sunrise', colors: ['#f1c40f', '#2ecc71'], angle: 135 },
  { name: 'Sakura', colors: ['#f797c9', '#ffb86c'], angle: 135 },
  { name: 'Candy', colors: ['#e056fd', '#686de0'], angle: 135 },
  { name: 'Lagoon', colors: ['#74b9ff', '#55efc4'], angle: 135 },
  { name: 'Sky', colors: ['#45aaf2', '#2dcbff'], angle: 135 },
  { name: 'Royal', colors: ['#5b7cfa', '#6c5ce7'], angle: 135 },
  { name: 'Moonstone', colors: ['#dfe6e9', '#b2bec3'], angle: 135 },
  { name: 'Emerald', colors: ['#2ecc71', '#00b894'], angle: 135 },
  { name: 'Flamingo', colors: ['#ff7675', '#fd79a8'], angle: 135 },
  { name: 'Lilac', colors: ['#a29bfe', '#d980fa'], angle: 135 },
  { name: 'Mint', colors: ['#55efc4', '#81ecec'], angle: 135 },
];

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 255, g: 255, b: 255 };
};

const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map((x) => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

const hsvToRgb = (h: number, s: number, v: number): { r: number; g: number; b: number } => {
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;

  let r = 0;
  let g = 0;
  let b = 0;
  if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
  else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
  else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
  else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
  else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
};

const rgbToHsv = (r: number, g: number, b: number): { h: number; s: number; v: number } => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }

  return { h, s, v };
};

interface ColorPickerPopoverProps {
  color: string;
  onColorChange: (color: string) => void;
  children: React.ReactNode;
}

const ColorPickerPopover = ({ color, onColorChange, children }: ColorPickerPopoverProps) => {
  const [open, setOpen] = useState(false);
  const satBrightRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const [isDraggingSatBright, setIsDraggingSatBright] = useState(false);
  const [isDraggingHue, setIsDraggingHue] = useState(false);

  const rgb = hexToRgb(color);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);

  const [hue, setHue] = useState(hsv.h);
  const [saturation, setSaturation] = useState(hsv.s);
  const [brightness, setBrightness] = useState(hsv.v);

  useEffect(() => {
    const nextRgb = hexToRgb(color);
    const nextHsv = rgbToHsv(nextRgb.r, nextRgb.g, nextRgb.b);
    setHue(nextHsv.h);
    setSaturation(nextHsv.s);
    setBrightness(nextHsv.v);
  }, [color]);

  const updateColor = useCallback((h: number, s: number, v: number) => {
    const nextRgb = hsvToRgb(h, s, v);
    onColorChange(rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b));
  }, [onColorChange]);

  const handleSatBrightMove = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!satBrightRef.current) return;
    const rect = satBrightRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const nextSat = x;
    const nextBright = 1 - y;
    setSaturation(nextSat);
    setBrightness(nextBright);
    updateColor(hue, nextSat, nextBright);
  }, [hue, updateColor]);

  const handleHueMove = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const nextHue = x * 360;
    setHue(nextHue);
    updateColor(nextHue, saturation, brightness);
  }, [saturation, brightness, updateColor]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSatBright) handleSatBrightMove(e);
      if (isDraggingHue) handleHueMove(e);
    };
    const handleMouseUp = () => {
      setIsDraggingSatBright(false);
      setIsDraggingHue(false);
    };

    if (isDraggingSatBright || isDraggingHue) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSatBright, isDraggingHue, handleSatBrightMove, handleHueMove]);

  const handleRgbChange = (component: 'r' | 'g' | 'b', value: string) => {
    const num = parseInt(value) || 0;
    const clamped = Math.max(0, Math.min(255, num));
    const currentRgb = hexToRgb(color);
    const nextRgb = { ...currentRgb, [component]: clamped };
    onColorChange(rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b));
  };

  const currentRgb = hexToRgb(color);
  const hueColor = hsvToRgb(hue, 1, 1);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-56 border-border bg-popover p-3" align="start" sideOffset={8}>
        <div
          ref={satBrightRef}
          className="relative mb-3 h-36 w-full cursor-crosshair rounded-md"
          style={{
            background: `linear-gradient(to bottom, transparent, black), linear-gradient(to right, white, rgb(${hueColor.r}, ${hueColor.g}, ${hueColor.b}))`,
          }}
          onMouseDown={(e) => {
            setIsDraggingSatBright(true);
            handleSatBrightMove(e);
          }}
        >
          <div
            className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
            style={{
              left: `${saturation * 100}%`,
              top: `${(1 - brightness) * 100}%`,
              backgroundColor: color,
            }}
          />
        </div>

        <div className="mb-3 flex items-center gap-2">
          <div className="h-5 w-5 rounded border border-border" style={{ backgroundColor: color }} />
          <div
            ref={hueRef}
            className="flex-1 cursor-pointer rounded"
            style={{
              height: 12,
              background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
            }}
            onMouseDown={(e) => {
              setIsDraggingHue(true);
              handleHueMove(e);
            }}
          >
            <div
              className="pointer-events-none h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white shadow-md"
              style={{
                marginLeft: `${(hue / 360) * 100}%`,
                backgroundColor: `hsl(${hue}, 100%, 50%)`,
              }}
            />
          </div>
        </div>

        <div className="flex gap-2">
          {(['r', 'g', 'b'] as const).map((component) => (
            <div key={component} className="flex-1">
              <Input
                value={currentRgb[component]}
                onChange={(e) => handleRgbChange(component, e.target.value)}
                className="h-7 bg-secondary/50 text-center text-xs"
                type="number"
                min={0}
                max={255}
              />
              <Label className="mt-1 block text-center text-[10px] uppercase text-muted-foreground">
                {component}
              </Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const RoleColorPicker = ({
  colorType,
  onColorTypeChange,
  color,
  onColorChange,
  gradientColors,
  onGradientColorsChange,
  gradientAngle,
  onGradientAngleChange,
}: RoleColorPickerProps) => {
  const twoGradientColors = gradientColors.slice(0, 2);
  if (twoGradientColors.length < 2) {
    twoGradientColors.push('#5865F2');
  }
  const selectedGradientKey = JSON.stringify(twoGradientColors);

  return (
    <div className="space-y-2">
      <Label className="block text-sm font-medium leading-5 text-foreground/90">Role color</Label>

      <div className="inline-flex h-8 items-center rounded-[4px] border border-[#4b4f5c] bg-[#30333d] p-0.5 shadow-none">
        <div className="flex h-full overflow-hidden rounded-[3px]">
          <button
            type="button"
            onClick={() => onColorTypeChange('solid')}
            className={cn(
              'h-full min-w-[58px] px-2.5 text-[13px] font-semibold transition-colors',
              colorType === 'solid'
                ? 'bg-[#3b404a] text-white'
                : 'text-[#d6d9df] hover:bg-white/5 hover:text-white',
            )}
          >
            Solid
          </button>
          <button
            type="button"
            onClick={() => onColorTypeChange('gradient')}
            className={cn(
              'h-full min-w-[74px] px-2.5 text-[13px] font-semibold transition-colors',
              colorType === 'gradient'
                ? 'bg-[#3b404a] text-white'
                : 'text-[#d6d9df] hover:bg-white/5 hover:text-white',
            )}
          >
            Gradient
          </button>
        </div>
      </div>

      <div className="flex w-full flex-wrap items-start gap-x-2.5 gap-y-2">
        {colorType === 'solid' ? (
          <ColorPickerPopover color={color} onColorChange={onColorChange}>
            <button
              type="button"
              aria-label="Choose custom role color"
              className="flex h-9 w-[86px] shrink-0 items-center justify-center rounded-full border border-black/20 transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: color }}
            >
              <Plus className="h-5 w-5 text-white" strokeWidth={2.4} />
            </button>
          </ColorPickerPopover>
        ) : (
          <div
            className="grid h-9 w-[86px] shrink-0 grid-cols-2 overflow-hidden rounded-full border border-black/20"
            style={{ background: `linear-gradient(${gradientAngle}deg, ${twoGradientColors.join(', ')})` }}
          >
            {twoGradientColors.map((gradColor, idx) => (
              <ColorPickerPopover
                key={idx}
                color={gradColor}
                onColorChange={(newColor) => {
                  const nextColors = [...twoGradientColors];
                  nextColors[idx] = newColor;
                  onGradientColorsChange(nextColors);
                }}
              >
                <button
                  type="button"
                  aria-label={`Choose gradient color ${idx + 1}`}
                  className="flex items-center justify-center transition-transform hover:scale-105"
                  style={{ backgroundColor: `${gradColor}c7` }}
                >
                  <Plus className="h-5 w-5 text-white" strokeWidth={2.4} />
                </button>
              </ColorPickerPopover>
            ))}
          </div>
        )}

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap gap-x-2 gap-y-2">
            {colorType === 'solid'
              ? PRESET_COLORS.map((preset) => (
                  <button
                    key={preset.color}
                    type="button"
                    onClick={() => onColorChange(preset.color)}
                    className={cn(
                      'group relative h-6 w-6 rounded-full transition-transform hover:scale-110',
                      color.toLowerCase() === preset.color.toLowerCase()
                        && 'ring-2 ring-[#f0d44e] ring-offset-2 ring-offset-[#2f343d]',
                    )}
                    style={{ backgroundColor: preset.color }}
                    aria-label={preset.name}
                  >
                    <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-[3px] bg-black px-2 py-1 text-[12px] font-semibold text-white group-hover:block">
                      {preset.name}
                    </span>
                  </button>
                ))
              : GRADIENT_PRESETS.map((preset) => {
                  const presetColors = preset.colors.slice(0, 2);
                  const isSelected = selectedGradientKey === JSON.stringify(presetColors);

                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        onGradientColorsChange(presetColors);
                        onGradientAngleChange(preset.angle);
                      }}
                      className={cn(
                        'group relative h-6 w-6 rounded-full transition-transform hover:scale-110',
                        isSelected && 'ring-2 ring-[#f0d44e] ring-offset-2 ring-offset-[#2f343d]',
                      )}
                      style={{ background: `linear-gradient(${preset.angle}deg, ${presetColors.join(', ')})` }}
                      aria-label={preset.name}
                    >
                      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-[3px] bg-black px-2 py-1 text-[12px] font-semibold text-white group-hover:block">
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
          </div>
        </div>
      </div>
    </div>
  );
};
