import { useState, useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { ServerMember } from '@/types';

type ActionType = 'kick' | 'ban' | 'mute' | 'unmute' | 'transferOwnership';

export const ConfirmActionModal = () => {
  const { activeModal, modalData, closeModal } = useUIStore();
  const { kickMember, banMember, updateMember, transferOwnership, currentServer } = useServerStore();
  const { user } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOpen = activeModal === 'confirmAction';
  const action = modalData?.action as ActionType | undefined;
  const member = modalData?.member as ServerMember | undefined;
  const title = modalData?.title as string | undefined;
  const message = modalData?.message as string | undefined;
  

  const handleClose = () => {
    closeModal();
  };

  const handleConfirm = async () => {
    if (!member || !currentServer || !action) return;
    
    setIsSubmitting(true);
    
    try {
      switch (action) {
        case 'kick':
          await kickMember(currentServer.id, member.user_id);
          toast.success(`${member.nickname || member.user?.username} has been kicked from the server`);
          break;
          
        case 'ban':
          await banMember(currentServer.id, member.user_id);
          toast.success(`${member.nickname || member.user?.username} has been banned from the server`);
          break;
          
        case 'mute':
          await updateMember(member.id, { is_muted: true });
          toast.success(`${member.nickname || member.user?.username} has been muted`);
          break;
          
        case 'unmute':
          await updateMember(member.id, { is_muted: false });
          toast.success(`${member.nickname || member.user?.username} has been unmuted`);
          break;
          
          
        case 'transferOwnership':
          if (user) {
            await transferOwnership(currentServer.id, user.id, member.user_id);
            toast.success(`Server ownership has been transferred to ${member.nickname || member.user?.username}`);
          }
          break;
      }
      
      handleClose();
    } catch (error) {
      console.error('Action failed:', error);
      toast.error(`Failed to ${action} member`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getActionColor = () => {
    switch (action) {
      case 'kick':
        return 'bg-orange-500 hover:bg-orange-600';
      case 'ban':
        return 'bg-destructive hover:bg-destructive/90';
      case 'transferOwnership':
        return 'bg-yellow-500 hover:bg-yellow-600 text-black';
      default:
        return '';
    }
  };

  const getActionText = () => {
    switch (action) {
      case 'kick': return 'Kick';
      case 'ban': return 'Ban';
      case 'mute': return 'Mute';
      case 'unmute': return 'Unmute';
      
      case 'transferOwnership': return 'Transfer Ownership';
      default: return 'Confirm';
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>{message}</p>
            {action === 'kick' && (
              <p className="text-muted-foreground text-sm">
                They will be able to rejoin the server with an invite link.
              </p>
            )}
            {action === 'ban' && (
              <p className="text-muted-foreground text-sm">
                They will not be able to rejoin the server until unbanned.
              </p>
            )}
            {action === 'transferOwnership' && (
              <p className="text-destructive text-sm font-medium">
                Warning: This action cannot be undone! You will become an admin.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={getActionColor()}
          >
            {isSubmitting ? 'Processing...' : getActionText()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// Change Nickname Modal
export const ChangeNicknameModal = () => {
  const { activeModal, modalData, closeModal } = useUIStore();
  const { updateMember } = useServerStore();
  const [nickname, setNickname] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOpen = activeModal === 'changeNickname';
  const member = modalData?.member as ServerMember | undefined;

  // Initialize nickname when modal opens - must be in useEffect, not during render
  useEffect(() => {
    if (isOpen && member?.nickname) {
      setNickname(member.nickname);
    } else if (!isOpen) {
      setNickname('');
    }
  }, [isOpen, member?.nickname]);

  const handleClose = () => {
    setNickname('');
    closeModal();
  };

  const handleSubmit = async () => {
    if (!member) return;
    
    setIsSubmitting(true);
    
    try {
      await updateMember(member.id, { nickname: nickname.trim() || null });
      toast.success('Nickname updated');
      handleClose();
    } catch (error) {
      console.error('Failed to update nickname:', error);
      toast.error('Failed to update nickname');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!member) {
    return (
      <AlertDialog open={false} onOpenChange={handleClose}>
        <AlertDialogContent aria-describedby={undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Nickname</AlertDialogTitle>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Change Nickname</AlertDialogTitle>
          <AlertDialogDescription>
            Set a server-specific nickname for {member.user?.username}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="py-4">
          <Label htmlFor="nickname">Nickname</Label>
          <Input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder={member.user?.username || 'Enter nickname'}
            maxLength={32}
            className="mt-2"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Leave empty to use their display name
          </p>
        </div>
        
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};