import { useState, memo } from 'react';
import { getFluentEmojiUrl, getFluentEmojiUrlNoVS16 } from '@/lib/fluentEmoji';
import { cn } from '@/lib/utils';

interface FluentEmojiProps {
  emoji: string;
  size?: number;
  className?: string;
}

/**
 * Renders a native emoji character as a Fluent Emoji 3D image.
 * Falls back to native text rendering if the CDN image fails.
 */
export const FluentEmoji = memo(function FluentEmoji({ emoji, size = 20, className }: FluentEmojiProps) {
  const [failCount, setFailCount] = useState(0);

  // After 2 failures (with and without VS16), show native text
  if (failCount >= 2) {
    return (
      <span
        className={cn('inline-flex items-center justify-center leading-none', className)}
        style={{ width: size, height: size, fontSize: size * 0.8 }}
      >
        {emoji}
      </span>
    );
  }

  const url = failCount === 0 ? getFluentEmojiUrl(emoji) : getFluentEmojiUrlNoVS16(emoji);

  return (
    <img
      src={url}
      alt={emoji}
      width={size}
      height={size}
      className={cn('inline-block object-contain', className)}
      decoding="async"
      draggable={false}
      onError={() => setFailCount(c => c + 1)}
    />
  );
});
