import { useEffect, useRef, useState, type RefObject } from 'react';
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
  /** Optional: virtual list ref for index-based scrolling. */
  virtuosoRef?: RefObject<VirtualListHandle | null>;
  /** Fallback: plain scroll container ref (used when virtuosoRef is not provided, e.g. DMs). */
  containerRef?: RefObject<HTMLElement | null>;
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

  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const { fetchMessages, currentChannelId } = useMessageStore();

  // Stable ref for clearMessageParam so the scroll effect doesn't re-run when searchParams changes
  const clearMessageParamRef = useRef(() => {});
  clearMessageParamRef.current = () => {
    setEventTargetId(null);
    if (urlTargetId) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('message');
      setSearchParams(newParams, { replace: true });
    }
  };

  // Listen for custom scrollToMessage events (from MessageItem reply clicks)
  useEffect(() => {
    const handler = (e: CustomEvent<{ messageId: string }>) => {
      // Always reset so clicking the same reply target twice works
      hasScrolledRef.current = false;
      setHighlightedMessageId(null);
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
      setEventTargetId(e.detail.messageId);
    };
    window.addEventListener("scrollToMessage" as keyof WindowEventMap, handler as EventListener);
    return () => window.removeEventListener("scrollToMessage" as keyof WindowEventMap, handler as EventListener);
  }, []);

  // Reset when the target message changes (for URL-based navigation)
  useEffect(() => {
    if (targetMessageId !== prevMessageIdRef.current) {
      hasScrolledRef.current = false;
      fetchAttemptsRef.current = 0;
      isFetchingRef.current = false;
      prevMessageIdRef.current = targetMessageId;
      setHighlightedMessageId(null);
    }
  }, [targetMessageId]);

  // If the target message isn't loaded, fetch older messages to find it
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

  // Scroll to message when it's available, then highlight after scroll finishes
  useEffect(() => {
    if (!targetMessageId || isLoading || hasScrolledRef.current) return;

    const targetIndex = messages.findIndex(m => m.id === targetMessageId);
    if (targetIndex === -1) return;

    const scrollTimeout = setTimeout(() => {
      if (virtuosoRef?.current) {
        virtuosoRef.current.scrollToIndex({
          index: targetIndex,
          alignToTop: false,
        });
      } else if (containerRef?.current) {
        const messageElement = document.getElementById(`message-${targetMessageId}`);
        if (!messageElement) return;

        const scrollContainer = containerRef.current;
        const containerRect = scrollContainer.getBoundingClientRect();
        const messageRect = messageElement.getBoundingClientRect();
        const currentScrollTop = scrollContainer.scrollTop;
        const messageTopInContainer = messageRect.top - containerRect.top + currentScrollTop;
        const targetScroll = messageTopInContainer - (containerRect.height / 2) + (messageRect.height / 2);

        scrollContainer.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: 'smooth',
        });
      }

      hasScrolledRef.current = true;

      setTimeout(() => {
        setHighlightedMessageId(targetMessageId);
      }, 400);

      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedMessageId(null);
        clearMessageParamRef.current();
      }, 2900);
    }, 150);

    return () => clearTimeout(scrollTimeout);
  }, [targetMessageId, messages, isLoading, virtuosoRef, containerRef]);

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
