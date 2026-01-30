import { useEffect, useState, useRef, useMemo } from "react";
import {
  Loader2,
  Upload,
  User,
  UserX,
  Palette,
  Key,
  LogOut,
  Trash2,
  Eye,
  EyeOff,
  Check,
  Copy,
  Link,
  Bell,
  MessageSquare,
  Clock,
  Sparkles,
  Volume2,
  Sparkles as DecorationIcon,
  X,
  ArrowLeft,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { AvatarDecorationModal } from "@/components/modals/AvatarDecorationModal";
import { ProfileEffectModal } from "@/components/modals/ProfileEffectModal";
import { useUIStore, THEMES, type Theme } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import { useFriendStore } from "@/stores/friendStore";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { isTauri } from "@/lib/tauriRuntime";
import type { User as UserType } from "@/types";

// Theme preview colors for the selector
const THEME_PREVIEWS: Record<Theme, { bg: string; sidebar: string; accent: string }> = {
  default: { bg: "#0a0a0a", sidebar: "#171717", accent: "#f97316" },
  nostalgia: { bg: "#452829", sidebar: "#2e1a1b", accent: "#E8D1C5" },
  lofi: { bg: "#293462", sidebar: "#161c35", accent: "#FE5F55" },
  cappuccino: { bg: "#493628", sidebar: "#2c2018", accent: "#AB886D" },
  hokori: { bg: "#000000", sidebar: "#050505", accent: "#E43636" },
};

type UserSettingsVariant = "modal" | "page";

const UserSettings = ({ variant }: { variant: UserSettingsVariant }) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isTauriApp = isTauri();
  const {
    activeModal,
    closeModal,
    theme,
    setTheme,
    linkPreviewsEnabled,
    setLinkPreviewsEnabled,
    desktopNotificationsEnabled,
    setDesktopNotificationsEnabled,
    notificationSoundEnabled,
    setNotificationSoundEnabled,
    showMessagePreview,
    setShowMessagePreview,
    compactMode,
    setCompactMode,
    showTimestamps,
    setShowTimestamps,
    animateEmojis,
    setAnimateEmojis,
  } = useUIStore();
  const { user, secretKey, updateUser, logout } = useAuthStore();
  const { blockedUsers, unblockUser, fetchFriends, isLoading: isFriendsLoading } = useFriendStore();

  const [activeTab, setActiveTab] = useState("account");
  const [isLoading, setIsLoading] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showKeyConfirm, setShowKeyConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeletePreview, setShowDeletePreview] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [deletionPreview, setDeletionPreview] = useState<{
    message_count: number;
    dm_count: number;
    reaction_count: number;
    friendship_count: number;
    servers_to_transfer: Array<{
      id: string;
      name: string;
      member_count: number;
      new_owner: { id: string; username: string } | null;
    }>;
    servers_to_delete: Array<{ id: string; name: string }>;
  } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAvatarDecorationModal, setShowAvatarDecorationModal] = useState(false);
  const [showProfileEffectModal, setShowProfileEffectModal] = useState(false);
  const [isBannerUploading, setIsBannerUploading] = useState(false);

  // Profile form state
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [profileThemePrimary, setProfileThemePrimary] = useState<string | null>(user?.profile_theme_primary ?? null);
  const [profileThemeAccent, setProfileThemeAccent] = useState<string | null>(user?.profile_theme_accent ?? null);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(user?.avatar_url ?? null);
  const [localBannerUrl, setLocalBannerUrl] = useState<string | null>(user?.banner_url ?? null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Keep local preview URLs in sync with store updates
  useEffect(() => {
    setLocalAvatarUrl(user?.avatar_url ?? null);
  }, [user?.avatar_url]);

  useEffect(() => {
    setLocalBannerUrl(user?.banner_url ?? null);
  }, [user?.banner_url]);

  const navItems = [
    { id: "account", label: "Account", icon: Key },
    { id: "profile", label: "Profile", icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "blocked", label: "Blocked", icon: UserX },
  ];

  const isOpen = activeModal === "user-settings";

  useEffect(() => {
    if (!user?.id) return;
    if (variant === "modal" && !isOpen) return;
    fetchFriends(user.id);
  }, [fetchFriends, isOpen, user?.id, variant]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      await updateUser({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        profile_theme_primary: profileThemePrimary,
        profile_theme_accent: profileThemeAccent,
      });
      toast.success("Profile updated!");
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setIsLoading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      // Update preview immediately
      setLocalAvatarUrl(publicUrl);
      await updateUser({ avatar_url: publicUrl });
      toast.success("Avatar updated!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload avatar");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Slightly larger than avatar (banners can be bigger)
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be less than 8MB");
      return;
    }

    setIsBannerUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/banner.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      // Update preview immediately
      setLocalBannerUrl(publicUrl);
      await updateUser({ banner_url: publicUrl });
      toast.success("Banner updated!");
    } catch (error) {
      console.error("Banner upload error:", error);
      toast.error("Failed to upload banner");
    } finally {
      setIsBannerUploading(false);
      // Allow re-selecting the same file
      if (bannerInputRef.current) bannerInputRef.current.value = "";
    }
  };

  const handleRemoveBanner = async () => {
    if (!user) return;
    setIsBannerUploading(true);
    try {
      // Update preview immediately
      setLocalBannerUrl(null);
      await updateUser({ banner_url: null });
      toast.success("Banner removed!");
    } catch (error) {
      console.error("Failed to remove banner:", error);
      toast.error("Failed to remove banner");
    } finally {
      setIsBannerUploading(false);
    }
  };

  const handleCopyKey = async () => {
    if (!secretKey) return;
    try {
      await navigator.clipboard.writeText(secretKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Secret key copied!");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleLogout = () => {
    logout();
    closeModal();
    navigate("/auth?mode=login");
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    handleLogout();
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.rpc("delete_user_account", {
        _user_id: user.id,
      });
      if (error) throw error;
      logout();
      closeModal();
      navigate("/auth?mode=signup");
      toast.success("Account deleted");
    } catch (error) {
      console.error("Failed to delete account:", error);
      toast.error("Failed to delete account");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setActiveTab("account");
    setShowSecretKey(false);
    setKeyRevealed(false);
    closeModal();
  };

  const handleDeletePreview = async () => {
    if (!user) return;
    setIsLoadingPreview(true);
    setShowDeletePreview(true);
    try {
      const { data, error } = await supabase.rpc("get_deletion_preview", { _user_id: user.id });
      if (error) throw error;
      setDeletionPreview(data as typeof deletionPreview);
    } catch (error) {
      console.error("Failed to fetch deletion preview:", error);
      toast.error("Failed to load deletion preview");
      setShowDeletePreview(false);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Settings Toggle Component - defined as a stable component
  const SettingsToggle = ({
    icon: Icon,
    label,
    description,
    checked,
    onCheckedChange,
    disabled = false,
  }: {
    icon: React.ElementType;
    label: string;
    description: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
  }) => (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-start gap-4 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-secondary/80 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="space-y-1 min-w-0">
          <Label className="text-sm font-medium">{label}</Label>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} className="flex-shrink-0 ml-4" />
    </div>
  );

  const blockedContent = (
    <div className="space-y-6">
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Blocked Users</Label>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          You won&apos;t see each other&apos;s messages, presence, or server entries while blocked.
        </p>
      </div>

      {isFriendsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : blockedUsers.length === 0 ? (
        <div className="p-6 rounded-xl bg-secondary/30 border border-border/50">
          <div className="text-sm font-medium">No blocked users</div>
          <div className="text-xs text-muted-foreground mt-1">When you block someone, they will show up here.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {blockedUsers.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between gap-3 p-4 bg-secondary/50 rounded-xl border border-border/50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <AvatarWithDecoration user={u as unknown as UserType} className="w-10 h-10 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{u.display_name || u.username}</div>
                  <div className="text-xs text-muted-foreground truncate">@{u.username}</div>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="rounded-xl"
                onClick={async () => {
                  if (!user?.id) return;
                  await unblockUser(user.id, u.id);
                  toast.success(`Unblocked @${u.username}`);
                }}
              >
                Unblock
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case "account":
        return accountContent;
      case "profile":
        return profileContent;
      case "notifications":
        return notificationsContent;
      case "appearance":
        return appearanceContent;
      case "blocked":
        return blockedContent;
      default:
        return null;
    }
  };

  // Account Content
  const accountContent = (
    <div className="space-y-6">
      {/* Username Display */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Username</Label>
        <div className="flex items-center gap-3 p-4 bg-secondary/50 rounded-xl border border-border/50">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <span className="font-medium">{user?.username}</span>
            <p className="text-xs text-muted-foreground mt-0.5">Cannot be changed</p>
          </div>
        </div>
      </div>

      {/* Secret Key Section */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Secret Key</Label>

        {!keyRevealed ? (
          <Button variant="secondary" onClick={() => setShowKeyConfirm(true)} className="w-full h-12 rounded-xl">
            <Eye className="w-4 h-4 mr-2" />
            View Secret Key
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                type={showSecretKey ? "text" : "password"}
                value={secretKey || ""}
                readOnly
                className="font-mono text-xs h-12 rounded-xl bg-secondary/50"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSecretKey(!showSecretKey)}
                className="h-12 w-12 rounded-xl flex-shrink-0"
              >
                {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyKey}
                className="h-12 w-12 rounded-xl flex-shrink-0"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-destructive flex items-center gap-2">
              <Key className="w-3 h-3" />
              Keep this key safe! It's the only way to access your account.
            </p>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="pt-6 mt-6 border-t border-destructive/20">
        <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-destructive">Danger Zone</h4>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Actions here are irreversible. Please make sure you have saved your secret key before logging out.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="secondary" onClick={handleLogoutClick} className="flex-1 h-11 rounded-xl">
              <LogOut className="w-4 h-4 mr-2" />
              Log Out
            </Button>
            <Button variant="error" onClick={handleDeletePreview} className="flex-1 h-11 rounded-xl">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Account
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // Profile Content
  const profileContent = (() => {
    const withAlpha = (hex: string, alphaHex: string) => {
      // Supports "#RRGGBB" -> "#RRGGBBAA"
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

    const previewUser = useMemo<UserType | null>(() => {
      if (!user) return null;
      return {
        ...user,
        avatar_url: localAvatarUrl,
        banner_url: localBannerUrl,
        display_name: (displayName.trim() || null) as UserType["display_name"],
        bio: (bio.trim() || null) as UserType["bio"],
        profile_theme_primary: profileThemePrimary,
        profile_theme_accent: profileThemeAccent,
      };
    }, [user, localAvatarUrl, localBannerUrl, displayName, bio, profileThemePrimary, profileThemeAccent]);

    const editor = (
      <div className="space-y-6">
        {/* Avatar Upload */}
        <div className="flex items-center gap-5">
          <div className="cursor-pointer flex-shrink-0 group relative" onClick={() => fileInputRef.current?.click()}>
            <AvatarWithDecoration
              user={previewUser ?? user}
              className="w-20 h-20 ring-4 ring-secondary/50 group-hover:ring-primary/30 transition-all"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              <Upload className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="h-10 rounded-xl"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Avatar
            </Button>
            <p className="text-xs text-muted-foreground">Max 5MB, JPG or PNG</p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </div>

        {/* Profile Banner */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Profile Banner</Label>
          <div className="relative h-24 w-full max-w-md rounded-xl overflow-hidden border border-border/50 bg-secondary/30">
            {localBannerUrl ? (
              <>
                <img
                  src={localBannerUrl}
                  alt="Profile banner"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/40" />
              </>
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  background:
                    previewUser?.profile_theme_primary && previewUser?.profile_theme_accent
                      ? `linear-gradient(180deg, ${previewUser.profile_theme_primary} 0%, ${previewUser.profile_theme_accent} 100%)`
                      : previewUser
                        ? `linear-gradient(180deg, ${withAlpha(previewUser.banner_color, "33")} 0%, ${withAlpha(
                            previewUser.banner_color,
                            "14",
                          )} 100%)`
                        : undefined,
                }}
              />
            )}
            {!localBannerUrl && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs text-muted-foreground">No banner uploaded</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => bannerInputRef.current?.click()}
              disabled={isBannerUploading}
              className="h-10 rounded-xl"
            >
              <Upload className="w-4 h-4 mr-2" />
              Change Banner
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleRemoveBanner}
              disabled={isBannerUploading || !localBannerUrl}
              className="h-10 rounded-xl"
            >
              Remove Banner
            </Button>
            <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
          </div>
          <p className="text-xs text-muted-foreground">Recommended wide image • Max 8MB</p>
        </div>

        {/* Display Name */}
        <div className="space-y-3">
          <Label htmlFor="displayName" className="text-sm font-medium">
            Display Name
          </Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How others see you"
            maxLength={32}
            className="h-12 rounded-xl"
          />
        </div>

        {/* Bio */}
        <div className="space-y-3">
          <Label htmlFor="bio" className="text-sm font-medium">
            Bio
          </Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about yourself"
            rows={3}
            className="rounded-xl resize-none"
          />
        </div>

        {/* Avatar Decoration */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Avatar Decoration</Label>
          <Button
            variant="outline"
            onClick={() => setShowAvatarDecorationModal(true)}
            className="w-full h-12 rounded-xl"
          >
            <DecorationIcon className="w-4 h-4 mr-2" />
            {user?.avatar_decoration ? "Change Decoration" : "Add Decoration"}
          </Button>
        </div>

        {/* Profile Effect */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Profile Effect</Label>
          <Button variant="outline" onClick={() => setShowProfileEffectModal(true)} className="w-full h-12 rounded-xl">
            <Sparkles className="w-4 h-4 mr-2" />
            {user?.profile_effect ? "Change Effect" : "Add Effect"}
          </Button>
        </div>

        {/* Profile Theme */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label className="text-sm font-medium">Profile Theme</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Pick a primary and accent color for your profile gradient.
              </p>
            </div>
            {(profileThemePrimary ||
              profileThemeAccent ||
              user?.profile_theme_primary ||
              user?.profile_theme_accent) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setProfileThemePrimary(null);
                  setProfileThemeAccent(null);
                }}
              >
                Clear
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Primary</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={(profileThemePrimary ?? "#ff0000").toLowerCase()}
                  onChange={(e) => setProfileThemePrimary(e.target.value)}
                  className="w-12 h-12 rounded-xl cursor-pointer border-2 border-border flex-shrink-0"
                />
                <Input
                  value={(profileThemePrimary ?? "#ff0000").toLowerCase()}
                  onChange={(e) => setProfileThemePrimary(e.target.value)}
                  placeholder="#ff0000"
                  className="font-mono text-sm h-12 rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Accent</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={(profileThemeAccent ?? "#00d4ff").toLowerCase()}
                  onChange={(e) => setProfileThemeAccent(e.target.value)}
                  className="w-12 h-12 rounded-xl cursor-pointer border-2 border-border flex-shrink-0"
                />
                <Input
                  value={(profileThemeAccent ?? "#00d4ff").toLowerCase()}
                  onChange={(e) => setProfileThemeAccent(e.target.value)}
                  placeholder="#00d4ff"
                  className="font-mono text-sm h-12 rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>

        <Button variant="primary" onClick={handleSaveProfile} disabled={isLoading} className="w-full h-12 rounded-xl">
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Profile
        </Button>
      </div>
    );

    const preview = (
      <div className="hidden md:block">
        {(() => {
          const light = isLightTheme(
            previewUser?.profile_theme_primary,
            previewUser?.profile_theme_accent,
            previewUser?.banner_color,
          );
          const fg = light ? "#0b0b0f" : "#f8fafc";
          const muted = light ? "rgba(11, 11, 15, 0.66)" : "rgba(248, 250, 252, 0.72)";
          const overlay = light ? "rgba(255, 255, 255, 0.46)" : "rgba(0, 0, 0, 0.34)";
          const divider = light ? "rgba(11, 11, 15, 0.18)" : "rgba(248, 250, 252, 0.18)";
          const bannerUrl = previewUser?.banner_url || user?.banner_url;

          return (
            <div
              className="relative rounded-2xl border border-border/50 overflow-hidden"
              style={{
                background:
                  previewUser?.profile_theme_primary && previewUser?.profile_theme_accent
                    ? `linear-gradient(180deg, ${previewUser.profile_theme_primary} 0%, ${previewUser.profile_theme_accent} 100%)`
                    : previewUser
                      ? `linear-gradient(180deg, ${withAlpha(previewUser.banner_color, "33")} 0%, ${withAlpha(
                          previewUser.banner_color,
                          "14",
                        )} 100%)`
                      : undefined,
              }}
            >
              {/* Soft overlay to keep text readable while still showing the theme */}
              <div className="absolute inset-0" style={{ backgroundColor: overlay }} />

              <div
                className="relative p-5"
                style={
                  {
                    color: fg,
                    ["--profile-muted" as any]: muted,
                  } as React.CSSProperties
                }
              >
                {/* Banner image */}
                {bannerUrl && (
                  <div className="-mx-5 -mt-5 mb-4 h-24 relative overflow-hidden">
                    <img src={bannerUrl} alt="Profile banner" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/35" />
                  </div>
                )}

                <div className="mb-3">
                  <div className={cn("inline-block", bannerUrl && "-mt-10")}>
                    <AvatarWithDecoration user={previewUser ?? user} className="w-16 h-16 shadow-lg" active={true} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-base font-semibold leading-tight">
                    {(previewUser?.display_name || previewUser?.username || user?.display_name || user?.username) ??
                      "—"}
                  </div>
                  <div className="text-xs font-medium text-[color:var(--profile-muted)]">
                    {previewUser?.username || user?.username ? `@${previewUser?.username || user?.username}` : "—"}
                  </div>
                </div>

                {(previewUser?.bio || user?.bio) && (
                  <div className="mt-4 text-sm opacity-90 whitespace-pre-wrap break-words">
                    {previewUser?.bio || user?.bio}
                  </div>
                )}

                {/* Divider */}
                <div className="mt-5 h-px" style={{ backgroundColor: divider }} />

                {/* Info rows (placeholders to feel like full profile) */}
                <div className="mt-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="text-[10px] font-medium text-[color:var(--profile-muted)] uppercase tracking-wider min-w-[92px] pt-0.5">
                      Member Since
                    </div>
                    <div className="text-sm text-foreground">
                      {formatMemberSince(previewUser?.created_at || user?.created_at)}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="text-[10px] font-medium text-[color:var(--profile-muted)] uppercase tracking-wider min-w-[92px] pt-0.5">
                      Servers
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      {["KL", "GK", "S3"].map((label) => (
                        <div
                          key={label}
                          className="w-8 h-8 rounded-lg bg-secondary/60 border border-border/40 flex items-center justify-center text-[10px] font-semibold text-foreground/90"
                          title="Server"
                        >
                          {label}
                        </div>
                      ))}
                      <div className="text-xs text-[color:var(--profile-muted)]">+ more</div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 text-xs text-[color:var(--profile-muted)]">Live preview</div>
              </div>
            </div>
          );
        })()}
      </div>
    );

    return (
      <div className="md:grid md:grid-cols-[7fr_3fr] md:gap-6">
        <div className="min-w-0">{editor}</div>
        <div className="min-w-0 md:sticky md:top-6 self-start">{preview}</div>
      </div>
    );
  })();

  // Notifications Content
  const notificationsContent = (
    <div className="space-y-2">
      <SettingsToggle
        icon={Bell}
        label="Desktop Notifications"
        description={
          !isTauriApp && typeof Notification !== "undefined" && Notification.permission === "denied"
            ? "Blocked in browser settings"
            : typeof Notification === "undefined" && !isTauriApp
              ? "Not supported on this device"
              : "Show desktop alerts for new messages"
        }
        checked={desktopNotificationsEnabled}
        disabled={!isTauriApp && (typeof Notification === "undefined" || Notification.permission === "denied")}
        onCheckedChange={async (checked) => {
          if (!checked) return setDesktopNotificationsEnabled(false);

          if (isTauriApp) {
            try {
              const { isPermissionGranted, requestPermission } = await import("@tauri-apps/plugin-notification");
              let granted = await isPermissionGranted();
              if (!granted) {
                const permission = await requestPermission();
                granted = permission === "granted";
              }
              if (granted) {
                setDesktopNotificationsEnabled(true);
                toast.success("Desktop notifications enabled!");
              } else {
                setDesktopNotificationsEnabled(false);
                toast.error("Notification permission denied. Enable in system settings.");
              }
            } catch {
              setDesktopNotificationsEnabled(false);
              toast.error("Unable to enable notifications on desktop.");
            }
            return;
          }

          // Check if Notification API is available (not on iOS Safari, etc.)
          if (typeof Notification === "undefined") {
            toast.error("Desktop notifications are not supported on this device.");
            return;
          }

          if (Notification.permission === "default") {
            try {
              const permission = await Notification.requestPermission();
              if (permission === "granted") {
                setDesktopNotificationsEnabled(true);
                toast.success("Desktop notifications enabled!");
              } else if (permission === "denied") {
                toast.error("Notification permission denied. Enable in browser settings.");
              }
            } catch {
              toast.error("Unable to request notification permission.");
            }
            return;
          }
          setDesktopNotificationsEnabled(true);
        }}
      />

      {isTauriApp && (
        <div className="flex justify-end pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const { isPermissionGranted, requestPermission, sendNotification } =
                  await import("@tauri-apps/plugin-notification");
                let granted = await isPermissionGranted();
                if (!granted) {
                  const permission = await requestPermission();
                  granted = permission === "granted";
                }
                if (!granted) {
                  toast.error("Notification permission denied. Enable in system settings.");
                  return;
                }
                sendNotification({
                  title: "Kloak",
                  body: "Test notification from the desktop app.",
                });
              } catch {
                toast.error("Failed to send a desktop notification.");
              }
            }}
          >
            Send test notification
          </Button>
        </div>
      )}

      <div className="border-t border-border/50" />

      <SettingsToggle
        icon={Volume2}
        label="Notification Sound"
        description="Play a sound when you receive notifications"
        checked={notificationSoundEnabled}
        onCheckedChange={setNotificationSoundEnabled}
      />

      <div className="border-t border-border/50" />

      <SettingsToggle
        icon={MessageSquare}
        label="Message Preview"
        description="Show message content in notifications"
        checked={showMessagePreview}
        onCheckedChange={setShowMessagePreview}
      />
    </div>
  );

  // Appearance Content
  const appearanceContent = (
    <div className="space-y-6">
      {/* Theme Selector */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">Theme</Label>
        <div className="grid grid-cols-2 gap-3">
          {THEMES.map((t) => {
            const preview = THEME_PREVIEWS[t.id];
            const isActive = theme === t.id;

            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-xl border-2 transition-all",
                  isActive ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50",
                )}
              >
                {/* Theme preview */}
                <div className="h-16 w-full flex" style={{ backgroundColor: preview.bg }}>
                  <div className="w-1/4 h-full" style={{ backgroundColor: preview.sidebar }} />
                  <div className="flex-1 p-2.5 flex items-end">
                    <div className="h-3 w-3/4 rounded" style={{ backgroundColor: preview.accent }} />
                  </div>
                </div>

                {/* Theme info */}
                <div className="px-3 py-2.5 bg-card flex items-center justify-between">
                  <div className="text-left">
                    <p className="text-sm font-medium">{t.name}</p>
                  </div>
                  {isActive && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Message Display Section */}
      <div className="space-y-2 pt-6 border-t border-border/50">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Message Display</Label>

        <SettingsToggle
          icon={MessageSquare}
          label="Compact Mode"
          description="Condensed message format for more content"
          checked={compactMode}
          onCheckedChange={setCompactMode}
        />

        <div className="border-t border-border/50" />

        <SettingsToggle
          icon={Clock}
          label="Show Timestamps"
          description="Display time on every message"
          checked={showTimestamps}
          onCheckedChange={setShowTimestamps}
        />

        <div className="border-t border-border/50" />

        <SettingsToggle
          icon={Sparkles}
          label="Animate Emojis"
          description="Enable emoji animations in chat"
          checked={animateEmojis}
          onCheckedChange={setAnimateEmojis}
        />

        <div className="border-t border-border/50" />

        <SettingsToggle
          icon={Link}
          label="Link Previews"
          description="Show rich previews for links in messages"
          checked={linkPreviewsEnabled}
          onCheckedChange={setLinkPreviewsEnabled}
        />
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile: Custom Dialog with Dock */}
      {variant === "modal" && isOpen && isMobile && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-end p-4 pb-6">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

          {/* Dialog */}
          <div
            className="relative bg-background rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-border mb-4"
            style={{ maxHeight: "calc(100vh - 140px)" }}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{navItems.find((n) => n.id === activeTab)?.label}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeTab === "account" && "Manage your account"}
                  {activeTab === "profile" && "Customize your profile"}
                  {activeTab === "notifications" && "Notification settings"}
                  {activeTab === "appearance" && "Personalize your app"}
                  {activeTab === "blocked" && "Manage blocked users"}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClose} className="rounded-full">
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-5" style={{ maxHeight: "calc(100vh - 240px)" }}>
              {renderContent()}
            </div>
          </div>

          {/* Dock Navigation */}
          <div className="relative w-full flex gap-2 p-2 bg-background/95 backdrop-blur-xl rounded-2xl border border-border shadow-2xl overflow-x-auto scrollbar-hide scroll-smooth justify-start">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "relative flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl transition-all flex-shrink-0",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Desktop: In-layout page (rendered from AppLayout) */}
      {variant === "page" && !isMobile && (
        <div className="h-full flex flex-col bg-background">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleClose} className="flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">User Settings</h1>
              <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar Navigation */}
            <div className="w-56 bg-secondary/30 border-r border-border flex flex-col overflow-hidden">
              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-sm rounded-xl transition-all",
                        isActive
                          ? "bg-background shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/80",
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              <div className="px-8 py-5 border-b border-border shrink-0">
                <h3 className="text-xl font-semibold">{navItems.find((n) => n.id === activeTab)?.label}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeTab === "account" && "Manage your account credentials and security"}
                  {activeTab === "profile" && "Customize how others see you"}
                  {activeTab === "notifications" && "Control how you receive notifications"}
                  {activeTab === "appearance" && "Personalize your app experience"}
                  {activeTab === "blocked" && "View and unblock users"}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-8">{renderContent()}</div>
            </div>
          </div>
        </div>
      )}

      {/* View Key Confirmation */}
      <AlertDialog open={showKeyConfirm} onOpenChange={setShowKeyConfirm}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Reveal Secret Key?</AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              Make sure no one is looking at your screen. Your secret key is the only way to access your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="m-0 rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setKeyRevealed(true);
                setShowKeyConfirm(false);
              }}
              className="rounded-xl bg-brand-600 text-black hover:bg-brand-700"
            >
              Reveal Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Logout Confirmation */}
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Log Out?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="leading-relaxed">
                  Are you sure you want to log out? You will need your secret key to sign back in.
                </p>
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium flex items-center gap-2">
                    <Key className="w-4 h-4 flex-shrink-0" />
                    Remember to save your secret key!
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    You can find your secret key in{" "}
                    <span className="font-medium text-foreground">Settings → Account → View Secret Key</span>. Without
                    it, you cannot recover your account.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="m-0 rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLogout} className="rounded-xl bg-red-500 text-black hover:bg-red-600">
              <LogOut className="w-4 h-4 mr-2" />
              Yes, Log Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Preview */}
      <AlertDialog
        open={showDeletePreview}
        onOpenChange={(open) => {
          setShowDeletePreview(open);
          if (!open) setDeletionPreview(null);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete Account?</AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              Review what will be deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {isLoadingPreview ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            deletionPreview && (
              <div className="space-y-5 py-2">
                {/* Data to be deleted */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Data to be deleted
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Messages", count: deletionPreview.message_count },
                      { label: "Direct Messages", count: deletionPreview.dm_count },
                      { label: "Reactions", count: deletionPreview.reaction_count },
                      { label: "Friends", count: deletionPreview.friendship_count },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl"
                      >
                        <span className="text-sm text-muted-foreground">{item.label}</span>
                        <span className="font-semibold">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Servers to be transferred */}
                {deletionPreview.servers_to_transfer.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Servers to be transferred
                    </h4>
                    <div className="space-y-2">
                      {deletionPreview.servers_to_transfer.map((server) => (
                        <div key={server.id} className="p-3 bg-secondary/50 rounded-xl">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{server.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {server.member_count} member{server.member_count !== 1 ? "s" : ""}
                            </span>
                          </div>
                          {server.new_owner && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Will be transferred to{" "}
                              <span className="text-foreground font-medium">@{server.new_owner.username}</span>
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Servers to be deleted */}
                {deletionPreview.servers_to_delete.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-destructive">
                      Servers to be deleted
                    </h4>
                    <div className="space-y-2">
                      {deletionPreview.servers_to_delete.map((server) => (
                        <div key={server.id} className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
                          <span className="font-medium">{server.name}</span>
                          <p className="text-xs text-muted-foreground mt-1">
                            No other members - will be permanently deleted
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="m-0 rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDeletePreview(false);
                setShowDeleteConfirm(true);
              }}
              disabled={isLoadingPreview}
              className="rounded-xl bg-red-600 text-white hover:bg-red-700"
            >
              Continue to Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Final Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              This is your final confirmation. Your account and all associated data will be permanently deleted. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="m-0 rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="rounded-xl bg-red-600 text-white hover:bg-red-700"
            >
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Avatar Decoration Modal */}
      <AvatarDecorationModal
        open={showAvatarDecorationModal}
        onOpenChange={setShowAvatarDecorationModal}
        onSelect={() => {}}
      />

      {/* Profile Effect Modal */}
      <ProfileEffectModal open={showProfileEffectModal} onOpenChange={setShowProfileEffectModal} onSelect={() => {}} />
    </>
  );
};

export const UserSettingsModal = () => <UserSettings variant="modal" />;
export const UserSettingsPage = () => <UserSettings variant="page" />;
