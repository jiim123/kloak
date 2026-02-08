/**
 * Mic Level Meter Component
 * Real-time visualization of microphone input level
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MicLevelMeterProps {
  level: number; // 0-1
  threshold?: number; // 0-1, optional threshold line
  className?: string;
  showThreshold?: boolean;
}

export function MicLevelMeter({
  level,
  threshold,
  className,
  showThreshold = false,
}: MicLevelMeterProps) {
  // Convert 0-1 to percentage
  const levelPercent = Math.min(100, Math.max(0, level * 100));
  const thresholdPercent = threshold ? Math.min(100, Math.max(0, (1 - threshold) * 100)) : 0;

  return (
    <div className={cn('relative h-3 w-full rounded-full overflow-hidden bg-secondary', className)}>
      {/* Level bar */}
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-primary/80"
        initial={{ width: 0 }}
        animate={{ width: `${levelPercent}%` }}
        transition={{ duration: 0.05, ease: 'linear' }}
      />

      {/* Threshold line */}
      {showThreshold && threshold !== undefined && (
        <div
          className="absolute inset-y-0 w-0.5 bg-destructive/80"
          style={{ left: `${thresholdPercent}%` }}
        />
      )}

      {/* Peak indicator dots */}
      <div className="absolute inset-0 flex items-center justify-evenly pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => {
          const dotPosition = (i + 1) * 5; // 5% intervals
          const isActive = levelPercent >= dotPosition;
          const isWarning = dotPosition >= 80;
          const isDanger = dotPosition >= 95;

          return (
            <div
              key={i}
              className={cn(
                'w-0.5 h-1.5 rounded-full transition-colors duration-75',
                isActive
                  ? isDanger
                    ? 'bg-destructive'
                    : isWarning
                    ? 'bg-amber-500'
                    : 'bg-primary-foreground/30'
                  : 'bg-transparent'
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
