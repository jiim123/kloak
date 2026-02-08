/**
 * PTT Keybind Capture Component
 * Captures keyboard input for Push-to-Talk keybind configuration
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatKeybind, keyboardEventToKeybind } from '@/utils/voiceSettingsValidation';

interface PTTKeybindCaptureProps {
  keybind: string;
  onChange: (keybind: string) => void;
  className?: string;
  disabled?: boolean;
}

export function PTTKeybindCapture({
  keybind,
  onChange,
  className,
  disabled = false,
}: PTTKeybindCaptureProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleCapture = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const newKeybind = keyboardEventToKeybind(e);
    if (newKeybind) {
      onChange(newKeybind);
      setIsCapturing(false);
    }
  }, [onChange]);

  const handleBlur = useCallback(() => {
    // Small delay to allow keydown to process
    setTimeout(() => {
      setIsCapturing(false);
    }, 100);
  }, []);

  useEffect(() => {
    if (isCapturing) {
      window.addEventListener('keydown', handleCapture);
      return () => {
        window.removeEventListener('keydown', handleCapture);
      };
    }
  }, [isCapturing, handleCapture]);

  const startCapture = () => {
    if (!disabled) {
      setIsCapturing(true);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <label className="text-sm font-medium text-foreground">
        Keybind
      </label>
      <Button
        ref={buttonRef}
        variant="outline"
        onClick={startCapture}
        onBlur={handleBlur}
        disabled={disabled}
        className={cn(
          'w-full justify-start gap-2 h-10 font-mono',
          isCapturing && 'ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse'
        )}
      >
        <Keyboard className="h-4 w-4 text-muted-foreground" />
        <AnimatePresence mode="wait">
          {isCapturing ? (
            <motion.span
              key="capturing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-muted-foreground"
            >
              Press a key...
            </motion.span>
          ) : (
            <motion.kbd
              key="keybind"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-2 py-0.5 rounded bg-muted text-sm"
            >
              {formatKeybind(keybind)}
            </motion.kbd>
          )}
        </AnimatePresence>
      </Button>
      <p className="text-xs text-muted-foreground">
        Click to change the Push-to-Talk keybind
      </p>
    </div>
  );
}
