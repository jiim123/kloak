import { useEffect, useRef, useState, useCallback, type RefObject } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMessageStore } from '@/stores/messageStore';

interface UseScrollToMessageOptions {
  messages: { id: string; created_at: string }[];
  isLoading: boolean;
  /** The scroll container ref — avoids unreliable DOM traversal on mobile. */
  containerRef: RefObject<HTMLElement | null>;
}

export const useScrollToMessage = ({ messages, isLoading, containerRef }: UseScrollToMessageOptions) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTargetId = searchParams.get('message');
  // Support both URL params and custom events (custom events avoid useSearchParams re-render cascade in MessageItem)
  const [eventTargetId, setEventTargetId] = useState<string | null>(null);
  const targetMessageId = eventTargetId || urlTargetId;
  const hasScrolledRef = useRef(false);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMessageIdRef = useRef<string | null>(null);
  const fetchAttemptsRef = useRef(0);
  const isFetchingRef = useRef(false);

  // Visual highlight — only set AFTER the scroll animation finishes
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const { fetchMessages, currentChannelId } = useMessageStore();

  // Listen for custom scrollToMessage events (from MessageItem reply clicks)
  useEffect(() => {
    const handler = (e: CustomEvent<{ messageId: string }>) => {
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

  // Clear the message param from URL
  const clearMessageParam = useCallback(() => {
    setEventTargetId(null);
    if (urlTargetId) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('message');
      setSearchParams(newParams, { replace: true });
    }
  }, [urlTargetId, searchParams, setSearchParams]);

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

    const messageExists = messages.some(m => m.id === targetMessageId);
    if (!messageExists) return;

    const scrollTimeout = setTimeout(() => {
      const messageElement = document.getElementById(`message-${targetMessageId}`);
      if (!messageElement) return;

      const scrollContainer = containerRef.current;

      if (scrollContainer) {
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

      // Activate the highlight AFTER the smooth scroll finishes (~400ms)
      setTimeout(() => {
        setHighlightedMessageId(targetMessageId);
      }, 400);

      // Clear everything after highlight animation finishes
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedMessageId(null);
        clearMessageParam();
      }, 2900); // 400ms scroll + 2500ms highlight
    }, 200);

    return () => clearTimeout(scrollTimeout);
  }, [targetMessageId, messages, isLoading, clearMessageParam]);

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
