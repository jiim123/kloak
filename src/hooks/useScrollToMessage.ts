import { useEffect, useRef, useState, useCallback, type RefObject } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMessageStore } from '@/stores/messageStore';

interface VirtualListHandle {
  scrollToIndex: (options: {
    index?: number;
    alignToTop?: boolean;
    offset?: number;
    delay?: number;
    prerender?: number;
  }) => void;
}

interface UseScrollToMessageOptions {
  messages: { id: string; created_at: string }[];
  isLoading: boolean;
  virtuosoRef?: RefObject<VirtualListHandle | null>;
  containerRef?: RefObject<HTMLElement | null>;
}

/**
 * Center a message element within its scroll container.
 * Returns true if the element was found and scrolled to.
 */
function centerMessageInView(container: HTMLElement, targetId: string, smooth: boolean): boolean {
  const el = document.getElementById(`message-${targetId}`);
  if (!el) return false;

  const containerRect = container.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const scrollTop = container.scrollTop;
  const elTopInContainer = elRect.top - containerRect.top + scrollTop;
  const targetScroll = elTopInContainer - containerRect.height / 2 + elRect.height / 2;

  container.scrollTo({
    top: Math.max(0, targetScroll),
    behavior: smooth ? 'smooth' : 'auto',
  });
  return true;
}

export const useScrollToMessage = ({ messages, isLoading, virtuosoRef, containerRef }: UseScrollToMessageOptions) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTargetId = searchParams.get('message');
  const [eventTargetId, setEventTargetId] = useState<string | null>(null);
  const targetMessageId = eventTargetId || urlTargetId;
  const hasScrolledRef = useRef(false);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMessageIdRef = useRef<string | null>(null);
  const fetchAttemptsRef = useRef(0);
  const isFetchingRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const { fetchMessages, currentChannelId } = useMessageStore();

  // Stable ref for clearMessageParam
  const clearMessageParamRef = useRef(() => {});
  clearMessageParamRef.current = () => {
    setEventTargetId(null);
    if (urlTargetId) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('message');
      setSearchParams(newParams, { replace: true });
    }
  };

  // Listen for custom scrollToMessage events (from reply clicks)
  useEffect(() => {
    const handler = (e: CustomEvent<{ messageId: string }>) => {
      hasScrolledRef.current = false;
      setHighlightedMessageId(null);
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setEventTargetId(e.detail.messageId);
    };
    window.addEventListener("scrollToMessage" as keyof WindowEventMap, handler as EventListener);
    return () => window.removeEventListener("scrollToMessage" as keyof WindowEventMap, handler as EventListener);
  }, []);

  // Reset when the target message changes
  useEffect(() => {
    if (targetMessageId !== prevMessageIdRef.current) {
      hasScrolledRef.current = false;
      fetchAttemptsRef.current = 0;
      isFetchingRef.current = false;
      prevMessageIdRef.current = targetMessageId;
      setHighlightedMessageId(null);
    }
  }, [targetMessageId]);

  // Fetch older messages if target isn't loaded
  useEffect(() => {
    if (!targetMessageId || isLoading || hasScrolledRef.current || isFetchingRef.current) return;
    if (!currentChannelId) return;

    const messageExists = messages.some(m => m.id === targetMessageId);
    if (messageExists) return;
    if (fetchAttemptsRef.current >= 5) return;

    const oldestMessage = messages[0];
    if (!oldestMessage) return;

    isFetchingRef.current = true;
    fetchAttemptsRef.current += 1;

    fetchMessages(currentChannelId, 50, oldestMessage.created_at, true, true).finally(() => {
      isFetchingRef.current = false;
    });
  }, [targetMessageId, messages, isLoading, currentChannelId, fetchMessages]);

  // Apply highlight and schedule cleanup
  const applyHighlight = useCallback((targetId: string) => {
    hasScrolledRef.current = true;

    // Small delay for scroll to settle, then highlight
    setTimeout(() => {
      setHighlightedMessageId(targetId);
    }, 150);

    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMessageId(null);
      clearMessageParamRef.current();
    }, 2900);
  }, []);

  // Retry-based centering: poll until the DOM element exists, then center it
  const centerWithRetry = useCallback((targetId: string, attempt = 0) => {
    const maxAttempts = 15; // ~750ms max wait
    const container = containerRef?.current;
    if (!container) return;

    const found = centerMessageInView(container, targetId, attempt > 0);
    if (found) {
      applyHighlight(targetId);
      return;
    }

    if (attempt < maxAttempts) {
      rafRef.current = requestAnimationFrame(() => {
        // Use nested rAF to wait for paint
        rafRef.current = requestAnimationFrame(() => {
          centerWithRetry(targetId, attempt + 1);
        });
      });
    }
  }, [containerRef, applyHighlight]);

  // Main scroll effect
  const performScroll = useCallback((targetIndex: number, targetId: string) => {
    const container = containerRef?.current;

    // Step 1: Use scrollToIndex to ensure the virtual list renders the item
    if (virtuosoRef?.current) {
      virtuosoRef.current.scrollToIndex({
        index: targetIndex,
        alignToTop: true,
        prerender: 10,
      });
    }

    // Step 2: After a frame, find the actual DOM element and center it
    // Use rAF to wait for the virtual list to render the target
    requestAnimationFrame(() => {
      if (container) {
        // First try immediate centering
        const found = centerMessageInView(container, targetId, false);
        if (found) {
          // Do a second smooth center pass after the instant jump settles
          setTimeout(() => {
            centerMessageInView(container, targetId, true);
          }, 50);
          applyHighlight(targetId);
        } else {
          // Element not rendered yet, start retry loop
          centerWithRetry(targetId, 0);
        }
      } else {
        applyHighlight(targetId);
      }
    });
  }, [virtuosoRef, containerRef, applyHighlight, centerWithRetry]);

  // Scroll to message when it's available in the messages array
  useEffect(() => {
    if (!targetMessageId || isLoading || hasScrolledRef.current) return;

    const targetIndex = messages.findIndex(m => m.id === targetMessageId);
    if (targetIndex === -1) return;

    performScroll(targetIndex, targetMessageId);
  }, [targetMessageId, messages, isLoading, performScroll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { highlightedMessageId };
};
