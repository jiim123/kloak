import { useRef, useCallback, useEffect } from 'react';

interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  edgeThreshold?: number;
  enabled?: boolean;
}

export const useSwipeGesture = ({
  onSwipeLeft,
  onSwipeRight,
  threshold = 70,
  edgeThreshold,
  enabled = true,
}: SwipeGestureOptions) => {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const touchEndY = useRef<number | null>(null);
  const isVerticalScroll = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchEndX.current = null;
    touchEndY.current = null;
    isVerticalScroll.current = false;
  }, [enabled]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || touchStartX.current === null || touchStartY.current === null) return;

    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;

    // Once we detect a primarily vertical gesture, lock it out
    if (!isVerticalScroll.current) {
      const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
      const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
      if (dy > 10 && dy > dx * 1.5) {
        isVerticalScroll.current = true;
      }
    }
  }, [enabled]);

  const handleTouchEnd = useCallback(() => {
    if (!enabled) return;

    if (touchStartX.current === null || touchEndX.current === null || isVerticalScroll.current) {
      touchStartX.current = null;
      touchStartY.current = null;
      touchEndX.current = null;
      touchEndY.current = null;
      isVerticalScroll.current = false;
      return;
    }

    const deltaX = touchEndX.current - touchStartX.current;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs((touchEndY.current ?? touchStartY.current!) - touchStartY.current!);

    // Only trigger if horizontal distance exceeds threshold AND is dominant over vertical
    if (absDeltaX >= threshold && absDeltaX > absDeltaY * 2) {
      let startedFromRequiredEdge = true;

      if (edgeThreshold && typeof window !== 'undefined') {
        const startsAtLeftEdge = touchStartX.current <= edgeThreshold;
        const startsAtRightEdge = touchStartX.current >= window.innerWidth - edgeThreshold;

        startedFromRequiredEdge =
          (deltaX > 0 && startsAtLeftEdge) ||
          (deltaX < 0 && startsAtRightEdge);
      }

      if (startedFromRequiredEdge && deltaX > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (startedFromRequiredEdge && deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
    touchEndX.current = null;
    touchEndY.current = null;
    isVerticalScroll.current = false;
  }, [enabled, edgeThreshold, threshold, onSwipeLeft, onSwipeRight]);

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

// Hook version that attaches to a ref and also captures at document level.
// The capture listener keeps edge navigation available on scroll-heavy first-load views.
export const useSwipeGestureRef = (options: SwipeGestureOptions) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const { bindSwipeHandlers } = useSwipeGesture(options);
  const optionsRef = useRef(options);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const touchEndY = useRef<number | null>(null);
  const isVerticalScroll = useRef(false);

  optionsRef.current = options;

  useEffect(() => {
    const cleanup = bindSwipeHandlers(elementRef.current);
    return cleanup;
  }, [bindSwipeHandlers]);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (optionsRef.current.enabled === false || e.touches.length !== 1) return;
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      touchEndX.current = null;
      touchEndY.current = null;
      isVerticalScroll.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (optionsRef.current.enabled === false || touchStartX.current === null || touchStartY.current === null) return;
      touchEndX.current = e.touches[0].clientX;
      touchEndY.current = e.touches[0].clientY;

      if (!isVerticalScroll.current) {
        const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
        const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
        if (dy > 10 && dy > dx * 1.5) {
          isVerticalScroll.current = true;
        }
      }
    };

    const reset = () => {
      touchStartX.current = null;
      touchStartY.current = null;
      touchEndX.current = null;
      touchEndY.current = null;
      isVerticalScroll.current = false;
    };

    const handleTouchEnd = () => {
      const { enabled = true, threshold = 70, edgeThreshold, onSwipeLeft, onSwipeRight } = optionsRef.current;
      if (!enabled) return reset();
      if (touchStartX.current === null || touchEndX.current === null || isVerticalScroll.current) return reset();

      const deltaX = touchEndX.current - touchStartX.current;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs((touchEndY.current ?? touchStartY.current!) - touchStartY.current!);

      if (absDeltaX >= threshold && absDeltaX > absDeltaY * 2) {
        let startedFromRequiredEdge = true;

        if (edgeThreshold && typeof window !== 'undefined') {
          const startsAtLeftEdge = touchStartX.current <= edgeThreshold;
          const startsAtRightEdge = touchStartX.current >= window.innerWidth - edgeThreshold;

          startedFromRequiredEdge =
            (deltaX > 0 && startsAtLeftEdge) ||
            (deltaX < 0 && startsAtRightEdge);
        }

        if (startedFromRequiredEdge && deltaX > 0) {
          onSwipeRight?.();
        } else if (startedFromRequiredEdge && deltaX < 0) {
          onSwipeLeft?.();
        }
      }

      reset();
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true, capture: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true, capture: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart, { capture: true });
      document.removeEventListener('touchmove', handleTouchMove, { capture: true });
      document.removeEventListener('touchend', handleTouchEnd, { capture: true });
    };
  }, []);

  return elementRef;
};