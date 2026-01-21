import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AvatarWithDecoration } from '@/components/ui/avatar-with-decoration';
import { AVATAR_DECORATIONS } from '@/lib/avatarDecorations';

interface AvatarDecorationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (decorationId: string | null) => void;
}

export const AvatarDecorationModal = ({ open, onOpenChange, onSelect }: AvatarDecorationModalProps) => {
  const { user, updateUser } = useAuthStore();
  const [selectedDecoration, setSelectedDecoration] = useState<string | null>(user?.avatar_decoration || null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewHovered, setIsPreviewHovered] = useState(false);

  // Update selected decoration when user changes
  useEffect(() => {
    if (open && user) {
      setSelectedDecoration(user.avatar_decoration || null);
    }
  }, [open, user?.avatar_decoration]);

  const handleSave = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      await updateUser({ avatar_decoration: selectedDecoration });
      onSelect(selectedDecoration);
      toast.success('Avatar decoration updated!');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save avatar decoration:', error);
      toast.error('Failed to save avatar decoration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      await updateUser({ avatar_decoration: null });
      setSelectedDecoration(null);
      onSelect(null);
      toast.success('Avatar decoration removed!');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to remove avatar decoration:', error);
      toast.error('Failed to remove avatar decoration');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Avatar Decoration</DialogTitle>
          <DialogDescription>
            Choose a decoration to display on your avatar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Preview */}
          <div className="flex flex-col items-center gap-4 p-6 bg-secondary/50 rounded-lg">
            <div
              className="relative"
              onMouseEnter={() => setIsPreviewHovered(true)}
              onMouseLeave={() => setIsPreviewHovered(false)}
            >
              <AvatarWithDecoration
                user={user ? { ...user, avatar_decoration: selectedDecoration } : null}
                className="w-24 h-24"
                active={isPreviewHovered}
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Preview of how your avatar will look
            </p>
          </div>

          {/* Decoration Grid */}
          <div className="max-h-[40vh] sm:max-h-[50vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {/* None option */}
              <button
                onClick={() => setSelectedDecoration(null)}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                  selectedDecoration === null
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-2xl">✕</span>
                </div>
                <span className="text-xs font-medium">None</span>
              </button>

              {/* Available decorations */}
              {AVATAR_DECORATIONS.map((decoration) => (
                <button
                  key={decoration.id}
                  onClick={() => setSelectedDecoration(decoration.id)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                    selectedDecoration === decoration.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <div className="relative w-16 h-16 rounded-full bg-muted overflow-hidden">
                    <img
                      src={decoration.src}
                      alt={decoration.name}
                      className="w-full h-full object-contain"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>
                  <span className="text-xs font-medium text-center">{decoration.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {selectedDecoration && (
              <Button variant="outline" onClick={handleRemove} disabled={isSaving}>
                Remove
              </Button>
            )}
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
