/**
 * Settings Slider Component
 * Reusable styled slider for voice settings
 */

import { Slider } from '@/components/ui/slider';
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
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={cn(
          'w-full',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      />
    </div>
  );
}
