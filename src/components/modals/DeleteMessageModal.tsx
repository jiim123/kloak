import { useState, useEffect } from "react";
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
import { useMessageStore } from "@/stores/messageStore";
import { useAuthStore } from "@/stores/authStore";
import { useMessageUser } from "@/stores/userCacheStore";
import { getMessagePreview } from "@/lib/message";
import { getSignedAttachmentUrl, extractStoragePath } from "@/lib/signedUrl";
import type { Message } from "@/types";
interface DeleteMessageModalProps {
  message?: Message | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onConfirm?: () => void;
  onClose?: () => void;
  messageContent?: string;
  /** Custom delete handler (used for DM messages) */
  customDeleteHandler?: (messageId: string, userId: string) => Promise<void>;
}

// Helper to check if a line is an image URL
const isImageUrl = (line: string): boolean => {
  const trimmed = line.trim();
  if (/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(trimmed)) return true;
  if (/^https?:\/\/.*supabase.*\/storage\/.*$/i.test(trimmed)) return true;
  return false;
};

// Parse content into caption text and image URLs
const parseContentImages = (content: string): { images: string[]; caption: string } => {
  const lines = content.trim().split("\n");
  const images: string[] = [];
  const captionLines: string[] = [];

  for (const line of lines) {
    if (isImageUrl(line)) {
      images.push(line.trim());
    } else if (line.trim()) {
      captionLines.push(line);
    }
  }

  return { images, caption: captionLines.join("\n").trim() };
};

export const DeleteMessageModal = ({
  message: messageProp,
  open: openProp,
  onOpenChange,
  onConfirm,
  onClose,
  messageContent,
  customDeleteHandler,
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
      const deleteFn = customDeleteHandler || deleteMessage;
      await deleteFn(message.id, user.id);
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
  const displayUser = useMessageUser(message?.user_id);
  const { images, caption } = parseContentImages(displayContent);
  const hasImages = images.length > 0;

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

            {caption && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{getMessagePreview(caption, 150)}</p>
            )}

            {hasImages ? (
              <div className="flex flex-wrap gap-1.5">
                {images.slice(0, 4).map((url, i) => (
                  <div key={i} className="relative">
                    <img
                      src={url}
                      alt="Attachment"
                      className="w-20 h-20 rounded-md object-cover select-none pointer-events-none"
                      onContextMenu={(e) => e.preventDefault()}
                      draggable={false}
                    />
                  </div>
                ))}
                {images.length > 4 && (
                  <div className="w-20 h-20 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground">
                    +{images.length - 4} more
                  </div>
                )}
              </div>
            ) : !caption ? (
              <p className="text-sm text-muted-foreground line-clamp-3">{getMessagePreview(displayContent, 200)}</p>
            ) : null}
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
