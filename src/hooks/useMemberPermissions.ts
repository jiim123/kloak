import { useMemo } from 'react';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { evaluatePermission } from '@/lib/permissions';
import type { Permission } from '@/types';

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
  const {
    members,
    currentServer,
    rolePermissions,
    channelPermissions,
    roles,
  } = useServerStore();

  const currentMember = useMemo(() => {
    if (!user || !currentServer) return null;
    return members.find((m) => m.user_id === user.id) || null;
  }, [members, user, currentServer]);

  const isOwner = useMemo(() => {
    if (!user || !currentServer) return false;
    return currentServer.owner_id === user.id;
  }, [user, currentServer]);

  const checkPermission = (permission: Permission): boolean => {
    if (!currentServer || !user) return false;

    return evaluatePermission(
      permission,
      isOwner,
      currentMember?.roles,
      rolePermissions,
      channelPermissions,
      channelId,
      user.id,
      roles
    );
  };

  return {
    currentMember,
    isOwner,
    hasPermission: checkPermission,
    canPerformInChannel: (permission: Permission, targetChannelId?: string) => {
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
        roles
      );
    },
  };
};
