import { useState, useEffect, useCallback, useRef } from "react";
import { ChannelHeader } from "@/components/chat/ChannelHeader";
import { MessageList } from "@/components/chat/MessageList";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { useMessageStore } from "@/stores/messageStore";
import { useUIStore } from "@/stores/uiStore";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { useSwipeGestureRef } from "@/hooks/useSwipeGesture";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2, Paperclip, Smile, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FormatToolbar, FORMAT_SYNTAX } from "@/components/chat/FormatToolbar";
import { ImageUploadDialog } from "@/components/modals/ImageUploadDialog";
import { EmojiGifPicker } from "@/components/modals/EmojiGifPicker";
import { supabase } from "@/integrations/supabase/client";
import { handleError, showSuccess } from "@/lib/errorHandler";
import type { Message } from "@/types";
import { TiptapEditor } from "./TiptapEditor";

export const AnnouncementChannelArea = () => {
  const { currentChannel, currentServer } = useServerStore();
  const { user } = useAuthStore();
  const { sendMessage, editMessage } = useMessageStore();
  const { setMobileSidebarOpen, setMemberSidebarOpen } = useUIStore();
  const isMobile = useIsMobile();
  const { hasPermission } = useMemberPermissions(currentChannel?.id);
  const canManageMessages = hasPermission("manage_messages");

  const [isCreatingAnnouncement, setIsCreatingAnnouncement] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [isCreateFocused, setIsCreateFocused] = useState(false);
  const [showFormatToolbar, setShowFormatToolbar] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const createTitleRef = useRef<HTMLInputElement>(null);
  const createTextareaRef = useRef<{ editor: any; dom: HTMLDivElement | null } | null>(null);
  const editTitleRef = useRef<HTMLInputElement>(null);
  const editTextareaRef = useRef<{ editor: any; dom: HTMLDivElement | null } | null>(null);

  const swipeRef = useSwipeGestureRef({
    onSwipeRight: () => setMobileSidebarOpen(true),
    onSwipeLeft: () => setMemberSidebarOpen(true),
    threshold: 50,
    enabled: isMobile,
  });

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
                    expanded={true}
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
                        case 'alignLeft':
                          editor.chain().focus().setTextAlign('left').run();
                          break;
                        case 'alignCenter':
                          editor.chain().focus().setTextAlign('center').run();
                          break;
                        case 'alignRight':
                          editor.chain().focus().setTextAlign('right').run();
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

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <MessageList channelId={currentChannel.id} channelName={currentChannel.name} />
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
    </div>
  );
};
