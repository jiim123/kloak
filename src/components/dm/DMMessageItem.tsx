import { useState, useRef, useCallback } from 'react';
import { Reply, Pencil, Trash2, Copy, CornerUpLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Textarea } from '@/components/ui/textarea';
import { useDMStore } from '@/stores/dmStore';
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
  const { editMessage, deleteMessage, addReaction, removeReaction } = useDMStore();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isOwnMessage = user?.id === message.sender_id;

  // Check if current user is mentioned in this message
  const isMentioned = user?.id && (
    message.content.includes(`<@${user.id}>`) ||
    message.content.includes('@everyone') ||
    message.content.includes('@here')
  );

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

  const handleEdit = async () => {
    if (!user) return;
    if (editContent.trim() && editContent !== message.content) {
      await editMessage(message.id, user.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(message.content);
  };

  const handleDelete = async () => {
    if (!user) return;
    await deleteMessage(message.id, user.id);
    setShowMobileActions(false);
  };

  const handleReactionClick = async (emoji: string) => {
    if (!user) return;
    const existingReaction = message.reactions?.find((r) => r.emoji === emoji);
    if (existingReaction?.hasReacted) {
      await removeReaction(message.id, user.id, emoji);
    } else {
      await addReaction(message.id, user.id, emoji);
    }
    setShowMobileActions(false);
  };

  const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

  return (
    <>
      <div
        className={cn(
          'group flex gap-4 py-0.5 px-2 -mx-2 rounded hover:bg-secondary/30 transition-smooth',
          isFirst && 'mt-4 pt-1',
          isMentioned && 'bg-primary/10 border-l-2 border-l-primary'
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

          {isEditing ? (
            <div className="flex flex-col gap-2">
              <Textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[60px] resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleEdit();
                  }
                  if (e.key === 'Escape') {
                    handleCancelEdit();
                  }
                }}
                autoFocus
              />
              <div className="flex gap-2 text-[11px]">
                <span className="text-muted-foreground">
                  escape to{' '}
                  <button className="text-primary hover:underline" onClick={handleCancelEdit}>
                    cancel
                  </button>
                  {' • '}
                  enter to{' '}
                  <button className="text-primary hover:underline" onClick={handleEdit}>
                    save
                  </button>
                </span>
              </div>
            </div>
          ) : (
            <p className="text-foreground whitespace-pre-wrap break-words">
              {message.content}
            </p>
          )}

          {message.edited_at && !isEditing && (
            <span className="text-xs text-muted-foreground">(edited)</span>
          )}

          {/* Reactions */}
          {message.reactions && message.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {message.reactions.map((reaction) => (
                <button
                  key={reaction.emoji}
                  onClick={() => handleReactionClick(reaction.emoji)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border transition-colors',
                    reaction.hasReacted
                      ? 'bg-primary/20 border-primary text-primary'
                      : 'bg-secondary border-transparent hover:border-border'
                  )}
                >
                  <span>{reaction.emoji}</span>
                  <span className="text-[11px]">{reaction.count}</span>
                </button>
              ))}
            </div>
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
              {quickReactions.map((emoji) => {
                const existingReaction = message.reactions?.find((r) => r.emoji === emoji);
                return (
                  <button
                    key={emoji}
                    onClick={() => handleReactionClick(emoji)}
                    className={cn(
                      'text-2xl p-2 rounded-full active:scale-90 transition-transform',
                      existingReaction?.hasReacted ? 'bg-primary/20' : 'hover:bg-accent'
                    )}
                  >
                    {emoji}
                  </button>
                );
              })}
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

              {isOwnMessage && (
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent active:bg-accent text-left"
                  onClick={() => {
                    setEditContent(message.content);
                    setIsEditing(true);
                    setShowMobileActions(false);
                  }}
                >
                  <Pencil className="w-5 h-5 text-muted-foreground" />
                  <span>Edit</span>
                </button>
              )}

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

              {isOwnMessage && (
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-destructive/10 active:bg-destructive/10 text-left text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="w-5 h-5" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};
