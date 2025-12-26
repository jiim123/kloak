import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Crown, ChevronDown, ChevronRight, MessageSquare, Edit3, UserX, Ban, VolumeX, Volume2, Shield, ShieldAlert, ShieldOff } from 'lucide-react';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useRealtimeMembers } from '@/hooks/useRealtimeMembers';
import { 
  hasPermission, 
  canModerate, 
  canAssignRole, 
  getAssignableRoles, 
  getRoleInfo,
  canTransferOwnership 
} from '@/lib/permissions';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import type { ServerMember, ServerRole } from '@/types';

const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// Helper to determine if a user should be shown as offline based on last_seen
const isUserOffline = (member: ServerMember): boolean => {
  if (member.user?.status === 'offline') return true;
  
  if (member.user?.last_seen) {
    const lastSeen = new Date(member.user.last_seen).getTime();
    const now = Date.now();
    if (now - lastSeen > OFFLINE_THRESHOLD_MS) {
      return true;
    }
  }
  
  return false;
};

// Status indicator component
const StatusIndicator = ({ status, isStale, className }: { status?: string; isStale?: boolean; className?: string }) => {
  if (isStale) {
    return <div className={cn('w-3 h-3 rounded-full bg-gray-500', className)} />;
  }
  
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

// Role badge component
const RoleBadge = ({ role }: { role: ServerRole }) => {
  const info = getRoleInfo(role);
  
  if (role === 'member') return null;
  
  return (
    <Badge 
      variant="outline" 
      className={cn('text-[10px] px-1 py-0 h-4 font-medium border-0', info.bgColor, info.color)}
    >
      {info.label}
    </Badge>
  );
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
  const currentUserRole = currentUserMember?.role;

  // Categorize members based on presence
  const { onlineMembers, offlineMembers } = useMemo(() => {
    const online: ServerMember[] = [];
    const offline: ServerMember[] = [];
    
    members.forEach(member => {
      if (isUserOffline(member)) {
        offline.push(member);
      } else {
        online.push(member);
      }
    });
    
    // Sort by role hierarchy then alphabetically
    const sortMembers = (a: ServerMember, b: ServerMember) => {
      const roleOrder = { owner: 0, admin: 1, moderator: 2, member: 3 };
      const roleA = roleOrder[a.role as keyof typeof roleOrder] ?? 3;
      const roleB = roleOrder[b.role as keyof typeof roleOrder] ?? 3;
      if (roleA !== roleB) return roleA - roleB;
      
      const nameA = a.nickname || a.user?.display_name || a.user?.username || '';
      const nameB = b.nickname || b.user?.display_name || b.user?.username || '';
      return nameA.localeCompare(nameB);
    };
    
    return { 
      onlineMembers: online.sort(sortMembers), 
      offlineMembers: offline.sort(sortMembers) 
    };
  }, [members]);

  const handleMemberClick = (member: ServerMember) => {
    openModal('userProfile', { userId: member.user_id, user: member.user });
  };

  const handleMessage = (member: ServerMember) => {
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
      message: `Are you sure you want to ban ${member.nickname || member.user?.username} from the server? They will not be able to rejoin.`
    });
  };

  const handleToggleMute = (member: ServerMember) => {
    openModal('confirmAction', { 
      action: member.is_muted ? 'unmute' : 'mute', 
      member,
      title: member.is_muted ? `Unmute ${member.nickname || member.user?.username}` : `Mute ${member.nickname || member.user?.username}`,
      message: member.is_muted 
        ? `Are you sure you want to unmute ${member.nickname || member.user?.username}?`
        : `Are you sure you want to mute ${member.nickname || member.user?.username}? They will be able to view but not send messages.`
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

  const handleChangeRole = (member: ServerMember, newRole: ServerRole) => {
    const roleInfo = getRoleInfo(newRole);
    openModal('confirmAction', { 
      action: 'changeRole', 
      member,
      newRole,
      title: 'Change Role',
      message: `Change ${member.nickname || member.user?.username}'s role to ${roleInfo.label}?`
    });
  };

  const MemberItem = ({ member }: { member: ServerMember }) => {
    const displayName = member.nickname || member.user?.display_name || member.user?.username || 'Unknown';
    const memberIsOffline = isUserOffline(member);
    const isSelf = member.user_id === user?.id;
    const isServerOwner = member.role === 'owner';
    
    // Permission checks using the permission system
    const canKick = hasPermission(currentUserRole, 'kick_members') && canModerate(currentUserRole, member.role) && !isSelf;
    const canBan = hasPermission(currentUserRole, 'ban_members') && canModerate(currentUserRole, member.role) && !isSelf;
    const canMute = hasPermission(currentUserRole, 'mute_members') && canModerate(currentUserRole, member.role) && !isSelf;
    const canChangeNickname = hasPermission(currentUserRole, 'manage_nicknames') && (canModerate(currentUserRole, member.role) || isSelf);
    const canTransfer = canTransferOwnership(currentUserRole) && !isSelf && member.role !== 'owner';
    const assignableRoles = getAssignableRoles(currentUserRole).filter(role => 
      canAssignRole(currentUserRole, member.role, role) && role !== member.role
    );
    
    const hasAdminActions = canKick || canBan || canMute || canChangeNickname || canTransfer || assignableRoles.length > 0;

    const roleInfo = getRoleInfo(member.role);

    const content = (
      <div 
        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/50 cursor-pointer transition-smooth group"
        onClick={() => handleMemberClick(member)}
      >
        {/* Avatar with status */}
        <div className="relative flex-shrink-0">
          <div 
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium',
              memberIsOffline && 'opacity-50'
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
            isStale={memberIsOffline && member.user?.status !== 'offline'}
            className="absolute -bottom-0.5 -right-0.5 border-2 border-layout-members" 
          />
        </div>

        {/* Name and info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isServerOwner && (
              <Crown className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
            )}
            <span className={cn(
              'text-sm truncate font-medium',
              memberIsOffline ? 'text-muted-foreground' : roleInfo.color
            )}>
              {displayName}
            </span>
            {member.is_muted && (
              <VolumeX className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-1">
            {!isServerOwner && member.role !== 'member' && (
              <RoleBadge role={member.role} />
            )}
            {member.user?.custom_status && (
              <p className="text-xs text-muted-foreground truncate">
                {member.user.custom_status}
              </p>
            )}
          </div>
        </div>
      </div>
    );

    // Only show context menu if there are any actions available
    if (!hasAdminActions && isSelf) {
      return content;
    }

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {content}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          {/* Basic actions */}
          <ContextMenuItem onClick={() => handleMessage(member)}>
            <MessageSquare className="w-4 h-4 mr-2" />
            Message
          </ContextMenuItem>
          
          {canChangeNickname && (
            <ContextMenuItem onClick={() => handleChangeNickname(member)}>
              <Edit3 className="w-4 h-4 mr-2" />
              Change Nickname
            </ContextMenuItem>
          )}
          
          {/* Moderation actions */}
          {(canKick || canBan || canMute) && (
            <>
              <ContextMenuSeparator />
              
              {canMute && (
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
              )}
              
              {canKick && (
                <ContextMenuItem 
                  onClick={() => handleKick(member)}
                  className="text-orange-400 focus:text-orange-400"
                >
                  <UserX className="w-4 h-4 mr-2" />
                  Kick
                </ContextMenuItem>
              )}
              
              {canBan && (
                <ContextMenuItem 
                  onClick={() => handleBan(member)}
                  className="text-destructive focus:text-destructive"
                >
                  <Ban className="w-4 h-4 mr-2" />
                  Ban
                </ContextMenuItem>
              )}
            </>
          )}

          {/* Role management */}
          {assignableRoles.length > 0 && (
            <>
              <ContextMenuSeparator />
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <Shield className="w-4 h-4 mr-2" />
                  Change Role
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-40">
                  {assignableRoles.map(role => {
                    const info = getRoleInfo(role);
                    return (
                      <ContextMenuItem 
                        key={role}
                        onClick={() => handleChangeRole(member, role)}
                      >
                        {role === 'admin' && <ShieldAlert className={cn('w-4 h-4 mr-2', info.color)} />}
                        {role === 'moderator' && <Shield className={cn('w-4 h-4 mr-2', info.color)} />}
                        {role === 'member' && <ShieldOff className="w-4 h-4 mr-2 text-muted-foreground" />}
                        <span className={info.color}>{info.label}</span>
                      </ContextMenuItem>
                    );
                  })}
                </ContextMenuSubContent>
              </ContextMenuSub>
            </>
          )}
          
          {/* Ownership transfer */}
          {canTransfer && (
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