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
  message: Message | null;
  onClose: () => void;
}

export const DeleteMessageModal = ({ message, onClose }: DeleteMessageModalProps) => {
  const { deleteMessage } = useMessageStore();
  const { user } = useAuthStore();

  const handleDelete = async () => {
    if (message && user) {
      await deleteMessage(message.id, user.id);
      onClose();
    }
  };

  return (
    <AlertDialog open={!!message} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Message</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this message? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {message && (
          <div className="my-4 p-3 bg-secondary rounded-lg border border-border">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">
                {message.user?.display_name || message.user?.username || 'Unknown'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {getMessagePreview(message.content, 200)}
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