import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import {
  AVATAR_DECORATIONS,
  DEFAULT_AVATAR_DECORATION_TRANSFORM,
  type AvatarDecorationTransform,
} from "@/lib/avatarDecorations";
import { Slider } from "@/components/ui/slider";
import { Copy, RotateCcw, X, Sparkles, Trash2 } from "lucide-react";

interface AvatarDecorationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (decorationId: string | null) => void;
}

const SCALE_MIN = 0.6;
const SCALE_MAX = 1.6;
const OFFSET_MIN = -30;
const OFFSET_MAX = 30;

const buildTransformMap = (): Record<string, AvatarDecorationTransform> =>
  Object.fromEntries(
    AVATAR_DECORATIONS.map((decoration) => [
      decoration.id,
      {
        scale: decoration.transform.scale,
        offsetXPercent: decoration.transform.offsetXPercent,
        offsetYPercent: decoration.transform.offsetYPercent,
      },
    ]),
  );

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const roundTo = (value: number, decimals = 2) => Number(value.toFixed(decimals));
const formatNumber = (value: number) => Number(value.toFixed(2)).toString();

const normalizeTransform = (transform: AvatarDecorationTransform): AvatarDecorationTransform => ({
  scale: roundTo(clamp(transform.scale, SCALE_MIN, SCALE_MAX)),
  offsetXPercent: roundTo(clamp(transform.offsetXPercent, OFFSET_MIN, OFFSET_MAX)),
  offsetYPercent: roundTo(clamp(transform.offsetYPercent, OFFSET_MIN, OFFSET_MAX)),
});

const areTransformsEqual = (a: AvatarDecorationTransform, b: AvatarDecorationTransform) =>
  a.scale === b.scale && a.offsetXPercent === b.offsetXPercent && a.offsetYPercent === b.offsetYPercent;

const formatTransformSnippet = (id: string, transform: AvatarDecorationTransform) =>
  `  "${id}": { scale: ${formatNumber(transform.scale)}, offsetXPercent: ${formatNumber(transform.offsetXPercent)}, offsetYPercent: ${formatNumber(transform.offsetYPercent)} },`;

const copyTextToClipboard = async (text: string) => {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    return;
  }
  throw new Error("Clipboard API unavailable");
};

export const AvatarDecorationModal = ({ open, onOpenChange, onSelect }: AvatarDecorationModalProps) => {
  const { user, updateUser } = useAuthStore();
  const [selectedDecoration, setSelectedDecoration] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewHovered, setIsPreviewHovered] = useState(false);
  const [draftTransforms, setDraftTransforms] = useState<Record<string, AvatarDecorationTransform>>(() =>
    buildTransformMap(),
  );
  // Re-enable debug tuner UI when needed:
  // const isDev = import.meta.env.DEV;
  const isDev = false;
  const baseTransformsById = useMemo(() => buildTransformMap(), []);

  // Sync state when modal opens or user changes
  useEffect(() => {
    if (open && user) {
      // Explicitly handle null/undefined - normalize to null
      setSelectedDecoration(user.avatar_decoration ?? null);
    }
  }, [open, user?.avatar_decoration]);

  useEffect(() => {
    if (!open) return;
    setDraftTransforms(buildTransformMap());
  }, [open]);

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

  const selectedTransform = useMemo(() => {
    if (!selectedDecoration) return null;
    return (
      draftTransforms[selectedDecoration] ??
      baseTransformsById[selectedDecoration] ??
      DEFAULT_AVATAR_DECORATION_TRANSFORM
    );
  }, [selectedDecoration, draftTransforms, baseTransformsById]);

  const changedTransformEntries = useMemo(() => {
    return AVATAR_DECORATIONS.map((decoration) => {
      const base = baseTransformsById[decoration.id] ?? DEFAULT_AVATAR_DECORATION_TRANSFORM;
      const current = draftTransforms[decoration.id] ?? base;
      return { id: decoration.id, base, current };
    }).filter((entry) => !areTransformsEqual(entry.base, entry.current));
  }, [draftTransforms, baseTransformsById]);

  const updateSelectedTransform = (patch: Partial<AvatarDecorationTransform>) => {
    if (!selectedDecoration) return;
    setDraftTransforms((prev) => {
      const current =
        prev[selectedDecoration] ?? baseTransformsById[selectedDecoration] ?? DEFAULT_AVATAR_DECORATION_TRANSFORM;
      return {
        ...prev,
        [selectedDecoration]: normalizeTransform({ ...current, ...patch }),
      };
    });
  };

  const resetSelectedTransform = () => {
    if (!selectedDecoration) return;
    setDraftTransforms((prev) => ({
      ...prev,
      [selectedDecoration]: baseTransformsById[selectedDecoration] ?? DEFAULT_AVATAR_DECORATION_TRANSFORM,
    }));
  };

  const handleCopySelectedTransform = async () => {
    if (!selectedDecoration || !selectedTransform) return;
    try {
      await copyTextToClipboard(formatTransformSnippet(selectedDecoration, selectedTransform).trim());
      toast.success("Selected transform copied");
    } catch (error) {
      console.error("Failed to copy selected transform:", error);
      toast.error("Could not copy selected transform");
    }
  };

  const handleCopyAllTransforms = async () => {
    if (changedTransformEntries.length === 0) {
      toast.info("No transform changes to copy");
      return;
    }
    const snippet = [
      "export const AVATAR_DECORATION_TRANSFORMS: Record<string, Partial<AvatarDecorationTransform>> = {",
      ...changedTransformEntries.map((entry) => formatTransformSnippet(entry.id, entry.current)),
      "};",
    ].join("\n");

    try {
      await copyTextToClipboard(snippet);
      toast.success(`Copied ${changedTransformEntries.length} transform override(s)`);
    } catch (error) {
      console.error("Failed to copy transform overrides:", error);
      toast.error("Could not copy transform overrides");
    }
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
              <DialogTitle className="text-lg font-medium">Avatar Decoration</DialogTitle>
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
                decorationTransformOverride={selectedDecoration ? draftTransforms[selectedDecoration] : undefined}
                active={isPreviewHovered}
              />
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground text-center">
              {selectedDecoration ? "Hover to preview animation" : "No decoration selected"}
            </p>
          </div>

          {isDev && selectedDecoration && selectedTransform && (
            <div className="space-y-4 p-4 sm:p-5 rounded-xl border border-border/30 bg-secondary/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-medium">Decoration Tuner (Dev)</h4>
                  <p className="text-xs text-muted-foreground">
                    Tune live and copy values into `src/lib/avatarDecorations.ts`.
                  </p>
                </div>
                <Button variant="outline" size="sm" className="rounded-lg" onClick={resetSelectedTransform}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Reset
                </Button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span>Scale</span>
                    <span className="font-mono">{selectedTransform.scale.toFixed(2)}</span>
                  </div>
                  <Slider
                    min={SCALE_MIN}
                    max={SCALE_MAX}
                    step={0.01}
                    value={[selectedTransform.scale]}
                    onValueChange={(value) =>
                      updateSelectedTransform({ scale: value[0] ?? selectedTransform.scale })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span>Offset X (%)</span>
                    <span className="font-mono">{selectedTransform.offsetXPercent.toFixed(2)}</span>
                  </div>
                  <Slider
                    min={OFFSET_MIN}
                    max={OFFSET_MAX}
                    step={0.25}
                    value={[selectedTransform.offsetXPercent]}
                    onValueChange={(value) =>
                      updateSelectedTransform({ offsetXPercent: value[0] ?? selectedTransform.offsetXPercent })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span>Offset Y (%)</span>
                    <span className="font-mono">{selectedTransform.offsetYPercent.toFixed(2)}</span>
                  </div>
                  <Slider
                    min={OFFSET_MIN}
                    max={OFFSET_MAX}
                    step={0.25}
                    value={[selectedTransform.offsetYPercent]}
                    onValueChange={(value) =>
                      updateSelectedTransform({ offsetYPercent: value[0] ?? selectedTransform.offsetYPercent })
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={handleCopySelectedTransform}
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copy Selected
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={handleCopyAllTransforms}
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copy All Overrides ({changedTransformEntries.length})
                </Button>
              </div>
            </div>
          )}

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
            {AVATAR_DECORATIONS.map((decoration) => {
              const previewTransform = draftTransforms[decoration.id] ?? decoration.transform;
              const baseTransform = baseTransformsById[decoration.id] ?? DEFAULT_AVATAR_DECORATION_TRANSFORM;
              const isTweaked = !areTransformsEqual(previewTransform, baseTransform);
              return (
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
                      style={{
                        imageRendering: "pixelated",
                        transform: `translate(${previewTransform.offsetXPercent}%, ${previewTransform.offsetYPercent}%) scale(${previewTransform.scale})`,
                        transformOrigin: "center center",
                      }}
                    />
                    {isDev && isTweaked && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <span className="text-[10px] sm:text-xs font-medium text-center leading-tight line-clamp-2">
                    {decoration.name}
                  </span>
                </button>
              );
            })}
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
