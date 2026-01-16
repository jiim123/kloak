import { useMemo } from 'react';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { hasMemberPermission, canPerformInChannel } from '@/lib/permissions';
import type { Permission, ServerMember } from '@/types';

/**
 * Hook to check if the current user has a specific permission
 * Automatically fetches and uses role permissions and channel permissions
 */
export const useMemberPermissions = (channelId?: string) => {
  const { user } = useAuthStore();
  const {
    members,
    currentServer,
    roles,
    rolePermissions,
    channelPermissions,
  } = useServerStore();

  const currentMember = useMemo(() => {
    if (!user || !currentServer) return null;
    return members.find((m) => m.user_id === user.id) || null;
  }, [members, user, currentServer]);

  const checkPermission = (permission: Permission): boolean => {
    if (!currentMember || !currentServer) return false;

    // Owner always has all permissions
    if (currentMember.role === 'owner') return true;

    // Check permission with database-backed system
    if (channelId) {
      return canPerformInChannel(
        currentMember.role,
        permission,
        channelId,
        currentMember.roles,
        rolePermissions,
        channelPermissions
      );
    } else {
      return hasMemberPermission(
        currentMember.role,
        permission,
        currentMember.roles,
        rolePermissions,
        channelPermissions
      );
    }
  };

  return {
    currentMember,
    hasPermission: checkPermission,
    canPerformInChannel: (permission: Permission) => {
      if (!channelId) return false;
      return checkPermission(permission);
    },
  };
};
