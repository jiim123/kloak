import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Crown, ChevronDown, ChevronRight, MessageSquare, Edit3, UserX, Ban, VolumeX, Volume2, Shield, ShieldAlert, ShieldOff, UserCog, Circle, Moon, MinusCircle } from 'lucide-react';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useRealtimeMembers } from '@/hooks/useRealtimeMembers';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { ServerMember } from '@/types';

// Status indicator component with proper icons
const StatusIndicator = ({ status, className }: { status?: string; className?: string }) => {
  switch (status) {
    case 'online':
      return <div className={cn('w-3 h-3 rounded-full bg-green-500', className)} />;
    case 'idle':
      return (
        <div className={cn('w-3 h-3 rounded-full bg-yellow-500 relative', className)}>
          <div className="absolute inset-0.5 bg-layout-members rounded-full" style={{ clipPath: 'polygon(50% 0%, 100% 0%, 100% 100%, 50% 100%)' }} />
        </div>
      );
    case 'dnd':
      return (
        <div className={cn('w-3 h-3 rounded-full bg-red-500 flex items-center justify-center', className)}>
          <div className="w-1.5 h-0.5 bg-layout-members rounded-full" />
        </div>
      );
    default:
      return <div className={cn('w-3 h-3 rounded-full bg-gray-500', className)} />;
  }
};

export const MembersSidebar = () => {
  const { members, currentServer } = useServerStore();
  const { user } = useAuthStore();
  const { openModal } = useUIStore();
  const [offlineExpanded, setOfflineExpanded] = useState(false);

  // Subscribe to realtime member updates
  useRealtimeMembers(currentServer?.id || null);

  // Get current user's role in this server
  const currentUserMember = members.find(m => m.user_id === user?.id);
  const isAdmin = currentUserMember?.role === 'owner' || currentUserMember?.role === 'admin';
  const isOwner = currentUserMember?.role === 'owner';

  const onlineMembers = members.filter(m => m.user?.status !== 'offline');
  const offlineMembers = members.filter(m => m.user?.status === 'offline');

  const getRoleColor = (role?: string) => {
    switch (role) {
      case 'owner': return 'text-yellow-400';
      case 'admin': return 'text-red-400';
      case 'moderator': return 'text-blue-400';
      default: return 'text-foreground';
    }
  };

  const handleMemberClick = (member: ServerMember) => {
    openModal('userProfile', { userId: member.user_id, user: member.user });
  };

  const handleMessage = (member: ServerMember) => {
    // Open DM with this user
    openModal('userProfile', { userId: member.user_id, user: member.user, openDM: true });
  };

  const handleChangeNickname = (member: ServerMember) => {
    openModal('changeNickname', { member });
  };

  const handleKick = (member: ServerMember) => {
    openModal('confirmAction', { 
      action: 'kick', 
      member,
      title: `Kick ${member.nickname || member.user?.username}`,
      message: `Are you sure you want to kick ${member.nickname || member.user?.username} from the server?`
    });
  };

  const handleBan = (member: ServerMember) => {
    openModal('confirmAction', { 
      action: 'ban', 
      member,
      title: `Ban ${member.nickname || member.user?.username}`,
      message: `Are you sure you want to ban ${member.nickname || member.user?.username} from the server?`
    });
  };

  const handleToggleMute = (member: ServerMember) => {
    openModal('confirmAction', { 
      action: member.is_muted ? 'unmute' : 'mute', 
      member,
      title: member.is_muted ? `Unmute ${member.nickname || member.user?.username}` : `Mute ${member.nickname || member.user?.username}`,
      message: member.is_muted 
        ? `Are you sure you want to unmute ${member.nickname || member.user?.username}?`
        : `Are you sure you want to mute ${member.nickname || member.user?.username}?`
    });
  };

  const handleTransferOwnership = (member: ServerMember) => {
    openModal('confirmAction', { 
      action: 'transferOwnership', 
      member,
      title: 'Transfer Ownership',
      message: `Are you sure you want to transfer server ownership to ${member.nickname || member.user?.username}? This action cannot be undone.`
    });
  };

  const handleChangeRole = (member: ServerMember, newRole: 'admin' | 'moderator' | 'member') => {
    openModal('confirmAction', { 
      action: 'changeRole', 
      member,
      newRole,
      title: 'Change Role',
      message: `Change ${member.nickname || member.user?.username}'s role to ${newRole}?`
    });
  };

  const MemberItem = ({ member }: { member: ServerMember }) => {
    const displayName = member.nickname || member.user?.display_name || member.user?.username || 'Unknown';
    const isOffline = member.user?.status === 'offline';
    const isSelf = member.user_id === user?.id;
    const canManage = isAdmin && !isSelf && member.role !== 'owner';
    const isServerOwner = member.role === 'owner';

    const content = (
      <div 
        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/50 cursor-pointer transition-smooth"
        onClick={() => handleMemberClick(member)}
      >
        {/* Avatar with status */}
        <div className="relative flex-shrink-0">
          <div 
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium',
              isOffline && 'opacity-50'
            )}
            style={{ backgroundColor: member.user?.banner_color || '#5865F2' }}
          >
            {member.user?.avatar_url ? (
              <img 
                src={member.user.avatar_url} 
                alt={displayName} 
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              (member.user?.username?.[0] || '?').toUpperCase()
            )}
          </div>
          <StatusIndicator 
            status={member.user?.status} 
            className="absolute -bottom-0.5 -right-0.5 border-2 border-layout-members" 
          />
        </div>

        {/* Name and status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            {isServerOwner && (
              <Crown className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
            )}
            <span className={cn(
              'text-sm truncate font-medium',
              isOffline ? 'text-muted-foreground' : getRoleColor(member.role)
            )}>
              {displayName}
            </span>
          </div>
          {member.user?.custom_status && (
            <p className="text-xs text-muted-foreground truncate">
              {member.user.custom_status}
            </p>
          )}
        </div>
      </div>
    );

    // Only show context menu for admin users managing other members
    if (!canManage) {
      return content;
    }

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {content}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={() => handleMessage(member)}>
            <MessageSquare className="w-4 h-4 mr-2" />
            Message
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleChangeNickname(member)}>
            <Edit3 className="w-4 h-4 mr-2" />
            Change Nickname
          </ContextMenuItem>
          
          <ContextMenuSeparator />
          
          <ContextMenuItem 
            onClick={() => handleKick(member)}
            className="text-orange-400 focus:text-orange-400"
          >
            <UserX className="w-4 h-4 mr-2" />
            Kick {displayName}
          </ContextMenuItem>
          <ContextMenuItem 
            onClick={() => handleBan(member)}
            className="text-destructive focus:text-destructive"
          >
            <Ban className="w-4 h-4 mr-2" />
            Ban {displayName}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleToggleMute(member)}>
            {member.is_muted ? (
              <>
                <Volume2 className="w-4 h-4 mr-2" />
                Unmute
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 mr-2" />
                Mute
              </>
            )}
          </ContextMenuItem>

          {isOwner && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem 
                onClick={() => handleTransferOwnership(member)}
                className="text-yellow-400 focus:text-yellow-400"
              >
                <Crown className="w-4 h-4 mr-2" />
                Transfer Ownership
              </ContextMenuItem>
            </>
          )}

          <ContextMenuSeparator />
          
          {member.role !== 'admin' && (
            <ContextMenuItem onClick={() => handleChangeRole(member, 'admin')}>
              <ShieldAlert className="w-4 h-4 mr-2 text-red-400" />
              Make Admin
            </ContextMenuItem>
          )}
          {member.role !== 'moderator' && (
            <ContextMenuItem onClick={() => handleChangeRole(member, 'moderator')}>
              <Shield className="w-4 h-4 mr-2 text-blue-400" />
              Make Moderator
            </ContextMenuItem>
          )}
          {member.role !== 'member' && (
            <ContextMenuItem onClick={() => handleChangeRole(member, 'member')}>
              <ShieldOff className="w-4 h-4 mr-2" />
              Remove Role
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const totalCount = members.length;

  return (
    <div className="h-full flex flex-col bg-layout-members border-l border-border w-60">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Members — {totalCount}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {/* Online section */}
        {onlineMembers.length > 0 && (
          <div className="mb-4">
            <h3 className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Online — {onlineMembers.length}
            </h3>
            {onlineMembers.map((member) => (
              <MemberItem key={member.id} member={member} />
            ))}
          </div>
        )}

        {/* Offline section - collapsible */}
        {offlineMembers.length > 0 && (
          <Collapsible open={offlineExpanded} onOpenChange={setOfflineExpanded}>
            <CollapsibleTrigger className="flex items-center gap-1 px-2 py-1 w-full hover:bg-secondary/30 rounded transition-smooth">
              {offlineExpanded ? (
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              )}
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Offline — {offlineMembers.length}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {offlineMembers.map((member) => (
                <MemberItem key={member.id} member={member} />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Empty state */}
        {members.length === 0 && (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            No members
          </div>
        )}
      </div>
    </div>
  );
};