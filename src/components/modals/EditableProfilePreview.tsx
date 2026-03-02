import { useState, useRef, useEffect, useMemo } from "react";
import {
  Camera,
  Pencil,
  Sparkles,
  Trash2,
  Upload,
  X,
  Loader2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getProfileEffectSrc } from "@/lib/profileEffects";
import type { User } from "@/types";

const BIO_MAX_LENGTH = 400;

// Validates display name: only letters (any language), numbers, spaces, hyphens, underscores, periods
const isValidDisplayName = (name: string): boolean => {
  if (name === "") return true;
  const validPattern = /^[\p{L}\p{N}\s\-_.]+$/u;
  return validPattern.test(name);
};

interface EditableProfilePreviewProps {
  user: User | null;
  localAvatarUrl: string | null;
  localBannerUrl: string | null;
  displayName: string;
  bio: string;
  profileThemePrimary: string | null;
  profileThemeAccent: string | null;
  onAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAvatarRemove: () => void;
  onBannerUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBannerRemove: () => void;
  onDisplayNameChange: (name: string) => void;
  onBioChange: (bio: string) => void;
  onThemePrimaryChange: (color: string | null) => void;
  onThemeAccentChange: (color: string | null) => void;
  onOpenAvatarDecoration: () => void;
  onOpenProfileEffect: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  bannerInputRef: React.RefObject<HTMLInputElement>;
  isLoading: boolean;
  isBannerUploading: boolean;
}

export const EditableProfilePreview = ({
  user,
  localAvatarUrl,
  localBannerUrl,
  displayName,
  bio,
  profileThemePrimary,
  profileThemeAccent,
  onAvatarUpload,
  onAvatarRemove,
  onBannerUpload,
  onBannerRemove,
  onDisplayNameChange,
  onBioChange,
  onThemePrimaryChange,
  onThemeAccentChange,
  onOpenAvatarDecoration,
  onOpenProfileEffect,
  fileInputRef,
  bannerInputRef,
  isLoading,
  isBannerUploading,
}: EditableProfilePreviewProps) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  
  const nameInputRef = useRef<HTMLInputElement>(null);
  const bioInputRef = useRef<HTMLTextAreaElement>(null);

  // Focus inputs when edit mode is activated
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  useEffect(() => {
    if (isEditingBio && bioInputRef.current) {
      bioInputRef.current.focus();
    }
  }, [isEditingBio]);

  // Color utilities
  const withAlpha = (hex: string, alphaHex: string) => {
    if (!hex || !hex.startsWith("#") || hex.length !== 7) return hex;
    return `${hex}${alphaHex}`;
  };

  const hexToRgb = (hex: string) => {
    const h = hex.trim().toLowerCase();
    if (!h.startsWith("#") || h.length !== 7) return null;
    const r = parseInt(h.slice(1, 3), 16);
    const g = parseInt(h.slice(3, 5), 16);
    const b = parseInt(h.slice(5, 7), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b };
  };

  const relLuminance = (hex: string) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;
    const srgb = [rgb.r, rgb.g, rgb.b].map((v) => v / 255);
    const lin = srgb.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  };

  const isLightTheme = (primary?: string | null, accent?: string | null, fallback?: string | null) => {
    const lums: number[] = [];
    if (primary) {
      const l = relLuminance(primary);
      if (l !== null) lums.push(l);
    }
    if (accent) {
      const l = relLuminance(accent);
      if (l !== null) lums.push(l);
    }
    if (lums.length === 0 && fallback) {
      const l = relLuminance(fallback);
      if (l !== null) lums.push(l);
    }
    if (lums.length === 0) return false;
    const avg = lums.reduce((a, b) => a + b, 0) / lums.length;
    return avg > 0.62;
  };

  const formatMemberSince = (iso?: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    try {
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return d.toDateString();
    }
  };

  // Build preview user with local edits
  const previewUser = useMemo<User | null>(() => {
    if (!user) return null;
    return {
      ...user,
      avatar_url: localAvatarUrl,
      banner_url: localBannerUrl,
      display_name: (displayName.trim() || null) as User["display_name"],
      bio: (bio.trim() || null) as User["bio"],
      profile_theme_primary: profileThemePrimary,
      profile_theme_accent: profileThemeAccent,
    };
  }, [user, localAvatarUrl, localBannerUrl, displayName, bio, profileThemePrimary, profileThemeAccent]);

  const light = isLightTheme(
    previewUser?.profile_theme_primary,
    previewUser?.profile_theme_accent,
    previewUser?.banner_color
  );
  const fg = light ? "#0b0b0f" : "#f8fafc";
  const muted = light ? "rgba(11, 11, 15, 0.66)" : "rgba(248, 250, 252, 0.72)";
  const overlay = light ? "rgba(255, 255, 255, 0.46)" : "rgba(0, 0, 0, 0.34)";
  const divider = light ? "rgba(11, 11, 15, 0.18)" : "rgba(248, 250, 252, 0.18)";
  const bannerUrl = previewUser?.banner_url || localBannerUrl;

  const handleDisplayNameChange = (value: string) => {
    if (isValidDisplayName(value)) {
      setDisplayNameError(null);
      onDisplayNameChange(value);
    } else {
      setDisplayNameError("Only letters, numbers, spaces, and basic punctuation allowed");
    }
  };

  const handleBioChange = (value: string) => {
    // Enforce max length
    if (value.length <= BIO_MAX_LENGTH) {
      onBioChange(value);
    }
  };

  const profileEffectSrc = getProfileEffectSrc(previewUser?.profile_effect);

  if (!user || !previewUser) return null;

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarUpload} />
      <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={onBannerUpload} />

      {/* Profile Card */}
      <div
        className="relative rounded-2xl border border-border/50 overflow-hidden"
        style={{
          background:
            profileThemePrimary && profileThemeAccent
              ? `linear-gradient(180deg, ${profileThemePrimary} 0%, ${profileThemeAccent} 100%)`
              : previewUser
                ? `linear-gradient(180deg, ${withAlpha(previewUser.banner_color, "33")} 0%, ${withAlpha(
                    previewUser.banner_color,
                    "14"
                  )} 100%)`
                : undefined,
        }}
      >
        {/* Soft overlay */}
        <div className="absolute inset-0" style={{ backgroundColor: overlay }} />

        {/* Profile Effect */}
        {profileEffectSrc && (
          <img
            src={profileEffectSrc}
            alt=""
            className="absolute inset-0 w-full h-full object-cover pointer-events-none z-[5]"
          />
        )}

        {/* Banner Section */}
        <div className="relative h-28">
          {bannerUrl ? (
            <img src={bannerUrl} alt="Banner" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/30" />
          )}
          
          {/* Always visible banner controls */}
          <div className="absolute inset-0 flex items-center justify-center">
            {isBannerUploading ? (
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="rounded-lg bg-black/60 hover:bg-black/80 text-white border-none"
                onClick={() => bannerInputRef.current?.click()}
              >
                <Camera className="w-4 h-4 mr-1.5" />
                {bannerUrl ? "Change Banner" : "Upload Banner"}
              </Button>
            )}
          </div>
          
          {/* Remove banner button - top right */}
          {bannerUrl && !isBannerUploading && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7 rounded-lg bg-black/60 hover:bg-destructive/80 text-white border-none"
              onClick={onBannerRemove}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Content Section */}
        <div className="relative px-5 pb-5 z-10" style={{ "--profile-fg": fg, "--profile-muted": muted } as React.CSSProperties}>
          {/* Avatar Section */}
          <div className="relative -mt-12 mb-3 flex items-end gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative cursor-pointer focus:outline-none">
                  <AvatarWithDecoration
                    user={previewUser}
                    className="w-20 h-20"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Avatar
                </DropdownMenuItem>
                {localAvatarUrl && (
                  <DropdownMenuItem onClick={onAvatarRemove} className="text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove Avatar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Decoration button - always visible with text */}
            <Button
              variant="secondary"
              size="sm"
              className="rounded-lg bg-background/60 hover:bg-background/80 h-8 px-3"
              onClick={onOpenAvatarDecoration}
            >
              {user.avatar_decoration ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Change Decoration
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Add Decoration
                </>
              )}
            </Button>
          </div>

          {/* Display Name - Inline Editable */}
          <div className="mb-1">
            {isEditingName ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Input
                    ref={nameInputRef}
                    value={displayName}
                    onChange={(e) => handleDisplayNameChange(e.target.value)}
                    onBlur={() => setIsEditingName(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape") {
                        setIsEditingName(false);
                      }
                    }}
                    placeholder="Display Name"
                    maxLength={32}
                    className="h-9 text-lg font-medium bg-background/80 rounded-lg"
                    style={{ color: fg }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => setIsEditingName(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                {displayNameError && (
                  <p className="text-xs text-destructive">{displayNameError}</p>
                )}
              </div>
            ) : (
              <button
                onClick={() => setIsEditingName(true)}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left"
              >
                <span className="text-lg font-medium" style={{ color: fg }}>
                  {displayName.trim() || user.display_name || user.username}
                </span>
                <Pencil className="w-3.5 h-3.5" style={{ color: muted }} />
              </button>
            )}
          </div>

          {/* Username */}
          <div className="text-sm mb-4" style={{ color: muted }}>
            @{user.username}
          </div>

          {/* Bio - Inline Editable */}
          <div className="mb-4">
            {isEditingBio ? (
              <div className="relative">
                <Textarea
                  ref={bioInputRef}
                  value={bio}
                  onChange={(e) => handleBioChange(e.target.value)}
                  onBlur={() => setIsEditingBio(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setIsEditingBio(false);
                    }
                  }}
                  placeholder="Tell us about yourself"
                  maxLength={BIO_MAX_LENGTH}
                  rows={3}
                  className="bg-background/80 rounded-lg resize-none pb-6 text-sm"
                  style={{ color: fg }}
                />
                <span
                  className={cn(
                    "absolute bottom-2 right-3 text-xs",
                    bio.length >= BIO_MAX_LENGTH
                      ? "text-destructive"
                      : bio.length >= 350
                        ? "text-amber-500"
                        : "text-muted-foreground"
                  )}
                >
                  {bio.length}/{BIO_MAX_LENGTH}
                </span>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingBio(true)}
                className="flex items-start gap-2 hover:opacity-80 transition-opacity text-left w-full"
              >
                <span className="text-sm leading-relaxed flex-1" style={{ color: muted }}>
                  {bio.trim() || user.bio || "Click to add a bio..."}
                </span>
                <Pencil className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: muted }} />
              </button>
            )}
          </div>

          {/* Customization Row */}
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="secondary"
              size="sm"
              className="rounded-lg bg-background/60 hover:bg-background/80"
              onClick={onOpenProfileEffect}
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              {user.profile_effect ? "Change Effect" : "Add Effect"}
            </Button>
          </div>

          {/* Theme Pickers - Always visible */}
          <div className="mb-4 p-3 rounded-xl bg-background/60 border border-border/30 space-y-3">
            {/* Theme header with buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full border border-border/50"
                  style={{
                    background: profileThemePrimary && profileThemeAccent
                      ? `linear-gradient(135deg, ${profileThemePrimary}, ${profileThemeAccent})`
                      : "hsl(var(--muted))",
                  }}
                />
                <span className="text-sm font-medium" style={{ color: fg }}>Profile Theme</span>
              </div>
              {(profileThemePrimary || profileThemeAccent) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-lg h-7 px-2 text-xs"
                  onClick={() => {
                    onThemePrimaryChange(null);
                    onThemeAccentChange(null);
                  }}
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Reset
                </Button>
              )}
            </div>
            
            {/* Color pickers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: muted }}>Primary</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={(profileThemePrimary ?? "#ff0000").toLowerCase()}
                    onChange={(e) => onThemePrimaryChange(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-border/50"
                  />
                  <Input
                    value={(profileThemePrimary ?? "").toLowerCase()}
                    onChange={(e) => onThemePrimaryChange(e.target.value)}
                    placeholder="#ff0000"
                    className="font-mono text-xs h-10 rounded-lg bg-background/50"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: muted }}>Accent</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={(profileThemeAccent ?? "#00d4ff").toLowerCase()}
                    onChange={(e) => onThemeAccentChange(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-border/50"
                  />
                  <Input
                    value={(profileThemeAccent ?? "").toLowerCase()}
                    onChange={(e) => onThemeAccentChange(e.target.value)}
                    placeholder="#00d4ff"
                    className="font-mono text-xs h-10 rounded-lg bg-background/50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px mb-4" style={{ backgroundColor: divider }} />

          {/* Info Section */}
          <div className="space-y-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: muted }}>
                Member Since
              </div>
              <div className="text-sm font-medium" style={{ color: fg }}>
                {formatMemberSince(user.created_at)}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: muted }}>
                Mutual Servers
              </div>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium"
                    style={{ backgroundColor: divider, color: muted }}
                  >
                    {i}
                  </div>
                ))}
                <div className="text-xs" style={{ color: muted }}>
                  + more
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
