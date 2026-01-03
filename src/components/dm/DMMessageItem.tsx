import { useState, useRef, useCallback } from 'react';
import { Reply, Copy, CornerUpLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useAuthStore } from '@/stores/authStore';
import { formatMessageTimestamp } from '@/lib/format';
import type { DirectMessage } from '@/types';

interface DMMessageItemProps {
  message: DirectMessage;
  isFirst: boolean;
  onReply: (message: DirectMessage) => void;
}

export const DMMessageItem = ({ message, isFirst, onReply }: DMMessageItemProps) => {
  const { user } = useAuthStore();
  
  const [showMobileActions, setShowMobileActions] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Long press handlers for mobile
  const handleTouchStart = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => {
      setShowMobileActions(true);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

  return (
    <>
      <div
        className={cn(
          'group flex gap-4 py-0.5 px-2 -mx-2 rounded hover:bg-secondary/30 transition-smooth',
          isFirst && 'mt-4 pt-1'
        )}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
      >
        {/* Avatar or spacer */}
        <div className="w-10 flex-shrink-0">
          {isFirst && (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
              style={{ backgroundColor: message.sender?.banner_color || '#5865F2' }}
            >
              {message.sender?.avatar_url ? (
                <img
                  src={message.sender.avatar_url}
                  alt={message.sender.username}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                (message.sender?.username?.[0] || '?').toUpperCase()
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {isFirst && (
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-medium text-foreground">
                {message.sender?.display_name || message.sender?.username}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatMessageTimestamp(message.created_at || '')}
              </span>
            </div>
          )}

          {/* Reply preview */}
          {message.reply_to && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1 pl-3 border-l-2 border-muted">
              <CornerUpLeft className="w-3 h-3" />
              <span className="font-medium">
                @{message.reply_to.sender?.username}
              </span>
              <span className="truncate">{message.reply_to.content}</span>
            </div>
          )}

          <p className="text-foreground whitespace-pre-wrap break-words">
            {message.content}
          </p>

          {message.edited_at && (
            <span className="text-xs text-muted-foreground">(edited)</span>
          )}
        </div>
      </div>

      {/* Mobile action drawer */}
      <Drawer open={showMobileActions} onOpenChange={setShowMobileActions}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-sm font-medium text-muted-foreground">Message Actions</DrawerTitle>
          </DrawerHeader>
          
          <div className="px-4 pb-8">
            {/* Quick reactions */}
            <div className="flex justify-center gap-3 mb-4 pb-4 border-b border-border">
              {quickReactions.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    // DM reactions not implemented yet, just close
                    setShowMobileActions(false);
                  }}
                  className="text-2xl p-2 hover:bg-accent rounded-full active:scale-90 transition-transform opacity-50"
                  disabled
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Action buttons */}
            <div className="space-y-1">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent active:bg-accent text-left"
                onClick={() => {
                  onReply(message);
                  setShowMobileActions(false);
                }}
              >
                <Reply className="w-5 h-5 text-muted-foreground" />
                <span>Reply</span>
              </button>

              <button
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent active:bg-accent text-left"
                onClick={() => {
                  navigator.clipboard.writeText(message.content);
                  setShowMobileActions(false);
                }}
              >
                <Copy className="w-5 h-5 text-muted-foreground" />
                <span>Copy Text</span>
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};
