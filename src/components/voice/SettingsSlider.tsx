/**
 * Settings Slider Component
 * Reusable styled slider for voice settings with gradient track
 */

import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

interface SettingsSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  description?: string;
  showValue?: boolean;
  valueFormatter?: (value: number) => string;
  className?: string;
  disabled?: boolean;
}

function getGradientColor(percent: number): string {
  // Interpolate from emerald-300 (hsl 158 64% 52%) to red-600 (hsl 0 72% 51%)
  const h = 158 - percent * 1.58;
  const s = 64 + percent * 0.08;
  const l = 52 - percent * 0.01;
  return `hsl(${Math.max(0, h)}, ${Math.max(0, s)}%, ${Math.max(0, l)}%)`;
}

export function SettingsSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  description,
  showValue = true,
  valueFormatter = (v) => `${v}%`,
  className,
  disabled = false,
}: SettingsSliderProps) {
  const percent = ((value - min) / (max - min)) * 100;
  const color = getGradientColor(percent);

  return (
    <div className={cn('space-y-2', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          <div>
            {label && (
              <label className="text-sm font-medium text-foreground">{label}</label>
            )}
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          {showValue && (
            <span className="text-sm font-mono text-muted-foreground tabular-nums">
              {valueFormatter(value)}
            </span>
          )}
        </div>
      )}
      <SliderPrimitive.Root
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={cn(
          'relative flex w-full touch-none select-none items-center',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-secondary">
          <SliderPrimitive.Range
            className="absolute h-full rounded-full"
            style={{
              background: `linear-gradient(to right, hsl(158, 64%, 52%), ${color})`,
            }}
          />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className="block h-4 w-4 rounded-full border-2 bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          style={{ borderColor: color }}
        />
      </SliderPrimitive.Root>
    </div>
  );
}
