import { Circle, Moon, MinusCircle, Eye } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import type { UserStatus } from '@/types';
import { useState } from 'react';

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

interface StatusSelectorProps {
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
}

export const StatusSelector = ({ children, side = 'right', align = 'start' }: StatusSelectorProps) => {
  const { user, updateUser, updateStatus } = useAuthStore();
  const [customStatus, setCustomStatus] = useState(user?.custom_status || '');
  const [isOpen, setIsOpen] = useState(false);

  const handleStatusChange = async (status: UserStatus) => {
    await updateStatus(status);
  };

  const handleCustomStatusChange = async () => {
    if (customStatus !== user?.custom_status) {
      await updateUser({ custom_status: customStatus || null });
    }
  };

  const handleClearCustomStatus = async () => {
    setCustomStatus('');
    await updateUser({ custom_status: null });
  };

  const currentStatus = statusOptions.find(s => s.value === user?.status) || statusOptions[0];

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align={align} className="w-64">
        {/* Current user info */}
        <div className="px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
              style={{ backgroundColor: user?.banner_color || '#5865F2' }}
            >
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                user?.username?.[0]?.toUpperCase() || '?'
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">
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

        {/* Custom status */}
        <div className="p-2 border-b border-border">
          <Input
            placeholder="Set a custom status..."
            value={customStatus}
            onChange={(e) => setCustomStatus(e.target.value)}
            onBlur={handleCustomStatusChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCustomStatusChange();
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="h-8 text-sm"
          />
          {user?.custom_status && (
            <button
              onClick={handleClearCustomStatus}
              className="text-xs text-muted-foreground hover:text-foreground mt-1"
            >
              Clear custom status
            </button>
          )}
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