import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUIStore } from '@/stores/uiStore';
import { useMessageStore } from '@/stores/messageStore';
import { useAuthStore } from '@/stores/authStore';
import { getMessagePreview } from '@/lib/message';
import type { Message } from '@/types';

interface DeleteMessageModalProps {
  message?: Message | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onConfirm?: () => void;
  onClose?: () => void;
  messageContent?: string;
}

export const DeleteMessageModal = ({ 
  message: messageProp, 
  open: openProp,
  onOpenChange,
  onConfirm,
  onClose,
  messageContent
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

  const displayContent = messageContent || (message ? message.content : '');
  const displayUser = message?.user;

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
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">
                  {displayUser.display_name || displayUser.username || 'Unknown'}
                </span>
              </div>
            )}
            <p className="text-sm text-muted-foreground line-clamp-3">
              {getMessagePreview(displayContent, 200)}
            </p>
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