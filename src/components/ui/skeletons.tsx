import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Server icon skeleton
export const ServerIconSkeleton = ({ className }: { className?: string }) => (
  <Skeleton className={cn('w-12 h-12 rounded-full', className)} />
);

// Channel item skeleton
export const ChannelItemSkeleton = ({ className }: { className?: string }) => (
  <div className={cn('flex items-center gap-2 px-2 py-1.5', className)}>
    <Skeleton className="w-4 h-4 rounded" />
    <Skeleton className="h-4 flex-1 max-w-[120px]" />
  </div>
);

// Channel category skeleton
export const ChannelCategorySkeleton = () => (
  <div className="mb-4">
    <div className="flex items-center gap-1 px-2 py-1 mb-1">
      <Skeleton className="w-3 h-3 rounded" />
      <Skeleton className="h-3 w-20" />
    </div>
    <div className="space-y-0.5 ml-2">
      <ChannelItemSkeleton />
      <ChannelItemSkeleton />
      <ChannelItemSkeleton />
    </div>
  </div>
);

// Member item skeleton
export const MemberItemSkeleton = ({ className }: { className?: string }) => (
  <div className={cn('flex items-center gap-2 px-2 py-1.5', className)}>
    <Skeleton className="w-8 h-8 rounded-full" />
    <div className="flex-1">
      <Skeleton className="h-4 w-24 mb-1" />
      <Skeleton className="h-3 w-16" />
    </div>
  </div>
);

// Message skeleton
export const MessageSkeleton = ({ isGrouped = false }: { isGrouped?: boolean }) => (
  <div className={cn('flex gap-4 px-4', isGrouped ? 'py-0.5' : 'py-2 mt-4')}>
    <div className="w-10 flex-shrink-0">
      {!isGrouped && <Skeleton className="w-10 h-10 rounded-full" />}
    </div>
    <div className="flex-1 space-y-2">
      {!isGrouped && (
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      )}
      <Skeleton className="h-4 w-full max-w-[400px]" />
      <Skeleton className="h-4 w-3/4 max-w-[300px]" />
    </div>
  </div>
);

// Message list skeleton
export const MessageListSkeleton = () => (
  <div className="py-4 space-y-0">
    <MessageSkeleton />
    <MessageSkeleton isGrouped />
    <MessageSkeleton isGrouped />
    <MessageSkeleton />
    <MessageSkeleton isGrouped />
    <MessageSkeleton />
    <MessageSkeleton isGrouped />
    <MessageSkeleton isGrouped />
  </div>
);

// Server sidebar skeleton
export const ServerSidebarSkeleton = () => (
  <div className="h-full flex flex-col items-center py-3 gap-2">
    <Skeleton className="w-12 h-12 rounded-2xl" />
    <div className="w-8 h-0.5 my-1" />
    <ServerIconSkeleton />
    <ServerIconSkeleton />
    <ServerIconSkeleton />
    <div className="flex-1" />
    <Skeleton className="w-10 h-10 rounded-full" />
  </div>
);

// Channel sidebar skeleton
export const ChannelSidebarSkeleton = () => (
  <div className="h-full flex flex-col">
    <div className="h-12 px-4 flex items-center border-b border-border">
      <Skeleton className="h-5 w-32" />
    </div>
    <div className="flex-1 p-2 space-y-4">
      <ChannelCategorySkeleton />
      <ChannelCategorySkeleton />
    </div>
    <div className="h-14 px-2 flex items-center gap-2 border-t border-border">
      <Skeleton className="w-8 h-8 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-4 w-20 mb-1" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  </div>
);

// Members sidebar skeleton
export const MembersSidebarSkeleton = () => (
  <div className="h-full flex flex-col">
    <div className="px-4 py-3 border-b border-border">
      <Skeleton className="h-3 w-24" />
    </div>
    <div className="flex-1 p-2 space-y-4">
      <div>
        <Skeleton className="h-3 w-20 mb-2 ml-2" />
        <MemberItemSkeleton />
        <MemberItemSkeleton />
        <MemberItemSkeleton />
      </div>
      <div>
        <Skeleton className="h-3 w-20 mb-2 ml-2" />
        <MemberItemSkeleton />
        <MemberItemSkeleton />
      </div>
    </div>
  </div>
);

// Friend item skeleton
export const FriendItemSkeleton = () => (
  <div className="flex items-center gap-3 px-4 py-3">
    <Skeleton className="w-10 h-10 rounded-full" />
    <div className="flex-1">
      <Skeleton className="h-4 w-28 mb-1" />
      <Skeleton className="h-3 w-16" />
    </div>
    <Skeleton className="w-9 h-9 rounded-full" />
    <Skeleton className="w-9 h-9 rounded-full" />
  </div>
);

// Conversation item skeleton
export const ConversationItemSkeleton = () => (
  <div className="flex items-center gap-3 px-2 py-2">
    <Skeleton className="w-8 h-8 rounded-full" />
    <div className="flex-1">
      <Skeleton className="h-4 w-24 mb-1" />
      <Skeleton className="h-3 w-32" />
    </div>
  </div>
);

// Loading spinner component
export const LoadingSpinner = ({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };
  
  return (
    <svg
      className={cn('animate-spin text-primary', sizeClasses[size], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};
