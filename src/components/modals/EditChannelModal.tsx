import { useState, useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter 
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Hash, Trash2, FolderOpen, Settings, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { ChannelPermissionsEditor } from './ChannelPermissionsEditor';
import type { Channel } from '@/types';

const SLOWMODE_OPTIONS = [
  { value: '0', label: 'Off' },
  { value: '5', label: '5 seconds' },
  { value: '10', label: '10 seconds' },
  { value: '30', label: '30 seconds' },
  { value: '60', label: '1 minute' },
  { value: '300', label: '5 minutes' },
  { value: '900', label: '15 minutes' },
  { value: '3600', label: '1 hour' },
];

export const EditChannelModal = () => {
  const { activeModal, modalData, closeModal } = useUIStore();
  const { channels, categories, currentServer, updateChannel, deleteChannel, updateCategory, deleteCategory, fetchChannelPermissions } = useServerStore();
  const { user } = useAuthStore();
  
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [isNsfw, setIsNsfw] = useState(false);
  const [slowmodeSeconds, setSlowmodeSeconds] = useState('0');
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const isOpen = activeModal === 'edit-channel';
  const channelId = modalData?.channelId as string | undefined;
  const categoryId = modalData?.categoryId as string | undefined;
  const isCategory = modalData?.isCategory === true;
  const showDeleteImmediately = modalData?.showDelete === true;
  
  const channel = channels.find(c => c.id === channelId);
  const category = categories.find(c => c.id === categoryId);

  // Determine what we're editing
  const hasValidTarget = isCategory ? !!category : !!channel;
  const targetName = isCategory ? category?.name : channel?.name;

  useEffect(() => {
    if (isCategory && category) {
      setName(category.name);
      setTopic('');
      setIsNsfw(false);
      setSlowmodeSeconds('0');
      setIsReadOnly(false);
    } else if (channel) {
      setName(channel.name);
      setTopic(channel.topic || '');
      setIsNsfw(channel.is_nsfw);
      setSlowmodeSeconds(String(channel.slowmode_seconds));
      setIsReadOnly(channel.is_read_only || false);
      
      // Fetch channel permissions when modal opens for a channel
      if (channel.id) {
        fetchChannelPermissions(channel.id).catch((error) => {
          console.error('Failed to fetch channel permissions:', error);
        });
      }
    }
    
    // If showDelete flag is set, immediately show delete confirmation
    if (showDeleteImmediately && hasValidTarget) {
      setShowDeleteConfirm(true);
    }
  }, [channel, category, isCategory, showDeleteImmediately, hasValidTarget, fetchChannelPermissions]);

  const handleClose = () => {
    setError('');
    setShowDeleteConfirm(false);
    closeModal();
  };

  const formatChannelName = (value: string) => {
    return value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  };

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault();
    
    if (!name.trim()) {
      setError(isCategory ? 'Category name is required' : 'Channel name is required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      if (!user) throw new Error('Not authenticated');
      
      if (isCategory && categoryId) {
        await updateCategory(categoryId, {
          name: name.trim(),
        }, user.id);
        toast.success('Category updated');
      } else if (channelId) {
        const updates: Partial<Channel> = {
          name: formatChannelName(name.trim()),
          is_nsfw: isNsfw,
          slowmode_seconds: parseInt(slowmodeSeconds, 10) || 0,
          is_read_only: isReadOnly,
        };
        
        // Only include topic if it's provided (even if empty/null)
        const trimmedTopic = topic.trim();
        updates.topic = trimmedTopic || null;
        
        await updateChannel(channelId, updates, user.id);
        toast.success('Channel updated');
      }
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to update ${isCategory ? 'category' : 'channel'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      if (!user) throw new Error('Not authenticated');
      
      if (isCategory && categoryId) {
        await deleteCategory(categoryId, user.id);
        toast.success('Category deleted');
      } else if (channelId) {
        await deleteChannel(channelId, user.id);
        toast.success('Channel deleted');
      }
      setShowDeleteConfirm(false);
      handleClose();
    } catch (err) {
      toast.error(`Failed to delete ${isCategory ? 'category' : 'channel'}`);
    }
  };

  // Single return statement - conditionally render content
  return (
    <>
      <Dialog open={isOpen && hasValidTarget} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className={isCategory ? "sm:max-w-md" : "sm:max-w-5xl max-w-[calc(100vw-2rem)] max-h-[90vh] sm:max-h-[85vh] p-0 flex flex-col"}>
          {isCategory && category ? (
            // Category editing content
            <>
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
                <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <FolderOpen className="h-5 w-5" />
                  Edit Category
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Modify category settings for {category.name}
                </DialogDescription>
              </DialogHeader>

              <div className="px-6 py-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="category-name">Category Name</Label>
                    <Input
                      id="category-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Category name"
                      maxLength={50}
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}

                  <div className="border border-destructive/50 rounded-lg p-4 space-y-3">
                    <div className="space-y-1">
                      <Label className="text-destructive">Danger Zone</Label>
                      <p className="text-xs text-muted-foreground">
                        Deleting a category will move all its channels to uncategorized.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Category
                    </Button>
                  </div>

                  <DialogFooter className="mt-6">
                    <Button type="button" variant="ghost" onClick={handleClose}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting || !name.trim()}>
                      {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </DialogFooter>
                </form>
              </div>
            </>
          ) : channel ? (
            // Channel editing content
            <>
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
                <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Hash className="h-5 w-5" />
                  Edit Channel
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Modify channel settings for #{channel.name}
                </DialogDescription>
              </DialogHeader>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex overflow-hidden">
                <TabsList className="flex flex-col items-start justify-start h-full w-48 sm:w-56 border-r border-border bg-secondary/30 p-2 gap-1 rounded-none inline-flex">
                  <TabsTrigger 
                    value="overview" 
                    className="w-full justify-start gap-2 text-xs sm:text-sm px-3 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <Hash className="w-4 h-4" />
                    <span>Overview</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="settings" 
                    className="w-full justify-start gap-2 text-xs sm:text-sm px-3 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="permissions" 
                    className="w-full justify-start gap-2 text-xs sm:text-sm px-3 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <Shield className="w-4 h-4" />
                    <span>Permissions</span>
                  </TabsTrigger>
                </TabsList>
                
                <div className="flex-1 overflow-y-auto">

                  {/* Overview Tab */}
                  <TabsContent value="overview" className="m-0 p-6">
                    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="channel-name">Channel Name</Label>
                        <div className="relative">
                          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="channel-name"
                            value={name}
                            onChange={(e) => setName(formatChannelName(e.target.value))}
                            placeholder="channel-name"
                            className="pl-9"
                            maxLength={50}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="channel-topic">
                          Channel Topic
                          <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                        </Label>
                        <Textarea
                          id="channel-topic"
                          value={topic}
                          onChange={(e) => setTopic(e.target.value)}
                          placeholder="Let everyone know what this channel is for..."
                          maxLength={1024}
                          rows={3}
                        />
                        <p className="text-xs text-muted-foreground text-right">
                          {topic.length}/1024
                        </p>
                      </div>

                      {error && (
                        <p className="text-sm text-destructive">{error}</p>
                      )}

                      <DialogFooter className="mt-6">
                        <Button type="button" variant="ghost" onClick={handleClose}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting || !name.trim()}>
                          {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </TabsContent>

                  {/* Settings Tab */}
                  <TabsContent value="settings" className="m-0 p-6">
                    <div className="space-y-4 sm:space-y-5">
                      <div className="space-y-2">
                        <Label>Slowmode</Label>
                        <Select value={slowmodeSeconds} onValueChange={setSlowmodeSeconds}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SLOWMODE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Members will only be able to send one message per this time period
                        </p>
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <Label>Read-Only Channel</Label>
                          <p className="text-xs text-muted-foreground">
                            Only admins and moderators can send messages
                          </p>
                        </div>
                        <Switch
                          checked={isReadOnly}
                          onCheckedChange={setIsReadOnly}
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <Label>Age-Restricted Channel</Label>
                          <p className="text-xs text-muted-foreground">
                            Mark this channel as NSFW
                          </p>
                        </div>
                        <Switch
                          checked={isNsfw}
                          onCheckedChange={setIsNsfw}
                        />
                      </div>

                      <div className="border border-destructive/50 rounded-lg p-4 space-y-3">
                        <div className="space-y-1">
                          <Label className="text-destructive">Danger Zone</Label>
                          <p className="text-xs text-muted-foreground">
                            Deleting a channel is irreversible. All messages will be permanently lost.
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setShowDeleteConfirm(true)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Channel
                        </Button>
                      </div>

                      <DialogFooter className="mt-6">
                        <Button type="button" variant="ghost" onClick={handleClose}>
                          Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting || !name.trim()}>
                          {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </Button>
                      </DialogFooter>
                    </div>
                  </TabsContent>

                  {/* Permissions Tab */}
                  <TabsContent value="permissions" className="m-0 p-6">
                    {channelId && currentServer ? (
                      <ChannelPermissionsEditor
                        channelId={channelId}
                        serverId={currentServer.id}
                        onClose={handleClose}
                      />
                    ) : (
                      <div className="flex items-center justify-center p-8 text-muted-foreground">
                        Loading permissions...
                      </div>
                    )}
                  </TabsContent>
                </div>
              </Tabs>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {isCategory ? 'Category' : 'Channel'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{isCategory ? targetName : `#${targetName}`}</strong>? 
              {isCategory 
                ? ' All channels in this category will be moved to uncategorized.'
                : ' This action cannot be undone and all messages in this channel will be permanently deleted.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete {isCategory ? 'Category' : 'Channel'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
