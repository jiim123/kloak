import { WifiOff, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';

export function OfflineBanner() {
  const { isOnline } = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 py-2 px-4",
      "bg-yellow-500/90 text-yellow-950 font-medium text-sm",
      "animate-in slide-in-from-top duration-300"
    )}>
      <WifiOff className="h-4 w-4" />
      <span>You're offline. Messages will be sent when you reconnect.</span>
      <RefreshCw className="h-4 w-4 animate-spin opacity-60" />
    </div>
  );
}
