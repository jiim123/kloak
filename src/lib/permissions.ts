/**
 * Role hierarchy and permission system for Kloak
 * 
 * Role Hierarchy (highest to lowest):
 * 1. Owner - Full control, can delete server, transfer ownership
 * 2. Admin - All permissions except delete server and manage admins
 * 3. Moderator - Kick, mute, delete messages, manage channels
 * 4. Member - Read, send messages, add reactions
 */

import type { ServerRole } from '@/types';

// Role hierarchy - higher number = more power
export const ROLE_HIERARCHY: Record<ServerRole, number> = {
  owner: 4,
  admin: 3,
  moderator: 2,
  member: 1,
};

// Permission types
export type Permission = 
  | 'manage_server'      // Edit server settings, delete server
  | 'manage_roles'       // Change member roles
  | 'manage_channels'    // Create, edit, delete channels
  | 'kick_members'       // Remove members from server
  | 'ban_members'        // Ban members from server
  | 'mute_members'       // Mute members
  | 'manage_nicknames'   // Change member nicknames
  | 'manage_messages'    // Delete any message
  | 'pin_messages'       // Pin/unpin messages
  | 'send_messages'      // Send messages
  | 'add_reactions'      // Add reactions to messages
  | 'view_channels'      // View channels and messages
  | 'transfer_ownership' // Transfer server ownership
  | 'manage_invites';    // Create/revoke invite codes

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