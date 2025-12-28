import { useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Hash, Volume2 } from 'lucide-react';
import { ChannelIconPicker } from './ChannelIconPicker';
import type { ChannelType } from '@/types';

export const CreateChannelModal = () => {
  const { activeModal, modalData, closeModal } = useUIStore();
  const { currentServer, categories, createChannel, createCategory } = useServerStore();
  
  const [mode, setMode] = useState<'channel' | 'category'>('channel');
  const [name, setName] = useState('');
  const [channelType, setChannelType] = useState<ChannelType>('text');
  const [categoryId, setCategoryId] = useState<string>('none');
  const [channelIcon, setChannelIcon] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isOpen = activeModal === 'create-channel';
  const presetCategoryId = modalData?.categoryId as string | undefined;

  const handleClose = () => {
    setName('');
    setChannelType('text');
    setCategoryId(presetCategoryId || 'none');
    setChannelIcon(null);
    setError('');
    setMode('channel');
    closeModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!currentServer) return;

    setIsSubmitting(true);
    setError('');

    try {
      if (mode === 'category') {
        await createCategory(currentServer.id, name.trim());
      } else {
        const selectedCategoryId = presetCategoryId || (categoryId === 'none' ? undefined : categoryId);
        await createChannel(currentServer.id, name.trim(), channelType, selectedCategoryId, channelIcon || undefined);
      }
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatChannelName = (value: string) => {
    return value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'category' ? 'Create Category' : 'Create Channel'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'category' 
              ? 'Categories help organize your channels'
              : 'Channels are where your members communicate'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === 'channel' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('channel')}
            >
              Channel
            </Button>
            <Button
              type="button"
              variant={mode === 'category' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('category')}
            >
              Category
            </Button>
          </div>

          {mode === 'channel' && (
            <>
              {/* Channel Icon & Type Row */}
              <div className="flex gap-4">
                {/* Icon picker */}
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <ChannelIconPicker value={channelIcon} onChange={setChannelIcon} />
                </div>

                {/* Channel Type */}
                <div className="flex-1 space-y-2">
                  <Label>Channel Type</Label>
                  <RadioGroup
                    value={channelType}
                    onValueChange={(value) => setChannelType(value as ChannelType)}
                    className="gap-2"
                  >
                    <Label
                      htmlFor="text"
                      className={`flex items-center gap-3 p-3 rounded-md cursor-pointer border transition-colors ${
                        channelType === 'text' 
                          ? 'bg-accent/20 border-primary' 
                          : 'bg-secondary/50 border-border hover:bg-secondary'
                      }`}
                    >
                      <RadioGroupItem value="text" id="text" />
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">Text</span>
                    </Label>
                    <Label
                      htmlFor="voice"
                      className={`flex items-center gap-3 p-3 rounded-md cursor-pointer border transition-colors ${
                        channelType === 'voice' 
                          ? 'bg-accent/20 border-primary' 
                          : 'bg-secondary/50 border-border hover:bg-secondary'
                      }`}
                    >
                      <RadioGroupItem value="voice" id="voice" />
                      <Volume2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">Voice</span>
                    </Label>
                  </RadioGroup>
                </div>
              </div>

              {/* Category selector */}
              {!presetCategoryId && categories.length > 0 && (
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="No category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No category</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {/* Name input */}
          <div className="space-y-2">
            <Label htmlFor="name">
              {mode === 'category' ? 'Category Name' : 'Channel Name'}
            </Label>
            <div className="relative">
              {mode === 'channel' && !channelIcon && (
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              )}
              {mode === 'channel' && channelIcon && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-emoji">{channelIcon}</span>
              )}
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(
                  mode === 'channel' 
                    ? formatChannelName(e.target.value) 
                    : e.target.value
                )}
                placeholder={mode === 'category' ? 'Category name' : 'new-channel'}
                className={mode === 'channel' ? 'pl-9' : ''}
                maxLength={mode === 'category' ? 100 : 50}
              />
            </div>
            {mode === 'channel' && name && (
              <p className="text-xs text-muted-foreground">
                Preview: {channelIcon || '#'}{name}
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Creating...' : `Create ${mode === 'category' ? 'Category' : 'Channel'}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};