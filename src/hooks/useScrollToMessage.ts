import { useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

interface UseScrollToMessageOptions {
  messages: { id: string }[];
  isLoading: boolean;
}

export const useScrollToMessage = ({ messages, isLoading }: UseScrollToMessageOptions) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightedMessageId = searchParams.get('message');
  const hasScrolledRef = useRef(false);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        hasScrolledRef.current = true;

        // Clear the URL param after animation completes
        highlightTimeoutRef.current = setTimeout(() => {
          clearMessageParam();
        }, 2500);
      }
    }, 100);

    return () => clearTimeout(scrollTimeout);
  }, [highlightedMessageId, messages, isLoading, clearMessageParam]);

  // Reset on unmount or when message param changes
  useEffect(() => {
    return () => {
      hasScrolledRef.current = false;
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, [highlightedMessageId]);

  return { highlightedMessageId };
};
