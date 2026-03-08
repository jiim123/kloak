import { Circle, Moon, MinusCircle, Eye, Smile, X, Clock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { AvatarWithDecoration } from '@/components/ui/avatar-with-decoration';
import type { UserStatus } from '@/types';
import { useState, useEffect, useRef } from 'react';

interface StatusOption {
  value: UserStatus;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const statusOptions: StatusOption[] = [
  {
    value: 'online',
    label: 'Online',
    icon: <Circle className="w-3 h-3 fill-current" />,
    color: 'text-green-500',
    description: 'You are available',
  },
  {
    value: 'idle',
    label: 'Idle',
    icon: <Moon className="w-3 h-3 fill-current" />,
    color: 'text-yellow-500',
    description: 'You may be away',
  },
  {
    value: 'dnd',
    label: 'Do Not Disturb',
    icon: <MinusCircle className="w-3 h-3" />,
    color: 'text-red-500',
    description: 'You will not receive notifications',
  },
  {
    value: 'offline',
    label: 'Invisible',
    icon: <Eye className="w-3 h-3" />,
    color: 'text-gray-500',
    description: 'You will appear offline',
  },
];

const COMMON_EMOJIS = ['😊', '😄', '🎮', '💻', '🎵', '☕', '🔥', '✨', '💤', '🏠', '📚', '🎯'];

const CUSTOM_STATUS_MAX_LENGTH = 20;

const CLEAR_AFTER_OPTIONS = [
  { value: 'never', label: "Don't clear" },
  { value: '30m', label: '30 minutes', ms: 30 * 60 * 1000 },
  { value: '1h', label: '1 hour', ms: 60 * 60 * 1000 },
  { value: '4h', label: '4 hours', ms: 4 * 60 * 60 * 1000 },
  { value: 'today', label: 'Today', ms: null }, // Will be calculated
  { value: '1d', label: '24 hours', ms: 24 * 60 * 60 * 1000 },
];

interface StatusSelectorProps {
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
}

export const StatusSelector = ({ children, side = 'right', align = 'start' }: StatusSelectorProps) => {
  const { user, updateUser, updateStatus } = useAuthStore();
  const [customStatusText, setCustomStatusText] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('');
  const [clearAfter, setClearAfter] = useState('never');
  const [isOpen, setIsOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const clearTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Parse existing custom status (emoji prefix + text)
  useEffect(() => {
    if (user?.custom_status) {
      // Check if starts with an emoji (simple check for common emoji pattern)
      const emojiMatch = user.custom_status.match(/^(\p{Emoji})\s*/u);
      if (emojiMatch) {
        setSelectedEmoji(emojiMatch[1]);
        setCustomStatusText(user.custom_status.slice(emojiMatch[0].length));
      } else {
        setSelectedEmoji('');
        setCustomStatusText(user.custom_status);
      }
    } else {
      setSelectedEmoji('');
      setCustomStatusText('');
    }
  }, [user?.custom_status]);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
      }
    };
  }, []);

  const handleStatusChange = async (status: UserStatus) => {
    await updateStatus(status, { source: 'manual' });
  };

  const handleSaveCustomStatus = async () => {
    const fullStatus = selectedEmoji 
      ? `${selectedEmoji} ${customStatusText}`.trim()
      : customStatusText.trim();
    
    await updateUser({ custom_status: fullStatus || null });
    
    // Set up clear timer if needed
    if (clearAfter !== 'never' && fullStatus) {
      const option = CLEAR_AFTER_OPTIONS.find(o => o.value === clearAfter);
      if (option) {
        let timeout: number;
        
        if (clearAfter === 'today') {
          // Calculate time until end of day
          const now = new Date();
          const endOfDay = new Date(now);
          endOfDay.setHours(23, 59, 59, 999);
          timeout = endOfDay.getTime() - now.getTime();
        } else {
          timeout = option.ms!;
        }
        
        // Clear any existing timeout
        if (clearTimeoutRef.current) {
          clearTimeout(clearTimeoutRef.current);
        }
        
        clearTimeoutRef.current = setTimeout(async () => {
          await updateUser({ custom_status: null });
          setCustomStatusText('');
          setSelectedEmoji('');
          setClearAfter('never');
        }, timeout);
      }
    }
    
    setIsOpen(false);
  };

  const handleClearCustomStatus = async () => {
    // Clear local state first
    setCustomStatusText('');
    setSelectedEmoji('');
    setClearAfter('never');
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
    }
    // Persist to database - pass null directly
    await updateUser({ custom_status: null });
  };

  const handleEmojiSelect = (emoji: string) => {
    setSelectedEmoji(emoji);
    setShowEmojiPicker(false);
  };

  const currentStatus = statusOptions.find(s => s.value === user?.status) || statusOptions[0];

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align={align} className="w-72">
        {/* Current user info */}
        <div className="px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <AvatarWithDecoration user={user} className="w-10 h-10" active={false} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">
                {user?.display_name || user?.username}
              </p>
              <div className="flex items-center gap-1">
                <span className={cn('flex items-center gap-1 text-xs', currentStatus.color)}>
                  {currentStatus.icon}
                  {currentStatus.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Custom status section */}
        <div className="p-3 border-b border-border space-y-3">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Set Custom Status
          </div>
          
          {/* Emoji + Text input */}
          <div className="flex items-center gap-2">
            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-9 w-9 flex-shrink-0"
                >
                  {selectedEmoji || <Smile className="w-4 h-4 text-muted-foreground" />}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" side="bottom" align="start">
                <div className="grid grid-cols-6 gap-1">
                  {COMMON_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleEmojiSelect(emoji)}
                      className={cn(
                        'w-8 h-8 text-lg hover:bg-secondary rounded transition-colors',
                        selectedEmoji === emoji && 'bg-secondary'
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                {selectedEmoji && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full mt-2 text-xs"
                    onClick={() => {
                      setSelectedEmoji('');
                      setShowEmojiPicker(false);
                    }}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Remove emoji
                  </Button>
                )}
              </PopoverContent>
            </Popover>
            
            <Input
              placeholder="What's on your mind?"
              value={customStatusText}
              onChange={(e) => setCustomStatusText(e.target.value)}
              className="h-9 text-sm flex-1"
              maxLength={CUSTOM_STATUS_MAX_LENGTH}
            />
          </div>
          
          {/* Clear after dropdown */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Clear after:</span>
            <Select value={clearAfter} onValueChange={setClearAfter}>
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLEAR_AFTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-xs">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button 
              variant="secondary" 
              size="sm" 
              className="flex-1"
              onClick={handleClearCustomStatus}
              disabled={!user?.custom_status && !customStatusText && !selectedEmoji}
            >
              Clear
            </Button>
            <Button 
              size="sm" 
              className="flex-1"
              onClick={handleSaveCustomStatus}
            >
              Save
            </Button>
          </div>
        </div>

        {/* Status options */}
        <div className="py-1">
          {statusOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleStatusChange(option.value)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 cursor-pointer',
                user?.status === option.value && 'bg-secondary'
              )}
            >
              <span className={cn('flex-shrink-0', option.color)}>
                {option.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{option.label}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
              {user?.status === option.value && (
                <span className="w-2 h-2 rounded-full bg-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
