import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Loader2, Pencil, Trash2, X, Reply, Smile, CornerUpLeft } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { useRealtimeTasks } from "@/hooks/useRealtimeTasks";
import { supabase } from "@/integrations/supabase/client";
import { handleError, showSuccess } from "@/lib/errorHandler";
import { parseTextContent, ReplyPreview } from "@/components/chat/MessageContent";
import { formatMessageTimestamp } from "@/lib/format";
import { EmojiGifPicker } from "@/components/modals/EmojiGifPicker";
import { fetchServerEmojis } from "@/lib/serverEmojis";
import type { TaskComment } from "@/types";

interface TaskCommentSectionProps {
  taskId: string;
  channelId: string;
}

export const TaskCommentSection = ({ taskId, channelId }: TaskCommentSectionProps) => {
  const { user } = useAuthStore();
  const { currentServer } = useServerStore();
  const { hasPermission } = useMemberPermissions(channelId);

  const [comments, setComments] = useState<TaskComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [commentContent, setCommentContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [customEmojiMap, setCustomEmojiMap] = useState<Map<string, string>>(new Map());
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const canManageMessages = hasPermission("manage_messages");

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
      } catch (error) {
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
  const reactionEmojiNode = (emoji: string) => {
    const match = emoji.match(/^:([a-z0-9_]{2,32}):$/i);
    if (match) {
      const url = customEmojiMap.get(match[1]);
      if (url) {
        return <img src={url} alt={emoji} className="w-5 h-5 object-contain" loading="lazy" />;
      }
    }
    return <span className="text-base leading-none font-emoji">{emoji}</span>;
  };

  // Fetch comments
  const fetchComments = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase.rpc("get_task_comments", {
        _task_id: taskId,
        _user_id: user.id,
      });

      if (error) throw error;

      const commentData = (data || []) as any[];

      // Fetch user data for all comments and reply_to comments
      const userIds = new Set<string>();
      commentData.forEach((c) => {
        userIds.add(c.user_id);
        if (c.reply_to?.user_id) {
          userIds.add(c.reply_to.user_id);
        }
      });

      if (userIds.size > 0) {
        const { data: usersData } = await supabase
          .from("users")
          .select("id, username, display_name, avatar_url, banner_color")
          .in("id", Array.from(userIds));

        const userMap = new Map((usersData || []).map((u) => [u.id, u]));

        const commentsWithUsers: TaskComment[] = commentData.map((comment) => ({
          ...comment,
          user: userMap.get(comment.user_id),
          reply_to: comment.reply_to
            ? {
                ...comment.reply_to,
                user: userMap.get(comment.reply_to.user_id),
              }
            : undefined,
        }));

        setComments(commentsWithUsers);
      } else {
        setComments(commentData);
      }
    } catch (error) {
      handleError(error, "Failed to fetch comments");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [taskId, user?.id]);

  // Realtime updates - subscribe to task comments
  useEffect(() => {
    if (!taskId) return;

    const channel = supabase
      .channel(`task-comments:${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_comments',
          filter: `task_id=eq.${taskId}`,
        },
        async (payload) => {
          const newComment = payload.new as any;
          // Fetch user data for the new comment
          const { data: userData } = await supabase
            .from('users')
            .select('id, username, display_name, avatar_url, banner_color')
            .eq('id', newComment.user_id)
            .single();

          // If it's a reply, fetch the parent comment data
          let replyTo: TaskComment | undefined;
          if (newComment.reply_to_id) {
            const { data: parentComment } = await supabase
              .from('task_comments')
              .select('id, user_id, content, created_at')
              .eq('id', newComment.reply_to_id)
              .single();

            if (parentComment) {
              const { data: parentUser } = await supabase
                .from('users')
                .select('id, username, display_name, avatar_url, banner_color')
                .eq('id', parentComment.user_id)
                .single();

              replyTo = {
                ...parentComment,
                user: parentUser || undefined,
              } as TaskComment;
            }
          }

          const commentWithUser: TaskComment = {
            ...newComment,
            user: userData || undefined,
            reply_to: replyTo,
          };

          setComments((prev) => {
            // Check if comment already exists (avoid duplicates)
            const exists = prev.some((c) => c.id === commentWithUser.id);
            if (exists) {
              // Update existing comment
              return prev.map((c) => (c.id === commentWithUser.id ? commentWithUser : c));
            }
            // Add new comment and sort chronologically
            return [...prev, commentWithUser].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'task_comments',
          filter: `task_id=eq.${taskId}`,
        },
        async (payload) => {
          const updatedComment = payload.new as any;
          // Fetch user data
          const { data: userData } = await supabase
            .from('users')
            .select('id, username, display_name, avatar_url, banner_color')
            .eq('id', updatedComment.user_id)
            .single();

          // Fetch reply_to if it exists
          let replyTo: TaskComment | undefined;
          if (updatedComment.reply_to_id) {
            const { data: parentComment } = await supabase
              .from('task_comments')
              .select('id, user_id, content, created_at')
              .eq('id', updatedComment.reply_to_id)
              .single();

            if (parentComment) {
              const { data: parentUser } = await supabase
                .from('users')
                .select('id, username, display_name, avatar_url, banner_color')
                .eq('id', parentComment.user_id)
                .single();

              replyTo = {
                ...parentComment,
                user: parentUser || undefined,
              } as TaskComment;
            }
          }

          const commentWithUser: TaskComment = {
            ...updatedComment,
            user: userData || undefined,
            reply_to: replyTo,
          };

          setComments((prev) =>
            prev.map((c) => (c.id === commentWithUser.id ? commentWithUser : c))
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'task_comments',
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          const oldComment = payload.old as { id: string };
          setComments((prev) => prev.filter((c) => c.id !== oldComment.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  const handleSendComment = async () => {
    if (!user || !commentContent.trim()) return;

    const content = commentContent.trim();
    setIsSending(true);
    
    // Clear input immediately for better UX
    setCommentContent("");
    
    try {
      const { data, error } = await supabase.rpc("create_task_comment", {
        _task_id: taskId,
        _user_id: user.id,
        _content: content,
        _reply_to_id: null,
      });

      if (error) {
        // Restore content on error
        setCommentContent(content);
        throw error;
      }

      showSuccess("Comment added");
      // Fetch immediately to show the comment, realtime will handle future updates
      fetchComments();
    } catch (error) {
      handleError(error, "Failed to add comment");
    } finally {
      setIsSending(false);
    }
  };

  const handleSendReply = async (parentCommentId: string) => {
    if (!user || !replyContent.trim()) return;

    const content = replyContent.trim();
    setIsSendingReply(true);
    
    // Clear inputs immediately for better UX
    setReplyContent("");
    setReplyingToId(null);
    
    try {
      const { error } = await supabase.rpc("create_task_comment", {
        _task_id: taskId,
        _user_id: user.id,
        _content: content,
        _reply_to_id: parentCommentId,
      });

      if (error) {
        // Restore content on error
        setReplyContent(content);
        setReplyingToId(parentCommentId);
        throw error;
      }

      showSuccess("Reply added");
      // Fetch immediately to show the reply, realtime will handle future updates
      fetchComments();
    } catch (error) {
      handleError(error, "Failed to add reply");
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!user || !editContent.trim()) return;

    try {
      const { error } = await supabase.rpc("update_task_comment", {
        _comment_id: commentId,
        _user_id: user.id,
        _content: editContent.trim(),
      });

      if (error) throw error;

      setEditingCommentId(null);
      setEditContent("");
      showSuccess("Comment updated");
      // Realtime will handle the update
    } catch (error) {
      handleError(error, "Failed to update comment");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user || !confirm("Are you sure you want to delete this comment?")) return;

    try {
      const { error } = await supabase.rpc("delete_task_comment", {
        _comment_id: commentId,
        _user_id: user.id,
      });

      if (error) throw error;

      showSuccess("Comment deleted");
      // Realtime will handle the update
    } catch (error) {
      handleError(error, "Failed to delete comment");
    }
  };

  const canEditComment = (comment: TaskComment) => {
    return comment.user_id === user?.id;
  };

  const canDeleteComment = (comment: TaskComment) => {
    return comment.user_id === user?.id || canManageMessages;
  };

  // Render a comment (all comments shown inline, replies with preview)
  const renderComment = (comment: TaskComment) => {
    const isOwnComment = user?.id === comment.user_id;
    const isHovered = hoveredCommentId === comment.id;
    const isEditing = editingCommentId === comment.id;
    const canDelete = canDeleteComment(comment);
    const parsedContent = parseTextContent(
      comment.content,
      user?.id,
      undefined,
      undefined,
      customEmojiMap
    );

    return (
      <div
        key={comment.id}
        className="group relative flex gap-3"
        onMouseEnter={() => setHoveredCommentId(comment.id)}
        onMouseLeave={() => setHoveredCommentId(null)}
      >
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarImage src={comment.user?.avatar_url} />
          <AvatarFallback
            style={{ backgroundColor: comment.user?.banner_color || "#5865F2" }}
            className="text-xs"
          >
            {comment.user?.username?.[0]?.toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">
              {comment.user?.display_name || comment.user?.username || "Unknown"}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatMessageTimestamp(comment.created_at)}
            </span>
            {comment.edited_at && (
              <span className="text-[10px] text-muted-foreground">(edited)</span>
            )}
          </div>

          {/* Reply reference - show like forum messages */}
          {comment.reply_to && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <CornerUpLeft className="w-3 h-3 flex-shrink-0" />
              <span>Replying to</span>
              <span className="font-medium text-primary">
                @{comment.reply_to.user?.username || "unknown"}
              </span>
              <span className="truncate max-w-[200px]">
                <ReplyPreview content={comment.reply_to.content} maxLength={50} />
              </span>
            </div>
          )}

          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                ref={editTextareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[60px] resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setEditingCommentId(null);
                    setEditContent("");
                  } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleEditComment(comment.id);
                  }
                }}
                autoFocus
              />
              <div className="flex gap-2 text-xs">
                <button
                  className="text-primary hover:underline"
                  onClick={() => handleEditComment(comment.id)}
                >
                  Save
                </button>
                <button
                  className="text-muted-foreground hover:underline"
                  onClick={() => {
                    setEditingCommentId(null);
                    setEditContent("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                className="text-sm prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: parsedContent }}
              />
            </>
          )}

          {/* Hover actions menu */}
          {(isHovered || showEmojiPicker === comment.id) && !isEditing && (
            <div
              className="hover-actions-menu absolute right-2 -top-4 z-50 flex items-center gap-1 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-xl p-1 transition-opacity duration-200"
              onMouseEnter={() => setHoveredCommentId(comment.id)}
              onMouseLeave={(e) => {
                const relatedTarget = e.relatedTarget as HTMLElement;
                if (!relatedTarget || !relatedTarget.closest('[role="dialog"]')) {
                  setHoveredCommentId(null);
                }
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Reply */}
              <button
                type="button"
                className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setReplyingToId(comment.id);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                aria-label="Reply"
                title="Reply"
              >
                <Reply className="w-4 h-4" />
              </button>

              {/* Edit (own comments) */}
              {isOwnComment && (
                <button
                  type="button"
                  className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditingCommentId(comment.id);
                    setEditContent(comment.content);
                    setTimeout(() => editTextareaRef.current?.focus(), 0);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  aria-label="Edit"
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}

              <div className="w-px h-5 bg-border mx-0.5" />

              {/* Delete (own comments or admins) */}
              {canDelete && (
                <button
                  type="button"
                  className="p-2 rounded-lg bg-transparent hover:bg-destructive/10 transition-colors text-destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteComment(comment.id);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  aria-label="Delete"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    );
  };

  const totalCount = comments.reduce(
    (total, comment) => total + 1 + (comment.replies?.length || 0),
    0
  );

  return (
    <div className="space-y-4 pt-4">
      <h3 className="text-sm font-semibold">Comments ({comments.length})</h3>

      {/* Comments List */}
      <div className="space-y-4 max-h-[400px] overflow-y-auto">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="text-sm text-muted-foreground">No comments yet</div>
        ) : (
          comments.map((comment) => renderComment(comment))
        )}
      </div>

      {/* Comment Input */}
      <div className="border-t border-border pt-4">
        <div className="space-y-2">
          {/* Reply Preview */}
          {replyingToId && (() => {
            const replyToComment = comments.find((c) => c.id === replyingToId);
            if (!replyToComment) return null;
            return (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-lg border border-border/50 text-xs">
                <span className="text-muted-foreground">Replying to</span>
                <span className="font-medium text-primary">
                  {replyToComment.user?.display_name || replyToComment.user?.username || "Unknown"}
                </span>
                <span className="text-muted-foreground truncate flex-1">
                  <ReplyPreview content={replyToComment.content} maxLength={50} />
                </span>
                <button
                  onClick={() => setReplyingToId(null)}
                  className="p-1 rounded hover:bg-muted"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })()}
          <Textarea
            value={replyingToId ? replyContent : commentContent}
            onChange={(e) => {
              if (replyingToId) {
                setReplyContent(e.target.value);
              } else {
                setCommentContent(e.target.value);
              }
            }}
            placeholder={replyingToId ? "Write a reply..." : "Add a comment..."}
            className="min-h-[80px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                if (replyingToId) {
                  const parentComment = comments.find((c) => c.id === replyingToId);
                  if (parentComment) {
                    handleSendReply(parentComment.id);
                  }
                } else {
                  handleSendComment();
                }
              }
            }}
          />
          <div className="flex justify-end gap-2">
            {replyingToId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setReplyingToId(null);
                  setReplyContent("");
                }}
              >
                Cancel
              </Button>
            )}
            <Button
              onClick={() => {
                if (replyingToId) {
                  const parentComment = comments.find((c) => c.id === replyingToId);
                  if (parentComment) {
                    handleSendReply(parentComment.id);
                  }
                } else {
                  handleSendComment();
                }
              }}
              disabled={
                (replyingToId ? isSendingReply : isSending) ||
                (replyingToId ? !replyContent.trim() : !commentContent.trim())
              }
              size="sm"
            >
              {(replyingToId ? isSendingReply : isSending) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
