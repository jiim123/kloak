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
import { useUIStore } from "@/stores/uiStore";
import { useMessageStore } from "@/stores/messageStore";
import { useAuthStore } from "@/stores/authStore";
import { getMessagePreview, isImageOnlyMessage } from "@/lib/message";
import type { Message } from "@/types";

interface DeleteMessageModalProps {
  message?: Message | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onConfirm?: () => void;
  onClose?: () => void;
  messageContent?: string;
}

// Helper to extract image URLs from content
const extractImageUrl = (content: string): string | null => {
  const trimmed = content.trim();

  // Check if it's a direct image URL
  if (/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(trimmed)) {
    return trimmed;
  }

  // Check for Supabase storage URLs (they might not have extensions)
  if (/^https?:\/\/.*supabase.*\/storage\/.*$/i.test(trimmed)) {
    return trimmed;
  }

  return null;
};

// Helper to check if content contains an image (possibly with caption)
const getImageFromContent = (content: string): { imageUrl: string | null; caption: string | null } => {
  const lines = content.trim().split("\n");

  // Check last line for image URL (common pattern: caption + image)
  for (let i = lines.length - 1; i >= 0; i--) {
    const imageUrl = extractImageUrl(lines[i]);
    if (imageUrl) {
      const captionLines = lines.slice(0, i);
      const caption = captionLines.join("\n").trim();
      return { imageUrl, caption: caption || null };
    }
  }

  // Check if the whole content is just an image
  const directImage = extractImageUrl(content);
  if (directImage) {
    return { imageUrl: directImage, caption: null };
  }

  return { imageUrl: null, caption: null };
};

export const DeleteMessageModal = ({
  message: messageProp,
  open: openProp,
  onOpenChange,
  onConfirm,
  onClose,
  messageContent,
}: DeleteMessageModalProps) => {
  const { deleteMessage } = useMessageStore();
  const { user } = useAuthStore();

  const message = messageProp || null;
  const isOpen = openProp !== undefined ? openProp : !!message;

  const handleDelete = async () => {
    if (onConfirm) {
      onConfirm();
      if (onOpenChange) onOpenChange(false);
      if (onClose) onClose();
    } else if (message && user) {
      await deleteMessage(message.id, user.id);
      if (onOpenChange) onOpenChange(false);
      if (onClose) onClose();
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    } else if (!open && onClose) {
      onClose();
    }
  };

  const displayContent = messageContent || (message ? message.content : "");
  const displayUser = message?.user;

  // Check if content contains an image
  const { imageUrl, caption } = getImageFromContent(displayContent);
  const isImageMessage = !!imageUrl;

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Message</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this message? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {(message || messageContent) && (
          <div className="my-4 p-3 bg-secondary rounded-lg border border-border">
            {displayUser && (
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium text-sm">
                  {displayUser.display_name || displayUser.username || "Unknown"}
                </span>
              </div>
            )}

            {isImageMessage ? (
              <div className="space-y-2">
                {/* Show caption if present */}
                {caption && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{getMessagePreview(caption, 150)}</p>
                )}
                {/* Show image preview */}
                <div className="relative">
                  <img
                    src={imageUrl}
                    alt="Message attachment"
                    className="max-w-full max-h-40 rounded-md object-contain select-none pointer-events-none"
                    onContextMenu={(e) => e.preventDefault()}
                    draggable={false}
                  />
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 text-white text-[10px] rounded">
                    Image
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground line-clamp-3">{getMessagePreview(displayContent, 200)}</p>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
