import React, { useState, useEffect, useCallback, useRef, forwardRef, useMemo } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import { useUIStore } from "@/stores/uiStore";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { useAuthorStyles } from "@/hooks/useAuthorStyles";
import { 
  Send, 
  Loader2, 
  Reply, 
  Pencil, 
  Trash2, 
  Smile, 
  CornerUpLeft,
  MessageSquare,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { EmojiGifPicker } from "@/components/modals/EmojiGifPicker";
import { DeleteMessageModal } from "@/components/modals/DeleteMessageModal";
import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/lib/errorHandler";
import { formatMessageTimestamp } from "@/lib/format";
import { fetchServerEmojis } from "@/lib/serverEmojis";
import type { User, ReactionGroup, CustomServerRole, ServerRole } from "@/types";

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

const ROLE_COLORS: Record<ServerRole, string> = {
  owner: "text-yellow-400",
  admin: "text-red-400",
  moderator: "text-blue-400",
  member: "text-foreground",
};

const getRoleColorClass = (role?: ServerRole | null): string => {
  return role ? ROLE_COLORS[role] || "text-foreground" : "text-foreground";
};

const isGradientColor = (value?: string | null) => !!value && value.startsWith("linear-gradient");

export const MediaComments = forwardRef<HTMLDivElement, MediaCommentsProps>(({ mediaId, channelId }, ref) => {
  const { user } = useAuthStore();
  const { currentServer, members, roles } = useServerStore();
  const { openModal } = useUIStore();
  const { hasPermission } = useMemberPermissions(channelId);
  const canManageMessages = hasPermission("manage_messages");

  const [comments, setComments] = useState<MediaComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [replyContent, setReplyContent] = useState("");
  const [replyingToComment, setReplyingToComment] = useState<string | null>(null);
  const [isSendingReply, setIsSendingReply] = useState(false);
  
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<MediaComment | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState<string | null>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const commentsRef = useRef<MediaComment[]>([]);
  const [customEmojiMap, setCustomEmojiMap] = useState<Map<string, string>>(new Map());
  const [composerFocused, setComposerFocused] = useState(false);
  const [composerEmojiOpen, setComposerEmojiOpen] = useState(false);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  const membersByUserId = useMemo(() => {
    const map = new Map<string, (typeof members)[number]>();
    members.forEach((member) => map.set(member.user_id, member));
    return map;
  }, [members]);

  const rolesById = useMemo(() => {
    const map = new Map<string, CustomServerRole>();
    roles.forEach((role) => map.set(role.id, role));
    return map;
  }, [roles]);

  const authorStyleTargetIds = useMemo(() => {
    const ids = new Set<string>();
    comments.forEach((comment) => {
      if (comment.user_id) ids.add(comment.user_id);
      if (comment.user?.id) ids.add(comment.user.id);
      if (comment.reply_to?.user_id) ids.add(comment.reply_to.user_id);
      if (comment.reply_to?.user?.id) ids.add(comment.reply_to.user.id);
    });
    return Array.from(ids);
  }, [comments]);

  const authorStyles = useAuthorStyles(currentServer?.id, authorStyleTargetIds);

  const getCommentDisplayName = useCallback(
    (comment: MediaComment) => {
      const member = membersByUserId.get(comment.user_id);
      const fallback = authorStyles[comment.user_id];
      return (
        member?.nickname ||
        fallback?.nickname ||
        comment.user?.display_name ||
        comment.user?.username ||
        "Unknown"
      );
    },
    [membersByUserId, authorStyles],
  );

  const getCommentUsernameColor = useCallback(
    (userId?: string) => {
      if (!userId) return { className: "text-foreground" as const, style: undefined as React.CSSProperties | undefined };

      const member = membersByUserId.get(userId);
      const fallback = authorStyles[userId];
      const memberRoles = member?.roles ?? fallback?.roles ?? [];
      let topCustomRole: CustomServerRole | null = null;

      for (const roleRef of memberRoles) {
        const resolvedRole = rolesById.get(roleRef.id) ?? roleRef;
        if (!topCustomRole) {
          topCustomRole = resolvedRole;
          continue;
        }
        const aPos = typeof resolvedRole.position === "number" ? resolvedRole.position : Number.POSITIVE_INFINITY;
        const bPos = typeof topCustomRole.position === "number" ? topCustomRole.position : Number.POSITIVE_INFINITY;
        if (aPos < bPos) topCustomRole = resolvedRole;
      }

      if (topCustomRole?.color) {
        if (isGradientColor(topCustomRole.color)) {
          return {
            className: "text-transparent",
            style: {
              background: topCustomRole.color,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            } as React.CSSProperties,
          };
        }
        return {
          className: "text-foreground",
          style: { color: topCustomRole.color } as React.CSSProperties,
        };
      }

      return {
        className: getRoleColorClass(member?.role ?? fallback?.role),
        style: undefined,
      };
    },
    [membersByUserId, authorStyles, rolesById],
  );

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
          return <img src={url} alt={emoji} className="w-6 h-6 object-contain" loading="lazy" />;
        }
      }
      return <span className="text-xl leading-none font-emoji">{emoji}</span>;
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
  const fetchComments = useCallback(async (options?: { silent?: boolean }) => {
    if (!mediaId) return;
    const silent = options?.silent ?? false;

    if (!silent) setIsLoading(true);
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
      if (!silent) setIsLoading(false);
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
        "broadcast",
        { event: "media_comments" },
        () => {
          void fetchComments({ silent: true });
        }
      )
      .on(
        "broadcast",
        { event: "media_comment_reactions" },
        () => {
          void fetchComments({ silent: true });
        }
      )
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
            const { data: userRows } = await supabase.rpc("get_users_basic_secure", {
              _user_id: user!.id,
              _target_user_ids: [newComment.user_id],
            });
            const userData = Array.isArray(userRows) ? userRows[0] : null;

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
            const commentId = deletedReaction?.comment_id;
            
            // comment_id might not be available if REPLICA IDENTITY isn't FULL
            // In that case, refetch all reactions for all comments in this media
            if (!commentId) {
              console.log("[MediaComments] No comment_id in DELETE payload, refetching all reactions");
              
              // Refetch reactions for all comments in this media
              const commentIds = commentsRef.current.map(c => c.id);
              if (commentIds.length === 0) return;
              
              const { data: reactionsDataRaw } = await supabase
                .from("media_comment_reactions" as any)
                .select("*")
                .in("comment_id", commentIds);
              
              const reactionsData = reactionsDataRaw as any[] || [];
              const reactionsMap: Record<string, any[]> = {};
              reactionsData.forEach((r: any) => {
                if (!reactionsMap[r.comment_id]) reactionsMap[r.comment_id] = [];
                reactionsMap[r.comment_id].push(r);
              });
              
              setComments((prev) =>
                prev.map((c) => ({
                  ...c,
                  reactions: groupReactions(reactionsMap[c.id] || [], user?.id),
                }))
              );
              return;
            }
            
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
        const { data, error } = await (supabase.rpc as any)('insert_media_comment', {
          _media_id: mediaId,
          _user_id: user.id,
          _content: content,
          _reply_to_id: replyToId
        });

        if (error) throw error;
        await fetchComments({ silent: true });
      } catch (error) {
        handleError(error, "Failed to send comment");
        setReplyContent(content);
        setReplyingToComment(replyToId);
      } finally {
        setIsSendingReply(false);
      }
    },
    [user, replyContent, replyingToComment, mediaId, fetchComments]
  );

  const handleEdit = useCallback(async () => {
    if (!editingCommentId || !editContent.trim()) return;

    const content = editContent.trim();
    try {
      const { error } = await (supabase.rpc as any)('edit_media_comment', {
        _comment_id: editingCommentId,
        _user_id: user?.id,
        _content: content
      });

      if (error) throw error;
      await fetchComments({ silent: true });

      setEditingCommentId(null);
      setEditContent("");
    } catch (error) {
      handleError(error, "Failed to edit comment");
    }
  }, [editingCommentId, editContent, user?.id, fetchComments]);

  const handleDelete = useCallback(async (commentId: string) => {
    try {
      const { error } = await (supabase.rpc as any)('delete_media_comment', {
        _comment_id: commentId,
        _user_id: user?.id
      });
      if (error) throw error;
      await fetchComments({ silent: true });
    } catch (error) {
      handleError(error, "Failed to delete comment");
    }
  }, [user?.id, fetchComments]);

  const handleReaction = useCallback(async (commentId: string, emoji: string) => {
    if (!user) return;
    
    const comment = comments.find(c => c.id === commentId);
    const existingReaction = comment?.reactions?.find(r => r.emoji === emoji);
    const hasReacted = existingReaction?.hasReacted;

    // Optimistic UI update - update state immediately
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c;
        
        const reactions = [...(c.reactions || [])];
        const reactionIndex = reactions.findIndex(r => r.emoji === emoji);
        
        if (hasReacted) {
          // Removing reaction
          if (reactionIndex !== -1) {
            const reaction = reactions[reactionIndex];
            if (reaction.count <= 1) {
              reactions.splice(reactionIndex, 1);
            } else {
              reactions[reactionIndex] = {
                ...reaction,
                count: reaction.count - 1,
                users: reaction.users.filter(u => u !== user.id),
                hasReacted: false,
              };
            }
          }
        } else {
          // Adding reaction
          if (reactionIndex !== -1) {
            const reaction = reactions[reactionIndex];
            reactions[reactionIndex] = {
              ...reaction,
              count: reaction.count + 1,
              users: [...reaction.users, user.id],
              hasReacted: true,
            };
          } else {
            reactions.push({
              emoji,
              count: 1,
              users: [user.id],
              hasReacted: true,
            });
          }
        }
        
        return { ...c, reactions };
      })
    );

    try {
      const { error } = await (supabase.rpc as any)('toggle_media_comment_reaction', {
        _comment_id: commentId,
        _user_id: user.id,
        _emoji: emoji
      });

      if (error) throw error;
    } catch (error) {
      console.error("Failed to toggle reaction:", error);
      // Revert optimistic update on error by refetching
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
    }
  }, [user, comments, groupReactions]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    if (emojiPickerOpen) {
      handleReaction(emojiPickerOpen, emoji);
      setEmojiPickerOpen(null);
    }
  }, [emojiPickerOpen, handleReaction]);

  const replyingToCommentData = replyingToComment 
    ? comments.find(c => c.id === replyingToComment)
    : null;

  const insertIntoComposer = useCallback((text: string) => {
    const el = replyTextareaRef.current;
    if (!el) {
      setReplyContent((prev) => prev + text);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = `${el.value.slice(0, start)}${text}${el.value.slice(end)}`;
    setReplyContent(next);
    requestAnimationFrame(() => {
      try {
        el.focus();
        const pos = start + text.length;
        el.setSelectionRange(pos, pos);
      } catch {
        // ignore
      }
    });
  }, []);

  const resizeComposer = useCallback(() => {
    const el = replyTextareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 40), 160)}px`;
  }, []);

  useEffect(() => {
    resizeComposer();
  }, [replyContent, resizeComposer]);

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
              (() => {
                const usernameColor = getCommentUsernameColor(comment.user_id || comment.user?.id);
                return (
              <div
                key={comment.id}
                className="group relative py-1 px-2 -mx-2 rounded hover:bg-accent/5 cursor-pointer"
                onClick={(e) => {
                  // Don't trigger reply when clicking on interactive elements
                  const target = e.target as HTMLElement;
                  const isInteractive = target.closest('button, a, input, textarea, [role="button"], [contenteditable]');
                  if (!isInteractive && editingCommentId !== comment.id) {
                    setReplyingToComment(comment.id);
                  }
                }}
              >
                {/* Reply reference - matching chat style */}
                {comment.reply_to && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1 ml-11">
                    <CornerUpLeft className="w-3 h-3 flex-shrink-0" />
                    <span>Replying to</span>
                    <span className="font-medium text-primary">
                      @{comment.reply_to.user?.username || 'unknown'}
                    </span>
                    <span className="truncate max-w-[150px] opacity-75">
                      {comment.reply_to.content?.slice(0, 50)}
                      {(comment.reply_to.content?.length || 0) > 50 ? '...' : ''}
                    </span>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    className="flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
                    onClick={() => {
                      if (comment.user) {
                        openModal('userProfile', { userId: comment.user.id });
                      }
                    }}
                    aria-label={`View ${comment.user?.username}'s profile`}
                  >
                    <Avatar className="w-8 h-8 cursor-pointer hover:opacity-80 transition-opacity">
                      <AvatarImage src={comment.user?.avatar_url || undefined} />
                      <AvatarFallback 
                        className="text-xs text-primary-foreground"
                        style={{ backgroundColor: comment.user?.banner_color || 'hsl(var(--primary))' }}
                      >
                        {comment.user?.username?.[0]?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <button
                        type="button"
                        className={`font-medium text-sm hover:underline focus:outline-none ${usernameColor.className}`}
                        style={usernameColor.style}
                        onClick={() => {
                          if (comment.user) {
                            openModal('userProfile', { userId: comment.user.id });
                          }
                        }}
                      >
                        {getCommentDisplayName(comment)}
                      </button>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatMessageTimestamp(comment.created_at)}
                      </span>
                    </div>

                    {editingCommentId === comment.id ? (
                      <div className="mt-1 flex flex-col gap-2">
                        <textarea
                          ref={editTextareaRef}
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 min-h-[60px] max-h-[200px]"
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setEditingCommentId(null);
                              setEditContent("");
                            } else if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleEdit();
                            }
                          }}
                          autoFocus
                        />
                        <div className="flex gap-2 text-[11px]">
                          <span className="text-muted-foreground">
                            escape to{" "}
                            <button 
                              className="text-primary hover:underline" 
                              onClick={() => {
                                setEditingCommentId(null);
                                setEditContent("");
                              }}
                            >
                              cancel
                            </button>
                            {" • "}enter to{" "}
                            <button className="text-primary hover:underline" onClick={handleEdit}>
                              save
                            </button>
                          </span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap break-words">
                          {comment.content}
                        </p>
                        {comment.edited_at && (
                          <span className="text-[10px] text-muted-foreground ml-1">(edited)</span>
                        )}
                      </>
                    )}

                    {/* Reactions with HoverCard - matching chat style */}
                    {comment.reactions && comment.reactions.length > 0 && !editingCommentId && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {comment.reactions.map((reaction) => (
                          <HoverCard key={reaction.emoji} openDelay={200}>
                            <HoverCardTrigger asChild>
                              <button
                                onClick={() => handleReaction(comment.id, reaction.emoji)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors duration-200 ${
                                  reaction.hasReacted
                                    ? "bg-primary/20 border-primary text-primary"
                                    : "bg-secondary/80 border-transparent hover:border-border hover:bg-secondary"
                                }`}
                              >
                                {reactionEmojiNode(reaction.emoji)}
                                <span className="text-sm font-medium">{reaction.count}</span>
                              </button>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-auto p-2" align="start" side="top">
                              <div className="flex items-center gap-2">
                                <div className="shrink-0 text-2xl">{reactionEmojiNode(reaction.emoji)}</div>
                                <div className="min-w-0 text-sm">
                                  <span className="text-muted-foreground">reacted by </span>
                                  {reaction.users.slice(0, 5).map((userId, idx) => {
                                    const reactingUser = comments.find(c => c.user_id === userId)?.user;
                                    const name = userId === user?.id ? 'You' : (reactingUser?.display_name || reactingUser?.username || 'Unknown');
                                    return (
                                      <span key={userId}>
                                        <span className="font-medium">{name}</span>
                                        {idx < Math.min(reaction.users.length, 5) - 1 ? ', ' : ''}
                                      </span>
                                    );
                                  })}
                                  {reaction.users.length > 5 && (
                                    <span className="text-muted-foreground"> and {reaction.users.length - 5} others</span>
                                  )}
                                </div>
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Hover actions - matching chat style with opacity transition */}
                {!editingCommentId && (
                  <div 
                    className="absolute right-2 -top-3 hidden md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 md:flex items-center gap-0.5 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-xl p-1 transition-opacity duration-200 z-50"
                  >
                    <EmojiGifPicker
                      onEmojiSelect={handleEmojiSelect}
                      onGifSelect={() => {}}
                      open={emojiPickerOpen === comment.id}
                      onOpenChange={(open) => {
                        setEmojiPickerOpen(open ? comment.id : null);
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
                      >
                        <Smile className="w-4 h-4" />
                      </button>
                    </EmojiGifPicker>
                    
                    <button
                      type="button"
                      className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      onClick={() => setReplyingToComment(comment.id)}
                      aria-label="Reply"
                      title="Reply"
                    >
                      <Reply className="w-4 h-4" />
                    </button>
                    
                    {comment.user_id === user?.id && (
                      <>
                        <div className="w-px h-5 bg-border mx-0.5" />
                        <button
                          type="button"
                          className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setEditingCommentId(comment.id);
                            setEditContent(comment.content);
                          }}
                          aria-label="Edit"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    
                    {(comment.user_id === user?.id || canManageMessages) && (
                      <>
                        <div className="w-px h-5 bg-border mx-0.5" />
                        <button
                          type="button"
                          className="p-2 rounded-lg bg-transparent hover:bg-destructive/10 transition-colors text-destructive"
                          onClick={() => {
                            setCommentToDelete(comment);
                            setShowDeleteModal(true);
                          }}
                          aria-label="Delete"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
                );
              })()
            ))
          )}
        </div>
      </ScrollArea>

      {/* Reply Input */}
      {user && (
        <div className="p-3 border-t border-border">
          {replyingToCommentData && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-muted/50 border-l-2 border-primary rounded text-sm">
              <CornerUpLeft className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Replying to</span>
              <span className="font-medium text-primary">
                @{replyingToCommentData.user?.username || 'unknown'}
              </span>
              <span className="truncate text-muted-foreground opacity-75 max-w-[120px]">
                {replyingToCommentData.content?.slice(0, 30)}
                {(replyingToCommentData.content?.length || 0) > 30 ? '...' : ''}
              </span>
              <button
                type="button"
                className="ml-auto p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                onClick={() => setReplyingToComment(null)}
                aria-label="Cancel reply"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div
            className={`rounded-2xl bg-card/80 border transition-all ${
              composerFocused ? "border-primary/30 shadow-lg" : "border-border/50"
            }`}
          >
            <div className="flex items-end gap-2 p-2 sm:p-3">
              <textarea
                ref={replyTextareaRef}
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                onFocus={() => setComposerFocused(true)}
                onBlur={() => setComposerFocused(false)}
                placeholder="Write a comment..."
                className="flex-1 bg-transparent resize-none outline-none py-2 px-1 min-h-[40px] max-h-[160px] text-[15px]"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleReply();
                  }
                }}
              />

              <div className="flex items-center gap-1 mb-0.5 relative">
                <EmojiGifPicker
                  onEmojiSelect={(emoji) => insertIntoComposer(emoji)}
                  onGifSelect={() => {}}
                  open={composerEmojiOpen}
                  onOpenChange={setComposerEmojiOpen}
                  disableGif
                  serverId={currentServer?.id}
                  serverName={currentServer?.name}
                >
                  <button
                    type="button"
                    className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 transition-colors"
                    aria-label="Add emoji"
                    title="Add emoji"
                    disabled={!currentServer?.id}
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                </EmojiGifPicker>

                <button
                  type="button"
                  onClick={handleReply}
                  disabled={!replyContent.trim() || isSendingReply}
                  className={`p-2 rounded-xl transition-all ${
                    replyContent.trim() && !isSendingReply
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
                      : "bg-muted/50 text-muted-foreground/50 cursor-not-allowed"
                  }`}
                  aria-label="Send"
                  title="Send"
                >
                  {isSendingReply ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
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
