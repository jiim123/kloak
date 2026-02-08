/**
 * Settings Toggle Component
 * Reusable styled toggle for voice settings
 */

import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface SettingsToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  className?: string;
  disabled?: boolean;
}

export function SettingsToggle({
  checked,
  onChange,
  label,
  description,
  className,
  disabled = false,
}: SettingsToggleProps) {
  const id = `toggle-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className={cn('flex items-start justify-between gap-4 py-2', className)}>
      <div className="flex-1 min-w-0">
        <label 
          htmlFor={id} 
          className="text-sm font-medium text-foreground cursor-pointer"
        >
          {label}
        </label>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
