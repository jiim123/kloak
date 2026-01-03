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
        <DialogContent className="sm:max-w-2xl max-w-[calc(100vw-2rem)] max-h-[90vh] sm:max-h-[80vh] p-0 gap-0 overflow-hidden">
          <div className="flex flex-col sm:flex-row h-[85vh] sm:h-[70vh]">
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

              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {/* Account Section */}
                {activeTab === 'account' && (
                  <div className="space-y-4">
                    {/* Username Display */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">
                        Username
                      </Label>
                      <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
                        <span className="font-medium">{user?.username}</span>
                        <span className="text-xs text-muted-foreground">(cannot be changed)</span>
                      </div>
                    </div>

                    {/* Secret Key Section */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">
                        Secret Key
                      </Label>
                      {!keyRevealed ? (
                        <Button 
                          variant="outline" 
                          onClick={() => setShowKeyConfirm(true)}
                          className="w-full"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Secret Key
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Input
                              type={showSecretKey ? 'text' : 'password'}
                              value={secretKey || ''}
                              readOnly
                              className="font-mono text-xs"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setShowSecretKey(!showSecretKey)}
                            >
                              {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={handleCopyKey}
                            >
                              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </div>
                          <p className="text-xs text-destructive">
                            Keep this key safe! It's the only way to access your account.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Log Out */}
                    <Button variant="outline" onClick={handleLogout} className="w-full">
                      <LogOut className="w-4 h-4 mr-2" />
                      Log Out
                    </Button>

                    {/* Danger Zone */}
                    <div className="border-t border-destructive/20 pt-4 mt-6">
                      <h4 className="text-sm font-semibold text-destructive mb-2">Danger Zone</h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        Deleting your account will permanently remove all your data.
                      </p>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Account
                      </Button>
                    </div>
                  </div>
                )}

                {/* Profile Section */}
                {activeTab === 'profile' && (
                  <div className="space-y-4">
                    {/* Avatar Upload */}
                    <div className="flex items-center gap-4">
                      <Avatar className="w-20 h-20 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <AvatarImage src={user?.avatar_url || undefined} />
                        <AvatarFallback style={{ backgroundColor: bannerColor }}>
                          {user?.username?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isLoading}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Avatar
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1">Max 5MB, JPG or PNG</p>
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
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Display Name</Label>
                      <Input
                        id="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="How others see you"
                        maxLength={32}
                      />
                    </div>

                    {/* Bio */}
                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell us about yourself"
                        rows={3}
                      />
                    </div>

                    {/* Banner Color */}
                    <div className="space-y-2">
                      <Label>Banner Color</Label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={bannerColor}
                          onChange={(e) => setBannerColor(e.target.value)}
                          className="w-12 h-10 rounded cursor-pointer border-0"
                        />
                        <Input
                          value={bannerColor}
                          onChange={(e) => setBannerColor(e.target.value)}
                          placeholder="#5865F2"
                          className="w-28 font-mono"
                        />
                        <div 
                          className="flex-1 h-10 rounded"
                          style={{ backgroundColor: bannerColor }}
                        />
                      </div>
                    </div>

                    <Button onClick={handleSaveProfile} disabled={isLoading} className="w-full">
                      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Save Profile
                    </Button>
                  </div>
                )}

                {/* Notifications Section */}
                {activeTab === 'notifications' && (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">
                        Notification Settings
                      </Label>
                      
                      {/* Desktop Notifications */}
                      <div className="flex items-center justify-between py-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-muted-foreground" />
                            <Label>Desktop Notifications</Label>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {Notification.permission === 'denied' 
                              ? 'Notifications are blocked in your browser settings'
                              : 'Show desktop notifications for new messages'}
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
                      <div className="flex items-center justify-between py-2 border-t pt-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Volume2 className="w-4 h-4 text-muted-foreground" />
                            <Label>Notification Sound</Label>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Play a sound when receiving notifications
                          </p>
                        </div>
                        <Switch
                          checked={notificationSoundEnabled}
                          onCheckedChange={setNotificationSoundEnabled}
                        />
                      </div>

                      {/* Message Preview */}
                      <div className="flex items-center justify-between py-2 border-t pt-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-muted-foreground" />
                            <Label>Show Message Preview</Label>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Show message content in notifications
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
                  <div className="space-y-4">
                    {/* Theme Selector */}
                    <div className="space-y-3">
                      <Label className="text-sm">Theme</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                                className="h-16 w-full flex"
                                style={{ backgroundColor: preview.bg }}
                              >
                                {/* Sidebar preview */}
                                <div 
                                  className="w-1/4 h-full"
                                  style={{ backgroundColor: preview.sidebar }}
                                />
                                {/* Chat area with accent message */}
                                <div className="flex-1 p-2 flex items-end">
                                  <div 
                                    className="h-3 w-3/4 rounded-sm"
                                    style={{ backgroundColor: preview.accent }}
                                  />
                                </div>
                              </div>
                              {/* Theme info */}
                              <div className="px-3 py-2 bg-card flex items-center justify-between">
                                <div className="text-left">
                                  <p className="text-sm font-medium">{t.name}</p>
                                  <p className="text-xs text-muted-foreground">{t.description}</p>
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
                    <div className="space-y-3 border-t pt-4">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">
                        Message Display
                      </Label>

                      {/* Compact Mode */}
                      <div className="flex items-center justify-between py-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-muted-foreground" />
                            <Label>Compact Mode</Label>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Display messages in a condensed format
                          </p>
                        </div>
                        <Switch
                          checked={compactMode}
                          onCheckedChange={setCompactMode}
                        />
                      </div>

                      {/* Show Timestamps */}
                      <div className="flex items-center justify-between py-2 border-t pt-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <Label>Show Timestamps</Label>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Display time on each message
                          </p>
                        </div>
                        <Switch
                          checked={showTimestamps}
                          onCheckedChange={setShowTimestamps}
                        />
                      </div>

                      {/* Animate Emojis */}
                      <div className="flex items-center justify-between py-2 border-t pt-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-muted-foreground" />
                            <Label>Animate Emojis</Label>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Enable animated emoji effects
                          </p>
                        </div>
                        <Switch
                          checked={animateEmojis}
                          onCheckedChange={setAnimateEmojis}
                        />
                      </div>
                    </div>

                    {/* Link Previews */}
                    <div className="flex items-center justify-between py-2 border-t pt-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Link className="w-4 h-4 text-muted-foreground" />
                          <Label>Link Previews</Label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Show previews for links in messages
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