import { useState, useCallback, useRef, useEffect } from "react";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { ChannelHeader } from "@/components/chat/ChannelHeader";
import { MediaComments } from "./MediaComments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ImagePlus, 
  Upload, 
  Link2, 
  Play, 
  Trash2, 
  MoreHorizontal,
  X,
  Film,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatRelativeTime } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MediaItem {
  id: string;
  channel_id: string;
  user_id: string;
  title: string | null;
  description: string | null;
  media_url: string;
  media_type: 'image' | 'video' | 'gif' | 'youtube';
  thumbnail_url: string | null;
  youtube_video_id: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  user?: {
    id: string;
    username: string;
    avatar_url: string | null;
    banner_color: string;
  };
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3MB for images
const MAX_VIDEO_SIZE = 10 * 1024 * 1024; // 10MB for videos

// Extract YouTube video ID from URL
const extractYouTubeId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

// Check if URL is a direct image/gif
const isDirectMediaUrl = (url: string): boolean => {
  return /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url);
};

export const MediaChannelArea = () => {
  const { currentChannel } = useServerStore();
  const { user } = useAuthStore();
  const { hasPermission } = useMemberPermissions(currentChannel?.id);
  
  const canSendMessages = hasPermission('send_messages');
  const canManageMessages = hasPermission('manage_messages');
  
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  
  // Upload form state
  const [uploadType, setUploadType] = useState<'file' | 'url'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch media items
  const fetchMediaItems = useCallback(async () => {
    if (!currentChannel) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('media_items' as any)
        .select(`
          *,
          user:users(id, username, avatar_url, banner_color)
        `)
        .eq('channel_id', currentChannel.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setMediaItems((data as unknown as MediaItem[]) || []);
    } catch (err) {
      console.error('Failed to fetch media items:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentChannel]);

  useEffect(() => {
    fetchMediaItems();
  }, [fetchMediaItems]);

  // Realtime subscription
  useEffect(() => {
    if (!currentChannel) return;

    const channel = supabase
      .channel(`media_items:${currentChannel.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'media_items',
        filter: `channel_id=eq.${currentChannel.id}`,
      }, () => {
        fetchMediaItems();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentChannel, fetchMediaItems]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
    
    if (!isImage && !isVideo) {
      toast.error('Only images (JPEG, PNG, GIF, WebP) and videos (MP4, WebM, MOV, AVI) are allowed');
      return;
    }
    
    if (isImage && file.size > MAX_IMAGE_SIZE) {
      toast.error('Image size must be less than 3MB');
      return;
    }
    
    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      toast.error('Video size must be less than 10MB');
      return;
    }
    
    setSelectedFile(file);
    setFilePreview(URL.createObjectURL(file));
  };

  // Handle URL input
  const handleUrlChange = (url: string) => {
    setUrlInput(url);
    // Auto-detect YouTube
    if (extractYouTubeId(url)) {
      setUploadType('url');
    }
  };

  // Reset upload form
  const resetUploadForm = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setUrlInput('');
    setTitle('');
    setDescription('');
    setUploadType('file');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle upload submission
  const handleUpload = async () => {
    if (!currentChannel || !user) return;
    
    setIsUploading(true);
    try {
      let mediaUrl = '';
      let mediaType: 'image' | 'video' | 'gif' | 'youtube' = 'image';
      let thumbnailUrl: string | null = null;
      let youtubeVideoId: string | null = null;
      let width: number | null = null;
      let height: number | null = null;

      if (uploadType === 'file' && selectedFile) {
        // Upload file to storage
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${currentChannel.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, selectedFile);
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from('attachments')
          .getPublicUrl(filePath);
        
        mediaUrl = urlData.publicUrl;
        
        // Determine media type based on file type
        if (ALLOWED_VIDEO_TYPES.includes(selectedFile.type)) {
          mediaType = 'video';
        } else if (selectedFile.type === 'image/gif') {
          mediaType = 'gif';
        } else {
          mediaType = 'image';
        }
        
        // Get image dimensions
        if (filePreview) {
          const img = new Image();
          img.src = filePreview;
          await new Promise<void>((resolve) => {
            img.onload = () => {
              width = img.naturalWidth;
              height = img.naturalHeight;
              resolve();
            };
            img.onerror = () => resolve();
          });
        }
      } else if (urlInput) {
        const ytId = extractYouTubeId(urlInput);
        if (ytId) {
          mediaType = 'youtube';
          youtubeVideoId = ytId;
          mediaUrl = urlInput;
          thumbnailUrl = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
        } else if (isDirectMediaUrl(urlInput)) {
          mediaUrl = urlInput;
          mediaType = urlInput.toLowerCase().includes('.gif') ? 'gif' : 'image';
        } else {
          toast.error('Please enter a valid YouTube URL or direct image link');
          return;
        }
      } else {
        toast.error('Please select a file or enter a URL');
        return;
      }

      // Insert media item
      const { error: insertError } = await supabase
        .from('media_items' as any)
        .insert({
          channel_id: currentChannel.id,
          user_id: user.id,
          title: title.trim() || null,
          description: description.trim() || null,
          media_url: mediaUrl,
          media_type: mediaType,
          thumbnail_url: thumbnailUrl,
          youtube_video_id: youtubeVideoId,
          width,
          height,
        });
      
      if (insertError) throw insertError;
      
      toast.success('Media uploaded successfully!');
      setIsUploadModalOpen(false);
      resetUploadForm();
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error('Failed to upload media');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle delete
  const handleDelete = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('media_items' as any)
        .delete()
        .eq('id', itemId);
      
      if (error) throw error;
      toast.success('Media deleted');
    } catch (err) {
      console.error('Failed to delete:', err);
      toast.error('Failed to delete media');
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const mediaFile = files.find(f => 
      ALLOWED_IMAGE_TYPES.includes(f.type) || ALLOWED_VIDEO_TYPES.includes(f.type)
    );
    
    if (mediaFile) {
      const isImage = ALLOWED_IMAGE_TYPES.includes(mediaFile.type);
      const isVideo = ALLOWED_VIDEO_TYPES.includes(mediaFile.type);
      
      if (isImage && mediaFile.size > MAX_IMAGE_SIZE) {
        toast.error('Image size must be less than 3MB');
        return;
      }
      if (isVideo && mediaFile.size > MAX_VIDEO_SIZE) {
        toast.error('Video size must be less than 10MB');
        return;
      }
      
      setSelectedFile(mediaFile);
      setFilePreview(URL.createObjectURL(mediaFile));
      setUploadType('file');
      setIsUploadModalOpen(true);
    }
  };

  if (!currentChannel) return null;

  return (
    <div 
      className="h-full flex flex-col min-w-0 bg-background relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <ChannelHeader channel={currentChannel} />
      
      {/* Media Grid */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Upload button for users with permission */}
          {canSendMessages && (
            <Button
              onClick={() => setIsUploadModalOpen(true)}
              className="mb-4 gap-2"
              variant="secondary"
            >
              <ImagePlus className="w-4 h-4" />
              Add Media
            </Button>
          )}

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          ) : mediaItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full bg-muted/30 blur-xl scale-150" />
                <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-muted/80 to-muted/40 border border-border/50 flex items-center justify-center">
                  <Film className="w-12 h-12 text-muted-foreground" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">Media Gallery</h2>
              <p className="text-muted-foreground mb-6 max-w-sm leading-relaxed">
                Share videos, pictures, and GIFs with your community in this visual gallery.
              </p>
              {canSendMessages && (
                <Button onClick={() => setIsUploadModalOpen(true)} className="gap-2">
                  <Upload className="w-4 h-4" />
                  Upload First Media
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {mediaItems.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  onClick={() => setSelectedMedia(item)}
                  onDelete={() => handleDelete(item.id)}
                  canDelete={item.user_id === user?.id || canManageMessages}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Upload Modal */}
      <Dialog open={isUploadModalOpen} onOpenChange={(open) => {
        setIsUploadModalOpen(open);
        if (!open) resetUploadForm();
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Media</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Upload type tabs */}
            <div className="flex gap-2">
              <Button
                variant={uploadType === 'file' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setUploadType('file')}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload File
              </Button>
              <Button
                variant={uploadType === 'url' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setUploadType('url')}
                className="gap-2"
              >
                <Link2 className="w-4 h-4" />
                Paste URL
              </Button>
            </div>

            {uploadType === 'file' ? (
              <div className="space-y-4">
                {filePreview ? (
                  <div className="relative rounded-xl overflow-hidden bg-muted">
                    <AspectRatio ratio={16/9}>
                      <img 
                        src={filePreview} 
                        alt="Preview" 
                        className="object-contain w-full h-full"
                      />
                    </AspectRatio>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute top-2 right-2 w-8 h-8"
                      onClick={() => {
                        setSelectedFile(null);
                        setFilePreview(null);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Click to select or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Images up to 3MB • Videos up to 10MB
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime,video/x-msvideo"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>YouTube URL or Image Link</Label>
                <Input
                  placeholder="https://youtube.com/watch?v=... or https://example.com/image.jpg"
                  value={urlInput}
                  onChange={(e) => handleUrlChange(e.target.value)}
                />
                {extractYouTubeId(urlInput) && (
                  <div className="rounded-xl overflow-hidden bg-muted">
                    <AspectRatio ratio={16/9}>
                      <img 
                        src={`https://img.youtube.com/vi/${extractYouTubeId(urlInput)}/maxresdefault.jpg`}
                        alt="YouTube thumbnail" 
                        className="object-cover w-full h-full"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center">
                          <Play className="w-8 h-8 text-destructive-foreground fill-current ml-1" />
                        </div>
                      </div>
                    </AspectRatio>
                  </div>
                )}
              </div>
            )}

            {/* Title and Description */}
            <div className="space-y-2">
              <Label>Title (optional)</Label>
              <Input
                placeholder="Give your media a title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Add a description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
              />
            </div>

            <Button 
              onClick={handleUpload} 
              disabled={isUploading || (!selectedFile && !urlInput)}
              className="w-full gap-2"
            >
              {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isUploading ? 'Uploading...' : 'Add Media'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Media Lightbox */}
      <AnimatePresence>
        {selectedMedia && (
          <MediaLightbox
            item={selectedMedia}
            onClose={() => setSelectedMedia(null)}
          />
        )}
      </AnimatePresence>

      {/* Drag Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg pointer-events-none"
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-lg font-medium text-foreground">
                  Drop media to upload
                </p>
                <p className="text-sm text-muted-foreground">
                  Images and GIFs
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Media Card Component
const MediaCard = ({ 
  item, 
  onClick, 
  onDelete,
  canDelete 
}: { 
  item: MediaItem; 
  onClick: () => void; 
  onDelete: () => void;
  canDelete: boolean;
}) => {
  const isYouTube = item.media_type === 'youtube';
  const thumbnailSrc = isYouTube 
    ? item.thumbnail_url 
    : item.media_url;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group relative rounded-xl overflow-hidden bg-muted cursor-pointer"
      onClick={onClick}
    >
      <AspectRatio ratio={1}>
        <img
          src={thumbnailSrc || '/placeholder.svg'}
          alt={item.title || 'Media'}
          className="object-cover w-full h-full transition-transform group-hover:scale-105"
          loading="lazy"
        />
        
        {/* Play button for videos */}
        {isYouTube && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="w-12 h-12 rounded-full bg-destructive flex items-center justify-center shadow-lg">
              <Play className="w-6 h-6 text-destructive-foreground fill-current ml-0.5" />
            </div>
          </div>
        )}

        {/* GIF badge */}
        {item.media_type === 'gif' && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-secondary/80 text-foreground text-xs font-medium">
            GIF
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        
        {/* Bottom info overlay - user and title together to avoid overlap */}
        <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-2 mb-1">
            <Avatar className="w-5 h-5 border border-border flex-shrink-0">
              <AvatarImage src={item.user?.avatar_url || undefined} />
              <AvatarFallback style={{ backgroundColor: item.user?.banner_color || 'hsl(var(--primary))' }} className="text-[8px] text-primary-foreground">
                {item.user?.username?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <span className="text-foreground text-xs truncate">{item.user?.username}</span>
          </div>
          {item.title && (
            <p className="text-foreground text-sm font-medium line-clamp-2">{item.title}</p>
          )}
        </div>

        {/* Actions */}
        {canDelete && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button size="icon" variant="secondary" className="w-8 h-8">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </AspectRatio>
    </motion.div>
  );
};

// Media Lightbox Component
const MediaLightbox = ({ 
  item, 
  onClose 
}: { 
  item: MediaItem; 
  onClose: () => void;
}) => {
  const isYouTube = item.media_type === 'youtube';
  const [showComments, setShowComments] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex bg-black/95 backdrop-blur-md"
      onClick={onClose}
    >
      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {/* Top controls bar */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              <AvatarImage src={item.user?.avatar_url || undefined} />
              <AvatarFallback style={{ backgroundColor: item.user?.banner_color || 'hsl(var(--primary))' }} className="text-xs text-primary-foreground">
                {item.user?.username?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-white">{item.user?.username}</p>
              <p className="text-xs text-white/60">{formatRelativeTime(item.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowComments(!showComments);
              }}
              className={`p-2.5 rounded-lg transition-colors text-white ${
                showComments ? 'bg-white/20' : 'bg-white/10 hover:bg-white/20'
              }`}
              aria-label={showComments ? 'Hide comments' : 'Show comments'}
              title={showComments ? 'Hide comments' : 'Show comments'}
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
              aria-label="Close"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Media content */}
        <div 
          className="flex-1 flex items-center justify-center p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="max-w-4xl max-h-full w-full">
            {isYouTube ? (
              <AspectRatio ratio={16/9} className="bg-muted rounded-xl overflow-hidden">
                <iframe
                  src={`https://www.youtube.com/embed/${item.youtube_video_id}?autoplay=1`}
                  title={item.title || 'YouTube video'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </AspectRatio>
            ) : (
              <img
                src={item.media_url}
                alt={item.title || 'Media'}
                className="max-h-[75vh] w-auto mx-auto object-contain rounded-xl"
              />
            )}

            {/* Title and description below media */}
            {(item.title || item.description) && (
              <div className="mt-4 text-center">
                {item.title && (
                  <h3 className="text-lg font-semibold text-white mb-1">{item.title}</h3>
                )}
                {item.description && (
                  <p className="text-sm text-white/70">{item.description}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comments sidebar */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-[360px] bg-background border-l border-border flex flex-col h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <MediaComments 
              mediaId={item.id} 
              channelId={item.channel_id}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
