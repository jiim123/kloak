/**
 * Role hierarchy and permission system for Kloak
 * 
 * Permission Evaluation Order (Discord-accurate):
 * 1. User-specific channel overrides (highest priority)
 * 2. Role-based channel overrides
 * 3. Server-wide role permissions
 * 4. Default base role permissions (lowest priority)
 * 
 * Conflict Resolution:
 * - Explicit channel DENY always blocks the action
 * - Explicit channel ALLOW overrides role denies
 * - Among multiple roles, DENY takes precedence over ALLOW
 * 
 * Role Hierarchy (highest to lowest):
 * 1. Owner - Full control, can delete server, transfer ownership
 * 2. Admin - All permissions except delete server and manage admins
 * 3. Moderator - Kick, mute, delete messages, manage channels
 * 4. Member - Read, send messages, add reactions
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

// Default role permissions (base permissions for each role)
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
 * Check if a role has a specific permission (base check only)
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
 * Evaluate permission with full hierarchy consideration
 * 
 * Evaluation Order:
 * 1. Channel-specific overrides (role_name or role_id match)
 *    - Explicit DENY always blocks
 *    - Explicit ALLOW overrides server-level restrictions
 * 2. Server-wide role permissions (from role_permissions table)
 * 3. Default base role permissions
 * 
 * @param permission - The permission to check
 * @param baseRole - The member's base role (owner/admin/moderator/member)
 * @param customRoles - Custom roles assigned to the member
 * @param rolePermissions - Server-wide role permission overrides
 * @param channelPermissions - Channel-specific permission overrides
 * @param channelId - Optional channel ID for channel-specific checks
 * @returns boolean - Whether the permission is allowed
 */
export const evaluatePermission = (
  permission: Permission,
  baseRole: ServerRole | undefined,
  customRoles?: CustomServerRole[],
  rolePermissions?: RolePermission[],
  channelPermissions?: ChannelPermission[],
  channelId?: string
): boolean => {
  // Owner always has all permissions
  if (baseRole === 'owner') return true;

  if (!baseRole) return false;

  const customRoleIds = new Set(customRoles?.map(r => r.id) ?? []);

  // Step 1: Check channel-specific overrides (highest priority)
  if (channelId && channelPermissions && channelPermissions.length > 0) {
    const relevantChannelPerms = channelPermissions.filter(
      cp => cp.channel_id === channelId && cp.permission === permission
    );

    if (relevantChannelPerms.length > 0) {
      // Check for custom role matches (Higher priority)
      const customRoleChannelPerms = relevantChannelPerms.filter(
        cp => cp.role_id && customRoleIds.has(cp.role_id)
      );

      if (customRoleChannelPerms.length > 0) {
        // Among custom roles, DENY takes precedence
        const hasDeny = customRoleChannelPerms.some(p => p.allowed === false);
        if (hasDeny) return false;

        const hasAllow = customRoleChannelPerms.some(p => p.allowed === true);
        if (hasAllow) return true;
      }

      // Check for base role match (Lower priority)
      const baseRoleChannelPerm = relevantChannelPerms.find(
        cp => cp.role_name === baseRole && !cp.role_id
      );

      if (baseRoleChannelPerm) {
        return baseRoleChannelPerm.allowed;
      }
    }
  }

  // Step 2: Check server-wide role permissions
  if (rolePermissions && rolePermissions.length > 0) {
    const relevantRolePerms = rolePermissions.filter(
      rp => rp.permission === permission
    );

    if (relevantRolePerms.length > 0) {
      // Check for custom role matches (Higher priority)
      const customRolePerms = relevantRolePerms.filter(
        rp => rp.role_id && customRoleIds.has(rp.role_id)
      );

      if (customRolePerms.length > 0) {
        // Among custom roles, DENY takes precedence
        const hasDeny = customRolePerms.some(p => p.allowed === false);
        if (hasDeny) return false;

        const hasAllow = customRolePerms.some(p => p.allowed === true);
        if (hasAllow) return true;
      }

      // Check for base role match (Lower priority)
      const baseRolePerm = relevantRolePerms.find(
        rp => rp.role_name === baseRole && !rp.role_id
      );

      if (baseRolePerm) {
        return baseRolePerm.allowed;
      }
    }
  }

  // Step 3: Fall back to default base role permissions
  return hasBasePermission(baseRole, permission);
};

/**
 * Get all permissions for a member considering the full hierarchy
 */
export const getMemberPermissions = (
  baseRole: ServerRole | undefined,
  customRoles: CustomServerRole[] | undefined,
  rolePermissions: RolePermission[] | undefined,
  channelPermissions: ChannelPermission[] | undefined,
  channelId?: string
): Map<Permission, boolean> => {
  const permissions = new Map<Permission, boolean>();

  // All possible permissions
  const allPermissions: Permission[] = [
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
  ];

  for (const permission of allPermissions) {
    permissions.set(
      permission,
      evaluatePermission(permission, baseRole, customRoles, rolePermissions, channelPermissions, channelId)
    );
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
  return evaluatePermission(
    permission,
    baseRole,
    customRoles,
    rolePermissions,
    channelPermissions,
    channelId
  );
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
  return evaluatePermission(
    permission,
    baseRole,
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
