/**
 * Role hierarchy and permission system for Kloak
 * 
 * Role Hierarchy (highest to lowest):
 * 1. Owner - Full control, can delete server, transfer ownership
 * 2. Admin - All permissions except delete server and manage admins
 * 3. Moderator - Kick, mute, delete messages, manage channels
 * 4. Member - Read, send messages, add reactions
 * 
 * Permission System:
 * - Base role permissions (from server_role enum)
 * - Custom role permissions (from server_roles table)
 * - Channel-specific permission overrides (allow/deny)
 * - When checking permissions, all roles are combined and channel overrides are applied
 */

import type { ServerRole, Permission, RolePermission, ChannelPermission, CustomServerRole } from '@/types';

// Role hierarchy - higher number = more power
export const ROLE_HIERARCHY: Record<ServerRole, number> = {
  owner: 4,
  admin: 3,
  moderator: 2,
  member: 1,
};

// Re-export Permission type from types
export type { Permission } from '@/types';

// Role permissions
const ROLE_PERMISSIONS: Record<ServerRole, Permission[]> = {
  owner: [
    'manage_server',
    'manage_roles',
    'manage_channels',
    'kick_members',
    'ban_members',
    'mute_members',
    'manage_nicknames',
    'manage_messages',
    'pin_messages',
    'send_messages',
    'add_reactions',
    'view_channels',
    'transfer_ownership',
    'manage_invites',
  ],
  admin: [
    'manage_channels',
    'kick_members',
    'ban_members',
    'mute_members',
    'manage_nicknames',
    'manage_messages',
    'pin_messages',
    'send_messages',
    'add_reactions',
    'view_channels',
    'manage_invites',
  ],
  moderator: [
    'kick_members',
    'mute_members',
    'manage_nicknames',
    'manage_messages',
    'pin_messages',
    'send_messages',
    'add_reactions',
    'view_channels',
  ],
  member: [
    'send_messages',
    'add_reactions',
    'view_channels',
  ],
};

/**
 * Check if a role has a specific permission
 */
export const hasPermission = (role: ServerRole | undefined, permission: Permission): boolean => {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
};

/**
 * Check if one role can manage another role
 * A role can only manage roles lower in the hierarchy
 */
export const canManageRole = (actorRole: ServerRole | undefined, targetRole: ServerRole | undefined): boolean => {
  if (!actorRole || !targetRole) return false;
  return ROLE_HIERARCHY[actorRole] > ROLE_HIERARCHY[targetRole];
};

/**
 * Check if a role can be assigned to a member by the actor
 * - Owners can assign any role except owner
 * - Admins can assign moderator and member roles
 * - Others cannot assign roles
 */
export const canAssignRole = (actorRole: ServerRole | undefined, targetCurrentRole: ServerRole | undefined, newRole: ServerRole): boolean => {
  if (!actorRole || !targetCurrentRole) return false;
  
  // Can't assign owner role directly (must transfer ownership)
  if (newRole === 'owner') return false;
  
  // Can't change owner's role
  if (targetCurrentRole === 'owner') return false;
  
  // Must be able to manage the target
  if (!canManageRole(actorRole, targetCurrentRole)) return false;
  
  // Check if can assign the new role
  if (actorRole === 'owner') {
    return true; // Owner can assign any non-owner role
  }
  
  if (actorRole === 'admin') {
    return newRole === 'moderator' || newRole === 'member';
  }
  
  return false;
};

/**
 * Get display info for a role
 */
export const getRoleInfo = (role: ServerRole) => {
  switch (role) {
    case 'owner':
      return {
        label: 'Owner',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-400/10',
        description: 'Full control over the server',
      };
    case 'admin':
      return {
        label: 'Admin',
        color: 'text-red-400',
        bgColor: 'bg-red-400/10',
        description: 'Manage server settings and members',
      };
    case 'moderator':
      return {
        label: 'Moderator',
        color: 'text-blue-400',
        bgColor: 'bg-blue-400/10',
        description: 'Manage messages and moderate members',
      };
    case 'member':
      return {
        label: 'Member',
        color: 'text-foreground',
        bgColor: 'bg-secondary',
        description: 'Standard server member',
      };
  }
};

/**
 * Get available roles that an actor can assign
 */
export const getAssignableRoles = (actorRole: ServerRole | undefined): ServerRole[] => {
  if (!actorRole) return [];
  
  if (actorRole === 'owner') {
    return ['admin', 'moderator', 'member'];
  }
  
  if (actorRole === 'admin') {
    return ['moderator', 'member'];
  }
  
  return [];
};

/**
 * Check if a member can be kicked/banned by the actor
 */
export const canModerate = (actorRole: ServerRole | undefined, targetRole: ServerRole | undefined): boolean => {
  if (!actorRole || !targetRole) return false;
  
  // Can't moderate self
  // Can't moderate equal or higher roles
  return canManageRole(actorRole, targetRole);
};

/**
 * Check if actor can delete server
 */
export const canDeleteServer = (role: ServerRole | undefined): boolean => {
  return role === 'owner';
};

/**
 * Check if actor can transfer ownership
 */
export const canTransferOwnership = (role: ServerRole | undefined): boolean => {
  return role === 'owner';
};

// ============================================
// Database-backed Permission System
// ============================================

/**
 * Get base permissions for a role (from default role permissions)
 */
export const getBaseRolePermissions = (role: ServerRole | undefined): Permission[] => {
  if (!role) return [];
  return ROLE_PERMISSIONS[role] ?? [];
};

/**
 * Check if a role has a permission based on base permissions
 * (for backward compatibility)
 */
export const hasBasePermission = (role: ServerRole | undefined, permission: Permission): boolean => {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
};

/**
 * Get all permissions for a member considering:
 * - Base role permissions
 * - Custom role permissions from database
 * - Channel-specific overrides (if channel_id provided)
 */
export const getMemberPermissions = (
  baseRole: ServerRole | undefined,
  customRoles: CustomServerRole[] | undefined,
  rolePermissions: RolePermission[] | undefined,
  channelPermissions: ChannelPermission[] | undefined,
  channelId?: string
): Map<Permission, boolean> => {
  const permissions = new Map<Permission, boolean>();
  
  // If user has custom roles, they ONLY get permissions from those custom roles
  // Base role permissions are NOT inherited when custom roles are present
  const hasCustomRoles = customRoles && customRoles.length > 0;
  
  if (hasCustomRoles && rolePermissions) {
    // User has custom roles - start with NO permissions (except view_channels which is always allowed)
    permissions.set('view_channels', true);
    
    const customRoleIds = new Set(customRoles.map(cr => cr.id));
    
    // Collect all permissions from custom roles
    // Deny takes precedence over allow when multiple roles conflict
    const customPerms = new Map<Permission, boolean>();
    for (const rolePerm of rolePermissions) {
      // Check if this permission applies to the member's custom roles
      if (rolePerm.role_id && customRoleIds.has(rolePerm.role_id)) {
        const existing = customPerms.get(rolePerm.permission);
        // Deny always wins
        if (rolePerm.allowed === false) {
          customPerms.set(rolePerm.permission, false);
        } else if (rolePerm.allowed === true) {
          // Only set to true if not already denied
          if (existing !== false) {
            customPerms.set(rolePerm.permission, true);
          }
        }
      }
    }
    
    // Apply custom role permissions
    for (const [perm, allowed] of customPerms.entries()) {
      permissions.set(perm, allowed);
    }
  } else {
    // No custom roles - use base role permissions
    if (baseRole) {
      const basePerms = getBaseRolePermissions(baseRole);
      for (const perm of basePerms) {
        permissions.set(perm, true);
      }
    }
  }
  
  // Apply channel-specific overrides (if channel_id provided)
  // Channel overrides take highest precedence
  if (channelId && channelPermissions) {
    const customRoleIds = customRoles ? new Set(customRoles.map(cr => cr.id)) : new Set<string>();
    
    for (const channelPerm of channelPermissions) {
      if (channelPerm.channel_id !== channelId) continue;
      
      // Check if this permission applies to the member's roles
      const appliesToMember = 
        (channelPerm.role_name === baseRole) ||
        (channelPerm.role_id && customRoleIds.has(channelPerm.role_id));
      
      if (appliesToMember) {
        // Channel overrides always take precedence
        permissions.set(channelPerm.permission, channelPerm.allowed);
      }
    }
  }
  
  return permissions;
};

/**
 * Check if a member has a specific permission
 * Supports database-backed permissions and channel overrides
 */
export const hasMemberPermission = (
  baseRole: ServerRole | undefined,
  permission: Permission,
  customRoles?: CustomServerRole[],
  rolePermissions?: RolePermission[],
  channelPermissions?: ChannelPermission[],
  channelId?: string
): boolean => {
  const permissions = getMemberPermissions(
    baseRole,
    customRoles,
    rolePermissions,
    channelPermissions,
    channelId
  );
  
  return permissions.get(permission) ?? false;
};

/**
 * Check if a member can perform an action in a channel
 * This is a convenience wrapper around hasMemberPermission
 */
export const canPerformInChannel = (
  baseRole: ServerRole | undefined,
  permission: Permission,
  channelId: string,
  customRoles?: CustomServerRole[],
  rolePermissions?: RolePermission[],
  channelPermissions?: ChannelPermission[]
): boolean => {
  return hasMemberPermission(
    baseRole,
    permission,
    customRoles,
    rolePermissions,
    channelPermissions,
    channelId
  );
};

/**
 * Get all allowed permissions for a member
 */
export const getAllowedPermissions = (
  baseRole: ServerRole | undefined,
  customRoles?: CustomServerRole[],
  rolePermissions?: RolePermission[],
  channelPermissions?: ChannelPermission[],
  channelId?: string
): Permission[] => {
  const permissions = getMemberPermissions(
    baseRole,
    customRoles,
    rolePermissions,
    channelPermissions,
    channelId
  );
  
  const allowed: Permission[] = [];
  for (const [perm, allowedValue] of permissions.entries()) {
    if (allowedValue) {
      allowed.push(perm);
    }
  }
  
  return allowed;
};