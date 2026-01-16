import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save } from 'lucide-react';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import type { Permission, ServerRole, CustomServerRole } from '@/types';

interface RolePermissionsEditorProps {
  role: CustomServerRole;
  serverId: string;
  onClose: () => void;
}

const PERMISSION_GROUPS: Array<{
  label: string;
  permissions: Permission[];
}> = [
  {
    label: 'General Permissions',
    permissions: ['view_channels', 'send_messages', 'add_reactions'],
  },
  {
    label: 'Member Permissions',
    permissions: ['kick_members', 'ban_members', 'mute_members', 'manage_nicknames'],
  },
  {
    label: 'Channel Permissions',
    permissions: ['manage_channels', 'manage_messages', 'pin_messages'],
  },
  {
    label: 'Administrative Permissions',
    permissions: ['manage_server', 'manage_roles', 'manage_invites', 'transfer_ownership'],
  },
];

const PERMISSION_LABELS: Record<Permission, string> = {
  view_channels: 'View Channels',
  send_messages: 'Send Messages',
  add_reactions: 'Add Reactions',
  kick_members: 'Kick Members',
  ban_members: 'Ban Members',
  mute_members: 'Mute Members',
  manage_nicknames: 'Manage Nicknames',
  manage_channels: 'Manage Channels',
  manage_messages: 'Manage Messages',
  pin_messages: 'Pin Messages',
  manage_server: 'Manage Server',
  manage_roles: 'Manage Roles',
  manage_invites: 'Manage Invites',
  transfer_ownership: 'Transfer Ownership',
};

export const RolePermissionsEditor = ({ role, serverId, onClose }: RolePermissionsEditorProps) => {
  const { user } = useAuthStore();
  const {
    rolePermissions,
    fetchRolePermissions,
    setRolePermission,
    deleteRolePermission,
  } = useServerStore();

  const [permissionStates, setPermissionStates] = useState<Map<Permission, boolean | null>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const roleName = role.name;

  useEffect(() => {
    const loadPermissions = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        await fetchRolePermissions(serverId);
      } catch (error) {
        console.error('Failed to load permissions:', error);
        toast.error('Failed to load permissions');
      } finally {
        setIsLoading(false);
      }
    };

    loadPermissions();
  }, [serverId, user, fetchRolePermissions]);

  useEffect(() => {
    // Initialize permission states - start with all permissions as unchecked (null)
    const states = new Map<Permission, boolean | null>();

    // Get all possible permissions
    const allPermissions: Permission[] = [
      'view_channels', 'send_messages', 'add_reactions',
      'manage_messages', 'pin_messages', 'manage_channels',
      'kick_members', 'ban_members', 'mute_members',
      'manage_nicknames', 'manage_roles', 'manage_server',
      'manage_invites', 'transfer_ownership'
    ];

    // Initialize all permissions as null (not set)
    for (const perm of allPermissions) {
      states.set(perm, null);
    }

    // Apply database permissions (override null with actual values)
    const relevantPermissions = rolePermissions.filter(
      (rp) => rp.role_id === role.id
    );

    for (const rp of relevantPermissions) {
      states.set(rp.permission, rp.allowed);
    }

    setPermissionStates(states);
  }, [rolePermissions, role]);

  const handlePermissionToggle = (permission: Permission, checked: boolean) => {
    setPermissionStates((prev) => {
      const next = new Map(prev);
      next.set(permission, checked);
      return next;
    });
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      // Get current database permissions
      const currentDbPermissions = rolePermissions.filter(
        (rp) => rp.role_id === role.id
      );

      const currentDbPermMap = new Map(
        currentDbPermissions.map((rp) => [rp.permission, rp])
      );

      // Save all changed permissions
      const savePromises: Promise<void>[] = [];

      // Process all permissions
      // If checked (true) -> save as allowed=true
      // If unchecked (false) -> delete (revert to base/default)
      // If null -> no change needed
      for (const [permission, state] of permissionStates.entries()) {
        const currentDb = currentDbPermMap.get(permission);
        
        if (state === true) {
          // Permission is checked - save as allowed
          if (currentDb) {
            // Update if different
            if (currentDb.allowed !== true) {
              savePromises.push(
                setRolePermission(serverId, user.id, permission, role.id, undefined, true)
              );
            }
          } else {
            // Create new permission
            savePromises.push(
              setRolePermission(serverId, user.id, permission, role.id, undefined, true)
            );
          }
        } else if (state === false && currentDb) {
          // Permission is unchecked and exists in DB - delete it
          savePromises.push(deleteRolePermission(currentDb.id, user.id));
        }
        // If state is null, no change needed (permission not set)
      }

      await Promise.all(savePromises);
      
      // Refresh permissions to ensure they're up to date
      await fetchRolePermissions(serverId);
      
      toast.success('Permissions saved successfully');
      onClose();
    } catch (error) {
      console.error('Failed to save permissions:', error);
      toast.error('Failed to save permissions');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Role Permissions</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Configure permissions for {roleName}
        </p>
      </div>

      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-6">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.label} className="space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">
                {group.label}
              </Label>
              <div className="space-y-2 pl-1">
                {group.permissions.map((permission) => {
                  const state = permissionStates.get(permission);
                  // null means not set (unchecked), true means checked, false means explicitly unchecked
                  const isChecked = state === true;

                  return (
                    <div key={permission} className="flex items-center space-x-2">
                      <Checkbox
                        id={permission}
                        checked={isChecked}
                        onCheckedChange={(checked) =>
                          handlePermissionToggle(permission, checked === true)
                        }
                      />
                      <Label
                        htmlFor={permission}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {PERMISSION_LABELS[permission]}
                      </Label>
                    </div>
                  );
                })}
              </div>
              <Separator />
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="flex items-center justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
