import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useMessageStore } from "@/stores/messageStore";
import { useAuthStore } from "@/stores/authStore";
import { useMessageUser } from "@/stores/userCacheStore";
import { getMessagePreview } from "@/lib/message";
import { getSignedAttachmentUrl } from "@/lib/signedUrl";
import { getPollIdFromContent, isPollMessageContent, usePollLabel } from "@/lib/poll";
import type { Message } from "@/types";

const MODAL_CONTENT_CLASS =
  "max-h-[90vh] max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-[4px] border border-[#4a4f5a] bg-[#333842] p-0 text-[#f4f5f7] shadow-2xl sm:max-w-[448px]";

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
  if (/^kloak-attachment:\/\/.+/i.test(trimmed)) return true;
  if (/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(trimmed)) return true;
  if (/^https?:\/\/.*supabase.*\/storage\/.*$/i.test(trimmed)) return true;
  return false;
};

// Component to resolve kloak-attachment:// URLs to displayable src
const ResolvedImage = ({ url, className }: { url: string; className?: string }) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (url.startsWith("kloak-attachment://")) {
      const path = url.replace("kloak-attachment://", "");
      if (path) {
        getSignedAttachmentUrl(path).then(setSrc).catch(() => {});
      }
    } else {
      setSrc(url);
    }
  }, [url]);

  if (!src) return <div className={`${className} bg-muted animate-pulse`} />;

  return (
    <img
      src={src}
      alt="Attachment"
      className={`${className} select-none pointer-events-none`}
      onContextMenu={(e) => e.preventDefault()}
      draggable={false}
    />
  );
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
  const [isDeleting, setIsDeleting] = useState(false);

  const message = messageProp || null;
  const isOpen = openProp !== undefined ? openProp : !!message;

  const handleClose = () => {
    if (onOpenChange) onOpenChange(false);
    if (onClose) onClose();
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      if (onConfirm) {
        await Promise.resolve(onConfirm());
        handleClose();
      } else if (message && user) {
        const deleteFn = customDeleteHandler || deleteMessage;
        await deleteFn(message.id, user.id);
        handleClose();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (open) return;
    handleClose();
  };

  const displayContent = messageContent || (message ? message.content : "");
  const displayUser = useMessageUser(message?.user_id);
  const isPoll = isPollMessageContent(displayContent);
  const pollId = isPoll ? getPollIdFromContent(displayContent) : null;
  const pollLabel = usePollLabel(pollId);
  const { images, caption } = isPoll ? { images: [] as string[], caption: "" } : parseContentImages(displayContent);
  const hasImages = images.length > 0;
  const displayName = displayUser?.display_name || displayUser?.username || "Unknown";

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className={MODAL_CONTENT_CLASS} hideCloseButton>
        <div className="flex max-h-[82vh] flex-col overflow-hidden">
          <div className="border-b border-[#2b3039] bg-[#2f343d] px-5 py-3">
            <div className="text-base font-medium leading-none tracking-tight">Delete Message</div>
          </div>

          <div className="space-y-5 overflow-y-auto px-6 py-4">
            <div className="space-y-2">
              <p className="text-sm leading-6 text-[#f3f4f7]">
                Are you sure you want to delete this message? This action cannot be undone.
              </p>
            </div>

            {(message || messageContent) && (
              <div className="border border-[#4a4f5a] bg-[#2f343d] p-3">
                <p className="text-sm font-medium leading-none text-[#f3f4f7]">Selected message</p>

                <div className="mt-2">
                  <p className="text-sm text-[#d7dbe3]">{displayName}</p>
                  {displayUser?.username && (
                    <p className="mt-1 text-xs text-[#9ea4af]">@{displayUser.username}</p>
                  )}
                </div>

                {isPoll ? (
                  <p className="mt-3 line-clamp-3 text-sm italic text-[#cfd4de]">{pollLabel}</p>
                ) : (caption || !hasImages) && (
                  <p className="mt-3 line-clamp-3 text-sm text-[#cfd4de]">
                    {getMessagePreview(caption || displayContent, 200)}
                  </p>
                )}

                {hasImages ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {images.slice(0, 4).map((url, i) => (
                      <div key={i} className="relative">
                        <ResolvedImage url={url} className="h-20 w-20 rounded-md object-cover" />
                      </div>
                    ))}
                    {images.length > 4 && (
                      <div className="flex h-20 w-20 items-center justify-center rounded-md bg-[#3a404b] text-xs text-[#b8bec8]">
                        +{images.length - 4} more
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#2c3139] bg-[#30353f] px-5 py-3">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isDeleting}
              className="h-9 rounded-[3px] px-4 text-[#b9bec8] hover:bg-transparent hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="h-9 rounded-[3px] bg-[#d32f2f] px-5 font-medium text-white hover:bg-[#b71c1c]"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Message"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
