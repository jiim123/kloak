import { useState, useEffect, useCallback, useRef } from "react";
import type React from "react";
import { ChannelHeader } from "@/components/chat/ChannelHeader";
import { MessageContent } from "@/components/chat/MessageContent";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { useMessageStore } from "@/stores/messageStore";
import { useUIStore } from "@/stores/uiStore";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { useSwipeGestureRef } from "@/hooks/useSwipeGesture";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2, MessageSquare, Clock, MoreVertical, Smile, Reply, Pencil, Trash2, Copy, Megaphone, Users, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { FormatToolbar, FORMAT_SYNTAX } from "@/components/chat/FormatToolbar";
import { ImageUploadDialog } from "@/components/modals/ImageUploadDialog";
import { EmojiGifPicker } from "@/components/modals/EmojiGifPicker";
import { DeleteMessageModal } from "@/components/modals/DeleteMessageModal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { handleError, showSuccess } from "@/lib/errorHandler";
import { formatDistanceToNow } from "date-fns";
import type { Message, User, ServerMember, CustomServerRole } from "@/types";
import { TiptapEditor } from "./TiptapEditor";
import { AnnouncementView } from "./AnnouncementView";
import { cn } from "@/lib/utils";

const ROLE_COLORS: Record<string, string> = {
  owner: "text-yellow-400",
  admin: "text-red-400",
  moderator: "text-blue-400",
};

const getRoleColor = (role?: string): string => {
  return role ? ROLE_COLORS[role] || "text-foreground" : "text-foreground";
};

const getRoleLabel = (role?: string): string => {
  if (!role) return "Member";
  return role.charAt(0).toUpperCase() + role.slice(1);
};

const isGradientColor = (value?: string | null) => !!value && value.startsWith("linear-gradient");

export const AnnouncementChannelArea = () => {
  const { currentChannel, currentServer, members, roles } = useServerStore();
  const { user } = useAuthStore();
  const { sendMessage, editMessage, deleteMessage, addReaction, removeReaction } = useMessageStore();
  const { setMobileSidebarOpen, setMemberSidebarOpen } = useUIStore();
  const isMobile = useIsMobile();
  const { hasPermission } = useMemberPermissions(currentChannel?.id);
  const canManageMessages = hasPermission("manage_messages");

  const [announcements, setAnnouncements] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [lastCommentActivity, setLastCommentActivity] = useState<Record<string, { time: string; user?: User }>>({});
  const [isCreatingAnnouncement, setIsCreatingAnnouncement] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [isCreateFocused, setIsCreateFocused] = useState(false);
  const [showFormatToolbar, setShowFormatToolbar] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [customEmojiMap, setCustomEmojiMap] = useState<Map<string, string>>(new Map());
  const [hoveredAnnouncementId, setHoveredAnnouncementId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState<Message | null>(null);
  const createTitleRef = useRef<HTMLInputElement>(null);
  const createTextareaRef = useRef<{ editor: any; dom: HTMLDivElement | null } | null>(null);
  const editTitleRef = useRef<HTMLInputElement>(null);
  const editTextareaRef = useRef<{ editor: any; dom: HTMLDivElement | null } | null>(null);
  
  // Load server emojis
  useEffect(() => {
    if (!currentServer?.id) return;
    
    let cancelled = false;
    (async () => {
      try {
        const { fetchServerEmojis } = await import("@/lib/serverEmojis");
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

  const swipeRef = useSwipeGestureRef({
    onSwipeRight: () => setMobileSidebarOpen(true),
    onSwipeLeft: () => setMemberSidebarOpen(true),
    threshold: 50,
    enabled: isMobile,
  });

  // Group reactions helper function
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

  // Keep a ref to announcements for realtime callbacks
  const announcementsRef = useRef<Message[]>([]);
  useEffect(() => {
    announcementsRef.current = announcements;
  }, [announcements]);

  // Subscribe to real-time reactions for announcement posts
  useEffect(() => {
    if (!currentChannel?.id) return;

    const channel = supabase
      .channel(`announcement-reactions:${currentChannel.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reactions",
        },
        async (payload) => {
          try {
            const newReaction = payload.new as { message_id: string; user_id: string; emoji: string };
            
            // Check if this reaction is for an announcement in this channel
            if (!announcementsRef.current.some(a => a.id === newReaction.message_id)) return;
            
            // Fetch updated reactions for this message
            const { data: reactionsData } = await supabase
              .from("reactions")
              .select("*")
              .eq("message_id", newReaction.message_id);
            
            if (reactionsData) {
              const reactions = groupReactions(reactionsData, user?.id);
              
              setAnnouncements((prev) =>
                prev.map((a) =>
                  a.id === newReaction.message_id ? { ...a, reactions } : a
                )
              );
            }
          } catch (error) {
            console.error("[Announcement] Failed to handle reaction insert:", error);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "reactions",
        },
        async (payload) => {
          try {
            const deletedReaction = payload.old as { message_id?: string; user_id?: string; emoji?: string };
            if (!deletedReaction.message_id) return;
            
            // Check if this reaction is for an announcement in this channel
            if (!announcementsRef.current.some(a => a.id === deletedReaction.message_id)) return;
            
            // Fetch updated reactions for this message
            const { data: reactionsData } = await supabase
              .from("reactions")
              .select("*")
              .eq("message_id", deletedReaction.message_id);
            
            if (reactionsData !== null) {
              const reactions = groupReactions(reactionsData, user?.id);
              
              setAnnouncements((prev) =>
                prev.map((a) =>
                  a.id === deletedReaction.message_id ? { ...a, reactions } : a
                )
              );
            }
          } catch (error) {
            console.error("[Announcement] Failed to handle reaction delete:", error);
          }
        }
      )
      .subscribe((status) => {
        console.log(`[Announcement] Reactions subscription for ${currentChannel.id}:`, status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentChannel?.id, user?.id, groupReactions]);

  // Fetch announcements
  const fetchAnnouncements = useCallback(async () => {
    if (!currentChannel) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select(`
          *,
          user:users (*),
          attachments:message_attachments (*),
          reactions (*)
        `)
        .eq("channel_id", currentChannel.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group reactions for each announcement
      const currentUserId = user?.id;
      const announcementsWithReactions = (data || []).map((announcement: any) => ({
        ...announcement,
        reactions: groupReactions(announcement.reactions || [], currentUserId),
      }));

      setAnnouncements(announcementsWithReactions);

      // Fetch comment counts and last activity for each announcement
      const counts: Record<string, number> = {};
      const activities: Record<string, { time: string; user?: User }> = {};

      for (const announcement of data || []) {
        // Get comment count
        const { count } = await supabase
          .from("announcement_comments")
          .select("*", { count: "exact", head: true })
          .eq("message_id", announcement.id);

        counts[announcement.id] = count || 0;

        // Get last comment activity
        const { data: lastComment } = await supabase
          .from("announcement_comments")
          .select(`
            created_at,
            user_id,
            user:users (id, username, display_name, avatar_url)
          `)
          .eq("message_id", announcement.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (lastComment) {
          activities[announcement.id] = {
            time: lastComment.created_at,
            user: lastComment.user as User,
          };
        } else {
          activities[announcement.id] = {
            time: announcement.created_at,
            user: announcement.user as User,
          };
        }
      }

      setCommentCounts(counts);
      setLastCommentActivity(activities);
    } catch (error) {
      handleError(error, "Failed to fetch announcements");
    } finally {
      setIsLoading(false);
    }
  }, [currentChannel, user?.id, groupReactions]);

  useEffect(() => {
    fetchAnnouncements();

    // Subscribe to new announcements
    if (!currentChannel) return;

    const channel = supabase
      .channel(`announcements:${currentChannel.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${currentChannel.id}`,
        },
        () => {
          fetchAnnouncements();
        }
      )
      .subscribe();

    // Subscribe to comment changes for comment counts
    const commentChannel = supabase
      .channel(`announcement-comment-counts:${currentChannel.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "announcement_comments",
        },
        async (payload) => {
          const comment = (payload.new || payload.old) as { id?: string; message_id?: string } | null;
          if (!comment || !comment.message_id) return;

          // Update comment count
          const { count } = await supabase
            .from("announcement_comments")
            .select("*", { count: "exact", head: true })
            .eq("message_id", comment.message_id);

          setCommentCounts((prev) => ({
            ...prev,
            [comment.message_id!]: count || 0,
          }));

          // Update last activity
          if (payload.eventType === "INSERT") {
            const { data: newComment } = await supabase
              .from("announcement_comments")
              .select(`
                created_at,
                user_id,
                user:users (id, username, display_name, avatar_url)
              `)
              .eq("id", comment.id!)
              .single();

            if (newComment) {
              setLastCommentActivity((prev) => ({
                ...prev,
                [comment.message_id!]: {
                  time: newComment.created_at,
                  user: newComment.user as User,
                },
              }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(commentChannel);
    };
  }, [currentChannel, fetchAnnouncements]);

  const handleCreateAnnouncement = useCallback(
    async () => {
      if (!user || !currentChannel) return;
      
      const title = announcementTitle.trim();
      const content = announcementContent.trim();
      
      // If title is provided, use it; otherwise use first line of content as title
      const finalTitle = title || content.split('\n')[0] || "";
      const finalContent = title 
        ? content 
        : content.split('\n').slice(1).join('\n').trim();
      
      // Combine title and content: title on first line, then double newline, then content
      const fullContent = finalContent
        ? `${finalTitle}\n\n${finalContent}`
        : finalTitle;
      
      if (!fullContent.trim()) return;

      setIsCreatingAnnouncement(true);
      try {
        const message = await sendMessage(currentChannel.id, user.id, fullContent);
        if (!message) {
          throw new Error("Failed to send announcement");
        }

        // Clear inputs
        setAnnouncementTitle("");
        setAnnouncementContent("");
        setIsCreateFocused(false);
        setShowFormatToolbar(false);
        await fetchAnnouncements();
        showSuccess("Announcement created successfully");
      } catch (error) {
        handleError(error, "Failed to create announcement");
      } finally {
        setIsCreatingAnnouncement(false);
      }
    },
    [user, currentChannel, sendMessage, announcementTitle, announcementContent]
  );

  const handleImageUpload = useCallback(async (file: File) => {
    const editorRef = editingMessage ? editTextareaRef.current : createTextareaRef.current;
    const editor = editorRef?.editor;
    if (!editor) return;

    try {
      // Upload image to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `announcements/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      // Insert image using Tiptap's image command with default alignment and size
      editor.chain().focus().setImage({ 
        src: publicUrl, 
        alt: 'Image',
        align: 'left',
        width: '400'
      }).run();
      setShowImageUpload(false);
    } catch (error) {
      handleError(error, "Failed to upload image");
    }
  }, [editContent, announcementContent, editingMessage]);


  const handleCancelCreate = useCallback(() => {
    setAnnouncementTitle("");
    setAnnouncementContent("");
    setIsCreateFocused(false);
    setShowFormatToolbar(false);
    setEditingMessage(null);
    setEditTitle("");
    setEditContent("");
  }, []);

  // Listen for edit events from MessageItem
  useEffect(() => {
    const handleStartEdit = (e: CustomEvent<{ message: Message }>) => {
      if (!currentChannel || currentChannel.type !== "announcement") return;
      const message = e.detail.message;
      
      // Extract title and content from message
      const content = message.content || "";
      const parts = content.split('\n\n');
      const title = parts.length > 1 ? parts[0].trim() : content.split('\n')[0].trim() || "";
      const messageContent = parts.length > 1 
        ? parts.slice(1).join('\n\n').trim() 
        : content.split('\n').slice(1).join('\n').trim();
      
      setEditingMessage(message);
      setEditTitle(title);
      setEditContent(messageContent);
      setIsCreateFocused(true);
      setShowFormatToolbar(true);
      
      setTimeout(() => {
        editTitleRef.current?.focus();
      }, 100);
    };

    window.addEventListener("startEditAnnouncement" as keyof WindowEventMap, handleStartEdit as EventListener);
    return () => window.removeEventListener("startEditAnnouncement" as keyof WindowEventMap, handleStartEdit as EventListener);
  }, [currentChannel]);

  const handleSaveEdit = useCallback(async () => {
    if (!user || !currentChannel || !editingMessage) return;
    
    const title = editTitle.trim();
    const content = editContent.trim();
    
    const finalTitle = title || content.split('\n')[0] || "";
    const finalContent = title 
      ? content 
      : content.split('\n').slice(1).join('\n').trim();
    
    const fullContent = finalContent
      ? `${finalTitle}\n\n${finalContent}`
      : finalTitle;
    
    if (!fullContent.trim()) return;

    setIsCreatingAnnouncement(true);
    try {
      await editMessage(editingMessage.id, fullContent, user.id);
      await fetchAnnouncements();
      showSuccess("Announcement updated successfully");
      handleCancelCreate();
    } catch (error) {
      handleError(error, "Failed to update announcement");
    } finally {
      setIsCreatingAnnouncement(false);
    }
  }, [user, currentChannel, editingMessage, editTitle, editContent, editMessage, handleCancelCreate]);

  if (!currentChannel) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">No Channel Selected</h2>
          <p className="text-muted-foreground max-w-md text-sm leading-relaxed mt-2">
            Choose an announcement channel from the sidebar
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={swipeRef} className="h-full flex flex-col min-w-0 bg-background">
      <ChannelHeader channel={currentChannel} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Create/Edit Announcement Editor - Only visible to admins */}
        {canManageMessages && (
          <>
            {isCreateFocused ? (
              <div className="p-4 border-b border-border bg-card/50 flex-shrink-0">
                <div className="mb-3 text-sm font-medium text-foreground">
                  {editingMessage ? "Edit Announcement" : "Create Announcement"}
                </div>
                
                {/* Title Input with Avatar */}
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={user?.avatar_url} />
                    <AvatarFallback>
                      {user?.username?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <Input
                    ref={editingMessage ? editTitleRef : createTitleRef}
                    value={editingMessage ? editTitle : announcementTitle}
                    onChange={(e) => editingMessage ? setEditTitle(e.target.value) : setAnnouncementTitle(e.target.value)}
                    placeholder="Type your announcement title"
                    className="flex-1 bg-transparent border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
                    onFocus={() => setIsCreateFocused(true)}
                  />
                </div>

                {/* Formatting Toolbar */}
                <div className="mb-3 format-toolbar" onMouseDown={(e) => e.preventDefault()}>
                  <FormatToolbar
                    onFormat={(formatType) => {
                      const editorRef = editingMessage ? editTextareaRef.current : createTextareaRef.current;
                      const editor = editorRef?.editor;
                      if (!editor) return;

                      // Use Tiptap commands for formatting
                      switch (formatType) {
                        case 'bold':
                          editor.chain().focus().toggleBold().run();
                          break;
                        case 'italic':
                          editor.chain().focus().toggleItalic().run();
                          break;
                        case 'underline':
                          editor.chain().focus().toggleUnderline().run();
                          break;
                        case 'strikethrough':
                          editor.chain().focus().toggleStrike().run();
                          break;
                        case 'heading1':
                          editor.chain().focus().toggleHeading({ level: 1 }).run();
                          break;
                        case 'heading2':
                          editor.chain().focus().toggleHeading({ level: 2 }).run();
                          break;
                        case 'heading3':
                          editor.chain().focus().toggleHeading({ level: 3 }).run();
                          break;
                        case 'code':
                          editor.chain().focus().toggleCode().run();
                          break;
                        case 'codeblock':
                          editor.chain().focus().toggleCodeBlock().run();
                          break;
                        case 'separator':
                          editor.chain().focus().setHorizontalRule().run();
                          break;
                        default:
                          // For other formats, insert markdown syntax
                          const { from, to } = editor.state.selection;
                          const selectedText = editor.state.doc.textBetween(from, to);
                          const syntax = FORMAT_SYNTAX[formatType];
                          if (syntax) {
                            const { prefix, suffix } = syntax;
                            const formattedText = prefix + (selectedText || 'text') + suffix;
                            editor.chain().focus().insertContent(formattedText).run();
                          }
                      }
                    }}
                    onImageClick={() => {
                      // Blur editor before opening dialog to prevent aria-hidden warning
                      const editorRef = editingMessage ? editTextareaRef.current : createTextareaRef.current;
                      const editor = editorRef?.editor;
                      if (editor) {
                        editor.view.dom.blur();
                      }
                      // Open dialog
                      setShowImageUpload(true);
                    }}
                    onClose={() => {
                      setShowFormatToolbar(false);
                      const editorRef = editingMessage ? editTextareaRef.current : createTextareaRef.current;
                      const editor = editorRef?.editor;
                      if (editor) {
                        editor.chain().focus().run();
                      }
                    }}
                  />
                </div>

                {/* Main Content Textarea with inline preview */}
                <TiptapEditor
                  ref={editingMessage ? editTextareaRef : createTextareaRef}
                  value={editingMessage ? editContent : announcementContent}
                  onChange={(text) => {
                    if (editingMessage) {
                      setEditContent(text);
                    } else {
                      setAnnouncementContent(text);
                    }
                  }}
                  onFocus={() => {
                    setIsCreateFocused(true);
                    setShowFormatToolbar(true);
                  }}
                  onBlur={() => {
                    // Use setTimeout to check if focus moved to format toolbar, buttons, or image dialog
                    setTimeout(() => {
                      // Don't hide if image upload dialog is open
                      if (showImageUpload) return;
                      
                      const activeElement = document.activeElement;
                      if (!activeElement || 
                          (!activeElement.closest('.format-toolbar') && 
                           !activeElement.closest('.create-announcement-actions') &&
                           !activeElement.closest('[role="dialog"]') &&
                           !activeElement.closest('[data-radix-portal]'))) {
                        // Only blur if clicking outside
                        const hasTitle = editingMessage ? editTitle.trim() : announcementTitle.trim();
                        const hasContent = editingMessage ? editContent.trim() : announcementContent.trim();
                        if (!hasTitle && !hasContent && !editingMessage) {
                          setIsCreateFocused(false);
                          setShowFormatToolbar(false);
                        }
                      }
                    }, 200);
                  }}
                  placeholder="What do you want to announce?"
                />

                {/* Action Buttons */}
                <div className="flex justify-end gap-2 mt-4 create-announcement-actions">
                  <Button
                    variant="outline"
                    onClick={handleCancelCreate}
                    disabled={isCreatingAnnouncement}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={editingMessage ? handleSaveEdit : handleCreateAnnouncement}
                    disabled={((editingMessage ? !editTitle.trim() && !editContent.trim() : !announcementTitle.trim() && !announcementContent.trim()) || isCreatingAnnouncement)}
                  >
                    {isCreatingAnnouncement ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {editingMessage ? "Updating..." : "Creating..."}
                      </>
                    ) : (
                      editingMessage ? "Update Announcement" : "Create Announcement"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 border-b border-border flex-shrink-0">
                <div 
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 cursor-text transition-all"
                  onClick={() => {
                    setIsCreateFocused(true);
                    setTimeout(() => {
                      createTitleRef.current?.focus();
                    }, 100);
                  }}
                >
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={user?.avatar_url} />
                    <AvatarFallback>
                      {user?.username?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground flex-1">Create an announcement</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Announcements List or View */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Announcements List */}
          <div className={`${selectedMessageId ? 'w-full md:w-1/2 border-r border-border' : 'w-full'} ${selectedMessageId && isMobile ? 'hidden' : ''} overflow-y-auto transition-all`}>
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">Loading announcements...</div>
            ) : announcements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="relative mb-6">
                  <div className="absolute inset-0 rounded-full bg-muted/30 blur-xl scale-150" />
                  <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-muted/80 to-muted/40 border border-border/50 flex items-center justify-center">
                    <Megaphone className="w-12 h-12 text-muted-foreground" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-3">Announcements</h2>
                <p className="text-muted-foreground mb-6 max-w-sm leading-relaxed">
                  Share important updates with your community. Announcements support rich text, images, and comments.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-muted/50 text-sm text-muted-foreground">
                    <Megaphone className="w-4 h-4" />
                    <span>Rich content</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-muted/50 text-sm text-muted-foreground">
                    <MessageSquare className="w-4 h-4" />
                    <span>Comments</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-muted/50 text-sm text-muted-foreground">
                    <Bell className="w-4 h-4" />
                    <span>Notify members</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-6">
                {announcements.map((announcement) => {
                  const isSelected = selectedMessageId === announcement.id;
                  const messageContent = announcement.content || "";
                  const parts = messageContent.split('\n\n');
                  const announcementTitle = parts.length > 1 
                    ? parts[0].trim() 
                    : messageContent.split('\n')[0].trim() || "No title";
                  const announcementDescription = parts.length > 1 
                    ? parts.slice(1).join('\n\n').trim() 
                    : messageContent.split('\n').slice(1).join('\n').trim();
                  const commentCount = commentCounts[announcement.id] || 0;
                  
                  // Get member info for role display
                  const announcementMember = members.find((m) => m.user_id === announcement.user_id);
                  
                  // Get top custom role
                  const memberRoles = announcementMember?.roles ?? [];
                  let topCustomRole: CustomServerRole | null = null;
                  if (memberRoles.length > 0) {
                    const resolved = memberRoles.map((mr) => roles.find((r) => r.id === mr.id) ?? mr).filter(Boolean) as CustomServerRole[];
                    for (const r of resolved) {
                      if (!topCustomRole) {
                        topCustomRole = r;
                        continue;
                      }
                      const aPos = typeof r.position === "number" ? r.position : Number.POSITIVE_INFINITY;
                      const bPos = typeof topCustomRole.position === "number" ? topCustomRole.position : Number.POSITIVE_INFINITY;
                      if (aPos < bPos) topCustomRole = r;
                    }
                  }
                  
                  const roleColorClass = topCustomRole 
                    ? (isGradientColor(topCustomRole.color) ? "text-transparent" : "text-foreground")
                    : getRoleColor(announcementMember?.role);
                  
                  const roleColorStyle = topCustomRole && isGradientColor(topCustomRole.color)
                    ? { background: topCustomRole.color, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } as React.CSSProperties
                    : undefined;
                  
                  const isOwnAnnouncement = user?.id === announcement.user_id;
                  const isHovered = hoveredAnnouncementId === announcement.id;
                  const isAdmin = canManageMessages;
                  
                  return (
                    <div
                      key={announcement.id}
                      className="relative group cursor-pointer"
                      onMouseEnter={() => setHoveredAnnouncementId(announcement.id)}
                      onMouseLeave={() => setHoveredAnnouncementId(null)}
                      onClick={() => setSelectedMessageId(isSelected ? null : announcement.id)}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between pb-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <AvatarWithDecoration
                            user={announcement.user}
                            className="w-10 h-10 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn("font-semibold text-sm", roleColorClass)} style={roleColorStyle}>
                                {announcementMember?.nickname || announcement.user?.display_name || announcement.user?.username || "Unknown"}
                              </span>
                              {topCustomRole && (
                                <span 
                                  className="text-xs font-medium px-2 py-0.5 rounded"
                                  style={
                                    isGradientColor(topCustomRole.color)
                                      ? { background: topCustomRole.color, color: "#fff" }
                                      : { backgroundColor: `${topCustomRole.color}20`, color: topCustomRole.color }
                                  }
                                >
                                  {topCustomRole.name}
                                </span>
                              )}
                              {!topCustomRole && announcementMember?.role && (
                                <span className={cn("text-xs text-muted-foreground")}>
                                  {getRoleLabel(announcementMember.role)}
                                </span>
                              )}
                            </div>
                            {/* Metadata under user details */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <span>{formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>{commentCount} {commentCount === 1 ? 'comment' : 'comments'}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="pb-4">
                        {/* Title */}
                        <h2 className="text-2xl font-bold text-foreground mb-3">
                          {announcementTitle}
                        </h2>
                        
                        {/* Description - Full content */}
                        {announcementDescription && (
                          <div className="text-sm text-foreground mb-4">
                            <MessageContent
                              content={announcementDescription}
                              currentUserId={user?.id}
                              messageUser={announcement.user}
                            />
                          </div>
                        )}
                        
                        {/* Reactions */}
                        {announcement.reactions && announcement.reactions.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {announcement.reactions.map((reaction) => (
                              <button
                                key={reaction.emoji}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!user?.id) return;
                                  
                                  // Optimistic update
                                  setAnnouncements((prev) => {
                                    return prev.map((a) => {
                                      if (a.id !== announcement.id) return a;
                                      
                                      const reactions = [...(a.reactions || [])];
                                      const existingGroup = reactions.find(r => r.emoji === reaction.emoji);
                                      
                                      if (reaction.hasReacted) {
                                        // Remove reaction
                                        if (existingGroup) {
                                          existingGroup.count--;
                                          existingGroup.users = existingGroup.users.filter(u => u !== user.id);
                                          existingGroup.hasReacted = false;
                                          if (existingGroup.count === 0) {
                                            return { ...a, reactions: reactions.filter(r => r.emoji !== reaction.emoji) };
                                          }
                                        }
                                      } else {
                                        // Add reaction
                                        if (existingGroup) {
                                          if (!existingGroup.users.includes(user.id)) {
                                            existingGroup.count++;
                                            existingGroup.users.push(user.id);
                                            existingGroup.hasReacted = true;
                                          }
                                        } else {
                                          reactions.push({
                                            emoji: reaction.emoji,
                                            count: 1,
                                            users: [user.id],
                                            hasReacted: true,
                                          });
                                        }
                                      }
                                      
                                      return { ...a, reactions };
                                    });
                                  });
                                  
                                  // Then call the actual function
                                  if (reaction.hasReacted) {
                                    await removeReaction(announcement.id, user.id, reaction.emoji);
                                  } else {
                                    await addReaction(announcement.id, user.id, reaction.emoji);
                                  }
                                }}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors duration-200",
                                  reaction.hasReacted
                                    ? "bg-primary/20 border-primary text-primary"
                                    : "bg-secondary/80 border-transparent hover:border-border hover:bg-secondary"
                                )}
                              >
                                {reactionEmojiNode(reaction.emoji)}
                                <span className="text-sm font-medium">{reaction.count}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Hover actions menu - Desktop only */}
                      {(isHovered || showEmojiPicker === announcement.id) && (
                        <div 
                          className="absolute right-2 -top-4 z-50 hidden md:flex items-center gap-1 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-xl p-1 transition-opacity duration-200 opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                          onMouseEnter={() => setHoveredAnnouncementId(announcement.id)}
                          onMouseLeave={(e) => {
                            const relatedTarget = e.relatedTarget as HTMLElement;
                            if (!relatedTarget || !relatedTarget.closest('[role="dialog"]')) {
                              setHoveredAnnouncementId(null);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Add Reaction */}
                          <EmojiGifPicker
                            open={showEmojiPicker === announcement.id}
                            onOpenChange={(open) => {
                              setShowEmojiPicker(open ? announcement.id : null);
                              if (open) {
                                setHoveredAnnouncementId(announcement.id);
                              }
                            }}
                            onEmojiSelect={async (emoji) => {
                              if (!user?.id) return;
                              
                              const hasReacted = announcement.reactions?.some(r => r.emoji === emoji && r.hasReacted);
                              
                              // Optimistic update
                              setAnnouncements((prev) => {
                                return prev.map((a) => {
                                  if (a.id !== announcement.id) return a;
                                  
                                  const reactions = [...(a.reactions || [])];
                                  const existingGroup = reactions.find(r => r.emoji === emoji);
                                  
                                  if (hasReacted) {
                                    // Remove reaction
                                    if (existingGroup) {
                                      existingGroup.count--;
                                      existingGroup.users = existingGroup.users.filter(u => u !== user.id);
                                      existingGroup.hasReacted = false;
                                      if (existingGroup.count === 0) {
                                        return { ...a, reactions: reactions.filter(r => r.emoji !== emoji) };
                                      }
                                    }
                                  } else {
                                    // Add reaction
                                    if (existingGroup) {
                                      if (!existingGroup.users.includes(user.id)) {
                                        existingGroup.count++;
                                        existingGroup.users.push(user.id);
                                        existingGroup.hasReacted = true;
                                      }
                                    } else {
                                      reactions.push({
                                        emoji,
                                        count: 1,
                                        users: [user.id],
                                        hasReacted: true,
                                      });
                                    }
                                  }
                                  
                                  return { ...a, reactions };
                                });
                              });
                              
                              // Then call the actual function
                              if (hasReacted) {
                                await removeReaction(announcement.id, user.id, emoji);
                              } else {
                                await addReaction(announcement.id, user.id, emoji);
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

                          {/* Edit (own announcements) */}
                          {isOwnAnnouncement && (
                            <button
                              type="button"
                              className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                window.dispatchEvent(new CustomEvent("startEditAnnouncement", { detail: { message: announcement } }));
                              }}
                              onMouseDown={(e) => e.preventDefault()}
                              aria-label="Edit"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}

                          {/* Copy */}
                          <button
                            type="button"
                            className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              navigator.clipboard.writeText(announcement.content);
                              showSuccess("Content copied to clipboard");
                            }}
                            onMouseDown={(e) => e.preventDefault()}
                            aria-label="Copy text"
                            title="Copy text"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          <div className="w-px h-5 bg-border mx-0.5" />

                          {/* Delete (own announcements or admins) */}
                          {(isOwnAnnouncement || isAdmin) && (
                            <button
                              type="button"
                              className="p-2 rounded-lg bg-transparent hover:bg-destructive/10 transition-colors text-destructive"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setAnnouncementToDelete(announcement);
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

          {/* Announcement View - Only shown when an announcement is selected */}
          {selectedMessageId && (() => {
            const selectedMessage = announcements.find(m => m.id === selectedMessageId);
            if (!selectedMessage) return null;
            return (
              <>
                {/* Desktop: Side-by-side view */}
                <div className="hidden md:flex md:w-1/2 flex-col border-l border-border">
                  <AnnouncementView
                    message={selectedMessage}
                    onClose={() => setSelectedMessageId(null)}
                  />
                </div>

                {/* Mobile: Full-screen overlay */}
                {isMobile && (
                  <div className="md:hidden fixed inset-0 z-50 bg-background flex flex-col">
                    <AnnouncementView
                      message={selectedMessage}
                      onClose={() => setSelectedMessageId(null)}
                    />
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Image Upload Dialog */}
      <ImageUploadDialog 
        open={showImageUpload} 
        onOpenChange={(open) => {
          // Ensure editor is blurred when dialog opens to prevent aria-hidden warning
          if (open) {
            const editorRef = editingMessage ? editTextareaRef.current : createTextareaRef.current;
            const editor = editorRef?.editor;
            if (editor) {
              editor.view.dom.blur();
            }
          }
          setShowImageUpload(open);
        }} 
        onUpload={handleImageUpload} 
      />

      {/* Delete Announcement Modal */}
      {announcementToDelete && (
        <DeleteMessageModal
          open={showDeleteModal}
          onOpenChange={setShowDeleteModal}
          onConfirm={async () => {
            if (!user || !announcementToDelete) return;
            try {
              await deleteMessage(announcementToDelete.id, user.id);
              setShowDeleteModal(false);
              setAnnouncementToDelete(null);
              await fetchAnnouncements();
            } catch (error) {
              handleError(error, "Failed to delete announcement");
            }
          }}
          messageContent={announcementToDelete.content}
        />
      )}
    </div>
  );
};
