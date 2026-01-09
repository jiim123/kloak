import { forwardRef, ComponentPropsWithoutRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

/**
 * Motion elements that properly forward refs for use with Radix UI's asChild pattern.
 * These components wrap framer-motion elements to ensure ref forwarding works correctly.
 */

// MotionButton - for use with TooltipTrigger, DropdownMenuTrigger, etc.
export const MotionButton = forwardRef<
  HTMLButtonElement,
  HTMLMotionProps<'button'>
>((props, ref) => {
  return <motion.button ref={ref} {...props} />;
});
MotionButton.displayName = 'MotionButton';

// MotionDiv - for use with TooltipTrigger when a div is needed
export const MotionDiv = forwardRef<
  HTMLDivElement,
  HTMLMotionProps<'div'>
>((props, ref) => {
  return <motion.div ref={ref} {...props} />;
});
MotionDiv.displayName = 'MotionDiv';

// MotionSpan - for inline elements
export const MotionSpan = forwardRef<
  HTMLSpanElement,
  HTMLMotionProps<'span'>
>((props, ref) => {
  return <motion.span ref={ref} {...props} />;
});
MotionSpan.displayName = 'MotionSpan';
