import { useState, useRef } from "react";
import {
  Loader2,
  Upload,
  User,
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
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
import { useUIStore, THEMES, type Theme } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

// Theme preview colors for the selector
const THEME_PREVIEWS: Record<Theme, { bg: string; sidebar: string; accent: string }> = {
  default: { bg: "#0a0a0a", sidebar: "#171717", accent: "#f97316" },
  nostalgia: { bg: "#452829", sidebar: "#2e1a1b", accent: "#E8D1C5" },
  lofi: { bg: "#293462", sidebar: "#161c35", accent: "#FE5F55" },
  cappuccino: { bg: "#493628", sidebar: "#2c2018", accent: "#AB886D" },
  hokori: { bg: "#000000", sidebar: "#050505", accent: "#E43636" },
};

export const UserSettingsModal = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
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

  const [activeTab, setActiveTab] = useState("account");
  const [isLoading, setIsLoading] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showKeyConfirm, setShowKeyConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeletePreview, setShowDeletePreview] = useState(false);
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

  // Profile form state
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [bannerColor, setBannerColor] = useState(user?.banner_color || "#5865F2");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const navItems = [
    { id: "account", label: "Account", icon: Key },
    { id: "profile", label: "Profile", icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "appearance", label: "Appearance", icon: Palette },
  ];

  const isOpen = activeModal === "user-settings";

  const handleSaveProfile = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      await updateUser({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        banner_color: bannerColor,
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

      await updateUser({ avatar_url: publicUrl });
      toast.success("Avatar updated!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload avatar");
    } finally {
      setIsLoading(false);
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
          <Button variant="outline" onClick={() => setShowKeyConfirm(true)} className="w-full h-12 rounded-xl">
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
                variant="outline"
                size="icon"
                onClick={() => setShowSecretKey(!showSecretKey)}
                className="h-12 w-12 rounded-xl flex-shrink-0"
              >
                {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyKey}
                className="h-12 w-12 rounded-xl flex-shrink-0"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-destructive flex items-center gap-2">
              <Key className="w-3 h-3" />
              Keep this key safe! It's the only way to access your account.
            </p>
          </div>
        )}
      </div>

      {/* Log Out */}
      <Button variant="outline" onClick={handleLogout} className="w-full h-12 rounded-xl">
        <LogOut className="w-4 h-4 mr-2" />
        Log Out
      </Button>

      {/* Danger Zone */}
      <div className="pt-6 mt-6 border-t border-destructive/20">
        <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-destructive">Danger Zone</h4>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Deleting your account will permanently remove all your data including messages, servers, and friendships.
            </p>
          </div>
          <Button variant="destructive" onClick={handleDeletePreview} className="w-full h-11 rounded-xl">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Account
          </Button>
        </div>
      </div>
    </div>
  );

  // Profile Content
  const profileContent = (
    <div className="space-y-6">
      {/* Avatar Upload */}
      <div className="flex items-center gap-5">
        <div className="cursor-pointer flex-shrink-0 group relative" onClick={() => fileInputRef.current?.click()}>
          <AvatarWithDecoration
            user={user}
            className="w-20 h-20 ring-4 ring-secondary/50 group-hover:ring-primary/30 transition-all"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            <Upload className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="space-y-2">
          <Button
            variant="outline"
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
        <Button variant="outline" onClick={() => setShowAvatarDecorationModal(true)} className="w-full h-12 rounded-xl">
          <DecorationIcon className="w-4 h-4 mr-2" />
          {user?.avatar_decoration ? "Change Decoration" : "Add Decoration"}
        </Button>
      </div>

      {/* Banner Color */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Banner Color</Label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={bannerColor}
            onChange={(e) => setBannerColor(e.target.value)}
            className="w-12 h-12 rounded-xl cursor-pointer border-2 border-border flex-shrink-0"
          />
          <Input
            value={bannerColor}
            onChange={(e) => setBannerColor(e.target.value)}
            placeholder="#5865F2"
            className="w-32 font-mono text-sm h-12 rounded-xl"
          />
          <div className="flex-1 h-12 rounded-xl border border-border/50" style={{ backgroundColor: bannerColor }} />
        </div>
      </div>

      <Button onClick={handleSaveProfile} disabled={isLoading} className="w-full h-12 rounded-xl">
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Save Profile
      </Button>
    </div>
  );

  // Notifications Content
  const notificationsContent = (
    <div className="space-y-2">
      <SettingsToggle
        icon={Bell}
        label="Desktop Notifications"
        description={
          Notification.permission === "denied" ? "Blocked in browser settings" : "Show desktop alerts for new messages"
        }
        checked={desktopNotificationsEnabled}
        disabled={Notification.permission === "denied"}
        onCheckedChange={async (checked) => {
          if (checked && Notification.permission === "default") {
            const permission = await Notification.requestPermission();
            if (permission === "granted") {
              setDesktopNotificationsEnabled(true);
              toast.success("Desktop notifications enabled!");
            } else if (permission === "denied") {
              toast.error("Notification permission denied. Enable in browser settings.");
            }
          } else {
            setDesktopNotificationsEnabled(checked);
          }
        }}
      />

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
      {isOpen && isMobile && (
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
          <div className="relative flex gap-2 p-2 bg-background/95 backdrop-blur-xl rounded-2xl border border-border shadow-2xl">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "relative flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl transition-all",
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

      {/* Desktop: Standard Dialog */}
      {!isMobile && (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
          <DialogContent className="sm:max-w-3xl max-h-[85vh] p-0 gap-0 overflow-hidden rounded-2xl">
            <div className="flex h-[70vh] max-h-[600px]">
              {/* Sidebar Navigation */}
              <div className="w-56 bg-secondary/30 border-r border-border flex flex-col">
                <div className="p-5 border-b border-border">
                  <h2 className="font-semibold text-base">User Settings</h2>
                </div>
                <nav className="flex-1 p-3 space-y-1">
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
                            ? "bg-primary text-primary-foreground shadow-sm"
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
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-8 py-5 border-b border-border shrink-0">
                  <h3 className="text-xl font-semibold">{navItems.find((n) => n.id === activeTab)?.label}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activeTab === "account" && "Manage your account credentials and security"}
                    {activeTab === "profile" && "Customize how others see you"}
                    {activeTab === "notifications" && "Control how you receive notifications"}
                    {activeTab === "appearance" && "Personalize your app experience"}
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-8">{renderContent()}</div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
              className="rounded-xl"
            >
              Reveal Key
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
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
    </>
  );
};
