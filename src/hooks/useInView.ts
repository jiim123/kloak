/**
 * useInView — lightweight IntersectionObserver hook.
 * Returns a ref callback and an inView boolean.
 * When `once` is true (default), the observer disconnects after first intersect.
 */
import { useCallback, useEffect, useRef, useState } from "react";

interface Options {
  rootMargin?: string;
  threshold?: number | number[];
  once?: boolean;
}

export function useInView<T extends Element = HTMLDivElement>(
  opts: Options = {},
): [(node: T | null) => void, boolean] {
  const { rootMargin = "600px", threshold = 0, once = true } = opts;
  const [inView, setInView] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const nodeRef = useRef<T | null>(null);

  const setRef = useCallback(
    (node: T | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      nodeRef.current = node;
      if (!node) return;

      if (typeof IntersectionObserver === "undefined") {
        setInView(true);
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setInView(true);
              if (once) {
                observer.disconnect();
                observerRef.current = null;
              }
            } else if (!once) {
              setInView(false);
            }
          }
        },
        { rootMargin, threshold },
      );
      observer.observe(node);
      observerRef.current = observer;
    },
    [rootMargin, threshold, once],
  );

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  return [setRef, inView];
}
