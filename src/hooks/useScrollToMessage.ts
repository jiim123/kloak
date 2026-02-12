import { useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

interface UseScrollToMessageOptions {
  messages: { id: string }[];
  isLoading: boolean;
}

/**
 * Find the nearest scrollable ancestor of an element.
 */
function findScrollContainer(el: HTMLElement): HTMLElement | null {
  let current = el.parentElement;
  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      current.scrollHeight > current.clientHeight
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

export const useScrollToMessage = ({ messages, isLoading }: UseScrollToMessageOptions) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightedMessageId = searchParams.get('message');
  const hasScrolledRef = useRef(false);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMessageIdRef = useRef<string | null>(null);

  // Reset hasScrolled when the target message changes
  useEffect(() => {
    if (highlightedMessageId !== prevMessageIdRef.current) {
      hasScrolledRef.current = false;
      prevMessageIdRef.current = highlightedMessageId;
    }
  }, [highlightedMessageId]);

  // Clear the message param from URL after scrolling
  const clearMessageParam = useCallback(() => {
    if (highlightedMessageId) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('message');
      setSearchParams(newParams, { replace: true });
    }
  }, [highlightedMessageId, searchParams, setSearchParams]);

  // Scroll to message when it's available
  useEffect(() => {
    if (!highlightedMessageId || isLoading || hasScrolledRef.current) return;

    const messageExists = messages.some(m => m.id === highlightedMessageId);
    if (!messageExists) return;

    // Small delay to ensure DOM is ready
    const scrollTimeout = setTimeout(() => {
      const messageElement = document.getElementById(`message-${highlightedMessageId}`);
      if (!messageElement) return;

      const scrollContainer = findScrollContainer(messageElement);

      if (scrollContainer) {
        // Calculate the target scroll position to center the message
        const containerRect = scrollContainer.getBoundingClientRect();
        const messageRect = messageElement.getBoundingClientRect();
        const currentScrollTop = scrollContainer.scrollTop;
        const messageTopRelative = messageRect.top - containerRect.top + currentScrollTop;
        const targetScroll = messageTopRelative - (containerRect.height / 2) + (messageRect.height / 2);

        scrollContainer.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: 'smooth',
        });
      } else {
        // Fallback for edge cases
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      hasScrolledRef.current = true;

      // Clear the URL param after animation completes
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      highlightTimeoutRef.current = setTimeout(() => {
        clearMessageParam();
      }, 2500);
    }, 150);

    return () => clearTimeout(scrollTimeout);
  }, [highlightedMessageId, messages, isLoading, clearMessageParam]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  return { highlightedMessageId };
};
