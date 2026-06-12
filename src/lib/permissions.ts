/**
 * Simplified Permission System for Kloak
 * 
 * Permission Evaluation Order:
 * 1. Owner check (always has all permissions)
 * 2. Channel role permissions (highest priority - explicit grant only)
 * 3. Server role permissions (explicit grant only)
 * 4. Base role defaults (fallback for basic permissions)
 * 5. Default: deny
 */

import type { Permission, RolePermission, ChannelPermission, CustomServerRole, ServerRole } from "@/types";

export type { Permission } from "@/types";

/**
 * Default permissions granted to each base role.
 * These are fallback permissions when no explicit grants exist.
 */
const DEFAULT_ROLE_PERMISSIONS: Record<ServerRole, Permission[]> = {
  owner: [
    "manage_server", "manage_roles", "manage_channels", "manage_emojis",
    "kick_members", "ban_members", "mute_members", "deafen_members",
    "move_members", "manage_nicknames", "manage_messages", "pin_messages",
    "create_instant_invite", "manage_invites", "transfer_ownership",
    "view_channels", "read_message_history", "send_messages", "add_reactions",
    "attach_files", "embed_links", "mention_everyone", "mention_roles",
    "use_external_emojis", "manage_webhooks", "manage_threads",
    "connect", "speak", "use_voice_activation", "use_application_commands",
    "view_tasks", "create_tasks", "edit_own_tasks", "edit_all_tasks",
    "assign_tasks", "change_task_status", "delete_tasks",
    "view_events", "create_events", "edit_own_events", "edit_all_events", "delete_events", "rsvp_events"
  ],
  admin: [
    "manage_server", "manage_roles", "manage_channels", "manage_emojis",
    "kick_members", "ban_members", "mute_members", "deafen_members",
    "move_members", "manage_nicknames", "manage_messages", "pin_messages",
    "create_instant_invite", "manage_invites",
    "view_channels", "read_message_history", "send_messages", "add_reactions",
    "attach_files", "embed_links", "mention_everyone", "mention_roles",
    "use_external_emojis", "manage_webhooks", "manage_threads",
    "connect", "speak", "use_voice_activation", "use_application_commands",
    "view_tasks", "create_tasks", "edit_own_tasks", "edit_all_tasks",
    "assign_tasks", "change_task_status", "delete_tasks",
    "view_events", "create_events", "edit_own_events", "edit_all_events", "delete_events", "rsvp_events"
  ],
  moderator: [
    "kick_members", "mute_members", "manage_nicknames", "manage_messages",
    "pin_messages", "view_channels", "read_message_history", "send_messages",
    "add_reactions", "attach_files", "embed_links", "mention_roles",
    "use_external_emojis", "manage_threads", "connect", "speak",
    "use_voice_activation", "use_application_commands",
    "view_tasks", "create_tasks", "edit_own_tasks", "edit_all_tasks",
    "assign_tasks", "change_task_status", "delete_tasks",
    "view_events", "create_events", "edit_own_events", "delete_events", "rsvp_events"
  ],
  member: [
    "view_channels", "read_message_history", "send_messages", "add_reactions",
    "attach_files", "embed_links", "mention_roles", "use_external_emojis",
    "connect", "speak", "use_voice_activation", "use_application_commands",
    "change_nickname", "create_tasks", "edit_own_tasks", "change_task_status",
    "view_events", "create_events", "edit_own_events", "rsvp_events"
  ],
};

/**
 * Evaluate permission using simplified logic.
 * No explicit deny - permission is granted only if explicitly set or matches base role defaults.
 */
export const evaluatePermission = (
  permission: Permission,
  isOwner: boolean,
  customRoles?: CustomServerRole[],
  rolePermissions?: RolePermission[],
  channelPermissions?: ChannelPermission[],
  channelId?: string,
  userId?: string,
): boolean => {
  // Owner always has all permissions
  if (isOwner) return true;

  const customRoleIds = new Set(customRoles?.map((r) => r.id) ?? []);

  // Step 1: Check channel role permissions (highest priority)
  if (channelId && channelPermissions && channelPermissions.length > 0) {
    const channelRolePerm = channelPermissions.find(
      (cp) => cp.channel_id === channelId && cp.permission === permission && cp.role_id && customRoleIds.has(cp.role_id),
    );
    if (channelRolePerm) return true;
  }

  // Step 2: Check server role permissions
  if (rolePermissions && rolePermissions.length > 0) {
    const rolePerm = rolePermissions.find(
      (rp) => rp.permission === permission && rp.role_id && customRoleIds.has(rp.role_id),
    );
    if (rolePerm) return true;
  }

  // Step 3: Default deny - no more base role override logic needed
  // All permissions default to false unless explicitly granted
  return false;
};

/**
 * Numeric rank for base roles — lower = higher rank.
 */
const BASE_ROLE_RANK: Record<ServerRole, number> = {
  owner: 0,
  admin: 1,
  moderator: 2,
  member: 3,
};

/**
 * Check if one member can moderate another based on role positions.
 */
export const canModerateByRoles = (
  actorIsOwner: boolean,
  actorRoles: CustomServerRole[] | undefined,
  targetIsOwner: boolean,
  targetRoles: CustomServerRole[] | undefined,
  actorBaseRole?: ServerRole,
  targetBaseRole?: ServerRole,
): boolean => {
  if (actorIsOwner) return !targetIsOwner;
  if (targetIsOwner) return false;

  const getHighestPosition = (roles?: CustomServerRole[]): number => {
    if (!roles || roles.length === 0) return Number.POSITIVE_INFINITY;
    return Math.min(...roles.map((r) => r.position));
  };

  const actorPos = getHighestPosition(actorRoles);
  const targetPos = getHighestPosition(targetRoles);

  if (actorPos !== Number.POSITIVE_INFINITY || targetPos !== Number.POSITIVE_INFINITY) {
    return actorPos < targetPos;
  }

  const actorRank = BASE_ROLE_RANK[actorBaseRole ?? "member"];
  const targetRank = BASE_ROLE_RANK[targetBaseRole ?? "member"];
  return actorRank < targetRank;
};

/**
 * Get all permissions for a member considering the full hierarchy.
 */
export const getMemberPermissions = (
  isOwner: boolean,
  customRoles: CustomServerRole[] | undefined,
  rolePermissions: RolePermission[] | undefined,
  channelPermissions: ChannelPermission[] | undefined,
  channelId?: string,
  userId?: string,
): Map<Permission, boolean> => {
  const permissions = new Map<Permission, boolean>();

  const allPermissions: Permission[] = [
    "manage_server", "manage_roles", "manage_channels", "manage_emojis",
    "kick_members", "ban_members", "mute_members", "deafen_members",
    "move_members", "manage_nicknames", "change_nickname", "manage_messages",
    "pin_messages", "send_messages", "add_reactions", "view_channels",
    "read_message_history", "attach_files", "embed_links", "mention_everyone",
    "mention_roles", "use_external_emojis", "manage_webhooks", "manage_threads",
    "create_instant_invite", "transfer_ownership", "manage_invites",
    "connect", "speak", "use_voice_activation", "use_application_commands",
    "view_tasks", "create_tasks", "edit_own_tasks", "edit_all_tasks",
    "assign_tasks", "change_task_status", "delete_tasks",
    "view_events", "create_events", "edit_own_events", "edit_all_events", "delete_events", "rsvp_events"
  ];

  for (const permission of allPermissions) {
    permissions.set(
      permission,
      evaluatePermission(
        permission,
        isOwner,
        customRoles,
        rolePermissions,
        channelPermissions,
        channelId,
        userId,
      ),
    );
  }

  return permissions;
};

/**
 * Get all allowed permissions for a member.
 */
export const getAllowedPermissions = (
  isOwner: boolean,
  customRoles?: CustomServerRole[],
  rolePermissions?: RolePermission[],
  channelPermissions?: ChannelPermission[],
  channelId?: string,
  userId?: string,
): Permission[] => {
  const permissions = getMemberPermissions(
    isOwner,
    customRoles,
    rolePermissions,
    channelPermissions,
    channelId,
    userId,
  );

  const allowed: Permission[] = [];
  for (const [perm, allowedValue] of permissions.entries()) {
    if (allowedValue) allowed.push(perm);
  }

  return allowed;
};

/**
 * Check if user has any of the specified permissions.
 */
export const hasAnyPermission = (
  permissions: Permission[],
  isOwner: boolean,
  customRoles?: CustomServerRole[],
  rolePermissions?: RolePermission[],
  channelPermissions?: ChannelPermission[],
  channelId?: string,
  userId?: string,
): boolean => {
  return permissions.some((p) =>
    evaluatePermission(p, isOwner, customRoles, rolePermissions, channelPermissions, channelId, userId),
  );
};

/**
 * Check if user has all of the specified permissions.
 */
export const hasAllPermissions = (
  permissions: Permission[],
  isOwner: boolean,
  customRoles?: CustomServerRole[],
  rolePermissions?: RolePermission[],
  channelPermissions?: ChannelPermission[],
  channelId?: string,
  userId?: string,
): boolean => {
  return permissions.every((p) =>
    evaluatePermission(p, isOwner, customRoles, rolePermissions, channelPermissions, channelId, userId),
  );
};