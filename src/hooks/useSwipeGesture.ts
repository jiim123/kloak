import { useRef, useCallback, useEffect } from 'react';

interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number; // Minimum distance to trigger swipe
  enabled?: boolean;
}

export const useSwipeGesture = ({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  enabled = true,
}: SwipeGestureOptions) => {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchEndX.current = null;
  }, [enabled]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || touchStartX.current === null) return;
    touchEndX.current = e.touches[0].clientX;
  }, [enabled]);

  const handleTouchEnd = useCallback(() => {
    if (!enabled) return;
    
    if (touchStartX.current === null || touchEndX.current === null) {
      touchStartX.current = null;
      touchStartY.current = null;
      touchEndX.current = null;
      return;
    }

    const deltaX = touchEndX.current - touchStartX.current;
    const absDeltaX = Math.abs(deltaX);

    // Only trigger if horizontal swipe is significant
    if (absDeltaX >= threshold) {
      if (deltaX > 0 && onSwipeRight) {
        // Swiped right
        onSwipeRight();
      } else if (deltaX < 0 && onSwipeLeft) {
        // Swiped left
        onSwipeLeft();
      }
    }

    // Reset
    touchStartX.current = null;
    touchStartY.current = null;
    touchEndX.current = null;
  }, [enabled, threshold, onSwipeLeft, onSwipeRight]);

  const bindSwipeHandlers = useCallback((element: HTMLElement | null) => {
    if (!element) return () => {};

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { bindSwipeHandlers };
};

// Hook version that attaches to a ref
export const useSwipeGestureRef = (options: SwipeGestureOptions) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const { bindSwipeHandlers } = useSwipeGesture(options);

  useEffect(() => {
    const cleanup = bindSwipeHandlers(elementRef.current);
    return cleanup;
  }, [bindSwipeHandlers]);

  return elementRef;
};
