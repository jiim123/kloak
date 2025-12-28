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
  Link
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  light: { bg: '#ffffff', sidebar: '#fafafa', accent: '#ea580c' },
  dark: { bg: '#171717', sidebar: '#0a0a0a', accent: '#f97316' },
  midnight: { bg: '#1a1f36', sidebar: '#0f1321', accent: '#f97316' },
  forest: { bg: '#1f2a24', sidebar: '#141a16', accent: '#f97316' },
  sunset: { bg: '#2a2320', sidebar: '#1a1512', accent: '#f97316' },
  ocean: { bg: '#1f2a2e', sidebar: '#141c1f', accent: '#f97316' },
  lavender: { bg: '#28232e', sidebar: '#1a161f', accent: '#f97316' },
  'high-contrast': { bg: '#000000', sidebar: '#0d0d0d', accent: '#facc15' },
  protanopia: { bg: '#1a1d24', sidebar: '#12141a', accent: '#3b82f6' },
  deuteranopia: { bg: '#1a1a24', sidebar: '#121218', accent: '#7c3aed' },
  tritanopia: { bg: '#1c1a1a', sidebar: '#141212', accent: '#14b8a6' },
  monochromacy: { bg: '#141414', sidebar: '#0a0a0a', accent: '#e5e5e5' },
  'low-vision': { bg: '#1a1611', sidebar: '#100e0a', accent: '#eab308' },
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

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>User Settings</DialogTitle>
            <DialogDescription>
              Manage your account and preferences
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="account" className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                Account
              </TabsTrigger>
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="appearance" className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Appearance
              </TabsTrigger>
            </TabsList>

            {/* Account Tab */}
            <TabsContent value="account" className="space-y-4 mt-4">
              {/* Username Display */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">
                  Username
                </Label>
                <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
                  <span className="font-medium">{user.username}</span>
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
            </TabsContent>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-4 mt-4">
              {/* Avatar Upload */}
              <div className="flex items-center gap-4">
                <Avatar className="w-20 h-20 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback style={{ backgroundColor: bannerColor }}>
                    {user.username[0].toUpperCase()}
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
            </TabsContent>

            {/* Appearance Tab */}
            <TabsContent value="appearance" className="space-y-4 mt-4 overflow-y-auto max-h-[50vh]">
              {/* Theme Selector */}
              <div className="space-y-3">
                <Label>Theme</Label>
                <div className="grid grid-cols-2 gap-3">
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

              {/* Link Previews Toggle */}
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
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* View Key Confirmation */}
      <AlertDialog open={showKeyConfirm} onOpenChange={setShowKeyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reveal Secret Key?</AlertDialogTitle>
            <AlertDialogDescription>
              Make sure no one is looking at your screen. Your secret key is the only way to access your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All your data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
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