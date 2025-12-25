import { useState, useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
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
import { Hash, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

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
  const { channels, updateChannel, deleteChannel } = useServerStore();
  
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [isNsfw, setIsNsfw] = useState(false);
  const [slowmodeSeconds, setSlowmodeSeconds] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');

  const isOpen = activeModal === 'edit-channel';
  const channelId = modalData?.channelId as string | undefined;
  const channel = channels.find(c => c.id === channelId);

  useEffect(() => {
    if (channel) {
      setName(channel.name);
      setTopic(channel.topic || '');
      setIsNsfw(channel.is_nsfw);
      setSlowmodeSeconds(String(channel.slowmode_seconds));
    }
  }, [channel]);

  const handleClose = () => {
    setError('');
    closeModal();
  };

  const formatChannelName = (value: string) => {
    return value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Channel name is required');
      return;
    }

    if (!channelId) return;

    setIsSubmitting(true);
    setError('');

    try {
      await updateChannel(channelId, {
        name: formatChannelName(name.trim()),
        topic: topic.trim() || null,
        is_nsfw: isNsfw,
        slowmode_seconds: parseInt(slowmodeSeconds, 10),
      });
      toast.success('Channel updated');
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update channel');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!channelId) return;
    
    try {
      await deleteChannel(channelId);
      toast.success('Channel deleted');
      setShowDeleteConfirm(false);
      handleClose();
    } catch (err) {
      toast.error('Failed to delete channel');
    }
  };

  if (!channel) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Edit Channel
            </DialogTitle>
            <DialogDescription>
              Modify channel settings for #{channel.name}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="permissions">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Channel name */}
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

                {/* Channel topic */}
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

                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting || !name.trim()}>
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>

            <TabsContent value="permissions" className="space-y-4 mt-4">
              {/* Slowmode */}
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

              {/* NSFW toggle */}
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

              {/* Danger zone */}
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

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting || !name.trim()}>
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Channel</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>#{channel.name}</strong>? 
              This action cannot be undone and all messages in this channel will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Channel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
