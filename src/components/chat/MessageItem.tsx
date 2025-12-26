import { useState, useEffect, useRef } from 'react';
import { 
  Smile, Reply, Pencil, Trash2, Pin, MoreHorizontal, 
  CornerUpLeft 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/stores/authStore';
import { useMessageStore } from '@/stores/messageStore';
import { useServerStore } from '@/stores/serverStore';
import { MessageContent } from './MessageContent';
import { getMessagePreview } from '@/lib/message';
import { formatMessageTimestamp } from '@/lib/format';
import { DeleteMessageModal } from '@/components/modals/DeleteMessageModal';
import type { Message, ServerRole } from '@/types';

interface MessageItemProps {
  message: Message;
  isGrouped: boolean;
  showNewDivider?: boolean;
  onStartEdit?: () => void;
}

export const MessageItem = ({ message, isGrouped, showNewDivider, onStartEdit }: MessageItemProps) => {
  const { user } = useAuthStore();
  const { setReplyingTo, editMessage, pinMessage, addReaction, removeReaction } = useMessageStore();
  const { members } = useServerStore();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isHovered, setIsHovered] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isOwnMessage = user?.id === message.user_id;
  const messageUser = message.user;
  
  // Check if current user is admin
  const currentMember = members.find(m => m.user_id === user?.id);
  const isAdmin = currentMember?.role === 'owner' || currentMember?.role === 'admin' || currentMember?.role === 'moderator';

  // Get role color for username
  const messageMember = members.find(m => m.user_id === message.user_id);
  const getRoleColor = (role?: ServerRole): string => {
    switch (role) {
      case 'owner': return 'text-yellow-400';
      case 'admin': return 'text-red-400';
      case 'moderator': return 'text-blue-400';
      default: return 'text-foreground';
    }
  };

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(editContent.length, editContent.length);
    }
  }, [isEditing]);

  // Start editing externally (for Up arrow)
  const startEditing = () => {
    if (isOwnMessage) {
      setEditContent(message.content);
      setIsEditing(true);
      onStartEdit?.();
    }
  };

  // Expose startEditing via a custom event
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.detail.messageId === message.id) {
        startEditing();
      }
    };
    window.addEventListener('startEditMessage' as any, handler);
    return () => window.removeEventListener('startEditMessage' as any, handler);
  }, [message.id, isOwnMessage, message.content]);

  const handleEdit = async () => {
    if (editContent.trim() && editContent !== message.content) {
      await editMessage(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(message.content);
  };

  const handlePin = async () => {
    await pinMessage(message.id, !message.is_pinned);
  };

  const handleReactionClick = async (emoji: string, hasReacted: boolean) => {
    if (!user) return;
    if (hasReacted) {
      await removeReaction(message.id, user.id, emoji);
    } else {
      await addReaction(message.id, user.id, emoji);
    }
  };

  const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

  return (
    <>
      {showNewDivider && (
        <div className="flex items-center gap-2 my-2 px-4">
          <div className="flex-1 h-px bg-destructive" />
          <span className="text-xs text-destructive font-medium">NEW MESSAGES</span>
          <div className="flex-1 h-px bg-destructive" />
        </div>
      )}
      
      <div 
        className={`group relative flex gap-4 py-0.5 px-4 hover:bg-accent/30 ${isGrouped ? 'mt-0' : 'mt-4'}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Avatar or spacer */}
        <div className="w-10 flex-shrink-0">
          {!isGrouped && messageUser && (
            <Avatar className="w-10 h-10 cursor-pointer">
              <AvatarImage src={messageUser.avatar_url || undefined} />
              <AvatarFallback style={{ backgroundColor: messageUser.banner_color || '#5865F2' }}>
                {messageUser.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header (username + timestamp) - only on first message of group */}
          {!isGrouped && messageUser && (
            <div className="flex items-baseline gap-2">
              <span className={`font-medium hover:underline cursor-pointer ${getRoleColor(messageMember?.role)}`}>
                {messageMember?.nickname || messageUser.display_name || messageUser.username}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatMessageTimestamp(message.created_at)}
              </span>
              {message.is_pinned && (
                <Pin className="w-3 h-3 text-muted-foreground" />
              )}
            </div>
          )}

          {/* Reply reference */}
          {message.reply_to && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1 cursor-pointer hover:text-foreground">
              <CornerUpLeft className="w-3 h-3" />
              <span>Replying to</span>
              <span className="font-medium text-primary">
                @{message.reply_to.user?.username || 'unknown'}
              </span>
              <span className="truncate max-w-[200px]">
                {getMessagePreview(message.reply_to.content, 50)}
              </span>
            </div>
          )}

          {/* Message content */}
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <Textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[60px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleEdit();
                  }
                  if (e.key === 'Escape') {
                    handleCancelEdit();
                  }
                }}
              />
              <div className="flex gap-2 text-xs">
                <span className="text-muted-foreground">
                  escape to <button className="text-primary hover:underline" onClick={handleCancelEdit}>cancel</button>
                  {' • '}
                  enter to <button className="text-primary hover:underline" onClick={handleEdit}>save</button>
                </span>
              </div>
            </div>
          ) : (
            <MessageContent 
              content={message.content} 
              currentUserId={user?.id} 
            />
          )}

          {/* Edited indicator */}
          {message.edited_at && !isEditing && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground cursor-help">(edited)</span>
              </TooltipTrigger>
              <TooltipContent>
                {new Date(message.edited_at).toLocaleString()}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {message.attachments.map((attachment) => (
                <div key={attachment.id} className="relative">
                  {attachment.file_type?.startsWith('image/') ? (
                    <img 
                      src={attachment.file_url} 
                      alt={attachment.file_name}
                      className="max-w-[400px] max-h-[300px] rounded-lg cursor-pointer hover:opacity-90"
                    />
                  ) : (
                    <a 
                      href={attachment.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 bg-secondary rounded-lg hover:bg-secondary/80"
                    >
                      <span className="text-sm font-medium">{attachment.file_name}</span>
                      {attachment.file_size && (
                        <span className="text-xs text-muted-foreground">
                          ({Math.round(attachment.file_size / 1024)} KB)
                        </span>
                      )}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Reactions */}
          {message.reactions && message.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {message.reactions.map((reaction) => (
                <button
                  key={reaction.emoji}
                  onClick={() => handleReactionClick(reaction.emoji, reaction.hasReacted)}
                  className={`flex items-center gap-1 px-2 py-0.5 text-sm rounded-full border transition-colors ${
                    reaction.hasReacted 
                      ? 'bg-primary/20 border-primary text-primary' 
                      : 'bg-secondary border-transparent hover:border-border'
                  }`}
                >
                  <span>{reaction.emoji}</span>
                  <span>{reaction.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Hover actions */}
        {isHovered && !isEditing && (
          <div className="absolute right-4 -top-4 flex items-center gap-0.5 bg-secondary border border-border rounded-lg shadow-lg p-0.5">
            {/* Quick reactions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="w-7 h-7">
                  <Smile className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <div className="flex gap-1 p-1">
                  {quickReactions.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => user && addReaction(message.id, user.id, emoji)}
                      className="text-xl hover:scale-125 transition-transform p-1"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="w-7 h-7"
                  onClick={() => setReplyingTo(message)}
                >
                  <Reply className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reply</TooltipContent>
            </Tooltip>

            {isOwnMessage && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="w-7 h-7"
                    onClick={() => {
                      setEditContent(message.content);
                      setIsEditing(true);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit</TooltipContent>
              </Tooltip>
            )}

            {(isOwnMessage || isAdmin) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="w-7 h-7 text-destructive hover:text-destructive"
                    onClick={() => setShowDeleteModal(true)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            )}

            {isAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="w-7 h-7"
                    onClick={handlePin}
                  >
                    <Pin className={`w-4 h-4 ${message.is_pinned ? 'text-primary' : ''}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{message.is_pinned ? 'Unpin' : 'Pin'}</TooltipContent>
              </Tooltip>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="w-7 h-7">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(message.content)}>
                  Copy Text
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(message.id)}>
                  Copy Message ID
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      <DeleteMessageModal 
        message={showDeleteModal ? message : null} 
        onClose={() => setShowDeleteModal(false)} 
      />
    </>
  );
};
