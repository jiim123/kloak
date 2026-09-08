import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Check, Eraser, Dices, Pencil, Sparkles, X } from "lucide-react";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { StyledName } from "@/components/ui/styled-name";
import {
  AVAILABLE_NAME_EFFECTS,
  AVAILABLE_NAME_FONTS,
  DEFAULT_EFFECT_COLOR,
  NAME_COLOR_PRESETS,
  getNameFontCss,
  randomNameStyle,
  sanitizeNameStyle,
} from "@/lib/nameStyle";
import type { UserNameStyle, User as UserType } from "@/types";

interface NameStyleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (style: UserNameStyle | null) => void;
}

const DUMMY_STATUS = "Playing Kloak";

export const NameStyleModal = ({ open, onOpenChange, onSelect }: NameStyleModalProps) => {
  const { user, updateUser } = useAuthStore();
  const [draft, setDraft] = useState<UserNameStyle | null>(null);
  const [customColor, setCustomColor] = useState<string>(DEFAULT_EFFECT_COLOR);
  const [isSaving, setIsSaving] = useState(false);

  // Sync draft state when modal opens
  useEffect(() => {
    if (open && user) {
      setDraft(sanitizeNameStyle(user.name_style));
    }
  }, [open, user]);

  const savedStyle = useMemo(() => sanitizeNameStyle(user?.name_style), [user?.name_style]);
  const hasChanges = JSON.stringify(draft ?? null) !== JSON.stringify(savedStyle);

  const previewUser: UserType | null = user
    ? ({ ...user, name_style: draft } as UserType)
    : null;

  const selectedFont = draft?.font ?? "default";
  const selectedEffect = draft?.effect ?? "solid";
  const selectedColor = draft?.color ?? null;

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateUser({ name_style: draft } as unknown as Partial<UserType>);
      onSelect(draft);
      toast.success(draft ? "Display name style updated!" : "Display name style removed!");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save name style:", error);
      toast.error("Failed to save name style");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSurpriseMe = () => {
    setDraft(randomNameStyle());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-hidden bg-background/95 backdrop-blur-xl border-border/50 rounded-2xl p-0 flex flex-col">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-6 pb-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <DialogTitle className="text-lg font-medium">Change Display Name Style</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Customize how your name looks everywhere in Kloak
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5">
            {/* Left: pickers */}
            <div className="space-y-5 min-w-0">
              {/* Choose Font */}
              <section>
                <p className="text-sm font-semibold mb-2">Choose Font</p>
                <div className="grid grid-cols-4 gap-2">
                  {AVAILABLE_NAME_FONTS.map((font) => {
                    const isSelected = selectedFont === font.id;
                    return (
                      <button
                        key={font.id}
                        type="button"
                        title={font.label}
                        className={cn(
                          "h-12 sm:h-14 rounded-lg border-2 flex items-center justify-center text-xl transition-all duration-150",
                          isSelected
                            ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                            : "border-border/60 hover:border-primary/50 bg-secondary/40",
                        )}
                        onClick={() =>
                          setDraft((prev) => {
                            const base = prev ?? {};
                            if (font.id === "default" || selectedFont === font.id) {
                              const { font: _f, ...rest } = base;
                              return Object.keys(rest).length > 0 ? (rest as UserNameStyle) : null;
                            }
                            return { ...base, font: font.id };
                          })
                        }
                      >
                        <span
                          className="truncate px-1"
                          style={{
                            color: selectedColor ?? undefined,
                            ...getNameFontCss(font.id === "default" ? null : font.id),
                          }}
                        >
                          Gg
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Choose Effect */}
              <section>
                <p className="text-sm font-semibold mb-2">Choose Effect</p>
                <div className="grid grid-cols-4 gap-2">
                  {AVAILABLE_NAME_EFFECTS.map((effect) => {
                    const isSelected = selectedEffect === effect.id;
                    return (
                      <button
                        key={effect.id}
                        type="button"
                        title={effect.label}
                        className={cn(
                          "h-12 sm:h-14 rounded-lg border-2 flex items-center justify-center transition-all duration-150",
                          isSelected
                            ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                            : "border-border/60 hover:border-primary/50 bg-secondary/40",
                        )}
                        onClick={() =>
                          setDraft((prev) => {
                            const base = prev ?? {};
                            if (effect.id === "solid" || selectedEffect === effect.id) {
                              const { effect: _e, ...rest } = base;
                              return Object.keys(rest).length > 0 ? (rest as UserNameStyle) : null;
                            }
                            return { ...base, effect: effect.id };
                          })
                        }
                      >
                        <StyledName
                          name={effect.label}
                          className="text-sm font-semibold truncate px-1"
                          allowColor
                          user={{
                            display_name: effect.label,
                            name_style: {
                              effect: effect.id,
                              color: selectedColor ?? undefined,
                            },
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Choose Color */}
              <section>
                <p className="text-sm font-semibold mb-2">Choose Color</p>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Clear color */}
                  <button
                    type="button"
                    title="No color (use role color / default)"
                    className={cn(
                      "w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all duration-150",
                      selectedColor === null
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border/60 hover:border-primary/50",
                    )}
                    onClick={() =>
                      setDraft((prev) => {
                        const base = prev ?? {};
                        const { color: _c, ...rest } = base;
                        return Object.keys(rest).length > 0 ? (rest as UserNameStyle) : null;
                      })
                    }
                  >
                    <Eraser className="w-4 h-4 text-muted-foreground" />
                  </button>

                  {NAME_COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      title={color}
                      className={cn(
                        "w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all duration-150",
                        selectedColor === color
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-transparent hover:border-primary/50",
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setDraft((prev) => ({ ...(prev ?? {}), color } as UserNameStyle))}
                    >
                      {selectedColor === color && (
                        <Check className="w-4 h-4 text-white drop-shadow" />
                      )}
                    </button>
                  ))}

                  {/* Custom color */}
                  <label
                    className={cn(
                      "w-10 h-10 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all duration-150 relative",
                      selectedColor !== null && !NAME_COLOR_PRESETS.includes(selectedColor)
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border/60 hover:border-primary/50",
                    )}
                    style={{ backgroundColor: customColor }}
                    title="Custom color"
                  >
                    <Pencil className="w-4 h-4 text-white drop-shadow" />
                    <input
                      type="color"
                      value={customColor}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase();
                        setCustomColor(value);
                        setDraft((prev) => ({ ...(prev ?? {}), color: value } as UserNameStyle));
                      }}
                    />
                  </label>
                </div>
              </section>
            </div>

            {/* Right: preview */}
            <div className="flex flex-col gap-3 min-w-0">
              <div className="rounded-xl border border-border/40 overflow-hidden bg-secondary/30">
                {/* Mini profile card */}
                <div className="h-16 relative" style={{ backgroundColor: user?.banner_color || "#5865F2" }} />
                <div className="px-3 pb-3 -mt-6">
                  <div className="w-12 h-12 rounded-full border-4 border-background bg-background/60">
                    <AvatarWithDecoration
                      user={previewUser}
                      className="w-full h-full rounded-full"
                    />
                  </div>
                  <div className="mt-1.5 min-w-0">
                    <StyledName
                      user={previewUser}
                      name={user?.display_name || user?.username || "Username"}
                      className="text-lg font-bold leading-tight truncate block"
                      fallback="Username"
                    />
                    <p className="text-xs text-muted-foreground truncate">@{user?.username ?? "username"}</p>
                    <p className="text-[11px] text-muted-foreground/80 truncate mt-0.5">
                      {user?.custom_status || DUMMY_STATUS}
                    </p>
                  </div>
                </div>
              </div>

              {/* Mini chat message */}
              <div className="rounded-xl border border-border/40 bg-secondary/30 p-3 flex items-start gap-2.5">
                <AvatarWithDecoration
                  user={previewUser}
                  className="w-9 h-9 rounded-full flex-shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <StyledName
                      user={previewUser}
                      name={user?.display_name || user?.username || "Username"}
                      className="text-sm font-semibold truncate"
                      fallback="Username"
                    />
                    <span className="text-[10px] text-muted-foreground/70">6:55 PM</span>
                  </div>
                  <p className="text-sm text-foreground/90 truncate">does anyone read this?</p>
                </div>
              </div>

              {/* Mini sidebar item */}
              <div className="rounded-xl border border-border/40 bg-secondary/30 px-3 py-2 flex items-center gap-2">
                <AvatarWithDecoration
                  user={previewUser}
                  className="w-6 h-6 rounded-full flex-shrink-0"
                />
                <StyledName
                  user={previewUser}
                  name={user?.display_name || user?.username || "Username"}
                  className="text-sm font-medium truncate"
                  fallback="Username"
                />
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Your style shows everywhere your name appears — chats, member lists, DMs and your
                profile. In servers with role colors, your name color gives way to the role color.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 pt-3 border-t border-border/30 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => setDraft(null)}
            disabled={!draft}
            className="rounded-xl"
          >
            <X className="w-4 h-4 mr-1.5" />
            Reset
          </Button>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleSurpriseMe} className="rounded-xl">
              <Dices className="w-4 h-4 mr-1.5" />
              Surprise Me
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="rounded-xl bg-primary hover:bg-primary/90"
            >
              {isSaving ? "Saving..." : "Apply"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
