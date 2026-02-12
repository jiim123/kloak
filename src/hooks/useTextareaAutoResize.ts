import { useCallback, useRef, RefObject } from "react";

interface UseTextareaAutoResizeOptions {
  minHeight?: number;
  maxHeight?: number;
}

interface UseTextareaAutoResizeReturn {
  textareaRef: RefObject<HTMLTextAreaElement>;
  resizeTextarea: () => void;
}

/**
 * Hook for auto-resizing textareas based on content
 * Used in MessageInput, DMMessageInput, and MessageItem edit mode
 *
 * @param options - Configuration options
 * @param options.minHeight - Minimum height in pixels (default: 40)
 * @param options.maxHeight - Maximum height in pixels (default: 160)
 * @returns Object containing textarea ref and resize function
 *
 * @example
 * ```tsx
 * const { textareaRef, resizeTextarea } = useTextareaAutoResize({
 *   minHeight: 40,
 *   maxHeight: 200
 * });
 *
 * <textarea
 *   ref={textareaRef}
 *   onChange={(e) => {
 *     setValue(e.target.value);
 *     resizeTextarea();
 *   }}
 * />
 * ```
 */
export function useTextareaAutoResize(
  options: UseTextareaAutoResizeOptions = {}
): UseTextareaAutoResizeReturn {
  const { minHeight = 40, maxHeight = 160 } = options;

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to 0 to get accurate scrollHeight
    textarea.style.height = "0px";

    // Calculate new height within bounds
    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);

    // Apply new height
    textarea.style.height = `${newHeight}px`;
  }, [minHeight, maxHeight]);

  return { textareaRef, resizeTextarea };
}
