import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import type { Message } from '@/types';

interface VirtualizedItem {
  message: Message;
  index: number;
  isGrouped: boolean;
  showNewDivider: boolean;
}

interface VirtualizedRange {
  startIndex: number;
  endIndex: number;
  overscan: number;
}

const ITEM_HEIGHT = 72; // Average message height
const GROUPED_ITEM_HEIGHT = 44; // Height for grouped messages
const OVERSCAN = 10; // Number of items to render outside viewport

/**
 * Hook for virtualized message list rendering
 * Only renders visible messages plus overscan for smooth scrolling
 */
export function useVirtualizedMessages(
  messages: Message[],
  containerHeight: number,
  scrollTop: number,
  lastReadAt?: string | null
) {
  const [forceUpdate, setForceUpdate] = useState(0);
  const itemHeightsRef = useRef<Map<string, number>>(new Map());
  
  // Calculate which messages should be grouped
  const messageGroups = useMemo(() => {
    const groups: { isGrouped: boolean; showNewDivider: boolean }[] = [];
    const lastReadTime = lastReadAt ? new Date(lastReadAt).getTime() : null;
    let foundFirstUnread = false;
    
    for (let i = 0; i < messages.length; i++) {
      const current = messages[i];
      const previous = i > 0 ? messages[i - 1] : null;
      
      // Grouping logic
      let isGrouped = false;
      if (previous && current.user_id === previous.user_id && !current.reply_to_id) {
        const currentTime = new Date(current.created_at).getTime();
        const previousTime = new Date(previous.created_at).getTime();
        isGrouped = currentTime - previousTime < 5 * 60 * 1000; // 5 minutes
      }
      
      // New message divider
      let showNewDivider = false;
      if (lastReadTime && !foundFirstUnread) {
        const msgTime = new Date(current.created_at).getTime();
        if (msgTime > lastReadTime) {
          showNewDivider = true;
          foundFirstUnread = true;
        }
      }
      
      groups.push({ isGrouped, showNewDivider });
    }
    
    return groups;
  }, [messages, lastReadAt]);

  // Calculate cumulative heights for virtualization
  const itemOffsets = useMemo(() => {
    const offsets: number[] = [];
    let totalHeight = 0;
    
    for (let i = 0; i < messages.length; i++) {
      offsets.push(totalHeight);
      const cachedHeight = itemHeightsRef.current.get(messages[i].id);
      const estimatedHeight = cachedHeight || 
        (messageGroups[i]?.isGrouped ? GROUPED_ITEM_HEIGHT : ITEM_HEIGHT);
      totalHeight += estimatedHeight;
    }
    
    return offsets;
  }, [messages, messageGroups, forceUpdate]);

  // Total scrollable height
  const totalHeight = useMemo(() => {
    if (itemOffsets.length === 0) return 0;
    const lastOffset = itemOffsets[itemOffsets.length - 1];
    const lastHeight = itemHeightsRef.current.get(messages[messages.length - 1]?.id) || 
      (messageGroups[messages.length - 1]?.isGrouped ? GROUPED_ITEM_HEIGHT : ITEM_HEIGHT);
    return lastOffset + lastHeight;
  }, [itemOffsets, messages, messageGroups]);

  // Calculate visible range using binary search
  const visibleRange = useMemo((): VirtualizedRange => {
    if (messages.length === 0) {
      return { startIndex: 0, endIndex: 0, overscan: OVERSCAN };
    }
    
    // Binary search for start index
    let startIndex = 0;
    let low = 0;
    let high = itemOffsets.length - 1;
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (itemOffsets[mid] < scrollTop) {
        startIndex = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    
    // Find end index based on container height
    let endIndex = startIndex;
    const viewportEnd = scrollTop + containerHeight;
    
    for (let i = startIndex; i < itemOffsets.length; i++) {
      if (itemOffsets[i] > viewportEnd) {
        break;
      }
      endIndex = i;
    }
    
    // Apply overscan
    startIndex = Math.max(0, startIndex - OVERSCAN);
    endIndex = Math.min(messages.length - 1, endIndex + OVERSCAN);
    
    return { startIndex, endIndex, overscan: OVERSCAN };
  }, [messages.length, itemOffsets, scrollTop, containerHeight]);

  // Get items to render
  const virtualItems = useMemo((): VirtualizedItem[] => {
    const items: VirtualizedItem[] = [];
    
    for (let i = visibleRange.startIndex; i <= visibleRange.endIndex; i++) {
      if (messages[i]) {
        items.push({
          message: messages[i],
          index: i,
          isGrouped: messageGroups[i]?.isGrouped || false,
          showNewDivider: messageGroups[i]?.showNewDivider || false,
        });
      }
    }
    
    return items;
  }, [messages, messageGroups, visibleRange]);

  // Cache measured heights for more accurate virtualization
  const measureItem = useCallback((messageId: string, height: number) => {
    const cached = itemHeightsRef.current.get(messageId);
    if (cached !== height) {
      itemHeightsRef.current.set(messageId, height);
      // Trigger recalculation
      setForceUpdate((prev) => prev + 1);
    }
  }, []);

  // Get offset for a specific item
  const getItemOffset = useCallback((index: number): number => {
    return itemOffsets[index] || 0;
  }, [itemOffsets]);

  // Scroll to specific message
  const scrollToMessage = useCallback((messageId: string): number | null => {
    const index = messages.findIndex((m) => m.id === messageId);
    if (index === -1) return null;
    return itemOffsets[index] || 0;
  }, [messages, itemOffsets]);

  // Scroll to bottom
  const scrollToBottom = useCallback((): number => {
    return totalHeight;
  }, [totalHeight]);

  return {
    virtualItems,
    totalHeight,
    visibleRange,
    measureItem,
    getItemOffset,
    scrollToMessage,
    scrollToBottom,
    isVirtualized: messages.length > 50, // Only virtualize for large lists
  };
}
