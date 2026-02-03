import { useState, useRef, useEffect, useCallback } from 'react';
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

// Preset solid colors matching Discord's palette
const PRESET_COLORS = [
  '#1ABC9C', '#2ECC71', '#3498DB', '#9B59B6', '#E91E63',
  '#F1C40F', '#E67E22', '#E74C3C', '#95A5A6', '#607D8B',
  '#11806A', '#1F8B4C', '#206694', '#71368A', '#AD1457',
  '#C27C0E', '#A84300', '#992D22', '#979C9F', '#546E7A',
];

// Gradient presets matching Discord's gradient options
const GRADIENT_PRESETS = [
  { colors: ['#667eea', '#764ba2'], angle: 135 },
  { colors: ['#ff6b6b', '#feca57'], angle: 135 },
  { colors: ['#4facfe', '#00f2fe'], angle: 135 },
  { colors: ['#43e97b', '#38f9d7'], angle: 135 },
  { colors: ['#fa709a', '#fee140'], angle: 135 },
  { colors: ['#a8edea', '#fed6e3'], angle: 135 },
  { colors: ['#ff0844', '#ffb199'], angle: 135 },
  { colors: ['#d299c2', '#fef9d7'], angle: 135 },
  { colors: ['#89f7fe', '#66a6ff'], angle: 135 },
  { colors: ['#cd9cf2', '#f6f3ff'], angle: 135 },
];

// Helper to convert hex to RGB
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

// Helper to convert RGB to hex
const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

// Helper to convert HSV to RGB
const hsvToRgb = (h: number, s: number, v: number): { r: number; g: number; b: number } => {
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;
  
  let r = 0, g = 0, b = 0;
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

// Helper to convert RGB to HSV
const rgbToHsv = (r: number, g: number, b: number): { h: number; s: number; v: number } => {
  r /= 255; g /= 255; b /= 255;
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

// Color Wheel + Saturation/Brightness Picker
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
  
  // Update HSV when color changes externally
  useEffect(() => {
    const rgb = hexToRgb(color);
    const newHsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    setHue(newHsv.h);
    setSaturation(newHsv.s);
    setBrightness(newHsv.v);
  }, [color]);
  
  const updateColor = useCallback((h: number, s: number, v: number) => {
    const newRgb = hsvToRgb(h, s, v);
    onColorChange(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
  }, [onColorChange]);
  
  const handleSatBrightMove = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!satBrightRef.current) return;
    const rect = satBrightRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const newSat = x;
    const newBright = 1 - y;
    setSaturation(newSat);
    setBrightness(newBright);
    updateColor(hue, newSat, newBright);
  }, [hue, updateColor]);
  
  const handleHueMove = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newHue = x * 360;
    setHue(newHue);
    updateColor(newHue, saturation, brightness);
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
    const newRgb = { ...currentRgb, [component]: clamped };
    onColorChange(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
  };
  
  const currentRgb = hexToRgb(color);
  const hueColor = hsvToRgb(hue, 1, 1);
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent 
        className="w-56 p-3 bg-popover border-border" 
        align="start"
        sideOffset={8}
      >
        {/* Saturation/Brightness Picker */}
        <div
          ref={satBrightRef}
          className="relative w-full h-36 rounded-md cursor-crosshair mb-3"
          style={{
            background: `linear-gradient(to bottom, transparent, black), linear-gradient(to right, white, rgb(${hueColor.r}, ${hueColor.g}, ${hueColor.b}))`,
          }}
          onMouseDown={(e) => {
            setIsDraggingSatBright(true);
            handleSatBrightMove(e);
          }}
        >
          {/* Picker indicator */}
          <div
            className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: `${saturation * 100}%`,
              top: `${(1 - brightness) * 100}%`,
              backgroundColor: color,
            }}
          />
        </div>
        
        {/* Hue Slider */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded border border-border" style={{ backgroundColor: color }} />
          <div
            ref={hueRef}
            className="flex-1 h-3 rounded cursor-pointer"
            style={{
              background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
            }}
            onMouseDown={(e) => {
              setIsDraggingHue(true);
              handleHueMove(e);
            }}
          >
            <div
              className="w-3 h-3 rounded-full border-2 border-white shadow-md -translate-x-1/2 pointer-events-none"
              style={{
                marginLeft: `${(hue / 360) * 100}%`,
                backgroundColor: `hsl(${hue}, 100%, 50%)`,
              }}
            />
          </div>
        </div>
        
        {/* RGB Inputs */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              value={currentRgb.r}
              onChange={(e) => handleRgbChange('r', e.target.value)}
              className="h-7 text-xs text-center bg-secondary/50"
              type="number"
              min={0}
              max={255}
            />
            <Label className="text-[10px] text-muted-foreground text-center block mt-1">R</Label>
          </div>
          <div className="flex-1">
            <Input
              value={currentRgb.g}
              onChange={(e) => handleRgbChange('g', e.target.value)}
              className="h-7 text-xs text-center bg-secondary/50"
              type="number"
              min={0}
              max={255}
            />
            <Label className="text-[10px] text-muted-foreground text-center block mt-1">G</Label>
          </div>
          <div className="flex-1">
            <Input
              value={currentRgb.b}
              onChange={(e) => handleRgbChange('b', e.target.value)}
              className="h-7 text-xs text-center bg-secondary/50"
              type="number"
              min={0}
              max={255}
            />
            <Label className="text-[10px] text-muted-foreground text-center block mt-1">B</Label>
          </div>
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
  const presetColors = colorType === 'solid' ? PRESET_COLORS : [];
  const gradientPresets = colorType === 'gradient' ? GRADIENT_PRESETS : [];
  
  return (
    <div className="space-y-3">
      <Label className="text-sm">Role color</Label>
      
      {/* Solid/Gradient Toggle */}
      <div className="inline-flex bg-secondary/80 rounded-md p-0.5 border border-border/50">
        <button
          type="button"
          onClick={() => onColorTypeChange('solid')}
          className={cn(
            "px-4 py-1.5 text-xs font-medium rounded transition-all",
            colorType === 'solid'
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Solid
        </button>
        <button
          type="button"
          onClick={() => onColorTypeChange('gradient')}
          className={cn(
            "px-4 py-1.5 text-xs font-medium rounded transition-all",
            colorType === 'gradient'
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Gradient
        </button>
      </div>
      
      {/* Color Selection Area */}
      <div className="flex items-start gap-3">
        {/* Color Picker(s) */}
        {colorType === 'solid' ? (
          <ColorPickerPopover color={color} onColorChange={onColorChange}>
            <button
              type="button"
              className="w-12 h-12 rounded-full border-2 border-primary/50 flex items-center justify-center shrink-0 hover:border-primary transition-colors"
              style={{ backgroundColor: color }}
            >
              <Plus className="w-5 h-5 text-white drop-shadow-md" />
            </button>
          </ColorPickerPopover>
        ) : (
          <div className="flex gap-2">
            {gradientColors.map((gradColor, idx) => (
              <ColorPickerPopover
                key={idx}
                color={gradColor}
                onColorChange={(newColor) => {
                  const newColors = [...gradientColors];
                  newColors[idx] = newColor;
                  onGradientColorsChange(newColors);
                }}
              >
                <button
                  type="button"
                  className={cn(
                    "w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                    idx === 0 ? "border-primary/50 hover:border-primary" : "border-border hover:border-primary/50"
                  )}
                  style={{ backgroundColor: gradColor }}
                >
                  <Plus className="w-4 h-4 text-white drop-shadow-md" />
                </button>
              </ColorPickerPopover>
            ))}
            {gradientColors.length < 4 && (
              <button
                type="button"
                onClick={() => onGradientColorsChange([...gradientColors, '#5865F2'])}
                className="w-10 h-10 rounded-full border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center shrink-0 transition-colors bg-secondary/30"
              >
                <Plus className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        )}
        
        {/* Preset Grid */}
        <div className="flex-1 min-w-0">
          {colorType === 'solid' ? (
            <div className="grid grid-cols-10 gap-1.5">
              {presetColors.map((presetColor, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onColorChange(presetColor)}
                  className={cn(
                    "w-6 h-6 rounded-full transition-all hover:scale-110 hover:ring-2 hover:ring-primary/50",
                    color === presetColor && "ring-2 ring-primary scale-110"
                  )}
                  style={{ backgroundColor: presetColor }}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-1.5">
              {gradientPresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onGradientColorsChange(preset.colors);
                    onGradientAngleChange(preset.angle);
                  }}
                  className={cn(
                    "h-6 rounded-full transition-all hover:scale-105 hover:ring-2 hover:ring-primary/50",
                    JSON.stringify(gradientColors) === JSON.stringify(preset.colors) && 
                    "ring-2 ring-primary scale-105"
                  )}
                  style={{
                    background: `linear-gradient(${preset.angle}deg, ${preset.colors.join(', ')})`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Gradient Preview & Angle (only for gradient mode) */}
      {colorType === 'gradient' && (
        <div className="space-y-2 pt-2">
          <div 
            className="h-10 rounded-lg border border-border"
            style={{ 
              background: `linear-gradient(${gradientAngle}deg, ${gradientColors.join(', ')})` 
            }}
          />
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground shrink-0">Angle</Label>
            <input
              type="range"
              min="0"
              max="360"
              value={gradientAngle}
              onChange={(e) => onGradientAngleChange(parseInt(e.target.value))}
              className="flex-1 h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-muted-foreground w-8 text-right">{gradientAngle}°</span>
          </div>
        </div>
      )}
    </div>
  );
};
