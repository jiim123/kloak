import { useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMessageStore } from '@/stores/messageStore';

interface UseScrollToMessageOptions {
  messages: { id: string; created_at: string }[];
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
  const fetchAttemptsRef = useRef(0);
  const isFetchingRef = useRef(false);

  const { fetchMessages, currentChannelId } = useMessageStore();

  // Reset hasScrolled when the target message changes
  useEffect(() => {
    if (highlightedMessageId !== prevMessageIdRef.current) {
      hasScrolledRef.current = false;
      fetchAttemptsRef.current = 0;
      isFetchingRef.current = false;
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

  // If the target message isn't loaded, fetch older messages to find it
  useEffect(() => {
    if (!highlightedMessageId || isLoading || hasScrolledRef.current || isFetchingRef.current) return;
    if (!currentChannelId) return;

    const messageExists = messages.some(m => m.id === highlightedMessageId);
    if (messageExists) return; // Already loaded, the scroll effect below will handle it

    // Give up after 5 attempts (250 messages back)
    if (fetchAttemptsRef.current >= 5) return;

    // Fetch older messages using the oldest loaded message as cursor
    const oldestMessage = messages[0];
    if (!oldestMessage) return;

    isFetchingRef.current = true;
    fetchAttemptsRef.current += 1;

    fetchMessages(currentChannelId, 50, oldestMessage.created_at, true, true).finally(() => {
      isFetchingRef.current = false;
    });
  }, [highlightedMessageId, messages, isLoading, currentChannelId, fetchMessages]);

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
