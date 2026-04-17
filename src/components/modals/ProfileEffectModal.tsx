import { Sparkle, Trash, X } from "@phosphor-icons/react";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PROFILE_EFFECTS } from "@/lib/profileEffects";


interface ProfileEffectModalProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 onSelect: (effectId: string | null) => void;
}

export const ProfileEffectModal = ({ open, onOpenChange, onSelect }: ProfileEffectModalProps) => {
 const { user, updateUser } = useAuthStore();
 const [selectedEffect, setSelectedEffect] = useState<string | null>(null);
 const [isSaving, setIsSaving] = useState(false);

 // Sync state when modal opens or user changes
 useEffect(() => {
 if (open && user) {
 // Explicitly handle null/undefined - normalize to null
 setSelectedEffect(user.profile_effect ?? null);
 }
 }, [open, user?.profile_effect]);

 // Check if there are unsaved changes
 const hasChanges = selectedEffect !== (user?.profile_effect ?? null);

 // Check if user currently has an effect applied (in database)
 const hasCurrentEffect = Boolean(user?.profile_effect);

 const handleSave = async () => {
 if (!user) return;

 setIsSaving(true);
 try {
 // Explicitly set to null when removing, not undefined
 await updateUser({ profile_effect: selectedEffect === null ? null : selectedEffect });
 onSelect(selectedEffect);

 if (selectedEffect === null) {
 toast.success("Profile effect removed!");
 } else {
 toast.success("Profile effect updated!");
 }
 onOpenChange(false);
 } catch (error) {
 console.error("Failed to save profile effect:", error);
 toast.error("Failed to save profile effect");
 } finally {
 setIsSaving(false);
 }
 };

 const handleRemove = async () => {
 if (!user) return;

 setIsSaving(true);
 try {
 // Explicitly pass null to remove the effect
 await updateUser({ profile_effect: null });
 setSelectedEffect(null);
 onSelect(null);
 toast.success("Profile effect removed!");
 onOpenChange(false);
 } catch (error) {
 console.error("Failed to remove profile effect:", error);
 toast.error("Failed to remove profile effect");
 } finally {
 setIsSaving(false);
 }
 };

 const handleSelectNone = () => {
 setSelectedEffect(null);
 };

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="sm:max-w-xl max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-hidden bg-background/95 backdrop-blur-xl border-border/50 rounded-2xl p-0 flex flex-col">
 {/* Header */}
 <DialogHeader className="p-4 sm:p-6 pb-0">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
 <Sparkle className="w-5 h-5 text-primary" />
 </div>
 <div>
 <DialogTitle className="text-lg font-medium">Profile Effect</DialogTitle>
 <DialogDescription className="text-sm text-muted-foreground">
 Choose an effect to display in your profile card
 </DialogDescription>
 </div>
 </div>
 </DialogHeader>

 <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pt-4 space-y-4 sm:space-y-6">
 {/* Preview Section */}
 <div className="flex flex-col items-center gap-3 p-4 sm:p-6 bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30">
 <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-xl bg-muted/50 overflow-hidden border border-border/30 flex items-center justify-center">
 {selectedEffect ? (
 <img
 src={PROFILE_EFFECTS.find((e) => e.id === selectedEffect)?.src}
 alt={PROFILE_EFFECTS.find((e) => e.id === selectedEffect)?.name || "Profile effect"}
 className="w-full h-full object-contain"
 />
 ) : (
 <X className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
 )}
 </div>
 <p className="text-xs sm:text-sm text-muted-foreground text-center">
 {selectedEffect ? "Preview of selected effect" : "No effect selected"}
 </p>
 </div>

 {/* Effect Grid */}
 <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
 {/* None option */}
 <button
 onClick={handleSelectNone}
 className={cn(
 "flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all duration-200",
 selectedEffect === null
 ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
 : "border-border/50 hover:border-primary/50 hover:bg-secondary/50",
 )}
 >
 <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-muted/50 flex items-center justify-center border border-border/30">
 <X className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
 </div>
 <span className="text-[10px] sm:text-xs font-medium">None</span>
 </button>

 {/* Available effects */}
 {PROFILE_EFFECTS.map((effect) => (
 <button
 key={effect.id}
 onClick={() => setSelectedEffect(effect.id)}
 className={cn(
 "flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all duration-200",
 selectedEffect === effect.id
 ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
 : "border-border/50 hover:border-primary/50 hover:bg-secondary/50",
 )}
 >
 <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-muted/50 overflow-hidden border border-border/30">
 <img
 src={effect.src}
 alt={effect.name}
 className="w-full h-full object-contain"
 />
 </div>
 <span className="text-[10px] sm:text-xs font-medium text-center leading-tight line-clamp-2">
 {effect.name}
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

 {/* Show Remove button only if user HAS an effect currently saved */}
 {hasCurrentEffect && (
 <Button
 variant="outline"
 onClick={handleRemove}
 disabled={isSaving}
 className="flex-1 sm:flex-none rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
 >
 <Trash className="w-4 h-4 mr-2" />
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
