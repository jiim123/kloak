import { useState, useEffect, useCallback, useRef } from "react";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { X, Send, Loader2, Reply, Pencil, Trash2, Smile, ArrowLeft, CornerUpLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { EmojiGifPicker } from "@/components/modals/EmojiGifPicker";
import { DeleteMessageModal } from "@/components/modals/DeleteMessageModal";
import { supabase } from "@/integrations/supabase/client";
import { handleError, showSuccess } from "@/lib/errorHandler";
import { formatMessageTimestamp } from "@/lib/format";
import { formatDistanceToNow } from "date-fns";
import { isImageOnlyMessage } from "@/lib/message";
import { isPollMessageContent } from "@/lib/poll";
import { ReplyPreview } from "@/components/chat/MessageContent";
import { fetchServerEmojis } from "@/lib/serverEmojis";
import { getOrFetchUser, getUserFromCache } from "@/lib/userCache";
import type { Message, User, ReactionGroup } from "@/types";

interface AnnouncementComment {
  id: string;
  message_id: string;
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

interface AnnouncementViewProps {
  message: Message;
  onClose: () => void;
}

export const AnnouncementView = ({ message, onClose }: AnnouncementViewProps) => {
  const { user } = useAuthStore();
  const { currentServer } = useServerStore();
  const { setMobileSidebarOpen, setMemberSidebarOpen } = useUIStore();
  const isMobile = useIsMobile();
  const { hasPermission } = useMemberPermissions(message.channel_id);
  const canManageMessages = hasPermission("manage_messages");

  const [comments, setComments] = useState<AnnouncementComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [replyContent, setReplyContent] = useState("");
  const [replyingToComment, setReplyingToComment] = useState<string | null>(null);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<AnnouncementComment | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const commentsRef = useRef<AnnouncementComment[]>([]);
  const [customEmojiMap, setCustomEmojiMap] = useState<Map<string, string>>(new Map());
  const [reactionUserNameOverrides, setReactionUserNameOverrides] = useState<Map<string, string>>(new Map());

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
  const reactionEmojiNode = useCallback(
    (emoji: string) => {
      const match = emoji.match(/^:([a-z0-9_]{2,12}):$/i);
      if (match) {
        const url = customEmojiMap.get(match[1]);
        if (url) {
          return <img src={url} alt={emoji} className="w-6 h-6 object-contain" loading="lazy" />;
        }
      }
      return <span className="text-xl leading-none font-emoji">{emoji}</span>;
    },
    [customEmojiMap],
  );

  // Fetch comments
  const fetchComments = useCallback(async () => {
    if (!message.id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("announcement_comments")
        .select(`
          *,
          user:users (*)
        `)
        .eq("message_id", message.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch reply_to data for comments that have it
      const commentsWithReplies = await Promise.all(
        (data || []).map(async (comment: any) => {
          if (!comment.reply_to_id) {
            return {
              ...comment,
              user: comment.user,
              reply_to: null,
            };
          }

          // Fetch reply_to comment
          const { data: replyData } = await supabase
            .from("announcement_comments")
            .select(`
              id,
              user_id,
              content,
              created_at,
              user:users (id, username, display_name, avatar_url)
            `)
            .eq("id", comment.reply_to_id)
            .single();

          return {
            ...comment,
            user: comment.user,
            reply_to: replyData ? {
              id: replyData.id,
              user_id: replyData.user_id,
              content: replyData.content,
              created_at: replyData.created_at,
              user: replyData.user,
            } : null,
          };
        })
      );

      // Fetch reactions for all comments
      const commentIds = commentsWithReplies.map((c: any) => c.id);
      let reactionsMap: Record<string, any[]> = {};
      
      if (commentIds.length > 0) {
        const { data: reactionsData } = await supabase
          .from("announcement_comment_reactions")
          .select("*")
          .in("comment_id", commentIds);
        
        if (reactionsData) {
          reactionsData.forEach((reaction) => {
            if (!reactionsMap[reaction.comment_id]) {
              reactionsMap[reaction.comment_id] = [];
            }
            reactionsMap[reaction.comment_id].push(reaction);
          });
        }
      }

      // Group reactions
      const groupReactions = (reactions: any[], currentUserId?: string) => {
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
      };

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
  }, [message.id, user?.id]);

  useEffect(() => {
    fetchComments();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`announcement-comments:${message.id}`, {
        config: {
          broadcast: { self: false },
        },
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "announcement_comments",
          filter: `message_id=eq.${message.id}`,
        },
        async (payload) => {
          try {
            const newComment = payload.new as any;
            
            // Check if comment already exists
            if (commentsRef.current.some(c => c.id === newComment.id)) {
              return;
            }

            // Fetch user data
            const { data: userRows } = await supabase.rpc("get_users_basic_secure", {
              _user_id: user!.id,
              _target_user_ids: [newComment.user_id],
            });
            const userData = Array.isArray(userRows) ? userRows[0] : null;

            // Fetch reply_to data if exists
            let replyToData = null;
            if (newComment.reply_to_id) {
              const { data: replyData } = await supabase
                .from("announcement_comments")
                .select(`
                  id,
                  user_id,
                  content,
                  created_at,
                  user:users (id, username, display_name, avatar_url)
                `)
                .eq("id", newComment.reply_to_id)
                .single();
              
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

            const comment: AnnouncementComment = {
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
          table: "announcement_comments",
          filter: `message_id=eq.${message.id}`,
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
          table: "announcement_comments",
          filter: `message_id=eq.${message.id}`,
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
          table: "announcement_comment_reactions",
        },
        async (payload) => {
          try {
            const newReaction = payload.new as any;
            const commentId = newReaction.comment_id;
            
            // Check if this reaction is for a comment in this announcement
            if (!commentsRef.current.some(c => c.id === commentId)) return;
            
            // Fetch updated reactions for this comment
            const { data: reactionsData } = await supabase
              .from("announcement_comment_reactions")
              .select("*")
              .eq("comment_id", commentId);
            
            if (reactionsData) {
              const groupReactions = (reactions: any[], currentUserId?: string) => {
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
              };
              
              const reactions = groupReactions(reactionsData, user?.id);
              
              setComments((prev) =>
                prev.map((c) =>
                  c.id === commentId ? { ...c, reactions } : c
                )
              );
            }
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
          table: "announcement_comment_reactions",
        },
        async (payload) => {
          try {
            const deletedReaction = payload.old as any;
            const commentId = deletedReaction.comment_id;
            
            // Check if this reaction is for a comment in this announcement
            if (!commentsRef.current.some(c => c.id === commentId)) return;
            
            // Fetch updated reactions for this comment
            const { data: reactionsData } = await supabase
              .from("announcement_comment_reactions")
              .select("*")
              .eq("comment_id", commentId);
            
            if (reactionsData !== null) {
              const groupReactions = (reactions: any[], currentUserId?: string) => {
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
              };
              
              const reactions = groupReactions(reactionsData, user?.id);
              
              setComments((prev) =>
                prev.map((c) =>
                  c.id === commentId ? { ...c, reactions } : c
                )
              );
            }
          } catch (error) {
            console.error("Failed to handle reaction delete:", error);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [message.id, fetchComments, user?.id]);

  useEffect(() => {
    let cancelled = false;
    const unresolvedUserIds = new Set<string>();

    comments.forEach((comment) => {
      (comment.reactions || []).forEach((reaction) => {
        reaction.users.forEach((reactorId) => {
          if (!reactorId || reactorId === user?.id || reactorId.startsWith("ghost_")) return;
          if (reactionUserNameOverrides.has(reactorId)) return;

          const reactingComment = comments.find((c) => c.user_id === reactorId);
          if (reactingComment?.user?.display_name || reactingComment?.user?.username) return;

          const cached = getUserFromCache(reactorId);
          const cachedName = cached?.display_name ?? cached?.username ?? null;
          if (cachedName) {
            setReactionUserNameOverrides((prev) => {
              if (prev.get(reactorId) === cachedName) return prev;
              const next = new Map(prev);
              next.set(reactorId, cachedName);
              return next;
            });
            return;
          }

          unresolvedUserIds.add(reactorId);
        });
      });
    });

    unresolvedUserIds.forEach((reactorId) => {
      void getOrFetchUser(reactorId)
        .then((fetched) => {
          if (cancelled || !fetched) return;
          const displayName = fetched.display_name ?? fetched.username;
          if (!displayName) return;
          setReactionUserNameOverrides((prev) => {
            if (prev.get(reactorId) === displayName) return prev;
            const next = new Map(prev);
            next.set(reactorId, displayName);
            return next;
          });
        })
        .catch(() => undefined);
    });

    return () => {
      cancelled = true;
    };
  }, [comments, reactionUserNameOverrides, user?.id]);

  const getReactionDisplayName = useCallback(
    (reactorId: string) => {
      if (reactorId === user?.id) return "You";
      const reactingComment = comments.find((c) => c.user_id === reactorId);
      if (reactingComment?.user) {
        return reactingComment.user.display_name || reactingComment.user.username || reactorId;
      }
      const overrideName = reactionUserNameOverrides.get(reactorId);
      if (overrideName) return overrideName;
      const cached = getUserFromCache(reactorId);
      if (cached) return cached.display_name ?? cached.username ?? reactorId;
      return reactorId;
    },
    [comments, reactionUserNameOverrides, user?.id],
  );

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
          .from("announcement_comments")
          .insert({
            message_id: message.id,
            user_id: user.id,
            content: content,
            reply_to_id: replyToId,
          })
          .select(`
            *,
            user:users (*)
          `)
          .single();

        if (error) throw error;

        // Fetch reply_to data if exists
        let replyToData = null;
        if (data.reply_to_id) {
          const { data: replyData } = await supabase
            .from("announcement_comments")
            .select(`
              id,
              user_id,
              content,
              created_at,
              user:users (id, username, display_name, avatar_url)
            `)
            .eq("id", data.reply_to_id)
            .single();
          
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

        const newComment: AnnouncementComment = {
          ...data,
          user: data.user,
          reply_to: replyToData,
          reactions: [],
        };

        setComments((prev) => {
          if (prev.some(c => c.id === newComment.id)) {
            return prev;
          }
          return [...prev, newComment];
        });
      } catch (error) {
        setReplyContent(content);
        handleError(error, "Failed to send comment");
      } finally {
        setIsSendingReply(false);
      }
    },
    [user, replyContent, message.id, replyingToComment]
  );

  const handleEditComment = useCallback(async (commentId: string) => {
    if (!user || !editContent.trim()) return;
    
    try {
      const { error } = await supabase
        .from("announcement_comments")
        .update({ 
          content: editContent.trim(),
          edited_at: new Date().toISOString()
        })
        .eq("id", commentId)
        .eq("user_id", user.id);

      if (error) throw error;

      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, content: editContent.trim(), edited_at: new Date().toISOString() }
            : c
        )
      );

      setEditingCommentId(null);
      setEditContent("");
    } catch (error) {
      handleError(error, "Failed to edit comment");
    }
  }, [user, editContent]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (!user) return;
    
    try {
      // If user has manage_messages permission, they can delete any comment
      // Otherwise, only the comment owner can delete
      if (canManageMessages) {
        const { error } = await supabase
          .from("announcement_comments")
          .delete()
          .eq("id", commentId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("announcement_comments")
          .delete()
          .eq("id", commentId)
          .eq("user_id", user.id);

        if (error) throw error;
      }

      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setShowDeleteModal(false);
      setCommentToDelete(null);
    } catch (error) {
      handleError(error, "Failed to delete comment");
    }
  }, [user, canManageMessages]);

  const handleAddReaction = useCallback(async (commentId: string, emoji: string) => {
    if (!user) return;
    
    try {
      const { error } = await (supabase.rpc as any)('toggle_announcement_comment_reaction', {
        _comment_id: commentId,
        _user_id: user.id,
        _emoji: emoji
      });

      if (error) throw error;
      
      setShowEmojiPicker(null);
    } catch (error) {
      handleError(error, "Failed to add reaction");
    }
  }, [user]);

  // Extract title and content from message
  const messageContent = message.content || "";
  const parts = messageContent.split('\n\n');
  const announcementTitle = parts.length > 1 
    ? parts[0].trim() 
    : messageContent.split('\n')[0].trim() || "";

  return (
    <div className="h-full flex flex-col min-w-0 bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0"
        >
          {isMobile ? <ArrowLeft className="w-5 h-5" /> : <X className="w-4 h-4" />}
        </Button>
        <h3 className="text-lg font-medium flex-1 truncate">{announcementTitle || "Announcement"}</h3>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Comments */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">
            Comments ({comments.length})
          </h4>
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">No comments yet. Be the first to comment!</div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => {
              const isOwnComment = user?.id === comment.user_id;
              const isHovered = hoveredCommentId === comment.id;
              const isEditing = editingCommentId === comment.id;
              const canDeleteComment = isOwnComment || canManageMessages;
              
              return (
                <div
                  key={comment.id}
                  className="group relative flex gap-3 cursor-pointer"
                  onMouseEnter={() => setHoveredCommentId(comment.id)}
                  onMouseLeave={() => setHoveredCommentId(null)}
                  onClick={(e) => {
                    // Click-to-reply: trigger reply when clicking on comment body
                    const target = e.target as HTMLElement;
                    const isInteractive = target.closest('button, a, input, textarea, [role="button"], [contenteditable], .hover-actions-menu');
                    if (!isInteractive && !isEditing) {
                      setReplyingToComment(comment.id);
                    }
                  }}
                >
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={comment.user?.avatar_url} />
                    <AvatarFallback>
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
                    
                    {/* Reply reference */}
                    {comment.reply_to && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <CornerUpLeft className="w-3 h-3 flex-shrink-0" />
                        <span>Replying to</span>
                        <span className="font-medium text-primary">
                          @{comment.reply_to.user?.username || "unknown"}
                        </span>
                        {isPollMessageContent(comment.reply_to.content) ? (
                          <span className="italic">poll</span>
                        ) : isImageOnlyMessage(comment.reply_to.content) ? (
                          <img
                            src={comment.reply_to.content.trim()}
                            alt="Image"
                            className="w-6 h-6 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <span className="truncate max-w-[200px]">
                            <ReplyPreview content={comment.reply_to.content} maxLength={50} />
                          </span>
                        )}
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
                        <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                        
                        {/* Reactions */}
                        {comment.reactions && comment.reactions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {comment.reactions.map((reaction) => {
                              // Get user names for hover card
                              const reactionUserNames = reaction.users
                                .slice(0, 5)
                                .map((reactorId) => getReactionDisplayName(reactorId));
                              const remainingCount = Math.max(0, reaction.users.length - 5);
                              
                              return (
                                <HoverCard key={reaction.emoji} openDelay={200}>
                                  <HoverCardTrigger asChild>
                                    <button
                                      onClick={() => handleAddReaction(comment.id, reaction.emoji)}
                                      className={`flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-md border transition-colors duration-200 ${
                                        reaction.hasReacted
                                          ? "bg-primary/20 border-primary text-primary"
                                          : "bg-secondary border-transparent hover:border-border"
                                      }`}
                                    >
                                      {reactionEmojiNode(reaction.emoji)}
                                      <span className="text-xs">{reaction.count}</span>
                                    </button>
                                  </HoverCardTrigger>
                                  <HoverCardContent className="w-auto p-2" align="start" side="top">
                                    <div className="flex items-center gap-2">
                                      <div className="shrink-0 text-2xl">{reactionEmojiNode(reaction.emoji)}</div>
                                      <div className="min-w-0 text-sm">
                                        <span className="text-muted-foreground">reacted by </span>
                                        {reactionUserNames.map((name, idx) => (
                                          <span key={`${reaction.emoji}-${idx}`}>
                                            <span className="font-medium">{name}</span>
                                            {idx < reactionUserNames.length - 1 ? ', ' : ''}
                                          </span>
                                        ))}
                                        {remainingCount > 0 && (
                                          <span className="text-muted-foreground"> and {remainingCount} others</span>
                                        )}
                                      </div>
                                    </div>
                                  </HoverCardContent>
                                </HoverCard>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  
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
                      {/* Add Reaction */}
                      <EmojiGifPicker
                        open={showEmojiPicker === comment.id}
                        onOpenChange={(open) => {
                          setShowEmojiPicker(open ? comment.id : null);
                          if (open) {
                            setHoveredCommentId(comment.id);
                          }
                        }}
                        onEmojiSelect={(emoji) => {
                          handleAddReaction(comment.id, emoji);
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

                      {/* Reply */}
                      <button
                        type="button"
                        className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setReplyingToComment(comment.id);
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
                      {canDeleteComment && (
                        <button
                          type="button"
                          className="p-2 rounded-lg bg-transparent hover:bg-destructive/10 transition-colors text-destructive"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setCommentToDelete(comment);
                            setShowDeleteModal(true);
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
              );
            })}
          </div>
        )}
      </div>

      {/* Reply Input */}
      <div className="border-t border-border p-4 flex-shrink-0">
        <div className="space-y-2">
          {/* Reply Preview */}
          {replyingToComment && (() => {
            const replyToComment = comments.find(c => c.id === replyingToComment);
            if (!replyToComment) return null;
            return (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-lg border border-border/50 text-xs">
                <span className="text-muted-foreground">Replying to</span>
                <span className="font-medium text-primary">
                  {replyToComment.user?.display_name || replyToComment.user?.username || "Unknown"}
                </span>
                <span className="text-muted-foreground truncate flex-1">
                  {replyToComment.content.substring(0, 50)}
                  {replyToComment.content.length > 50 ? "..." : ""}
                </span>
                <button
                  onClick={() => setReplyingToComment(null)}
                  className="p-1 rounded hover:bg-muted"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })()}
          <Textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder={replyingToComment ? "Write a reply..." : "Write a comment..."}
            className="min-h-[80px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleReply();
              }
            }}
          />
          <div className="flex justify-end gap-2">
            {replyingToComment && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setReplyingToComment(null);
                }}
              >
                Cancel Reply
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleReply}
              disabled={!replyContent.trim() || isSendingReply}
            >
              {isSendingReply ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  {replyingToComment ? "Reply" : "Comment"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Comment Modal */}
      {commentToDelete && (
        <DeleteMessageModal
          open={showDeleteModal}
          onOpenChange={setShowDeleteModal}
          onConfirm={() => handleDeleteComment(commentToDelete.id)}
          messageContent={commentToDelete.content}
        />
      )}
    </div>
  );
};
