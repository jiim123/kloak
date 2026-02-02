import React, { useState, useEffect, useCallback, useRef, forwardRef } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { 
  Send, 
  Loader2, 
  Reply, 
  Pencil, 
  Trash2, 
  Smile, 
  CornerUpLeft,
  MessageSquare 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmojiGifPicker } from "@/components/modals/EmojiGifPicker";
import { DeleteMessageModal } from "@/components/modals/DeleteMessageModal";
import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/lib/errorHandler";
import { formatMessageTimestamp } from "@/lib/format";
import { fetchServerEmojis } from "@/lib/serverEmojis";
import type { User, ReactionGroup } from "@/types";

interface MediaComment {
  id: string;
  media_id: string;
  user_id: string;
  content: string;
  reply_to_id: string | null;
  reply_to?: {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    user?: User;
  };
  edited_at: string | null;
  created_at: string;
  user?: User;
  reactions?: ReactionGroup[];
}

interface MediaCommentsProps {
  mediaId: string;
  channelId: string;
}

export const MediaComments = forwardRef<HTMLDivElement, MediaCommentsProps>(({ mediaId, channelId }, ref) => {
  const { user } = useAuthStore();
  const { currentServer } = useServerStore();
  const { hasPermission } = useMemberPermissions(channelId);
  const canManageMessages = hasPermission("manage_messages");

  const [comments, setComments] = useState<MediaComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [replyContent, setReplyContent] = useState("");
  const [replyingToComment, setReplyingToComment] = useState<string | null>(null);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<MediaComment | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState<string | null>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const commentsRef = useRef<MediaComment[]>([]);
  const [customEmojiMap, setCustomEmojiMap] = useState<Map<string, string>>(new Map());

  // Update ref when comments change
  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  // Load server emojis
  useEffect(() => {
    if (!currentServer?.id) return;
    
    let cancelled = false;
    (async () => {
      try {
        const emojis = await fetchServerEmojis(currentServer.id);
        if (!cancelled) {
          const map = new Map<string, string>();
          emojis.forEach((emoji) => {
            map.set(emoji.name, emoji.url);
          });
          setCustomEmojiMap(map);
        }
      } catch {
        if (!cancelled) {
          setCustomEmojiMap(new Map());
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentServer?.id]);

  // Helper to render emoji
  const reactionEmojiNode = useCallback(
    (emoji: string) => {
      const match = emoji.match(/^:([a-z0-9_]{2,32}):$/i);
      if (match) {
        const url = customEmojiMap.get(match[1]);
        if (url) {
          return <img src={url} alt={emoji} className="w-5 h-5 object-contain" loading="lazy" />;
        }
      }
      return <span className="text-base leading-none font-emoji">{emoji}</span>;
    },
    [customEmojiMap],
  );

  // Group reactions helper
  const groupReactions = useCallback((reactions: any[], currentUserId?: string) => {
    const groups: Record<string, { emoji: string; count: number; users: string[]; hasReacted: boolean }> = {};
    reactions.forEach((reaction) => {
      if (!groups[reaction.emoji]) {
        groups[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          users: [],
          hasReacted: false,
        };
      }
      groups[reaction.emoji].count++;
      groups[reaction.emoji].users.push(reaction.user_id);
      if (reaction.user_id === currentUserId) {
        groups[reaction.emoji].hasReacted = true;
      }
    });
    return Object.values(groups);
  }, []);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    if (!mediaId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("media_comments" as any)
        .select(`
          *,
          user:users (*)
        `)
        .eq("media_id", mediaId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const rawData = data as any[] || [];

      // Fetch reply_to data for comments that have it
      const commentsWithReplies = await Promise.all(
        rawData.map(async (comment: any) => {
          if (!comment.reply_to_id) {
            return {
              ...comment,
              user: comment.user,
              reply_to: null,
            };
          }

          // Fetch reply_to comment
          const { data: replyData } = await supabase
            .from("media_comments" as any)
            .select(`
              id,
              user_id,
              content,
              created_at,
              user:users (id, username, display_name, avatar_url)
            `)
            .eq("id", comment.reply_to_id)
            .single();

          const reply = replyData as any;
          return {
            ...comment,
            user: comment.user,
            reply_to: reply ? {
              id: reply.id,
              user_id: reply.user_id,
              content: reply.content,
              created_at: reply.created_at,
              user: reply.user,
            } : null,
          };
        })
      );

      // Fetch reactions for all comments
      const commentIds = commentsWithReplies.map((c: any) => c.id);
      let reactionsMap: Record<string, any[]> = {};
      
      if (commentIds.length > 0) {
        const { data: reactionsData } = await supabase
          .from("media_comment_reactions" as any)
          .select("*")
          .in("comment_id", commentIds);
        
        const reactions = reactionsData as any[] || [];
        reactions.forEach((reaction: any) => {
          if (!reactionsMap[reaction.comment_id]) {
            reactionsMap[reaction.comment_id] = [];
          }
          reactionsMap[reaction.comment_id].push(reaction);
        });
      }

      const commentsWithReactions = commentsWithReplies.map((comment: any) => ({
        ...comment,
        reactions: groupReactions(reactionsMap[comment.id] || [], user?.id),
      }));

      setComments(commentsWithReactions);
    } catch (error) {
      handleError(error, "Failed to fetch comments");
    } finally {
      setIsLoading(false);
    }
  }, [mediaId, user?.id, groupReactions]);

  useEffect(() => {
    fetchComments();

    // Subscribe to real-time updates using postgres_changes (like announcement comments)
    const channel = supabase
      .channel(`media-comments:${mediaId}`, {
        config: {
          broadcast: { self: false },
        },
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "media_comments",
          filter: `media_id=eq.${mediaId}`,
        },
        async (payload) => {
          try {
            const newComment = payload.new as any;
            
            // Check if comment already exists
            if (commentsRef.current.some(c => c.id === newComment.id)) {
              return;
            }

            // Fetch user data
            const { data: userData } = await supabase
              .from("users")
              .select("*")
              .eq("id", newComment.user_id)
              .single();

            // Fetch reply_to data if exists
            let replyToData = null;
            if (newComment.reply_to_id) {
              const { data: replyDataRaw } = await supabase
                .from("media_comments" as any)
                .select(`
                  id,
                  user_id,
                  content,
                  created_at,
                  user:users (id, username, display_name, avatar_url)
                `)
                .eq("id", newComment.reply_to_id)
                .single();
              
              const replyData = replyDataRaw as any;
              if (replyData) {
                replyToData = {
                  id: replyData.id,
                  user_id: replyData.user_id,
                  content: replyData.content,
                  created_at: replyData.created_at,
                  user: replyData.user,
                };
              }
            }

            const comment: MediaComment = {
              ...newComment,
              user: userData,
              reply_to: replyToData,
              reactions: [],
            };

            setComments((prev) => {
              if (prev.some(c => c.id === comment.id)) {
                return prev;
              }
              return [...prev, comment];
            });
          } catch (error) {
            console.error("Failed to handle new comment:", error);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "media_comments",
          filter: `media_id=eq.${mediaId}`,
        },
        async (payload) => {
          try {
            const updatedComment = payload.new as any;
            setComments((prev) =>
              prev.map((c) =>
                c.id === updatedComment.id
                  ? { ...c, content: updatedComment.content, edited_at: updatedComment.edited_at }
                  : c
              )
            );
          } catch (error) {
            console.error("Failed to handle comment update:", error);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "media_comments",
          filter: `media_id=eq.${mediaId}`,
        },
        (payload) => {
          try {
            const deletedId = payload.old?.id;
            if (!deletedId) return;
            setComments((prev) => prev.filter((c) => c.id !== deletedId));
          } catch (error) {
            console.error("Failed to handle comment delete:", error);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "media_comment_reactions",
        },
        async (payload) => {
          try {
            const newReaction = payload.new as any;
            const commentId = newReaction.comment_id;
            
            // Check if this reaction is for a comment in this media
            if (!commentsRef.current.some(c => c.id === commentId)) return;
            
            // Fetch updated reactions for this comment
            const { data: reactionsDataRaw } = await supabase
              .from("media_comment_reactions" as any)
              .select("*")
              .eq("comment_id", commentId);
            
            const reactionsData = reactionsDataRaw as any[] || [];
            const reactions = groupReactions(reactionsData, user?.id);
            
            setComments((prev) =>
              prev.map((c) =>
                c.id === commentId ? { ...c, reactions } : c
              )
            );
          } catch (error) {
            console.error("Failed to handle reaction insert:", error);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "media_comment_reactions",
        },
        async (payload) => {
          try {
            const deletedReaction = payload.old as any;
            const commentId = deletedReaction.comment_id;
            
            // Check if this reaction is for a comment in this media
            if (!commentsRef.current.some(c => c.id === commentId)) return;
            
            // Fetch updated reactions for this comment
            const { data: reactionsDataRaw } = await supabase
              .from("media_comment_reactions" as any)
              .select("*")
              .eq("comment_id", commentId);
            
            const reactionsData = reactionsDataRaw as any[] || [];
            const reactions = groupReactions(reactionsData, user?.id);
            
            setComments((prev) =>
              prev.map((c) =>
                c.id === commentId ? { ...c, reactions } : c
              )
            );
          } catch (error) {
            console.error("Failed to handle reaction delete:", error);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mediaId, fetchComments, user?.id, groupReactions]);

  const handleReply = useCallback(
    async () => {
      if (!user || !replyContent.trim()) return;

      const content = replyContent.trim();
      setIsSendingReply(true);
      const replyToId = replyingToComment || null;
      
      setReplyContent("");
      setReplyingToComment(null);

      try {
        const { data, error } = await supabase
          .from("media_comments" as any)
          .insert({
            media_id: mediaId,
            user_id: user.id,
            content: content,
            reply_to_id: replyToId,
          } as any)
          .select(`*, user:users (*)`)
          .single();

        if (error) throw error;
        // Real-time sync is handled by postgres_changes subscription
      } catch (error) {
        handleError(error, "Failed to send comment");
        setReplyContent(content);
        setReplyingToComment(replyToId);
      } finally {
        setIsSendingReply(false);
      }
    },
    [user, replyContent, replyingToComment, mediaId]
  );

  const handleEdit = useCallback(async () => {
    if (!editingCommentId || !editContent.trim()) return;

    const content = editContent.trim();
    try {
      const { error } = await supabase
        .from("media_comments" as any)
        .update({ 
          content,
          edited_at: new Date().toISOString(),
        } as any)
        .eq("id", editingCommentId);

      if (error) throw error;
      // Real-time sync is handled by postgres_changes subscription

      setEditingCommentId(null);
      setEditContent("");
    } catch (error) {
      handleError(error, "Failed to edit comment");
    }
  }, [editingCommentId, editContent]);

  const handleDelete = useCallback(async (commentId: string) => {
    try {
      if (canManageMessages) {
        const { error } = await supabase
          .from("media_comments" as any)
          .delete()
          .eq("id", commentId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("media_comments" as any)
          .delete()
          .eq("id", commentId)
          .eq("user_id", user?.id);
        if (error) throw error;
      }
      // Real-time sync is handled by postgres_changes subscription
    } catch (error) {
      handleError(error, "Failed to delete comment");
    }
  }, [canManageMessages, user?.id]);

  const handleReaction = useCallback(async (commentId: string, emoji: string) => {
    if (!user) return;
    
    const comment = comments.find(c => c.id === commentId);
    const existingReaction = comment?.reactions?.find(r => r.emoji === emoji);
    const hasReacted = existingReaction?.hasReacted;

    try {
      if (hasReacted) {
        await supabase
          .from("media_comment_reactions" as any)
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", user.id)
          .eq("emoji", emoji);
      } else {
        await supabase
          .from("media_comment_reactions" as any)
          .insert({
            comment_id: commentId,
            user_id: user.id,
            emoji,
          } as any);
      }
      // Real-time sync is handled by postgres_changes subscription
    } catch (error) {
      console.error("Failed to toggle reaction:", error);
    }
  }, [user, comments]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    if (emojiPickerOpen) {
      handleReaction(emojiPickerOpen, emoji);
      setEmojiPickerOpen(null);
    }
  }, [emojiPickerOpen, handleReaction]);

  const replyingToCommentData = replyingToComment 
    ? comments.find(c => c.id === replyingToComment)
    : null;

  return (
    <div ref={ref} className="flex flex-col h-full">
      {/* Comments Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <MessageSquare className="w-5 h-5 text-muted-foreground" />
        <span className="font-medium text-foreground">
          Comments ({comments.length})
        </span>
      </div>

      {/* Comments List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No comments yet</p>
              <p className="text-xs opacity-75">Be the first to comment!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="group relative"
                onMouseEnter={() => setHoveredCommentId(comment.id)}
                onMouseLeave={() => setHoveredCommentId(null)}
              >
                {/* Reply reference */}
                {comment.reply_to && (
                  <div className="flex items-center gap-2 mb-1 ml-10 text-xs text-muted-foreground">
                    <CornerUpLeft className="w-3 h-3" />
                    <span className="font-medium">
                      {comment.reply_to.user?.display_name || comment.reply_to.user?.username || 'Unknown'}
                    </span>
                    <span className="line-clamp-1 opacity-75">
                      {comment.reply_to.content?.slice(0, 50)}
                      {(comment.reply_to.content?.length || 0) > 50 ? '...' : ''}
                    </span>
                  </div>
                )}

                <div className="flex gap-3">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={comment.user?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {comment.user?.username?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0 relative">
                    <div className="flex items-baseline gap-2 pr-20">
                      <span className="font-medium text-sm text-foreground">
                        {comment.user?.display_name || comment.user?.username || 'Unknown'}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatMessageTimestamp(comment.created_at)}
                        {comment.edited_at && (
                          <span className="ml-1 opacity-75">(edited)</span>
                        )}
                      </span>
                    </div>
                    
                    {/* Action buttons - matching announcement comments design */}
                    {(hoveredCommentId === comment.id || emojiPickerOpen === comment.id) && editingCommentId !== comment.id && (
                      <div 
                        className="hover-actions-menu absolute right-0 -top-4 z-50 flex items-center gap-1 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-xl p-1 transition-opacity duration-200"
                        onMouseEnter={() => setHoveredCommentId(comment.id)}
                        onMouseLeave={(e) => {
                          const relatedTarget = e.relatedTarget as HTMLElement;
                          if (!relatedTarget || !relatedTarget.closest('[role="dialog"]')) {
                            setHoveredCommentId(null);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <EmojiGifPicker
                          onEmojiSelect={handleEmojiSelect}
                          onGifSelect={() => {}}
                          open={emojiPickerOpen === comment.id}
                          onOpenChange={(open) => {
                            setEmojiPickerOpen(open ? comment.id : null);
                            if (open) {
                              setHoveredCommentId(comment.id);
                            }
                          }}
                          disableGif
                          serverId={currentServer?.id}
                          serverName={currentServer?.name}
                        >
                          <button
                            type="button"
                            className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            aria-label="Add reaction"
                            title="Add reaction"
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            <Smile className="w-4 h-4" />
                          </button>
                        </EmojiGifPicker>
                        
                        <button
                          type="button"
                          className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setReplyingToComment(comment.id);
                          }}
                          onMouseDown={(e) => e.preventDefault()}
                          aria-label="Reply"
                          title="Reply"
                        >
                          <Reply className="w-4 h-4" />
                        </button>
                        
                        {comment.user_id === user?.id && (
                          <button
                            type="button"
                            className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditingCommentId(comment.id);
                              setEditContent(comment.content);
                            }}
                            onMouseDown={(e) => e.preventDefault()}
                            aria-label="Edit"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        
                        {(comment.user_id === user?.id || canManageMessages) && (
                          <button
                            type="button"
                            className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setCommentToDelete(comment);
                              setShowDeleteModal(true);
                            }}
                            onMouseDown={(e) => e.preventDefault()}
                            aria-label="Delete"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}

                    {editingCommentId === comment.id ? (
                      <div className="mt-1 space-y-2">
                        <Textarea
                          ref={editTextareaRef}
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="min-h-[60px] text-sm"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleEdit}>
                            Save
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              setEditingCommentId(null);
                              setEditContent("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap break-words">
                        {comment.content}
                      </p>
                    )}

                    {/* Reactions - matching announcement comments design */}
                    {comment.reactions && comment.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {comment.reactions.map((reaction) => (
                          <button
                            key={reaction.emoji}
                            onClick={() => handleReaction(comment.id, reaction.emoji)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-md border transition-colors duration-200 ${
                              reaction.hasReacted
                                ? "bg-primary/20 border-primary text-primary"
                                : "bg-secondary border-transparent hover:border-border"
                            }`}
                          >
                            {reactionEmojiNode(reaction.emoji)}
                            <span className="text-xs">{reaction.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Reply Input */}
      {user && (
        <div className="p-3 border-t border-border">
          {replyingToCommentData && (
            <div className="flex items-center gap-2 mb-2 p-2 bg-muted rounded-lg text-sm">
              <Reply className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Replying to</span>
              <span className="font-medium text-foreground">
                {replyingToCommentData.user?.display_name || replyingToCommentData.user?.username}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="w-5 h-5 ml-auto"
                onClick={() => setReplyingToComment(null)}
              >
                <span className="sr-only">Cancel reply</span>
                ×
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a comment..."
              className="min-h-[40px] max-h-[120px] text-sm resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleReply();
                }
              }}
            />
            <Button
              size="icon"
              onClick={handleReply}
              disabled={!replyContent.trim() || isSendingReply}
              className="flex-shrink-0"
            >
              {isSendingReply ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      <DeleteMessageModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        onConfirm={() => {
          if (commentToDelete) {
            handleDelete(commentToDelete.id);
            setCommentToDelete(null);
          }
        }}
        onClose={() => {
          setShowDeleteModal(false);
          setCommentToDelete(null);
        }}
        messageContent={commentToDelete?.content}
      />
    </div>
  );
});

MediaComments.displayName = 'MediaComments';
