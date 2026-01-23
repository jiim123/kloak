import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { AVATAR_DECORATIONS } from "@/lib/avatarDecorations";
import { X, Sparkles, Trash2 } from "lucide-react";

interface AvatarDecorationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (decorationId: string | null) => void;
}

export const AvatarDecorationModal = ({ open, onOpenChange, onSelect }: AvatarDecorationModalProps) => {
  const { user, updateUser } = useAuthStore();
  const [selectedDecoration, setSelectedDecoration] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewHovered, setIsPreviewHovered] = useState(false);

  // Sync state when modal opens or user changes
  useEffect(() => {
    if (open && user) {
      // Explicitly handle null/undefined - normalize to null
      setSelectedDecoration(user.avatar_decoration ?? null);
    }
  }, [open, user?.avatar_decoration]);

  // Check if there are unsaved changes
  const hasChanges = selectedDecoration !== (user?.avatar_decoration ?? null);

  // Check if user currently has a decoration applied (in database)
  const hasCurrentDecoration = Boolean(user?.avatar_decoration);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      // Explicitly set to null when removing, not undefined
      await updateUser({ avatar_decoration: selectedDecoration === null ? null : selectedDecoration });
      onSelect(selectedDecoration);

      if (selectedDecoration === null) {
        toast.success("Avatar decoration removed!");
      } else {
        toast.success("Avatar decoration updated!");
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save avatar decoration:", error);
      toast.error("Failed to save avatar decoration");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      // Explicitly pass null to remove the decoration
      await updateUser({ avatar_decoration: null });
      setSelectedDecoration(null);
      onSelect(null);
      toast.success("Avatar decoration removed!");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to remove avatar decoration:", error);
      toast.error("Failed to remove avatar decoration");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectNone = () => {
    setSelectedDecoration(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-hidden bg-background/95 backdrop-blur-xl border-border/50 rounded-2xl p-0 flex flex-col">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-6 pb-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">Avatar Decoration</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Choose a decoration to display around your avatar
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pt-4 space-y-4 sm:space-y-6">
          {/* Preview Section */}
          <div className="flex flex-col items-center gap-3 p-4 sm:p-6 bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30">
            <div
              className="relative cursor-pointer transition-transform hover:scale-105"
              onMouseEnter={() => setIsPreviewHovered(true)}
              onMouseLeave={() => setIsPreviewHovered(false)}
            >
              <AvatarWithDecoration
                user={user ? { ...user, avatar_decoration: selectedDecoration } : null}
                className="w-20 h-20 sm:w-24 sm:h-24"
                active={isPreviewHovered}
              />
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground text-center">
              {selectedDecoration ? "Hover to preview animation" : "No decoration selected"}
            </p>
          </div>

          {/* Decoration Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
            {/* None option */}
            <button
              onClick={handleSelectNone}
              className={cn(
                "flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all duration-200",
                selectedDecoration === null
                  ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                  : "border-border/50 hover:border-primary/50 hover:bg-secondary/50",
              )}
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-muted/50 flex items-center justify-center border border-border/30">
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
              </div>
              <span className="text-[10px] sm:text-xs font-medium">None</span>
            </button>

            {/* Available decorations */}
            {AVATAR_DECORATIONS.map((decoration) => (
              <button
                key={decoration.id}
                onClick={() => setSelectedDecoration(decoration.id)}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all duration-200",
                  selectedDecoration === decoration.id
                    ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                    : "border-border/50 hover:border-primary/50 hover:bg-secondary/50",
                )}
              >
                <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-muted/50 overflow-hidden border border-border/30">
                  <img
                    src={decoration.src}
                    alt={decoration.name}
                    className="w-full h-full object-contain"
                    style={{ imageRendering: "pixelated" }}
                  />
                </div>
                <span className="text-[10px] sm:text-xs font-medium text-center leading-tight line-clamp-2">
                  {decoration.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Actions (sticky footer) */}
        <div className="p-4 sm:p-6 pt-3 border-t border-border/30">
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none rounded-xl">
              Cancel
            </Button>

            {/* Show Remove button only if user HAS a decoration currently saved */}
            {hasCurrentDecoration && (
              <Button
                variant="outline"
                onClick={handleRemove}
                disabled={isSaving}
                className="flex-1 sm:flex-none rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove
              </Button>
            )}

            <Button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="flex-1 sm:flex-none rounded-xl bg-primary hover:bg-primary/90"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
