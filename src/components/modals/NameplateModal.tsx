import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AVAILABLE_NAMEPLATES } from "@/types";
import { NameplateVideo } from "@/components/ui/nameplate-video";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { StyledName } from "@/components/ui/styled-name";
import { Check, X, Star } from "lucide-react";

interface NameplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (nameplateId: string | null) => void;
}

const DUMMY_STATUS = "Playing Kloak";

export const NameplateModal = ({ open, onOpenChange, onSelect }: NameplateModalProps) => {
  const { user, updateUser } = useAuthStore();
  const [selectedNameplate, setSelectedNameplate] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when modal opens or user changes
  useEffect(() => {
    if (open && user) {
      setSelectedNameplate(user.nameplate ?? null);
    }
  }, [open, user?.nameplate, user]);

  const hasChanges = selectedNameplate !== (user?.nameplate ?? null);
  const previewName = user?.display_name || user?.username || "Username";
  const previewStatus = user?.custom_status || DUMMY_STATUS;

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateUser({ nameplate: selectedNameplate === null ? null : selectedNameplate });
      onSelect(selectedNameplate);
      if (selectedNameplate === null) {
        toast.success("Nameplate removed!");
      } else {
        toast.success("Nameplate updated!");
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save nameplate:", error);
      toast.error("Failed to save nameplate");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-hidden bg-background/95 backdrop-blur-xl border-border/50 rounded-2xl p-0 flex flex-col">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-6 pb-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Star className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <DialogTitle className="text-lg font-medium">Nameplate</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Choose an animated background for your username in sidebars
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pt-4 space-y-4 sm:space-y-6">
          {/* Preview Section — mimics sidebar member item */}
          <div className="flex flex-col items-center gap-3 p-4 sm:p-6 bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30">
            <p className="text-xs text-muted-foreground">Preview</p>

            <div className="relative w-full max-w-[280px] rounded-xl px-2 py-1.5">
              {/* Nameplate background */}
              {selectedNameplate && (
                <NameplateVideo nameplate={selectedNameplate} forcePlay />
              )}

              <div className="relative flex items-center gap-2 z-[2]">
                {/* Avatar with status */}
                <div className="relative flex-shrink-0">
                  <AvatarWithDecoration
                    user={user ? { ...user, nameplate: selectedNameplate } : null}
                    className="w-8 h-8 rounded-full"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 p-[2px] bg-background rounded-full">
                    <div className="w-2.5 h-2.5 rounded-full bg-kloak-online" />
                  </div>
                </div>

                {/* Name + status */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <StyledName
                    user={user}
                    name={previewName}
                    className="text-[14px] font-semibold truncate leading-tight text-foreground block"
                  />
                  <p className="text-[11px] truncate mt-0.5 text-muted-foreground/80 max-w-[180px]">
                    {previewStatus}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              {selectedNameplate ? "This is how it will appear in member lists" : "No nameplate selected"}
            </p>
          </div>

          {/* Nameplate Grid */}
          <div className="grid grid-cols-3 gap-2">
            {/* None option */}
            <button
              onClick={() => setSelectedNameplate(null)}
              className={cn(
                "relative h-14 rounded-lg overflow-hidden border-2 transition-all duration-200",
                selectedNameplate === null
                  ? "border-primary ring-2 ring-primary/30 bg-primary/10 shadow-lg shadow-primary/10"
                  : "border-border/50 hover:border-primary/50 hover:bg-secondary/50",
              )}
            >
              <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                <X className="w-4 h-4 text-muted-foreground" />
              </div>
              <span className="absolute bottom-1 left-0 right-0 text-center text-[9px] font-medium text-muted-foreground">
                None
              </span>
            </button>

            {/* Available nameplates */}
            {AVAILABLE_NAMEPLATES.map((plate) => (
              <button
                key={plate.id}
                type="button"
                className={cn(
                  "relative h-14 rounded-lg overflow-hidden border-2 transition-all duration-200 group/plate",
                  selectedNameplate === plate.id
                    ? "border-primary ring-2 ring-primary/30 shadow-lg shadow-primary/10"
                    : "border-border/50 hover:border-primary/50",
                )}
                onClick={() => setSelectedNameplate(selectedNameplate === plate.id ? null : plate.id)}
              >
                {/* Render based on format */}
                {plate.format === 'png' && (
                  <img
                    className="absolute inset-0 w-full h-full object-cover"
                    src={plate.src}
                    alt=""
                  />
                )}
                {plate.format === 'gif' && (
                  <img
                    className="absolute inset-0 w-full h-full object-cover"
                    src={plate.src}
                    alt=""
                    style={{ animationPlayState: 'paused' }}
                  />
                )}
                {plate.format === 'webm' && (
                  <video
                    className="absolute inset-0 w-full h-full object-cover"
                    src={plate.src}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                  />
                )}
                <div className="absolute inset-0 bg-black/30" />
                <span className="absolute bottom-1 left-0 right-0 text-center text-[9px] font-medium text-white/90 truncate px-1">
                  {plate.label}
                </span>
                {selectedNameplate === plate.id && (
                  <div className="absolute top-1 right-1 z-10 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-primary-foreground" />
                  </div>
                )}
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
