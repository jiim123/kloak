import { useState, useEffect, useCallback, useRef } from "react";
import { ChannelHeader } from "@/components/chat/ChannelHeader";
import { MessageInput } from "@/components/chat/MessageInput";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { useMessageStore } from "@/stores/messageStore";
import { useUIStore } from "@/stores/uiStore";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { useTyping } from "@/hooks/useTyping";
import { useSwipeGestureRef } from "@/hooks/useSwipeGesture";
import { useIsMobile } from "@/hooks/use-mobile";
import { MessageSquare, Hash, ArrowRight, Clock, Send, Loader2, Plus, X, ArrowUp, Paperclip, Reply, Smile, Pencil, Trash2, CornerUpLeft, ArrowLeft, Users, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { FormatToolbar, FORMAT_SYNTAX } from "@/components/chat/FormatToolbar";
import { ImageUploadDialog } from "@/components/modals/ImageUploadDialog";
import { EmojiGifPicker } from "@/components/modals/EmojiGifPicker";
import { DeleteMessageModal } from "@/components/modals/DeleteMessageModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { secureUpload } from "@/lib/storageUpload";
import { handleError, showSuccess } from "@/lib/errorHandler";
import { formatMessageTimestamp } from "@/lib/format";
import { formatDistanceToNow } from "date-fns";
import { isImageOnlyMessage } from "@/lib/message";
import { isPollMessageContent } from "@/lib/poll";
import { ReplyPreview } from "@/components/chat/MessageContent";
import { fetchServerEmojis } from "@/lib/serverEmojis";
import type { Message, User, ReactionGroup } from "@/types";

interface Thread {
  id: string;
  message_id: string;
  channel_id: string;
  created_by: string;
  created_at: string;
  message?: Message;
  message_count?: number;
  last_activity?: string;
  last_message_author?: User;
}

export const ForumChannelArea = () => {
  const { currentChannel, currentServer } = useServerStore();
  const { user } = useAuthStore();
  const { sendMessage } = useMessageStore();
  const { setMobileSidebarOpen, setMemberSidebarOpen, openModal } = useUIStore();
  const { typingUsers, startTyping, stopTyping } = useTyping(currentChannel?.id || null);
  const isMobile = useIsMobile();
  const { hasPermission } = useMemberPermissions(currentChannel?.id);
  const canManageMessages = hasPermission("manage_messages");

  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<Record<string, Message[]>>({});
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [newThreadContent, setNewThreadContent] = useState("");
  const [replyingToThread, setReplyingToThread] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isCreateTopicFocused, setIsCreateTopicFocused] = useState(false);
  const [showFormatToolbar, setShowFormatToolbar] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [showDeleteThreadModal, setShowDeleteThreadModal] = useState(false);
  const [threadToDelete, setThreadToDelete] = useState<Thread | null>(null);
  const createTopicTitleRef = useRef<HTMLInputElement>(null);
  const createTopicTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Use ref to track current thread ID for realtime subscription
  const selectedThreadIdRef = useRef<string | null>(null);
  const threadMessagesRef = useRef<Record<string, Message[]>>({});
  
  // Reset thread selection when channel changes
  useEffect(() => {
    setSelectedThreadId(null);
    setReplyContent("");
    setReplyingToThread(null);
    setEditingMessageId(null);
    setEditContent("");
  }, [currentChannel?.id]);

  useEffect(() => {
    selectedThreadIdRef.current = selectedThreadId;
  }, [selectedThreadId]);
  
  useEffect(() => {
    threadMessagesRef.current = threadMessages;
  }, [threadMessages]);

  const swipeRef = useSwipeGestureRef({
    onSwipeRight: () => setMobileSidebarOpen(true),
    onSwipeLeft: () => setMemberSidebarOpen(true),
    threshold: 50,
    enabled: isMobile,
  });

  const [customEmojiMap, setCustomEmojiMap] = useState<Map<string, string>>(new Map());

  // Load server emojis for custom emoji rendering
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

  // Helper to render emoji (custom or unicode)
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

  const fetchThreads = useCallback(async () => {
    if (!currentChannel) return;

    setIsLoading(true);
    try {
      // Fetch all threads for this channel
      const { data: threadsData, error: threadsError } = await supabase
        .from("threads")
        .select("*")
        .eq("channel_id", currentChannel.id)
        .order("created_at", { ascending: false });

      if (threadsError) throw threadsError;

      // Fetch the original messages for each thread
      const messageIds = (threadsData || []).map((t) => t.message_id);
      if (messageIds.length === 0) {
        setThreads([]);
        setIsLoading(false);
        return;
      }

      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select(`
          *,
          user:users (*),
          attachments:message_attachments (*),
          reactions (*)
        `)
        .in("id", messageIds);

      if (messagesError) throw messagesError;

      // Get message counts and last activity for each thread
      const threadsWithInfo: Thread[] = await Promise.all(
        (threadsData || []).map(async (thread) => {
          const rawMessage = (messagesData || []).find((m) => m.id === thread.message_id);
          
          // Get thread message count
          const { data: countData } = await supabase.rpc("get_thread_message_count", {
            _message_id: thread.message_id,
          });

          // Get last thread message for activity
          const { data: lastMessagesData } = await supabase.rpc("get_thread_messages", {
            _thread_id: thread.id,
            _limit: 1,
          });

          let lastActivity = thread.created_at;
          let lastMessageAuthor: User | undefined;

          if (lastMessagesData) {
            // Parse JSON array if it's a string, otherwise use as-is
            const lastMessages = typeof lastMessagesData === 'string' ? JSON.parse(lastMessagesData) : lastMessagesData;
            
            if (Array.isArray(lastMessages) && lastMessages.length > 0) {
              const lastMsg = lastMessages[0] as any;
              lastActivity = lastMsg.created_at;
              if (lastMsg.user) {
                lastMessageAuthor = lastMsg.user;
              }
            }
          }

          // Transform raw reactions to ReactionGroup format
          let reactions: ReactionGroup[] = [];
          if (rawMessage?.reactions && Array.isArray(rawMessage.reactions)) {
            const reactionMap = new Map<string, { count: number; users: string[] }>();
            for (const r of rawMessage.reactions) {
              const existing = reactionMap.get(r.emoji);
              if (existing) {
                existing.count++;
                existing.users.push(r.user_id);
              } else {
                reactionMap.set(r.emoji, { count: 1, users: [r.user_id] });
              }
            }
            reactions = Array.from(reactionMap.entries()).map(([emoji, data]) => ({
              emoji,
              count: data.count,
              users: data.users,
              hasReacted: user ? data.users.includes(user.id) : false,
            }));
          }

          // Build the message with properly typed reactions
          const message: Message | undefined = rawMessage ? {
            ...rawMessage,
            is_pinned: rawMessage.is_pinned ?? false,
            reactions,
          } as Message : undefined;

          return {
            ...thread,
            message: message as Message,
            message_count: countData || 0,
            last_activity: lastActivity,
            last_message_author: lastMessageAuthor,
          };
        })
      );

      setThreads(threadsWithInfo);
    } catch (error) {
      handleError(error, "Failed to fetch threads");
    } finally {
      setIsLoading(false);
    }
  }, [currentChannel]);

  useEffect(() => {
    fetchThreads();

    // Subscribe to thread changes
    if (!currentChannel) return;

    const channel = supabase
      .channel(`forum-threads:${currentChannel.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "threads",
          filter: `channel_id=eq.${currentChannel.id}`,
        },
        () => {
          fetchThreads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentChannel, fetchThreads]);

  // Subscribe to thread messages for realtime updates
  useEffect(() => {
    if (!selectedThreadId || !currentChannel) return;

    const threadId = selectedThreadId; // Capture in closure

    const channel = supabase
      .channel(`thread-messages:${threadId}`, {
        config: {
          broadcast: { self: false },
        },
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "thread_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        async (payload) => {
          try {
            const newMsg = payload.new as any;
            const msgThreadId = newMsg.thread_id;
            
            // Verify this is for the current thread (use ref to get latest value)
            const currentThreadId = selectedThreadIdRef.current;
            if (msgThreadId !== currentThreadId) {
              return;
            }
            
            // Check if message already exists using functional update
            let shouldAdd = false;
            setThreadMessages((prev) => {
              const currentMessages = prev[currentThreadId] || [];
              if (currentMessages.some(m => m.id === newMsg.id)) {
                return prev;
              }
              shouldAdd = true;
              return prev; // Return unchanged for now
            });

            if (!shouldAdd) return;

            // Fetch user data for the new message
            const { data: userData, error: userError } = await supabase
              .from("users")
              .select("*")
              .eq("id", newMsg.user_id)
              .single();

            if (userError || !userData) {
              return;
            }

            // Fetch reply_to data if it exists
            let replyToData = null;
            if (newMsg.reply_to_id) {
              try {
                const { data: replyMsg, error: replyError } = await supabase
                  .from("thread_messages")
                  .select("id, user_id, content, created_at")
                  .eq("id", newMsg.reply_to_id)
                  .single();
                
                if (!replyError && replyMsg) {
                  // Fetch reply user
                  const { data: replyUser } = await supabase
                    .from("users")
                    .select("id, username, display_name, avatar_url")
                    .eq("id", replyMsg.user_id)
                    .single();
                  
                  replyToData = {
                    id: replyMsg.id,
                    user_id: replyMsg.user_id,
                    content: replyMsg.content,
                    created_at: replyMsg.created_at,
                    user: replyUser || null,
                  };
                }
              } catch (err) {
                // Failed to fetch reply_to data
              }
            }

            // Create message object
            const message: Message = {
              id: newMsg.id,
              user_id: newMsg.user_id,
              content: newMsg.content,
              reply_to_id: newMsg.reply_to_id,
              reply_to: replyToData,
              edited_at: newMsg.edited_at,
              created_at: newMsg.created_at,
              channel_id: currentChannel?.id || "",
              is_pinned: false,
              user: userData,
            };

            // Add message to state
            setThreadMessages((prev) => {
              const existing = prev[currentThreadId] || [];
              // Double-check message doesn't exist (race condition protection)
              if (existing.some(m => m.id === newMsg.id)) {
                return prev;
              }
              return {
                ...prev,
                [currentThreadId]: [...existing, message],
              };
            });

            // Update thread message count locally instead of full refresh
            setThreads((prev) => 
              prev.map((thread) => {
                if (thread.id === currentThreadId) {
                  return {
                    ...thread,
                    message_count: (thread.message_count || 0) + 1,
                    last_activity: newMsg.created_at,
                    last_message_author: userData,
                  };
                }
                return thread;
              })
            );
          } catch (error) {
            // Failed to handle new thread message
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "thread_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        async (payload) => {
          try {
            const updatedMsg = payload.new as any;
            
            setThreadMessages((prev) => {
              const messages = prev[selectedThreadId] || [];
              const updated = messages.map((msg) =>
                msg.id === updatedMsg.id
                  ? { ...msg, content: updatedMsg.content, edited_at: updatedMsg.edited_at }
                  : msg
              );
              return {
                ...prev,
                [selectedThreadId]: updated,
              };
            });
          } catch (error) {
            // Failed to handle thread message update
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "thread_reactions",
        },
        async (payload) => {
          try {
            const newReaction = payload.new as any;
            const messageId = newReaction.message_id;
            
            // Check if this reaction is for a message in the current thread
            const messages = threadMessagesRef.current[threadId] || [];
            if (!messages.some(m => m.id === messageId)) return;
            
            // Fetch updated reactions for this message
            const { data: reactionsData } = await supabase
              .from("thread_reactions")
              .select("*")
              .eq("message_id", messageId);
            
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
              
              setThreadMessages((prev) => {
                const messages = prev[threadId] || [];
                return {
                  ...prev,
                  [threadId]: messages.map((m) =>
                    m.id === messageId ? { ...m, reactions } : m
                  ),
                };
              });
            }
          } catch (error) {
            // Failed to handle reaction insert
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "thread_reactions",
        },
        async (payload) => {
          try {
            const deletedReaction = payload.old as any;
            const messageId = deletedReaction.message_id;
            
            // Check if this reaction is for a message in the current thread
            const messages = threadMessagesRef.current[threadId] || [];
            if (!messages.some(m => m.id === messageId)) return;
            
            // Fetch updated reactions for this message
            const { data: reactionsData } = await supabase
              .from("thread_reactions")
              .select("*")
              .eq("message_id", messageId);
            
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
              
              setThreadMessages((prev) => {
                const messages = prev[threadId] || [];
                return {
                  ...prev,
                  [threadId]: messages.map((m) =>
                    m.id === messageId ? { ...m, reactions } : m
                  ),
                };
              });
            }
          } catch (error) {
            // Failed to handle reaction delete
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "thread_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          try {
            const deletedId = payload.old?.id;
            if (!deletedId) return;

            setThreadMessages((prev) => {
              const messages = prev[threadId] || [];
              const filtered = messages.filter((msg) => msg.id !== deletedId);
              return {
                ...prev,
                [threadId]: filtered,
              };
            });

            // Update thread message count locally
            setThreads((prev) => 
              prev.map((thread) => {
                if (thread.id === threadId) {
                  return {
                    ...thread,
                    message_count: Math.max(0, (thread.message_count || 0) - 1),
                  };
                }
                return thread;
              })
            );
          } catch (error) {
            // Failed to handle thread message delete
          }
        }
      )
      .subscribe(() => {
        // Subscription status callback
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedThreadId, currentChannel?.id, fetchThreads]);

  const handleCreateThread = useCallback(
    async () => {
      if (!user || !currentChannel) return;
      
      // Use title from input field, or extract from content if no title provided
      const title = newThreadTitle.trim();
      const content = newThreadContent.trim();
      
      // If title is provided, use it; otherwise use first line of content as title
      const finalTitle = title || content.split('\n')[0] || "";
      const finalContent = title 
        ? content 
        : content.split('\n').slice(1).join('\n').trim();
      
      // Combine title and content: title on first line, then double newline, then content
      // This format makes it easy to extract the title later
      const fullContent = finalContent
        ? `${finalTitle}\n\n${finalContent}`
        : finalTitle;
      
      if (!fullContent.trim()) return;

      setIsCreatingThread(true);
      try {
        // First, send a message with title and content
        const message = await sendMessage(currentChannel.id, user.id, fullContent);
        if (!message) {
          throw new Error("Failed to send message");
        }

        // Then create a thread from that message
        const { data: threadId, error } = await supabase.rpc("create_thread", {
          _message_id: message.id,
          _user_id: user.id,
        });

        if (error) throw error;

        // Clear inputs and refresh threads
        setNewThreadTitle("");
        setNewThreadContent("");
        setIsCreateTopicFocused(false);
        setShowFormatToolbar(false);
        await fetchThreads();
        showSuccess("Thread created successfully");
      } catch (error) {
        handleError(error, "Failed to create thread");
      } finally {
        setIsCreatingThread(false);
      }
    },
    [user, currentChannel, sendMessage, fetchThreads, newThreadTitle, newThreadContent]
  );

  const handleImageUpload = useCallback(async (file: File) => {
    // Handle image upload similar to MessageInput
    const textarea = createTopicTextareaRef.current;
    if (!textarea) return;

    try {
      // Upload image to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `forum/${fileName}`;

      const { publicUrl } = await secureUpload('attachments', filePath, file, {
        contentType: file.type,
        upsert: false,
      });

      // Insert image URL at cursor position
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = 
        newThreadContent.slice(0, start) + 
        publicUrl + 
        newThreadContent.slice(end);

      setNewThreadContent(newContent);
      setShowImageUpload(false);
      
      requestAnimationFrame(() => {
        const newPos = start + publicUrl.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      });
    } catch (error) {
      handleError(error, "Failed to upload image");
    }
  }, [newThreadContent]);

  const handleReplyToThread = useCallback(
    async (threadId: string) => {
      if (!user || !replyContent.trim()) return;

      const content = replyContent.trim();
      setIsSendingReply(true);
      
      // Get reply_to_id if replying to a message
      const replyToId = replyingToThread || null;
      
      // Clear reply input and reply target immediately for better UX
      setReplyContent("");
      setReplyingToThread(null);

      try {
        const { data: result, error } = await supabase.rpc("send_thread_message", {
          _thread_id: threadId,
          _user_id: user.id,
          _content: content,
          _reply_to_id: replyToId,
        });

        if (error) {
          throw error;
        }

        // Parse the result to get the message data
        const messageData = typeof result === 'string' ? JSON.parse(result) : result;
        
        if (messageData && messageData.id) {
          // Add message immediately with user data and reply_to data
          // Find the reply_to message if we're replying to something
          let replyToData = null;
          if (replyToId && threadMessages[threadId]) {
            const replyToMsg = threadMessages[threadId].find(m => m.id === replyToId);
            if (replyToMsg) {
              replyToData = {
                id: replyToMsg.id,
                user_id: replyToMsg.user_id,
                content: replyToMsg.content,
                created_at: replyToMsg.created_at,
                user: replyToMsg.user,
              };
            }
          }
          
          const newMessage: Message = {
            id: messageData.id,
            user_id: user.id,
            content: content,
            reply_to_id: messageData.reply_to_id || null,
            reply_to: replyToData,
            edited_at: messageData.edited_at || null,
            created_at: messageData.created_at || new Date().toISOString(),
            channel_id: currentChannel?.id || "",
            is_pinned: false,
            user: user,
          };

          setThreadMessages((prev) => {
            const existing = prev[threadId] || [];
            // Check if message already exists (shouldn't happen, but safety check)
            if (existing.some(m => m.id === messageData.id)) {
              return prev;
            }
            return {
              ...prev,
              [threadId]: [...existing, newMessage],
            };
          });
        }

        // Update thread message count locally instead of full refresh
        setThreads((prev) => 
          prev.map((thread) => {
            if (thread.id === threadId) {
              return {
                ...thread,
                message_count: (thread.message_count || 0) + 1,
              };
            }
            return thread;
          })
        );
      } catch (error) {
        // Restore reply content on error
        setReplyContent(content);
        handleError(error, "Failed to send reply");
      } finally {
        setIsSendingReply(false);
      }
    },
    [user, replyContent, currentChannel, replyingToThread]
  );

  const handleThreadClick = useCallback(
    async (threadId: string, messageId: string) => {
      if (selectedThreadId === threadId) {
        setSelectedThreadId(null);
        return;
      }

      setSelectedThreadId(threadId);

      // Fetch thread messages if not already loaded
      if (!threadMessages[threadId]) {
        try {
          const { data, error } = await supabase.rpc("get_thread_messages", {
            _thread_id: threadId,
            _limit: 50,
          });

          if (error) throw error;

          // Parse JSON array if it's a string, otherwise use as-is
          const messages = typeof data === 'string' ? JSON.parse(data) : data;
          
          // Fetch reactions for all messages
          const messageIds = (messages || []).map((m: any) => m.id);
          let reactionsMap: Record<string, any[]> = {};
          
          if (messageIds.length > 0) {
            const { data: reactionsData } = await supabase
              .from("thread_reactions")
              .select("*")
              .in("message_id", messageIds);
            
            if (reactionsData) {
              reactionsData.forEach((reaction) => {
                if (!reactionsMap[reaction.message_id]) {
                  reactionsMap[reaction.message_id] = [];
                }
                reactionsMap[reaction.message_id].push(reaction);
              });
            }
          }

          // Group reactions helper
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

          // The function already includes user data and reply_to data
          const messagesWithUsers = (messages || []).map((msg: any) => ({
            id: msg.id,
            thread_id: msg.thread_id,
            user_id: msg.user_id,
            content: msg.content,
            reply_to_id: msg.reply_to_id,
            reply_to: msg.reply_to || null,
            edited_at: msg.edited_at,
            created_at: msg.created_at,
            user: msg.user,
            channel_id: currentChannel?.id || "",
            is_pinned: false,
            reactions: groupReactions(reactionsMap[msg.id] || [], user?.id),
          } as Message));

          setThreadMessages((prev) => ({
            ...prev,
            [threadId]: messagesWithUsers,
          }));
        } catch (error) {
          handleError(error, "Failed to fetch thread messages");
        }
      }
    },
    [selectedThreadId, threadMessages]
  );

  if (!currentChannel) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold text-foreground">No Channel Selected</h2>
          <p className="text-muted-foreground max-w-md text-sm leading-relaxed mt-2">
            Choose a forum channel from the sidebar to view threads
          </p>
        </div>
      </div>
    );
  }

  const handleFormat = useCallback((formatType: string) => {
    const textarea = createTopicTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = newThreadContent.slice(start, end);
    const syntax = FORMAT_SYNTAX[formatType];

    if (!syntax) return;

    const { prefix, suffix } = syntax;
    const textToWrap = selectedText || 'text';
    const newContent = 
      newThreadContent.slice(0, start) + 
      prefix + textToWrap + suffix + 
      newThreadContent.slice(end);

    setNewThreadContent(newContent);
    
    requestAnimationFrame(() => {
      if (selectedText) {
        const newPos = start + prefix.length + selectedText.length + suffix.length;
        textarea.setSelectionRange(newPos, newPos);
      } else {
        const selectStart = start + prefix.length;
        const selectEnd = selectStart + 4;
        textarea.setSelectionRange(selectStart, selectEnd);
      }
      textarea.focus();
    });
  }, [newThreadContent]);

  const handleCancelCreate = useCallback(() => {
    setNewThreadTitle("");
    setNewThreadContent("");
    setIsCreateTopicFocused(false);
    setShowFormatToolbar(false);
  }, []);

  const handleEditMessage = useCallback(async (messageId: string) => {
    if (!user || !editContent.trim()) return;
    
    try {
      const { error } = await supabase
        .from("thread_messages")
        .update({ 
          content: editContent.trim(),
          edited_at: new Date().toISOString()
        })
        .eq("id", messageId)
        .eq("user_id", user.id);

      if (error) throw error;

      // Update local state
      setThreadMessages((prev) => {
        const threadId = selectedThreadId;
        if (!threadId || !prev[threadId]) return prev;
        
        return {
          ...prev,
          [threadId]: prev[threadId].map((m) =>
            m.id === messageId
              ? { ...m, content: editContent.trim(), edited_at: new Date().toISOString() }
              : m
          ),
        };
      });

      setEditingMessageId(null);
      setEditContent("");
    } catch (error) {
      handleError(error, "Failed to edit message");
    }
  }, [user, editContent, selectedThreadId]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!user || !selectedThreadId) {
      return;
    }
    
    try {
      // Use RPC function that handles permission checks (allows admins to delete)
      const { data, error } = await supabase.rpc("delete_thread_message", {
        _message_id: messageId,
        _user_id: user.id,
      });

      if (error) {
        throw error;
      }

      // Update local state
      setThreadMessages((prev) => {
        if (!prev[selectedThreadId]) return prev;
        
        return {
          ...prev,
          [selectedThreadId]: prev[selectedThreadId].filter((m) => m.id !== messageId),
        };
      });

      // Update thread count
      setThreads((prev) => 
        prev.map((thread) => {
          if (thread.id === selectedThreadId) {
            return {
              ...thread,
              message_count: Math.max(0, (thread.message_count || 0) - 1),
            };
          }
          return thread;
        })
      );

      setShowDeleteModal(false);
      setMessageToDelete(null);
    } catch (error) {
      handleError(error, "Failed to delete message");
    }
  }, [user, selectedThreadId]);

  const handleDeleteThread = useCallback(async (thread: Thread) => {
    if (!user) return;

    try {
      const { error } = await (supabase.rpc as any)("delete_forum_thread", {
        _thread_id: thread.id,
        _user_id: user.id,
      });

      if (error) throw error;

      // Update local state
      setThreads((prev) => prev.filter((t) => t.id !== thread.id));
      if (selectedThreadId === thread.id) {
        setSelectedThreadId(null);
        setReplyContent("");
        setReplyingToThread(null);
      }
      setShowDeleteThreadModal(false);
      setThreadToDelete(null);
      showSuccess("Thread deleted successfully");
    } catch (error) {
      handleError(error, "Failed to delete thread");
    }
  }, [user, selectedThreadId]);

  const handleAddReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user || !selectedThreadId) {
      return;
    }
    
    try {
      // Check if reaction already exists
      const { data: existing, error: checkError } = await supabase
        .from("thread_reactions")
        .select("*")
        .eq("message_id", messageId)
        .eq("user_id", user.id)
        .eq("emoji", emoji)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existing) {
        // Remove reaction
        const { error: deleteError } = await supabase
          .from("thread_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", user.id)
          .eq("emoji", emoji);
        
        if (deleteError) {
          throw deleteError;
        }
      } else {
        // Add reaction
        const { error: insertError } = await supabase
          .from("thread_reactions")
          .insert({
            message_id: messageId,
            user_id: user.id,
            emoji: emoji,
          });
        
        if (insertError) {
          throw insertError;
        }
      }
      
      // Refresh reactions for this message
      const { data: reactionsData } = await supabase
        .from("thread_reactions")
        .select("*")
        .eq("message_id", messageId);
      
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
        
        setThreadMessages((prev) => {
          if (!selectedThreadId || !prev[selectedThreadId]) return prev;
          return {
            ...prev,
            [selectedThreadId]: prev[selectedThreadId].map((m) =>
              m.id === messageId ? { ...m, reactions } : m
            ),
          };
        });
      }
      
      setShowEmojiPicker(null);
    } catch (error) {
      handleError(error, "Failed to add reaction");
    }
  }, [user, selectedThreadId]);

  return (
    <div ref={swipeRef} className="h-full flex flex-col min-w-0 bg-background">
      <ChannelHeader channel={currentChannel} />

      <div className="flex-1 flex overflow-hidden relative">
        {/* Threads List */}
        <div className={`${selectedThreadId ? 'w-full md:w-1/2 border-r border-border' : 'w-full'} ${selectedThreadId && isMobile ? 'hidden' : ''} overflow-y-auto transition-all`}>
          {/* Create Topic Editor */}
          {isCreateTopicFocused ? (
            <div className="p-4 border-b border-border bg-card/50">
              {/* Title Input with Avatar */}
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarImage src={user?.avatar_url} />
                  <AvatarFallback>
                    {user?.username?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <Input
                  ref={createTopicTitleRef}
                  value={newThreadTitle}
                  onChange={(e) => setNewThreadTitle(e.target.value)}
                  placeholder="Type your title"
                  className="flex-1 bg-transparent border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
                  onFocus={() => setIsCreateTopicFocused(true)}
                />
              </div>

              {/* Formatting Toolbar */}
              <div className="mb-3 format-toolbar" onMouseDown={(e) => e.preventDefault()}>
                <FormatToolbar
                  onFormat={handleFormat}
                  onImageClick={() => setShowImageUpload(true)}
                  onClose={() => {
                    setShowFormatToolbar(false);
                    createTopicTextareaRef.current?.focus();
                  }}
                />
              </div>

              {/* Main Content Textarea */}
              <Textarea
                ref={createTopicTextareaRef}
                value={newThreadContent}
                onChange={(e) => setNewThreadContent(e.target.value)}
                onFocus={() => {
                  setIsCreateTopicFocused(true);
                  setShowFormatToolbar(true);
                }}
                onBlur={(e) => {
                  // Use setTimeout to check if focus moved to format toolbar or buttons
                  setTimeout(() => {
                    const activeElement = document.activeElement;
                    if (!activeElement || 
                        (!activeElement.closest('.format-toolbar') && 
                         !activeElement.closest('.create-topic-actions'))) {
                      // Only blur if clicking outside
                      if (!newThreadTitle.trim() && !newThreadContent.trim()) {
                        setIsCreateTopicFocused(false);
                        setShowFormatToolbar(false);
                      }
                    }
                  }, 200);
                }}
                placeholder="What do you want to post?"
                className="min-h-[200px] resize-none bg-transparent border-0 focus-visible:ring-0"
              />

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 mt-4 create-topic-actions">
                <Button
                  variant="outline"
                  onClick={handleCancelCreate}
                  disabled={isCreatingThread}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateThread}
                  disabled={(!newThreadTitle.trim() && !newThreadContent.trim()) || isCreatingThread}
                >
                  {isCreatingThread ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 border-b border-border">
              <div 
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 cursor-text transition-all"
                onClick={() => {
                  setIsCreateTopicFocused(true);
                  setTimeout(() => {
                    createTopicTitleRef.current?.focus();
                  }, 100);
                }}
              >
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarImage src={user?.avatar_url} />
                  <AvatarFallback>
                    {user?.username?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground flex-1">Create a topic</span>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">Loading threads...</div>
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full bg-muted/30 blur-xl scale-150" />
                <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-muted/80 to-muted/40 border border-border/50 flex items-center justify-center">
                  <MessageSquare className="w-12 h-12 text-muted-foreground" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">Forum Threads</h2>
              <p className="text-muted-foreground max-w-sm leading-relaxed">
                Start discussions with your community. Topics stay organized and easy to follow.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {threads.map((thread) => {
                const isSelected = selectedThreadId === thread.id;
                // Extract title from message content: first line before double newline, or first line if no double newline
                const messageContent = thread.message?.content || "";
                // Split by double newline first (title\n\ncontent format)
                const parts = messageContent.split('\n\n');
                const threadTitle = parts.length > 1 
                  ? parts[0].trim() 
                  : messageContent.split('\n')[0].trim() || "No content";
                const opUser = thread.message?.user;
                const lastAuthor = thread.last_message_author || opUser;
                
                return (
                  <div
                    key={thread.id}
                    onClick={() => handleThreadClick(thread.id, thread.message_id)}
                    className={`w-full relative text-left hover:bg-muted/30 transition-colors cursor-pointer group/thread ${
                      isSelected ? "bg-muted/50" : ""
                    }`}
                  >
                    {/* Colored bar indicator for selected thread */}
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-full" />
                    )}
                    
                    <div className="p-4 pl-6">
                      {/* Desktop: Single line layout */}
                      <div className="hidden md:flex items-center gap-8 text-sm">
                        {/* Title */}
                        <span className="font-semibold text-foreground flex-1 min-w-0 truncate">
                          {threadTitle}
                        </span>
                        
                        {/* Original Poster */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
                          <Avatar className="w-4 h-4">
                            <AvatarImage src={opUser?.avatar_url} />
                            <AvatarFallback className="text-[8px]">
                              {opUser?.username?.[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="hidden sm:inline">{opUser?.display_name || opUser?.username || "Unknown"}</span>
                        </div>
                        
                        {/* Reply Count */}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                          <MessageSquare className={`w-3.5 h-3.5 ${(thread.message_count || 0) > 0 ? 'text-primary' : ''}`} />
                          <span>{thread.message_count || 0}</span>
                        </div>
                        
                        {/* Last Post Time and User - Stacked on right */}
                        {thread.last_activity && (
                          <div className="flex flex-col items-end gap-0.5 text-xs text-muted-foreground flex-shrink-0 ml-auto">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{formatDistanceToNow(new Date(thread.last_activity), { addSuffix: true })}</span>
                            </div>
                            {/* Last Post User */}
                            {lastAuthor && thread.message_count && thread.message_count > 0 && (
                              <div className="flex items-center gap-1.5">
                                <Avatar className="w-4 h-4">
                                  <AvatarImage src={lastAuthor.avatar_url} />
                                  <AvatarFallback className="text-[8px]">
                                    {lastAuthor.username?.[0]?.toUpperCase() || "?"}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="hidden sm:inline">{lastAuthor.display_name || lastAuthor.username || "Unknown"}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Mobile: Stacked layout */}
                      <div className="md:hidden space-y-2">
                        {/* Title */}
                        <div className="font-semibold text-foreground text-sm">
                          {threadTitle}
                        </div>
                        
                        {/* Metadata row */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {/* Original Poster */}
                          <div className="flex items-center gap-1.5">
                            <Avatar className="w-4 h-4">
                              <AvatarImage src={opUser?.avatar_url} />
                              <AvatarFallback className="text-[8px]">
                                {opUser?.username?.[0]?.toUpperCase() || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <span>{opUser?.display_name || opUser?.username || "Unknown"}</span>
                          </div>
                          
                          {/* Reply Count */}
                          <div className="flex items-center gap-1">
                            <MessageSquare className={`w-3.5 h-3.5 ${(thread.message_count || 0) > 0 ? 'text-primary' : ''}`} />
                            <span>{thread.message_count || 0}</span>
                          </div>
                          
                          {/* Last Post Time */}
                          {thread.last_activity && (
                            <div className="flex items-center gap-1 ml-auto">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{formatDistanceToNow(new Date(thread.last_activity), { addSuffix: true })}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Last Post User on mobile */}
                        {lastAuthor && thread.message_count && thread.message_count > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span>Last reply by</span>
                            <Avatar className="w-4 h-4">
                              <AvatarImage src={lastAuthor.avatar_url} />
                              <AvatarFallback className="text-[8px]">
                                {lastAuthor.username?.[0]?.toUpperCase() || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <span>{lastAuthor.display_name || lastAuthor.username || "Unknown"}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Delete thread button */}
                    {(user?.id === thread.created_by || canManageMessages) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setThreadToDelete(thread);
                          setShowDeleteThreadModal(true);
                        }}
                        className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover/thread:opacity-100 transition-opacity"
                        title="Delete thread"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Thread View - Only shown when a thread is selected */}
        {selectedThreadId && (() => {
          const selectedThread = threads.find(t => t.id === selectedThreadId);
          const messageContent = selectedThread?.message?.content || "";
          const parts = messageContent.split('\n\n');
          const threadTitle = parts.length > 1 
            ? parts[0].trim() 
            : messageContent.split('\n')[0].trim() || "No content";
          const threadDescription = parts.length > 1 
            ? parts.slice(1).join('\n\n').trim() 
            : messageContent.split('\n').slice(1).join('\n').trim();
          const opUser = selectedThread?.message?.user;
          
          return (
            <>
              {/* Desktop: Side-by-side view */}
              <div className="hidden md:flex md:w-1/2 flex-col border-l border-border">
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">{threadTitle}</h3>
                    <div className="flex items-center gap-1">
                      {(user?.id === selectedThread?.created_by || canManageMessages) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (selectedThread) {
                              setThreadToDelete(selectedThread);
                              setShowDeleteThreadModal(true);
                            }
                          }}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Delete thread"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedThreadId(null);
                          setReplyContent("");
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                
                {/* Thread Description */}
                {threadDescription && (
                  <div className="mb-6 pb-6 border-b border-border">
                    <div className="flex gap-3">
                      <Avatar 
                        className="w-8 h-8 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => selectedThread?.created_by && openModal('userProfile', { userId: selectedThread.created_by })}
                      >
                        <AvatarImage src={opUser?.avatar_url} />
                        <AvatarFallback>
                          {opUser?.username?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span 
                            className="font-medium text-sm cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => selectedThread?.created_by && openModal('userProfile', { userId: selectedThread.created_by })}
                          >
                            {opUser?.display_name || opUser?.username || "Unknown"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {selectedThread?.created_at && formatDistanceToNow(new Date(selectedThread.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{threadDescription}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Thread Replies */}
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-muted-foreground mb-3">
                    Replies ({threadMessages[selectedThreadId]?.length || 0})
                  </h4>
                </div>
                
                {threadMessages[selectedThreadId] ? (
                  <div className="space-y-4">
                    {threadMessages[selectedThreadId].map((msg) => {
                      const isOwnMessage = user?.id === msg.user_id;
                      const isHovered = hoveredMessageId === msg.id;
                      const isEditing = editingMessageId === msg.id;
                      const canDeleteMessage = isOwnMessage || canManageMessages;
                      
                      return (
                        <div
                          key={msg.id}
                         className="group relative flex gap-3 cursor-pointer"
                          onMouseEnter={() => setHoveredMessageId(msg.id)}
                          onMouseLeave={() => setHoveredMessageId(null)}
                         onClick={(e) => {
                           // Click-to-reply: trigger reply when clicking on message body
                           const target = e.target as HTMLElement;
                           const isInteractive = target.closest('button, a, input, textarea, [role="button"], [contenteditable], .hover-actions-menu');
                           if (!isInteractive && !isEditing) {
                             setReplyingToThread(msg.id);
                           }
                         }}
                        >
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarImage src={msg.user?.avatar_url} />
                            <AvatarFallback>
                              {msg.user?.username?.[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span 
                                className="font-medium text-sm cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => msg.user_id && openModal('userProfile', { userId: msg.user_id })}
                              >
                                {msg.user?.display_name || msg.user?.username || "Unknown"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatMessageTimestamp(msg.created_at)}
                              </span>
                              {msg.edited_at && (
                                <span className="text-[10px] text-muted-foreground">(edited)</span>
                              )}
                            </div>
                            
                            {/* Reply reference */}
                            {msg.reply_to && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                <CornerUpLeft className="w-3 h-3 flex-shrink-0" />
                                <span>Replying to</span>
                                <span className="font-medium text-primary">
                                  @{msg.reply_to.user?.username || "unknown"}
                                </span>
                                {isPollMessageContent(msg.reply_to.content) ? (
                                  <span className="italic">poll</span>
                                ) : isImageOnlyMessage(msg.reply_to.content) ? (
                                  <img
                                    src={msg.reply_to.content.trim()}
                                    alt="Image"
                                    className="w-6 h-6 rounded object-cover flex-shrink-0"
                                  />
                                ) : (
                                  <span className="truncate max-w-[200px]">
                                    <ReplyPreview content={msg.reply_to.content} maxLength={50} />
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
                                      setEditingMessageId(null);
                                      setEditContent("");
                                    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                      handleEditMessage(msg.id);
                                    }
                                  }}
                                />
                                <div className="flex gap-2 text-xs">
                                  <button
                                    className="text-primary hover:underline"
                                    onClick={() => handleEditMessage(msg.id)}
                                  >
                                    Save
                                  </button>
                                  <button
                                    className="text-muted-foreground hover:underline"
                                    onClick={() => {
                                      setEditingMessageId(null);
                                      setEditContent("");
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                
                                {/* Reactions */}
                                {msg.reactions && msg.reactions.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {msg.reactions.map((reaction) => {
                                      // Get user names for hover card
                                      const reactionUserNames = reaction.users.slice(0, 5).map((userId) => {
                                        if (userId === user?.id) return 'You';
                                        const reactingMsg = threadMessages[selectedThreadId]?.find(m => m.user_id === userId);
                                        return reactingMsg?.user?.display_name || reactingMsg?.user?.username || 'Unknown';
                                      });
                                      const remainingCount = Math.max(0, reaction.users.length - 5);
                                      
                                      return (
                                        <HoverCard key={reaction.emoji} openDelay={200}>
                                          <HoverCardTrigger asChild>
                                            <button
                                              onClick={() => handleAddReaction(msg.id, reaction.emoji)}
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
                          {(isHovered || showEmojiPicker === msg.id) && !isEditing && (
                            <div 
                              className="hover-actions-menu absolute right-2 -top-4 z-50 flex items-center gap-1 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-xl p-1 transition-opacity duration-200"
                              onMouseEnter={() => setHoveredMessageId(msg.id)}
                              onMouseLeave={(e) => {
                                // Don't hide if moving to emoji picker popover
                                const relatedTarget = e.relatedTarget as HTMLElement;
                                if (!relatedTarget || !relatedTarget.closest('[role="dialog"]')) {
                                  setHoveredMessageId(null);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Add Reaction */}
                              <EmojiGifPicker
                                open={showEmojiPicker === msg.id}
                                onOpenChange={(open) => {
                                  setShowEmojiPicker(open ? msg.id : null);
                                  if (open) {
                                    setHoveredMessageId(msg.id);
                                  }
                                }}
                                onEmojiSelect={(emoji) => {
                                  handleAddReaction(msg.id, emoji);
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
                                  setReplyingToThread(msg.id);
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

                              {/* Edit (own messages) */}
                              {isOwnMessage && (
                                <button
                                  type="button"
                                  className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setEditingMessageId(msg.id);
                                    setEditContent(msg.content);
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

                              {/* Delete (own messages or admins) */}
                              {canDeleteMessage && (
                                <button
                                  type="button"
                                  className="p-2 rounded-lg bg-transparent hover:bg-destructive/10 transition-colors text-destructive"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setMessageToDelete(msg);
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
                ) : (
                  <div className="text-center text-muted-foreground py-8">Loading messages...</div>
                )}
              </div>

              {/* Reply Input */}
              <div className="border-t border-border p-4">
                <div className="space-y-2">
                  {/* Reply Preview */}
                  {replyingToThread && (() => {
                    const replyToMsg = threadMessages[selectedThreadId]?.find(m => m.id === replyingToThread);
                    if (!replyToMsg) return null;
                    return (
                      <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-lg border border-border/50 text-xs">
                        <span className="text-muted-foreground">Replying to</span>
                        <span className="font-medium text-primary">
                          {replyToMsg.user?.display_name || replyToMsg.user?.username || "Unknown"}
                        </span>
                        <span className="text-muted-foreground truncate flex-1">
                          {replyToMsg.content.substring(0, 50)}
                          {replyToMsg.content.length > 50 ? "..." : ""}
                        </span>
                        <button
                          onClick={() => setReplyingToThread(null)}
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
                    placeholder={replyingToThread ? "Write a reply..." : "Reply to thread..."}
                    className="min-h-[80px] resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        handleReplyToThread(selectedThreadId);
                      }
                    }}
                  />
                  <div className="flex justify-end gap-2">
                    {replyingToThread && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setReplyingToThread(null);
                        }}
                      >
                        Cancel Reply
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedThreadId(null);
                        setReplyContent("");
                        setReplyingToThread(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleReplyToThread(selectedThreadId)}
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
                          Reply
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile: Full-screen overlay */}
              {isMobile && (
                <div className="md:hidden fixed inset-0 z-50 bg-background flex flex-col">
                  {/* Header with back button */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedThreadId(null);
                        setReplyContent("");
                        setReplyingToThread(null);
                      }}
                      className="h-9 w-9 p-0"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h3 className="text-lg font-semibold flex-1 truncate">{threadTitle}</h3>
                    {(user?.id === selectedThread?.created_by || canManageMessages) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (selectedThread) {
                            setThreadToDelete(selectedThread);
                            setShowDeleteThreadModal(true);
                          }
                        }}
                        className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Delete thread"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {/* Thread content */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {/* Thread Description */}
                    {threadDescription && (
                      <div className="mb-6 pb-6 border-b border-border">
                        <div className="flex gap-3">
                          <Avatar 
                            className="w-8 h-8 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => selectedThread?.created_by && openModal('userProfile', { userId: selectedThread.created_by })}
                          >
                            <AvatarImage src={opUser?.avatar_url} />
                            <AvatarFallback>
                              {opUser?.username?.[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span 
                                className="font-medium text-sm cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => selectedThread?.created_by && openModal('userProfile', { userId: selectedThread.created_by })}
                              >
                                {opUser?.display_name || opUser?.username || "Unknown"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {selectedThread?.created_at && formatDistanceToNow(new Date(selectedThread.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{threadDescription}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Thread Replies */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-muted-foreground mb-3">
                        Replies ({threadMessages[selectedThreadId]?.length || 0})
                      </h4>
                    </div>
                    
                    {threadMessages[selectedThreadId] ? (
                      <div className="space-y-4">
                        {threadMessages[selectedThreadId].map((msg) => {
                          const isOwnMessage = user?.id === msg.user_id;
                          const isHovered = hoveredMessageId === msg.id;
                          const isEditing = editingMessageId === msg.id;
                          const canDeleteMessage = isOwnMessage || canManageMessages;
                          
                          return (
                            <div
                              key={msg.id}
                              className="group relative flex gap-3 cursor-pointer"
                              onTouchStart={() => setHoveredMessageId(msg.id)}
                              onTouchEnd={() => setTimeout(() => setHoveredMessageId(null), 2000)}
                              onClick={(e) => {
                                // Click-to-reply: trigger reply when clicking on message body
                                const target = e.target as HTMLElement;
                                const isInteractive = target.closest('button, a, input, textarea, [role="button"], [contenteditable], .hover-actions-menu');
                                if (!isInteractive && editingMessageId !== msg.id) {
                                  setReplyingToThread(msg.id);
                                }
                              }}
                            >
                              <Avatar className="w-8 h-8 flex-shrink-0">
                                <AvatarImage src={msg.user?.avatar_url} />
                                <AvatarFallback>
                                  {msg.user?.username?.[0]?.toUpperCase() || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span 
                                    className="font-medium text-sm cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => msg.user_id && openModal('userProfile', { userId: msg.user_id })}
                                  >
                                    {msg.user?.display_name || msg.user?.username || "Unknown"}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {formatMessageTimestamp(msg.created_at)}
                                  </span>
                                  {msg.edited_at && (
                                    <span className="text-[10px] text-muted-foreground">(edited)</span>
                                  )}
                                </div>
                                
                                {/* Reply reference */}
                                {msg.reply_to && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                    <CornerUpLeft className="w-3 h-3 flex-shrink-0" />
                                    <span>Replying to</span>
                                    <span className="font-medium text-primary">
                                      @{msg.reply_to.user?.username || "unknown"}
                                    </span>
                                    {isPollMessageContent(msg.reply_to.content) ? (
                                      <span className="italic">poll</span>
                                    ) : isImageOnlyMessage(msg.reply_to.content) ? (
                                      <img
                                        src={msg.reply_to.content.trim()}
                                        alt="Image"
                                        className="w-6 h-6 rounded object-cover flex-shrink-0"
                                      />
                                    ) : (
                                      <span className="truncate max-w-[200px]">
                                        <ReplyPreview content={msg.reply_to.content} maxLength={50} />
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
                                          setEditingMessageId(null);
                                          setEditContent("");
                                        } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                          handleEditMessage(msg.id);
                                        }
                                      }}
                                    />
                                    <div className="flex gap-2 text-xs">
                                      <button
                                        className="text-primary hover:underline"
                                        onClick={() => handleEditMessage(msg.id)}
                                      >
                                        Save
                                      </button>
                                      <button
                                        className="text-muted-foreground hover:underline"
                                        onClick={() => {
                                          setEditingMessageId(null);
                                          setEditContent("");
                                        }}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                    
                                    {/* Reactions */}
                                    {msg.reactions && msg.reactions.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {msg.reactions.map((reaction) => {
                                          // Get user names for hover card
                                          const reactionUserNames = reaction.users.slice(0, 5).map((userId) => {
                                            if (userId === user?.id) return 'You';
                                            const reactingMsg = threadMessages[selectedThreadId]?.find(m => m.user_id === userId);
                                            return reactingMsg?.user?.display_name || reactingMsg?.user?.username || 'Unknown';
                                          });
                                          const remainingCount = Math.max(0, reaction.users.length - 5);
                                          
                                          return (
                                            <HoverCard key={reaction.emoji} openDelay={200}>
                                              <HoverCardTrigger asChild>
                                                <button
                                                  onClick={() => handleAddReaction(msg.id, reaction.emoji)}
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
                              
                              {/* Mobile actions menu */}
                              {(isHovered || showEmojiPicker === msg.id) && !isEditing && (
                                <div 
                                  className="hover-actions-menu absolute right-2 -top-4 z-50 flex items-center gap-1 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-xl p-1 transition-opacity duration-200"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {/* Add Reaction */}
                                  <EmojiGifPicker
                                    open={showEmojiPicker === msg.id}
                                    onOpenChange={(open) => {
                                      setShowEmojiPicker(open ? msg.id : null);
                                      if (open) {
                                        setHoveredMessageId(msg.id);
                                      }
                                    }}
                                    onEmojiSelect={(emoji) => {
                                      handleAddReaction(msg.id, emoji);
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

                                  {/* Reply */}
                                  <button
                                    type="button"
                                    className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setReplyingToThread(msg.id);
                                    }}
                                    aria-label="Reply"
                                    title="Reply"
                                  >
                                    <Reply className="w-4 h-4" />
                                  </button>

                                  {/* Edit (own messages) */}
                                  {isOwnMessage && (
                                    <button
                                      type="button"
                                      className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setEditingMessageId(msg.id);
                                        setEditContent(msg.content);
                                        setTimeout(() => editTextareaRef.current?.focus(), 0);
                                      }}
                                      aria-label="Edit"
                                      title="Edit"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                  )}

                                  <div className="w-px h-5 bg-border mx-0.5" />

                                  {/* Delete (own messages or admins) */}
                                  {canDeleteMessage && (
                                    <button
                                      type="button"
                                      className="p-2 rounded-lg bg-transparent hover:bg-destructive/10 transition-colors text-destructive"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setMessageToDelete(msg);
                                        setShowDeleteModal(true);
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
                    ) : (
                      <div className="text-center text-muted-foreground py-8">Loading messages...</div>
                    )}
                  </div>

                  {/* Reply Input */}
                  <div className="border-t border-border p-4">
                    <div className="space-y-2">
                      {/* Reply Preview */}
                      {replyingToThread && (() => {
                        const replyToMsg = threadMessages[selectedThreadId]?.find(m => m.id === replyingToThread);
                        if (!replyToMsg) return null;
                        return (
                          <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-lg border border-border/50 text-xs">
                            <span className="text-muted-foreground">Replying to</span>
                            <span className="font-medium text-primary">
                              {replyToMsg.user?.display_name || replyToMsg.user?.username || "Unknown"}
                            </span>
                            <span className="text-muted-foreground truncate flex-1">
                              {replyToMsg.content.substring(0, 50)}
                              {replyToMsg.content.length > 50 ? "..." : ""}
                            </span>
                            <button
                              onClick={() => setReplyingToThread(null)}
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
                        placeholder={replyingToThread ? "Write a reply..." : "Reply to thread..."}
                        className="min-h-[80px] resize-none"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            handleReplyToThread(selectedThreadId);
                          }
                        }}
                      />
                      <div className="flex justify-end gap-2">
                        {replyingToThread && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setReplyingToThread(null);
                            }}
                          >
                            Cancel Reply
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedThreadId(null);
                            setReplyContent("");
                            setReplyingToThread(null);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleReplyToThread(selectedThreadId)}
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
                              Reply
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Image Upload Dialog */}
      <ImageUploadDialog 
        open={showImageUpload} 
        onOpenChange={setShowImageUpload} 
        onUpload={handleImageUpload} 
      />

      {/* Delete Message Modal */}
      {messageToDelete && (
        <DeleteMessageModal
          open={showDeleteModal}
          onOpenChange={setShowDeleteModal}
          onConfirm={() => handleDeleteMessage(messageToDelete.id)}
          messageContent={messageToDelete.content}
        />
      )}

      {/* Delete Thread Confirmation Modal */}
      <AlertDialog open={showDeleteThreadModal} onOpenChange={setShowDeleteThreadModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Thread</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this thread? This will remove the thread and all its replies. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {threadToDelete?.message?.content && (
            <div className="my-2 p-3 bg-secondary rounded-lg border border-border">
              <p className="text-sm text-muted-foreground line-clamp-3">
                {threadToDelete.message.content.split('\n\n')[0] || "No content"}
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setThreadToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => threadToDelete && handleDeleteThread(threadToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
