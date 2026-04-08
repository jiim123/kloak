import { useMemo, useCallback } from "react";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { evaluatePermission, canModerateByRoles } from "@/lib/permissions";
import type { Permission, CustomServerRole, ServerRole } from "@/types";

/**
 * Hook to check if the current user has a specific permission.
 * Uses Discord-style evaluation:
 * 1. Owner check via server.owner_id (always has all permissions)
 * 2. User-specific channel overrides
 * 3. Custom role channel overrides
 * 4. Server-wide role permissions
 * 5. @everyone role permissions (fallback)
 */
export const useMemberPermissions = (channelId?: string) => {
  const { user } = useAuthStore();
  const members = useServerStore((s) => s.members);
  const currentServer = useServerStore((s) => s.currentServer);
  const rolePermissions = useServerStore((s) => s.rolePermissions);
  const channelPermissions = useServerStore((s) => s.channelPermissions);
  const roles = useServerStore((s) => s.roles);

  const currentMember = useMemo(() => {
    if (!user || !currentServer) return null;
    return members.find((m) => m.user_id === user.id) || null;
  }, [members, user, currentServer]);

  const isOwner = useMemo(() => {
    if (!user || !currentServer) return false;
    return currentServer.owner_id === user.id;
  }, [user, currentServer]);

  const baseRole = currentMember?.role as ServerRole | undefined;

  const checkPermission = useCallback(
    (permission: Permission): boolean => {
      if (!currentServer || !user) return false;
      return evaluatePermission(
        permission,
        isOwner,
        currentMember?.roles,
        rolePermissions,
        channelPermissions,
        channelId,
        user.id,
        roles,
        baseRole,
      );
    },
    [currentServer, user, isOwner, currentMember, rolePermissions, channelPermissions, channelId, roles, baseRole],
  );

  // Check if current user can moderate a target member (kick/ban/mute/role changes)
  const canModerate = useCallback(
    (targetRoles?: CustomServerRole[], targetBaseRole?: ServerRole, targetIsOwner?: boolean): boolean => {
      return canModerateByRoles(
        isOwner,
        currentMember?.roles,
        targetIsOwner ?? false,
        targetRoles,
        baseRole,
        targetBaseRole,
      );
    },
    [isOwner, currentMember, baseRole],
  );

  return {
    currentMember,
    isOwner,
    baseRole,
    hasPermission: checkPermission,
    canModerate,
    canPerformInChannel: useCallback(
      (permission: Permission, targetChannelId?: string) => {
        if (!currentServer || !user) return false;
        const effectiveChannelId = targetChannelId || channelId;
        if (!effectiveChannelId) return checkPermission(permission);
        return evaluatePermission(
          permission,
          isOwner,
          currentMember?.roles,
          rolePermissions,
          channelPermissions,
          effectiveChannelId,
          user.id,
          roles,
          baseRole,
        );
      },
      [
        currentServer,
        user,
        isOwner,
        currentMember,
        rolePermissions,
        channelPermissions,
        channelId,
        roles,
        baseRole,
        checkPermission,
      ],
    ),
  };
};
