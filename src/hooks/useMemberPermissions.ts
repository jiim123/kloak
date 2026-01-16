import { useMemo } from 'react';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { evaluatePermission } from '@/lib/permissions';
import type { Permission } from '@/types';

/**
 * Hook to check if the current user has a specific permission
 * Uses the full permission hierarchy:
 * 1. Channel-specific overrides (highest priority)
 * 2. Server-wide role permissions
 * 3. Default base role permissions (lowest priority)
 */
export const useMemberPermissions = (channelId?: string) => {
  const { user } = useAuthStore();
  const {
    members,
    currentServer,
    rolePermissions,
    channelPermissions,
  } = useServerStore();

  const currentMember = useMemo(() => {
    if (!user || !currentServer) return null;
    return members.find((m) => m.user_id === user.id) || null;
  }, [members, user, currentServer]);

  const checkPermission = (permission: Permission): boolean => {
    if (!currentMember || !currentServer) return false;

    // Use the centralized permission evaluation function
    return evaluatePermission(
      permission,
      currentMember.role,
      currentMember.roles,
      rolePermissions,
      channelPermissions,
      channelId
    );
  };

  return {
    currentMember,
    hasPermission: checkPermission,
    canPerformInChannel: (permission: Permission, targetChannelId?: string) => {
      if (!currentMember || !currentServer) return false;
      const effectiveChannelId = targetChannelId || channelId;
      if (!effectiveChannelId) return checkPermission(permission);
      
      return evaluatePermission(
        permission,
        currentMember.role,
        currentMember.roles,
        rolePermissions,
        channelPermissions,
        effectiveChannelId
      );
    },
  };
};
