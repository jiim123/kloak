import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Crown, ChevronDown, ChevronRight, MessageSquare, Edit3, UserX, Ban, VolumeX, Volume2, Shield, ShieldAlert, ShieldOff, Users } from 'lucide-react';
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
  hasMemberPermission
} from '@/lib/permissions';
import { useMemberPermissions } from '@/hooks/useMemberPermissions';
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
import { MembersSidebarSkeleton } from '@/components/ui/skeletons';
import type { ServerMember, ServerRole, CustomServerRole } from '@/types';

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
  const { members, currentServer, roles, isLoading, fetchRolePermissions } = useServerStore();
  const { user } = useAuthStore();
  const { openModal } = useUIStore();
  const [offlineExpanded, setOfflineExpanded] = useState(false);

  // Subscribe to realtime member updates
  useRealtimeMembers(currentServer?.id || null);

  // Load permissions when server changes
  useEffect(() => {
    if (currentServer?.id) {
      fetchRolePermissions(currentServer.id);
    }
  }, [currentServer?.id, fetchRolePermissions]);

  // Get current user's role in this server
  const currentUserMember = members.find(m => m.user_id === user?.id);
  const currentUserRole = currentUserMember?.role;
  
  // Use database-backed permission checking
  const { hasPermission: checkPermission } = useMemberPermissions();

  // Group members: roles first (only online members with roles), then online/offline (only no-role members)
  const { roleGroups, onlineNoRoleMembers, offlineNoRoleMembers } = useMemo(() => {
    const rolePositionById = new Map<string, number>();
    roles.forEach((r) => rolePositionById.set(r.id, r.position));

    const getResolvedRolePosition = (role: CustomServerRole): number => {
      const fromStore = rolePositionById.get(role.id);
      return typeof fromStore === 'number' ? fromStore : role.position;
    };

    // Sort by role hierarchy then alphabetically
    const sortMembers = (a: ServerMember, b: ServerMember) => {
      const roleOrder = { owner: 0, admin: 1, moderator: 2, member: 3 };
      const roleA = roleOrder[a.role as keyof typeof roleOrder] ?? 3;
      const roleB = roleOrder[b.role as keyof typeof roleOrder] ?? 3;
      if (roleA !== roleB) return roleA - roleB;
      
      // Sort by custom role priority: higher in list (lower position) = higher priority
      const aPriorityPos = a.roles && a.roles.length > 0
        ? Math.min(...a.roles.map(getResolvedRolePosition))
        : Number.POSITIVE_INFINITY;
      const bPriorityPos = b.roles && b.roles.length > 0
        ? Math.min(...b.roles.map(getResolvedRolePosition))
        : Number.POSITIVE_INFINITY;
      if (aPriorityPos !== bPriorityPos) return aPriorityPos - bPriorityPos;
      
      const nameA = a.nickname || a.user?.display_name || a.user?.username || '';
      const nameB = b.nickname || b.user?.display_name || b.user?.username || '';
      return nameA.localeCompare(nameB);
    };
    
    // Group ONLINE members by roles only
    const roleGroupsMap: Map<string, ServerMember[]> = new Map();
    const noRoleMembers: ServerMember[] = [];
    
    // Create groups for each role
    roles.forEach(role => {
      roleGroupsMap.set(role.id, []);
    });
    
    // Distribute members to their roles (only online members)
    members.forEach(member => {
      const memberRoles = member.roles || [];
      if (memberRoles.length > 0) {
        // Only add online members to role groups
        if (!isUserOffline(member)) {
          // Add to priority role (lowest position = top of list)
          const priorityRole = memberRoles.reduce((prev, curr) =>
            getResolvedRolePosition(curr) < getResolvedRolePosition(prev) ? curr : prev
          );
          const roleMembers = roleGroupsMap.get(priorityRole.id) || [];
          roleMembers.push(member);
          roleGroupsMap.set(priorityRole.id, roleMembers);
        }
      } else {
        noRoleMembers.push(member);
      }
    });
    
    // Sort members within each role group
    roleGroupsMap.forEach((membersList, roleId) => {
      roleGroupsMap.set(roleId, membersList.sort(sortMembers));
    });
    
    // Separate no-role members by online/offline
    const online: ServerMember[] = [];
    const offline: ServerMember[] = [];
    
    noRoleMembers.forEach(member => {
      if (isUserOffline(member)) {
        offline.push(member);
      } else {
        online.push(member);
      }
    });
    
    return {
      roleGroups: roleGroupsMap,
      onlineNoRoleMembers: online.sort(sortMembers),
      offlineNoRoleMembers: offline.sort(sortMembers),
    };
  }, [members, roles]);

  // Show skeleton while loading - AFTER all hooks
  if (isLoading) {
    return <MembersSidebarSkeleton />;
  }

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
    const priorityCustomRoleColor = useMemo(() => {
      const memberRoles = member.roles || [];
      if (memberRoles.length === 0) return null;

      const resolved = memberRoles
        .map((mr) => roles.find((r) => r.id === mr.id) ?? mr)
        .filter(Boolean) as CustomServerRole[];

      let best: CustomServerRole | null = null;
      for (const r of resolved) {
        if (!best) {
          best = r;
          continue;
        }
        const aPos = typeof r.position === 'number' ? r.position : Number.POSITIVE_INFINITY;
        const bPos = typeof best.position === 'number' ? best.position : Number.POSITIVE_INFINITY;
        if (aPos < bPos) best = r;
      }
      return best?.color ?? null;
    }, [member.roles, roles]);
    
    // Permission checks using database-backed permission system
    const canKick = checkPermission('kick_members') && canModerate(currentUserRole, member.role) && !isSelf;
    const canBan = checkPermission('ban_members') && canModerate(currentUserRole, member.role) && !isSelf;
    const canMute = checkPermission('mute_members') && canModerate(currentUserRole, member.role) && !isSelf;
    const canChangeNickname = checkPermission('manage_nicknames') && (canModerate(currentUserRole, member.role) || isSelf);
    const canTransfer = checkPermission('transfer_ownership') && !isSelf && member.role !== 'owner';
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
              memberIsOffline ? 'text-muted-foreground' : (priorityCustomRoleColor ? 'text-foreground' : roleInfo.color)
            )}
            style={!memberIsOffline && priorityCustomRoleColor ? { color: priorityCustomRoleColor } : undefined}
            >
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
        {/* Roles section - shows all members with roles (both online and offline) */}
        {roles
          .sort((a, b) => a.position - b.position)
          .map((role) => {
            const roleMembers = roleGroups.get(role.id) || [];
            if (roleMembers.length === 0) return null;
            
            return (
              <div key={role.id} className="mb-4">
                <div className="px-2 py-1 flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: role.color }}
                  />
                  <span 
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: role.color }}
                  >
                    {role.name} — {roleMembers.length}
                  </span>
                </div>
                {roleMembers.map((member) => (
                  <MemberItem key={member.id} member={member} />
                ))}
              </div>
            );
          })}

        {/* Online section - only members with no roles */}
        {onlineNoRoleMembers.length > 0 && (
          <div className="mb-4">
            <h3 className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Online — {onlineNoRoleMembers.length}
            </h3>
            {onlineNoRoleMembers.map((member) => (
              <MemberItem key={member.id} member={member} />
            ))}
          </div>
        )}

        {/* Offline section - only members with no roles */}
        {offlineNoRoleMembers.length > 0 && (
          <Collapsible open={offlineExpanded} onOpenChange={setOfflineExpanded}>
            <CollapsibleTrigger className="flex items-center gap-1 px-2 py-1 w-full hover:bg-secondary/30 rounded transition-smooth">
              {offlineExpanded ? (
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              )}
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Offline — {offlineNoRoleMembers.length}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {offlineNoRoleMembers.map((member) => (
                <MemberItem key={member.id} member={member} />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Empty state */}
        {members.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <Users className="w-10 h-10 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No members to display</p>
          </div>
        )}
      </div>
    </div>
  );
};