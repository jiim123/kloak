import { useEffect, useState, useRef } from "react";
import {
  Loader2,
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
  Globe,
  Monitor,
  MessageSquare,
  Clock,
  Sparkles,
  Volume2,
  Mic,
  AtSign,
  Reply,
  Users,
  UserPlus,
  Mail,
  X,
  RefreshCw,
  AlertTriangle,
  Download,
  Shield,
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
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AvatarDecorationModal } from "@/components/modals/AvatarDecorationModal";
import { ProfileEffectModal } from "@/components/modals/ProfileEffectModal";
import { EditableProfilePreview } from "@/components/modals/EditableProfilePreview";
import { DockNavigation } from "@/components/ui/dock-navigation";
import { useUIStore, THEMES, type Theme } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import { useFriendStore } from "@/stores/friendStore";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { supabase } from "@/integrations/supabase/client";
import { secureUpload, secureListAndDelete } from "@/lib/storageUpload";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { getAuthEntryPath, isTauri } from "@/lib/tauriRuntime";
import { VoiceSettingsPanel } from "@/components/voice/VoiceSettingsPanel";
import type { User as UserType } from "@/types";
import { useAppUpdater } from "@/hooks/useAppUpdater";

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
  const authEntryPath = getAuthEntryPath();
  const { updateInfo, isChecking, isInstalling, checkUpdate, installUpdate } = useAppUpdater();
  const {
    activeModal,
    closeModal,
    theme,
    setTheme,
    linkPreviewsEnabled,
    setLinkPreviewsEnabled,
    desktopNotificationsEnabled,
    setDesktopNotificationsEnabled,
    browserNotificationsEnabled,
    setBrowserNotificationsEnabled,
    notificationSoundEnabled,
    setNotificationSoundEnabled,
    notificationSoundServerMentions,
    setNotificationSoundServerMentions,
    notificationSoundUserMentions,
    setNotificationSoundUserMentions,
    notificationSoundReplies,
    setNotificationSoundReplies,
    notificationVolume,
    setNotificationVolume,
    showMessagePreview,
    setShowMessagePreview,
    showPreviewServerMentions,
    setShowPreviewServerMentions,
    showPreviewUserMentions,
    setShowPreviewUserMentions,
    showPreviewReplies,
    setShowPreviewReplies,
    enableMentionNotifications,
    setEnableMentionNotifications,
    enableDMNotifications,
    setEnableDMNotifications,
    enableFriendRequestNotifications,
    setEnableFriendRequestNotifications,
    enableServerInviteNotifications,
    setEnableServerInviteNotifications,
    compactMode,
    setCompactMode,
    showTimestamps,
    setShowTimestamps,
    animateEmojis,
    setAnimateEmojis,
    dmPrivacy,
    setDmPrivacy,
  } = useUIStore();
  const { playTestSound } = useNotificationSound();
  const { user, updateUser, logout, resetSecretKey } = useAuthStore();
  const { blockedUsers, unblockUser, fetchFriends, isLoading: isFriendsLoading } = useFriendStore();

  const [activeTab, setActiveTab] = useState("account");
  const [isLoading, setIsLoading] = useState(false);
  const [showSecretKey, _setShowSecretKey] = useState(false);
  const [showKeyConfirm, setShowKeyConfirm] = useState(false);
  const [showResetKeyConfirm, setShowResetKeyConfirm] = useState(false);
  const [newSecretKey, setNewSecretKey] = useState<string | null>(null);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [isResettingKey, setIsResettingKey] = useState(false);
  const [resetCooldownEndsAt, setResetCooldownEndsAt] = useState<Date | null>(null);
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
  const [_keyRevealed, _setKeyRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAvatarDecorationModal, setShowAvatarDecorationModal] = useState(false);
  const [showProfileEffectModal, setShowProfileEffectModal] = useState(false);
  const [isBannerUploading, setIsBannerUploading] = useState(false);
  const [browserPermissionStatus, setBrowserPermissionStatus] = useState<NotificationPermission | "unsupported">(
    "default",
  );

  // Sync browser notification toggle with actual browser permission on mount
  useEffect(() => {
    if (typeof Notification === "undefined") {
      setBrowserPermissionStatus("unsupported");
      return;
    }

    // Initial check
    setBrowserPermissionStatus(Notification.permission);

    // If permission is denied or unsupported, force the toggle off
    if (Notification.permission === "denied") {
      setBrowserNotificationsEnabled(false);
    }

    // Listen for permission changes (some browsers support this)
    const checkPermission = () => {
      setBrowserPermissionStatus(Notification.permission);
      if (Notification.permission === "denied") {
        setBrowserNotificationsEnabled(false);
      }
    };

    // Check periodically when tab becomes visible (catches manual browser setting changes)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && typeof Notification !== "undefined") {
        checkPermission();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [setBrowserNotificationsEnabled]);

  // Profile form state
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [bio, setBio] = useState(user?.bio || "");
  // Pronouns removed per user request
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
    { id: "privacy", label: "Privacy", icon: Shield },
    { id: "voice", label: "Voice & Audio", icon: Mic },
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

  // ESC key to close (desktop page variant)
  useEffect(() => {
    if (variant !== "page") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [variant]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      await updateUser({
        display_name: displayName.trim() || null,
        bio: bio.trim() ? bio : null,
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

  const handleDmPrivacyChange = async (value: "everyone" | "shared_servers" | "friends" | "no_one") => {
    if (!user?.id) return;
    setDmPrivacy(value);
    const { error } = await supabase.rpc("set_dm_privacy_preference" as any, {
      _user_id: user.id,
      _dm_privacy: value,
    });
    if (error) {
      toast.error("Failed to update DM privacy");
    } else {
      toast.success("DM privacy updated");
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
      const { compressImage } = await import("@/lib/imageCompression");
      const compressed = await compressImage(file, "avatar");
      const fileExt = compressed.name.split(".").pop();
      const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      const { publicUrl } = await secureUpload("avatars", filePath, file, {
        upsert: false,
        cacheControl: "31536000",
      });
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

    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be less than 8MB");
      return;
    }

    setIsBannerUploading(true);
    try {
      const { compressImage } = await import("@/lib/imageCompression");
      const compressed = await compressImage(file, "profile-banner");
      const fileExt = compressed.name.split(".").pop();
      const filePath = `${user.id}/banner-${Date.now()}.${fileExt}`;

      const { publicUrl } = await secureUpload("avatars", filePath, file, {
        upsert: false,
        cacheControl: "31536000",
      });
      setLocalBannerUrl(publicUrl);
      await updateUser({ banner_url: publicUrl });
      toast.success("Banner updated!");
    } catch (error) {
      console.error("Banner upload error:", error);
      toast.error("Failed to upload banner");
    } finally {
      setIsBannerUploading(false);
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

  const handleAvatarRemove = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Delete avatar files from storage first
      try {
        await secureListAndDelete("avatars", user.id, "avatar");
      } catch {
        /* ignore cleanup errors */
      }

      setLocalAvatarUrl(null);
      await updateUser({ avatar_url: null });
      toast.success("Avatar removed!");
    } catch (error) {
      console.error("Failed to remove avatar:", error);
      toast.error("Failed to remove avatar");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyKey = async () => {
    // Secret key is no longer accessible from settings
    return;
  };

  const handleLogout = () => {
    logout();
    closeModal();
    navigate(`${authEntryPath}?mode=login`);
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
      navigate(`${authEntryPath}?mode=signup`);
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
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Blocked Users</Label>
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
                <AvatarWithDecoration
                  user={u as unknown as UserType}
                  className="w-10 h-10 flex-shrink-0"
                  freezeGifUntilHover
                />
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
      case "privacy":
        return privacyContent;
      case "voice":
        return voiceContent;
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
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Username</Label>
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
      <div className="space-y-4">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Secret Key</Label>

        {/* Secret Key Security Notice */}
        <div className="p-4 rounded-xl bg-secondary/50 border border-border/50 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium">Secret Key</h4>
              <p className="text-xs text-muted-foreground">Your key was shown once during registration</p>
            </div>
          </div>

          <div className="p-3 rounded-lg border border-border bg-secondary/30">
            <p className="text-sm text-muted-foreground">
              For security, Kloak does not store your secret key. It was displayed once when you created your account.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              If you lose your secret key, you will not be able to recover your account. Make sure you have it saved in a secure location.
            </p>
          </div>
        </div>

      </div>

      {/* App Updates - Only show in Tauri */}
      {isTauriApp && (
        <div className="space-y-4">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">App Updates</Label>

          <div className="p-4 rounded-xl bg-secondary/50 border border-border/50 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Download className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium">Check for Updates</h4>
                <p className="text-xs text-muted-foreground">
                  {updateInfo.available ? (
                    `Update available: v${updateInfo.version}`
                  ) : updateInfo.error ? (
                    <span className="text-destructive">
                      {updateInfo.error}
                      {updateInfo.error.includes("Unknown") && (
                        <span className="block mt-1 text-[10px] opacity-75">
                          Open DevTools (F12) Console for details
                        </span>
                      )}
                    </span>
                  ) : (
                    "Check if a new version is available"
                  )}
                </p>
              </div>
            </div>

            {updateInfo.available ? (
              <div className="space-y-3">
                {updateInfo.body && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{updateInfo.body}</p>
                  </div>
                )}
                {updateInfo.error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-destructive font-medium">Installation Error</p>
                        <p className="text-xs text-destructive/80 mt-1 break-words font-mono bg-destructive/5 p-2 rounded">
                          {updateInfo.error}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-2">
                          Common issues: Missing .sig file, network error, or permission denied. Check GitHub releases
                          for update files.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <Button onClick={installUpdate} disabled={isInstalling} className="w-full h-11 rounded-xl">
                  {isInstalling ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {updateInfo.error ? "Retry Installation" : "Installing Update..."}
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Install Update
                    </>
                  )}
                </Button>
                {isInstalling && !updateInfo.error && (
                  <div className="space-y-2">
                    <p className="text-xs text-center text-muted-foreground">Downloading and installing update...</p>
                    <p className="text-[10px] text-center text-muted-foreground/70">
                      The app will restart automatically after installation completes.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <Button
                variant="secondary"
                onClick={checkUpdate}
                disabled={isChecking}
                className="w-full h-11 rounded-xl"
              >
                {isChecking ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Check for Updates
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* DevTools - Only show in Tauri */}
      {isTauriApp && (
        <div className="space-y-4">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Developer Tools
          </Label>

          <div className="p-4 rounded-xl bg-secondary/50 border border-border/50 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Monitor className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium">Open DevTools</h4>
                <p className="text-xs text-muted-foreground">Open browser DevTools to view console logs and debug</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50 space-y-2">
              <p className="text-xs text-muted-foreground">
                DevTools: Press <kbd className="text-[10px] bg-background px-1.5 py-0.5 rounded border">F12</kbd> or{" "}
                <kbd className="text-[10px] bg-background px-1.5 py-0.5 rounded border">Ctrl+Shift+I</kbd> to open.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const { invoke } = await import("@tauri-apps/api/core");
                    const appDataDir = await invoke<string>("get_app_data_dir");
                    const logPath = `${appDataDir}\\updater-error.log`;
                    alert(
                      `App Data Directory:\n${appDataDir}\n\nUpdater Error Log:\n${logPath}\n\n(Only exists if updater failed to initialize)`,
                    );
                  } catch (error) {
                    console.error("Failed to get app data dir:", error);
                    alert("Failed to get app data directory. Check console.");
                  }
                }}
                className="w-full h-8 text-xs"
              >
                <Monitor className="w-3 h-3 mr-1" />
                Show App Data Directory Path
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="pt-6 mt-6 border-t border-destructive/20">
        <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-destructive">Danger Zone</h4>
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
  const profileContent = (
    <div className="max-w-lg mx-auto">
      <EditableProfilePreview
        user={user}
        localAvatarUrl={localAvatarUrl}
        localBannerUrl={localBannerUrl}
        displayName={displayName}
        bio={bio}
        profileThemePrimary={profileThemePrimary}
        profileThemeAccent={profileThemeAccent}
        onAvatarUpload={handleAvatarUpload}
        onAvatarRemove={handleAvatarRemove}
        onBannerUpload={handleBannerUpload}
        onBannerRemove={handleRemoveBanner}
        onDisplayNameChange={setDisplayName}
        onBioChange={setBio}
        onThemePrimaryChange={setProfileThemePrimary}
        onThemeAccentChange={setProfileThemeAccent}
        onOpenAvatarDecoration={() => setShowAvatarDecorationModal(true)}
        onOpenProfileEffect={() => setShowProfileEffectModal(true)}
        fileInputRef={fileInputRef}
        bannerInputRef={bannerInputRef}
        isLoading={isLoading}
        isBannerUploading={isBannerUploading}
      />

      <div className="mt-6 flex gap-3">
        <Button
          variant="outline"
          onClick={() => {
            // Reset to original values
            setDisplayName(user?.display_name || "");
            setBio(user?.bio || "");
            setProfileThemePrimary(user?.profile_theme_primary ?? null);
            setProfileThemeAccent(user?.profile_theme_accent ?? null);
            setLocalAvatarUrl(user?.avatar_url ?? null);
            setLocalBannerUrl(user?.banner_url ?? null);
          }}
          className="flex-1 h-11 rounded-xl"
        >
          Reset
        </Button>
        <Button variant="primary" onClick={handleSaveProfile} disabled={isLoading} className="flex-1 h-11 rounded-xl">
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  );

  // Voice & Audio Content
  const voiceContent = <VoiceSettingsPanel />;

  const privacyOptions: Array<{
    id: "everyone" | "shared_servers" | "friends" | "no_one";
    title: string;
    description: string;
  }> = [
    { id: "everyone", title: "Everyone", description: "Anyone can start a DM with you." },
    {
      id: "shared_servers",
      title: "Shared Servers",
      description: "Only people who share a server with you can DM you.",
    },
    { id: "friends", title: "Friends Only", description: "Only accepted friends can start a DM." },
    { id: "no_one", title: "No One", description: "Nobody can start new DMs with you." },
  ];

  const privacyContent = (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Direct Message Privacy</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-2">Control who can start a new DM conversation with you.</p>
        <div className="space-y-2">
          {privacyOptions.map((option) => {
            const active = dmPrivacy === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => void handleDmPrivacyChange(option.id)}
                className={cn(
                  "w-full text-left p-3 rounded-xl border transition-colors",
                  active ? "border-primary bg-primary/10" : "border-border/50 bg-background/30 hover:border-primary/40",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{option.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                  </div>
                  {active && <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // Notifications Content

  // Notifications Content
  const notificationsContent = (
    <div className="space-y-4">
      {/* Notification Types */}
      <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Notification Types</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-2">Choose which notifications you want to receive</p>
        <SettingsToggle
          icon={AtSign}
          label="@Mentions"
          description="When someone mentions you in a channel"
          checked={enableMentionNotifications}
          onCheckedChange={setEnableMentionNotifications}
        />
        <SettingsToggle
          icon={MessageSquare}
          label="Direct Messages"
          description="When you receive a direct message"
          checked={enableDMNotifications}
          onCheckedChange={setEnableDMNotifications}
        />
        <SettingsToggle
          icon={UserPlus}
          label="Friend Requests"
          description="When someone sends you a friend request"
          checked={enableFriendRequestNotifications}
          onCheckedChange={setEnableFriendRequestNotifications}
        />
        <SettingsToggle
          icon={Mail}
          label="Server Invites"
          description="When you're invited to a server"
          checked={enableServerInviteNotifications}
          onCheckedChange={setEnableServerInviteNotifications}
        />
      </div>

      {/* Desktop Notifications - Only for Tauri */}
      {isTauriApp && (
        <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Monitor className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Desktop App</h3>
          </div>
          <SettingsToggle
            icon={Monitor}
            label="Desktop Notifications"
            description="Show system notifications from the desktop app"
            checked={desktopNotificationsEnabled}
            onCheckedChange={async (checked) => {
              if (!checked) return setDesktopNotificationsEnabled(false);

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
            }}
          />
          <div className="flex justify-end">
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
        </div>
      )}

      {/* Browser Notifications */}
      <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Browser Notifications</h3>
        </div>
        <SettingsToggle
          icon={Globe}
          label="Browser Notifications"
          description={
            browserPermissionStatus === "unsupported"
              ? "Not supported on this device"
              : browserPermissionStatus === "denied"
                ? "Blocked in browser settings. Please enable in your browser's site settings."
                : browserPermissionStatus === "default"
                  ? "Click to enable browser notifications"
                  : "Show browser notifications for new messages"
          }
          checked={browserNotificationsEnabled && browserPermissionStatus === "granted"}
          disabled={browserPermissionStatus === "unsupported" || browserPermissionStatus === "denied"}
          onCheckedChange={async (checked) => {
            if (!checked) return setBrowserNotificationsEnabled(false);

            if (browserPermissionStatus === "unsupported") {
              toast.error("Browser notifications are not supported on this device.");
              return;
            }

            if (browserPermissionStatus === "denied") {
              toast.error("Notifications are blocked. Please enable them in your browser's site settings.");
              return;
            }

            if (browserPermissionStatus === "default") {
              try {
                const permission = await Notification.requestPermission();
                setBrowserPermissionStatus(permission);
                if (permission === "granted") {
                  setBrowserNotificationsEnabled(true);
                  toast.success("Browser notifications enabled!");
                } else if (permission === "denied") {
                  toast.error(
                    "Notification permission denied. You can enable it later in your browser's site settings.",
                  );
                }
              } catch {
                toast.error("Unable to request notification permission.");
              }
              return;
            }
            setBrowserNotificationsEnabled(true);
          }}
        />
        {browserPermissionStatus === "denied" && (
          <p className="text-xs text-muted-foreground ml-14">
            To enable notifications, click the lock/info icon in your browser's address bar and allow notifications for
            this site.
          </p>
        )}
      </div>

      {/* Notification Sound */}
      <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Volume2 className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Sound</h3>
        </div>
        <SettingsToggle
          icon={Volume2}
          label="Notification Sound"
          description="Play a sound when you receive notifications"
          checked={notificationSoundEnabled}
          onCheckedChange={setNotificationSoundEnabled}
        />

        {/* Sound sub-options when enabled */}
        {notificationSoundEnabled && (
          <div className="space-y-3 pt-2">
            {/* Volume Slider */}
            <div className="space-y-3 p-3 rounded-lg bg-background/50 border border-border/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Volume</span>
                <span className="text-sm text-muted-foreground">{notificationVolume}%</span>
              </div>
              <div className="flex items-center gap-3">
                <Slider
                  value={[notificationVolume]}
                  onValueChange={([value]) => setNotificationVolume(value)}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="sm" onClick={playTestSound} className="flex-shrink-0">
                  Test
                </Button>
              </div>
            </div>

            {/* Sound type toggles */}
            <div className="space-y-1 p-3 rounded-lg bg-background/50 border border-border/30">
              <p className="text-xs text-muted-foreground mb-2">Play sound for:</p>
              <div className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Server Mentions (@here, @everyone)</span>
                </div>
                <Switch
                  checked={notificationSoundServerMentions}
                  onCheckedChange={setNotificationSoundServerMentions}
                />
              </div>
              <div className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <AtSign className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">User Mentions (@you)</span>
                </div>
                <Switch checked={notificationSoundUserMentions} onCheckedChange={setNotificationSoundUserMentions} />
              </div>
              <div className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <Reply className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Replies</span>
                </div>
                <Switch checked={notificationSoundReplies} onCheckedChange={setNotificationSoundReplies} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Message Preview */}
      <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Message Previews</h3>
        </div>
        <SettingsToggle
          icon={MessageSquare}
          label="Message Preview"
          description="Show message content in notifications"
          checked={showMessagePreview}
          onCheckedChange={setShowMessagePreview}
        />

        {/* Preview sub-options when enabled */}
        {showMessagePreview && (
          <div className="space-y-1 p-3 rounded-lg bg-background/50 border border-border/30">
            <p className="text-xs text-muted-foreground mb-2">Show previews for:</p>
            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Server Mentions</span>
              </div>
              <Switch checked={showPreviewServerMentions} onCheckedChange={setShowPreviewServerMentions} />
            </div>
            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <AtSign className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">User Mentions</span>
              </div>
              <Switch checked={showPreviewUserMentions} onCheckedChange={setShowPreviewUserMentions} />
            </div>
            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <Reply className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Replies</span>
              </div>
              <Switch checked={showPreviewReplies} onCheckedChange={setShowPreviewReplies} />
            </div>
          </div>
        )}
      </div>
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
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Message Display</Label>

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
                <h3 className="text-lg font-medium">{navItems.find((n) => n.id === activeTab)?.label}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeTab === "account" && "Manage your account"}
                  {activeTab === "profile" && "Customize your profile"}
                  {activeTab === "privacy" && "Control who can message you"}
                  {activeTab === "voice" && "Audio and voice settings"}
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
          <DockNavigation navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      )}

      {/* Desktop: In-layout page (rendered from AppLayout) */}
      {variant === "page" && !isMobile && (
        <div className="h-full flex bg-background">
          {/* Sidebar Navigation */}
          <div className="w-56 flex-shrink-0 border-r border-border bg-secondary/20 flex flex-col overflow-hidden">
            {/* Settings Title Header */}
            <div className="px-4 pt-5 pb-3">
              <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground truncate">
                User Settings
              </h2>
            </div>

            {/* Nav Items */}
            <ScrollArea className="flex-1 px-2 pb-4">
              <nav className="flex flex-col gap-0.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 text-sm font-medium px-3 py-2 rounded-md transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </button>
                  );
                })}

                {/* Logout - at bottom, separated */}
                <Separator className="my-3" />
                <button
                  type="button"
                  onClick={handleLogoutClick}
                  className="w-full flex items-center gap-2.5 text-sm font-medium px-3 py-2 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Log Out
                </button>
              </nav>
            </ScrollArea>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto relative">
            {/* Close Button (ESC) */}
            <button
              type="button"
              onClick={handleClose}
              className="absolute top-4 right-4 z-10 flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors group"
            >
              <div className="w-9 h-9 rounded-full border border-border bg-secondary/50 flex items-center justify-center group-hover:bg-secondary group-hover:border-muted-foreground/50 transition-colors">
                <X className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wider">ESC</span>
            </button>

            {/* Content */}
            <div className="p-6 pr-16">
              <h2 className="text-xl font-medium mb-1">{navItems.find((n) => n.id === activeTab)?.label}</h2>
              <p className="text-sm text-muted-foreground mb-6">
                {activeTab === "account" && "Manage your account credentials and security"}
                {activeTab === "profile" && "Customize how others see you"}
                {activeTab === "privacy" && "Manage your direct message privacy preferences"}
                {activeTab === "voice" && "Configure your audio input, output, and voice settings"}
                {activeTab === "notifications" && "Control how you receive notifications"}
                {activeTab === "appearance" && "Personalize your app experience"}
                {activeTab === "blocked" && "View and unblock users"}
              </p>

              <div className={cn(activeTab !== "profile" && "max-w-xl")}>{renderContent()}</div>
            </div>
          </div>
        </div>
      )}

      {/* View Key Confirmation - removed: secret key no longer viewable in settings */}

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
                    Make sure you have your secret key saved!
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    Your secret key was shown once during registration. Without it, you cannot recover your account.
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
                   <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                        <span className="font-medium">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Servers to be transferred */}
                {deletionPreview.servers_to_transfer.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                    <h4 className="text-xs font-medium uppercase tracking-wider text-destructive">
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
