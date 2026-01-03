import { useState, useRef } from 'react';
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
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUIStore, THEMES, type Theme } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

// Theme preview colors for the selector
const THEME_PREVIEWS: Record<Theme, { bg: string; sidebar: string; accent: string }> = {
  default: { bg: '#0a0a0a', sidebar: '#171717', accent: '#f97316' },
  nostalgia: { bg: '#452829', sidebar: '#2e1a1b', accent: '#E8D1C5' },
  lofi: { bg: '#293462', sidebar: '#161c35', accent: '#FE5F55' },
  cappuccino: { bg: '#493628', sidebar: '#2c2018', accent: '#AB886D' },
  hokori: { bg: '#000000', sidebar: '#050505', accent: '#E43636' },
};

export const UserSettingsModal = () => {
  const navigate = useNavigate();
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
  
  const [activeTab, setActiveTab] = useState('account');
  const [isLoading, setIsLoading] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showKeyConfirm, setShowKeyConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Profile form state
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [bannerColor, setBannerColor] = useState(user?.banner_color || '#5865F2');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOpen = activeModal === 'user-settings';

  const handleSaveProfile = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      await updateUser({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        banner_color: bannerColor,
      });
      toast.success('Profile updated!');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setIsLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      await updateUser({ avatar_url: publicUrl });
      toast.success('Avatar updated!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload avatar');
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
      toast.success('Secret key copied!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleLogout = () => {
    logout();
    closeModal();
    navigate('/auth?mode=login');
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Delete user from database
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id);

      if (error) throw error;
      
      logout();
      closeModal();
      navigate('/auth?mode=signup');
      toast.success('Account deleted');
    } catch (error) {
      toast.error('Failed to delete account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setActiveTab('account');
    setShowSecretKey(false);
    setKeyRevealed(false);
    closeModal();
  };

  const navItems = [
    { id: 'account', label: 'Account', icon: Key },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
  ];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-2xl max-w-[calc(100vw-2rem)] h-[calc(100vh-3rem)] sm:h-auto sm:max-h-[80vh] p-0 gap-0 overflow-hidden">
          <div className="flex flex-col sm:flex-row h-full sm:h-[70vh]">
            {/* Mobile Tab Navigation */}
            <div className="sm:hidden border-b border-border">
              <div className="p-3">
                <h2 className="font-semibold text-sm">User Settings</h2>
              </div>
              <nav className="flex overflow-x-auto px-2 pb-2 gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0',
                        isActive 
                          ? 'bg-primary text-primary-foreground' 
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Desktop Sidebar Navigation */}
            <div className="hidden sm:flex w-48 bg-secondary/50 border-r border-border flex-col">
              <div className="p-4 border-b border-border">
                <h2 className="font-semibold text-sm">User Settings</h2>
              </div>
              <nav className="flex-1 p-2 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors',
                        isActive 
                          ? 'bg-primary text-primary-foreground' 
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
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
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border shrink-0">
                <DialogTitle className="text-base sm:text-lg">
                  {navItems.find(n => n.id === activeTab)?.label}
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  {activeTab === 'account' && 'Manage your account credentials and security'}
                  {activeTab === 'profile' && 'Customize how others see you'}
                  {activeTab === 'notifications' && 'Control how you receive notifications'}
                  {activeTab === 'appearance' && 'Personalize your app experience'}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-3 sm:p-6">
                {/* Account Section */}
                {activeTab === 'account' && (
                  <div className="space-y-3 sm:space-y-4">
                    {/* Username Display */}
                    <div className="space-y-1.5 sm:space-y-2">
                      <Label className="text-[10px] sm:text-xs font-bold uppercase text-muted-foreground">
                        Username
                      </Label>
                      <div className="flex items-center gap-2 p-2 sm:p-3 bg-secondary rounded-lg">
                        <span className="text-sm sm:text-base font-medium">{user?.username}</span>
                        <span className="text-[10px] sm:text-xs text-muted-foreground">(cannot be changed)</span>
                      </div>
                    </div>

                    {/* Secret Key Section */}
                    <div className="space-y-1.5 sm:space-y-2">
                      <Label className="text-[10px] sm:text-xs font-bold uppercase text-muted-foreground">
                        Secret Key
                      </Label>
                      {!keyRevealed ? (
                        <Button 
                          variant="outline" 
                          onClick={() => setShowKeyConfirm(true)}
                          className="w-full h-9 sm:h-10 text-xs sm:text-sm"
                        >
                          <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
                          View Secret Key
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex gap-1.5 sm:gap-2">
                            <Input
                              type={showSecretKey ? 'text' : 'password'}
                              value={secretKey || ''}
                              readOnly
                              className="font-mono text-[10px] sm:text-xs h-9 sm:h-10"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setShowSecretKey(!showSecretKey)}
                              className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
                            >
                              {showSecretKey ? <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={handleCopyKey}
                              className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
                            >
                              {copied ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500" /> : <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                            </Button>
                          </div>
                          <p className="text-[10px] sm:text-xs text-destructive">
                            Keep this key safe! It's the only way to access your account.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Log Out */}
                    <Button variant="outline" onClick={handleLogout} className="w-full h-9 sm:h-10 text-xs sm:text-sm">
                      <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
                      Log Out
                    </Button>

                    {/* Danger Zone */}
                    <div className="border-t border-destructive/20 pt-3 sm:pt-4 mt-4 sm:mt-6">
                      <h4 className="text-xs sm:text-sm font-semibold text-destructive mb-1.5 sm:mb-2">Danger Zone</h4>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mb-2 sm:mb-3">
                        Deleting your account will permanently remove all your data.
                      </p>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="text-xs h-8 sm:h-9"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                        Delete Account
                      </Button>
                    </div>
                  </div>
                )}

                {/* Profile Section */}
                {activeTab === 'profile' && (
                  <div className="space-y-3 sm:space-y-4">
                    {/* Avatar Upload */}
                    <div className="flex items-center gap-3 sm:gap-4">
                      <Avatar className="w-14 h-14 sm:w-20 sm:h-20 cursor-pointer flex-shrink-0" onClick={() => fileInputRef.current?.click()}>
                        <AvatarImage src={user?.avatar_url || undefined} />
                        <AvatarFallback style={{ backgroundColor: bannerColor }}>
                          {user?.username?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isLoading}
                          className="text-xs h-8 sm:h-9"
                        >
                          <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                          Upload Avatar
                        </Button>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Max 5MB, JPG or PNG</p>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarUpload}
                      />
                    </div>

                    {/* Display Name */}
                    <div className="space-y-1.5 sm:space-y-2">
                      <Label htmlFor="displayName" className="text-xs sm:text-sm">Display Name</Label>
                      <Input
                        id="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="How others see you"
                        maxLength={32}
                        className="h-9 sm:h-10 text-sm"
                      />
                    </div>

                    {/* Bio */}
                    <div className="space-y-1.5 sm:space-y-2">
                      <Label htmlFor="bio" className="text-xs sm:text-sm">Bio</Label>
                      <Textarea
                        id="bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell us about yourself"
                        rows={2}
                        className="text-sm resize-none"
                      />
                    </div>

                    {/* Banner Color */}
                    <div className="space-y-1.5 sm:space-y-2">
                      <Label className="text-xs sm:text-sm">Banner Color</Label>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <input
                          type="color"
                          value={bannerColor}
                          onChange={(e) => setBannerColor(e.target.value)}
                          className="w-10 h-9 sm:w-12 sm:h-10 rounded cursor-pointer border-0 flex-shrink-0"
                        />
                        <Input
                          value={bannerColor}
                          onChange={(e) => setBannerColor(e.target.value)}
                          placeholder="#5865F2"
                          className="w-20 sm:w-28 font-mono text-xs sm:text-sm h-9 sm:h-10"
                        />
                        <div 
                          className="flex-1 h-9 sm:h-10 rounded min-w-[40px]"
                          style={{ backgroundColor: bannerColor }}
                        />
                      </div>
                    </div>

                    <Button onClick={handleSaveProfile} disabled={isLoading} className="w-full h-9 sm:h-10 text-xs sm:text-sm">
                      {isLoading && <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 animate-spin" />}
                      Save Profile
                    </Button>
                  </div>
                )}

                {/* Notifications Section */}
                {activeTab === 'notifications' && (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="space-y-2 sm:space-y-3">
                      <Label className="text-[10px] sm:text-xs font-bold uppercase text-muted-foreground">
                        Notification Settings
                      </Label>
                      
                      {/* Desktop Notifications */}
                      <div className="flex items-center justify-between py-1.5 sm:py-2 gap-3">
                        <div className="space-y-0.5 sm:space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                            <Label className="text-xs sm:text-sm">Desktop Notifications</Label>
                          </div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            {Notification.permission === 'denied' 
                              ? 'Blocked in browser'
                              : 'Show desktop alerts'}
                          </p>
                        </div>
                        <Switch
                          checked={desktopNotificationsEnabled}
                          disabled={Notification.permission === 'denied'}
                          onCheckedChange={async (checked) => {
                            if (checked && Notification.permission === 'default') {
                              const permission = await Notification.requestPermission();
                              if (permission === 'granted') {
                                setDesktopNotificationsEnabled(true);
                                toast.success('Desktop notifications enabled!');
                              } else if (permission === 'denied') {
                                toast.error('Notification permission denied. Enable in browser settings.');
                              }
                            } else {
                              setDesktopNotificationsEnabled(checked);
                            }
                          }}
                        />
                      </div>

                      {/* Notification Sound */}
                      <div className="flex items-center justify-between py-1.5 sm:py-2 border-t pt-3 sm:pt-4 gap-3">
                        <div className="space-y-0.5 sm:space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                            <Label className="text-xs sm:text-sm">Notification Sound</Label>
                          </div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            Play sound on notification
                          </p>
                        </div>
                        <Switch
                          checked={notificationSoundEnabled}
                          onCheckedChange={setNotificationSoundEnabled}
                        />
                      </div>

                      {/* Message Preview */}
                      <div className="flex items-center justify-between py-1.5 sm:py-2 border-t pt-3 sm:pt-4 gap-3">
                        <div className="space-y-0.5 sm:space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                            <Label className="text-xs sm:text-sm">Message Preview</Label>
                          </div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            Show content in notifications
                          </p>
                        </div>
                        <Switch
                          checked={showMessagePreview}
                          onCheckedChange={setShowMessagePreview}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Appearance Section */}
                {activeTab === 'appearance' && (
                  <div className="space-y-3 sm:space-y-4">
                    {/* Theme Selector */}
                    <div className="space-y-2 sm:space-y-3">
                      <Label className="text-xs sm:text-sm">Theme</Label>
                      <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        {THEMES.map((t) => {
                          const preview = THEME_PREVIEWS[t.id];
                          const isActive = theme === t.id;
                          
                          return (
                            <button
                              key={t.id}
                              onClick={() => setTheme(t.id)}
                              className={cn(
                                'group relative flex flex-col overflow-hidden rounded-lg border-2 transition-all',
                                isActive 
                                  ? 'border-primary ring-2 ring-primary/20' 
                                  : 'border-border hover:border-primary/50'
                              )}
                            >
                              {/* Theme preview */}
                              <div 
                                className="h-10 sm:h-16 w-full flex"
                                style={{ backgroundColor: preview.bg }}
                              >
                                {/* Sidebar preview */}
                                <div 
                                  className="w-1/4 h-full"
                                  style={{ backgroundColor: preview.sidebar }}
                                />
                                {/* Chat area with accent message */}
                                <div className="flex-1 p-1.5 sm:p-2 flex items-end">
                                  <div 
                                    className="h-2 sm:h-3 w-3/4 rounded-sm"
                                    style={{ backgroundColor: preview.accent }}
                                  />
                                </div>
                              </div>
                              {/* Theme info */}
                              <div className="px-2 sm:px-3 py-1.5 sm:py-2 bg-card flex items-center justify-between">
                                <div className="text-left min-w-0">
                                  <p className="text-xs sm:text-sm font-medium truncate">{t.name}</p>
                                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate hidden sm:block">{t.description}</p>
                                </div>
                                {isActive && (
                                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                    <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary-foreground" />
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Message Display Section */}
                    <div className="space-y-2 sm:space-y-3 border-t pt-3 sm:pt-4">
                      <Label className="text-[10px] sm:text-xs font-bold uppercase text-muted-foreground">
                        Message Display
                      </Label>

                      {/* Compact Mode */}
                      <div className="flex items-center justify-between py-1.5 sm:py-2 gap-3">
                        <div className="space-y-0.5 sm:space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                            <Label className="text-xs sm:text-sm">Compact Mode</Label>
                          </div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            Condensed message format
                          </p>
                        </div>
                        <Switch
                          checked={compactMode}
                          onCheckedChange={setCompactMode}
                        />
                      </div>

                      {/* Show Timestamps */}
                      <div className="flex items-center justify-between py-1.5 sm:py-2 border-t pt-3 sm:pt-4 gap-3">
                        <div className="space-y-0.5 sm:space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                            <Label className="text-xs sm:text-sm">Show Timestamps</Label>
                          </div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            Display time on messages
                          </p>
                        </div>
                        <Switch
                          checked={showTimestamps}
                          onCheckedChange={setShowTimestamps}
                        />
                      </div>

                      {/* Animate Emojis */}
                      <div className="flex items-center justify-between py-1.5 sm:py-2 border-t pt-3 sm:pt-4 gap-3">
                        <div className="space-y-0.5 sm:space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                            <Label className="text-xs sm:text-sm">Animate Emojis</Label>
                          </div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            Enable emoji animations
                          </p>
                        </div>
                        <Switch
                          checked={animateEmojis}
                          onCheckedChange={setAnimateEmojis}
                        />
                      </div>
                    </div>

                    {/* Link Previews */}
                    <div className="flex items-center justify-between py-1.5 sm:py-2 border-t pt-3 sm:pt-4 gap-3">
                      <div className="space-y-0.5 sm:space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <Link className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                          <Label className="text-xs sm:text-sm">Link Previews</Label>
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          Show link previews in messages
                        </p>
                      </div>
                      <Switch
                        checked={linkPreviewsEnabled}
                        onCheckedChange={setLinkPreviewsEnabled}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Key Confirmation */}
      <AlertDialog open={showKeyConfirm} onOpenChange={setShowKeyConfirm}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">Reveal Secret Key?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Make sure no one is looking at your screen. Your secret key is the only way to access your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="m-0">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setKeyRevealed(true);
              setShowKeyConfirm(false);
            }}>
              Reveal Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">Delete Account?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This action cannot be undone. All your data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="m-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};