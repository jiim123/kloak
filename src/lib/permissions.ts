/**
 * Permission system for Kloak (Discord-style custom roles only)
 * 
 * Permission Evaluation Order:
 * 1. Owner check via server.owner_id (always has all permissions)
 * 2. User-specific channel overrides (highest priority)
 * 3. Role-based channel overrides (DENY wins among multiple roles)
 * 4. Server-wide role permissions (DENY wins)
 * 5. @everyone role permissions (fallback)
 * 6. Default: deny
 */

import type { Permission, RolePermission, ChannelPermission, CustomServerRole } from '@/types';

// Re-export Permission type from types
export type { Permission } from '@/types';

/**
 * Evaluate permission using owner_id + custom roles + @everyone
 * 
 * @param permission - The permission to check
 * @param isOwner - Whether the user is the server owner (server.owner_id === user.id)
 * @param customRoles - Custom roles assigned to the member (includes @everyone implicitly via rolePermissions)
 * @param rolePermissions - Server-wide role permission overrides (includes @everyone role perms)
 * @param channelPermissions - Channel-specific permission overrides
 * @param channelId - Optional channel ID for channel-specific checks
 * @param userId - Optional user ID for user-specific overrides
 * @returns boolean - Whether the permission is allowed
 */
export const evaluatePermission = (
  permission: Permission,
  isOwner: boolean,
  customRoles?: CustomServerRole[],
  rolePermissions?: RolePermission[],
  channelPermissions?: ChannelPermission[],
  channelId?: string,
  userId?: string,
  allRoles?: CustomServerRole[]
): boolean => {
  // Owner always has all permissions
  if (isOwner) return true;

  const customRoleIds = new Set(customRoles?.map(r => r.id) ?? []);
  
  // Find @everyone role by name from the full roles array
  const everyoneRoleIds = new Set<string>();
  if (allRoles) {
    const everyoneRole = allRoles.find(r => r.name === '@everyone');
    if (everyoneRole) {
      everyoneRoleIds.add(everyoneRole.id);
    }
  }

  // Step 1: Check user-specific channel overrides (highest priority)
  if (channelId && userId && channelPermissions && channelPermissions.length > 0) {
    const userOverride = channelPermissions.find(
      cp => cp.channel_id === channelId && 
            cp.permission === permission && 
            cp.user_id === userId &&
            !cp.role_id &&
            !cp.role_name
    );

    if (userOverride) {
      return userOverride.allowed;
    }
  }

  // Step 2: Check channel-specific role overrides
  if (channelId && channelPermissions && channelPermissions.length > 0) {
    const relevantChannelPerms = channelPermissions.filter(
      cp => cp.channel_id === channelId && 
            cp.permission === permission &&
            !cp.user_id // Only role-based overrides here
    );

    if (relevantChannelPerms.length > 0) {
      // Check for custom role matches (Higher priority)
      const customRoleChannelPerms = relevantChannelPerms.filter(
        cp => cp.role_id && customRoleIds.has(cp.role_id)
      );

      if (customRoleChannelPerms.length > 0) {
        const hasDeny = customRoleChannelPerms.some(p => p.allowed === false);
        if (hasDeny) return false;

        const hasAllow = customRoleChannelPerms.some(p => p.allowed === true);
        if (hasAllow) return true;
      }

      // Check for @everyone role channel overrides (Lower priority)
      const everyoneChannelPerms = relevantChannelPerms.filter(
        cp => cp.role_id && everyoneRoleIds.has(cp.role_id)
      );
      // Also check legacy base role overrides (role_name based)
      const baseRoleChannelPerms = relevantChannelPerms.filter(
        cp => cp.role_name && !cp.role_id
      );
      
      const fallbackPerms = [...everyoneChannelPerms, ...baseRoleChannelPerms];
      if (fallbackPerms.length > 0) {
        const hasDeny = fallbackPerms.some(p => p.allowed === false);
        if (hasDeny) return false;
        const hasAllow = fallbackPerms.some(p => p.allowed === true);
        if (hasAllow) return true;
      }
    }
  }

  // Step 3: Check server-wide role permissions
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
        const hasDeny = customRolePerms.some(p => p.allowed === false);
        if (hasDeny) return false;

        const hasAllow = customRolePerms.some(p => p.allowed === true);
        if (hasAllow) return true;
      }

      // Check @everyone role permissions (fallback)
      const everyonePerms = relevantRolePerms.filter(
        rp => rp.role_id && everyoneRoleIds.has(rp.role_id)
      );
      // Also check legacy base role perms
      const baseRolePerms = relevantRolePerms.filter(
        rp => rp.role_name && !rp.role_id
      );
      
      const fallbackPerms = [...everyonePerms, ...baseRolePerms];
      if (fallbackPerms.length > 0) {
        const hasDeny = fallbackPerms.some(p => p.allowed === false);
        if (hasDeny) return false;
        const hasAllow = fallbackPerms.some(p => p.allowed === true);
        if (hasAllow) return true;
      }
    }
  }

  // Default: deny (no permission found)
  return false;
};

/**
 * Check if one member can moderate another based on role positions.
 * The member with the highest-priority (lowest position number) role wins.
 * Owner always wins.
 */
export const canModerateByRoles = (
  actorIsOwner: boolean,
  actorRoles: CustomServerRole[] | undefined,
  targetIsOwner: boolean,
  targetRoles: CustomServerRole[] | undefined
): boolean => {
  if (actorIsOwner) return !targetIsOwner; // Owner can moderate anyone except themselves (handled by caller)
  if (targetIsOwner) return false; // Nobody can moderate the owner

  const getHighestPosition = (roles?: CustomServerRole[]): number => {
    if (!roles || roles.length === 0) return Number.POSITIVE_INFINITY;
    return Math.min(...roles.map(r => r.position));
  };

  const actorPos = getHighestPosition(actorRoles);
  const targetPos = getHighestPosition(targetRoles);

  // Lower position = higher rank. Actor must have strictly higher rank.
  return actorPos < targetPos;
};

/**
 * Get all permissions for a member considering the full hierarchy
 */
export const getMemberPermissions = (
  isOwner: boolean,
  customRoles: CustomServerRole[] | undefined,
  rolePermissions: RolePermission[] | undefined,
  channelPermissions: ChannelPermission[] | undefined,
  channelId?: string,
  userId?: string,
  allRoles?: CustomServerRole[]
): Map<Permission, boolean> => {
  const permissions = new Map<Permission, boolean>();

  const allPermissions: Permission[] = [
    'manage_server', 'manage_roles', 'manage_channels', 'manage_emojis',
    'kick_members', 'ban_members', 'mute_members', 'deafen_members',
    'move_members', 'manage_nicknames', 'change_nickname',
    'manage_messages', 'pin_messages', 'send_messages', 'add_reactions',
    'view_channels', 'read_message_history', 'attach_files', 'embed_links',
    'mention_everyone', 'mention_roles', 'use_external_emojis',
    'manage_webhooks', 'manage_threads', 'create_instant_invite',
    'transfer_ownership', 'manage_invites',
    'connect', 'speak', 'use_voice_activation', 'use_application_commands',
  ];

  for (const permission of allPermissions) {
    permissions.set(
      permission,
      evaluatePermission(permission, isOwner, customRoles, rolePermissions, channelPermissions, channelId, userId, allRoles)
    );
  }

  return permissions;
};

/**
 * Get all allowed permissions for a member
 */
export const getAllowedPermissions = (
  isOwner: boolean,
  customRoles?: CustomServerRole[],
  rolePermissions?: RolePermission[],
  channelPermissions?: ChannelPermission[],
  channelId?: string,
  userId?: string,
  allRoles?: CustomServerRole[]
): Permission[] => {
  const permissions = getMemberPermissions(
    isOwner, customRoles, rolePermissions, channelPermissions, channelId, userId, allRoles
  );

  const allowed: Permission[] = [];
  for (const [perm, allowedValue] of permissions.entries()) {
    if (allowedValue) allowed.push(perm);
  }

  return allowed;
};
