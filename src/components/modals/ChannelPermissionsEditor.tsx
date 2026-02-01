import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, ChevronRight } from 'lucide-react';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import type { Permission, ServerRole, CustomServerRole, ChannelPermission } from '@/types';
import { cn } from '@/lib/utils';

interface ChannelPermissionsEditorProps {
  channelId: string;
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
      permissions: ['manage_server', 'manage_roles', 'manage_emojis', 'manage_invites'],
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
  manage_emojis: 'Manage Emojis',
  transfer_ownership: 'Transfer Ownership',
};

// Only show owner and member as default roles (admin and moderator may have been removed)
const DEFAULT_ROLES: Array<{ name: ServerRole; label: string; color: string }> = [
  { name: 'owner', label: 'Owner', color: '#ef4444' },
  { name: 'member', label: 'Member', color: '#6b7280' },
];

export const ChannelPermissionsEditor = ({ channelId, serverId, onClose }: ChannelPermissionsEditorProps) => {
  const { user } = useAuthStore();
  const {
    roles,
    channelPermissions,
    fetchChannelPermissions,
    fetchRoles,
    setChannelPermission,
    deleteChannelPermission,
  } = useServerStore();

  const [selectedRoleKey, setSelectedRoleKey] = useState<string | null>(null);
  const [permissionStates, setPermissionStates] = useState<Map<string, Map<Permission, boolean | null>>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Combine default roles and custom roles
  const allRoles = useMemo(() => {
    return [
      ...DEFAULT_ROLES.map(r => ({ id: null, name: r.name, label: r.label, color: r.color, position: -1 })),
      ...roles.map(r => ({ id: r.id, name: null, label: r.name, color: r.color, position: r.position })),
    ].sort((a, b) => {
      // Default roles first (by their order), then custom roles (by position)
      if (a.id === null && b.id === null) {
        const aIndex = DEFAULT_ROLES.findIndex(dr => dr.name === a.name);
        const bIndex = DEFAULT_ROLES.findIndex(dr => dr.name === b.name);
        return aIndex - bIndex;
      }
      if (a.id === null) return -1;
      if (b.id === null) return 1;
      return a.position - b.position;
    });
  }, [roles]);

  // Auto-select first role when roles are loaded
  useEffect(() => {
    if (allRoles.length > 0 && !selectedRoleKey) {
      const firstRole = allRoles[0];
      setSelectedRoleKey(firstRole.id || firstRole.name!);
    }
  }, [allRoles, selectedRoleKey]);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      setIsLoading(true);
      try {
        await Promise.all([
          fetchChannelPermissions(channelId),
          fetchRoles(serverId),
        ]);
      } catch (error) {
        console.error('Failed to load permissions:', error);
        toast.error('Failed to load permissions');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [channelId, serverId, user, fetchChannelPermissions, fetchRoles]);

  useEffect(() => {
    // Initialize permission states for all roles
    const states = new Map<string, Map<Permission, boolean | null>>();

    // Get all possible permissions
    const allPermissions: Permission[] = [
      'view_channels', 'send_messages', 'add_reactions',
      'manage_messages', 'pin_messages', 'manage_channels',
      'kick_members', 'ban_members', 'mute_members',
      'manage_nicknames', 'manage_server', 'manage_roles',
      'manage_emojis', 'manage_invites'
    ];

    // Initialize all roles with null (inherit) permissions
    for (const role of allRoles) {
      const roleKey = role.id || role.name!;
      const rolePerms = new Map<Permission, boolean | null>();

      for (const perm of allPermissions) {
        rolePerms.set(perm, null); // null = inherit from role permissions
      }

      states.set(roleKey, rolePerms);
    }

    // Apply channel-specific overrides from database
    for (const cp of channelPermissions) {
      const roleKey = cp.role_id || cp.role_name!;
      const roleState = states.get(roleKey);

      if (roleState) {
        roleState.set(cp.permission, cp.allowed);
      }
    }

    setPermissionStates(states);
  }, [channelPermissions, allRoles]);

  const handlePermissionChange = (roleKey: string, permission: Permission, value: boolean | null) => {
    setPermissionStates((prev) => {
      const next = new Map(prev);
      const rolePerms = new Map(next.get(roleKey) || []);
      rolePerms.set(permission, value);
      next.set(roleKey, rolePerms);
      return next;
    });
  };

  const getPermissionState = (roleKey: string, permission: Permission): boolean | null => {
    return permissionStates.get(roleKey)?.get(permission) ?? null;
  };

  const getRoleOverrideCount = (roleKey: string): number => {
    const rolePerms = permissionStates.get(roleKey);
    if (!rolePerms) return 0;

    let count = 0;
    for (const state of rolePerms.values()) {
      if (state !== null) count++; // Count any non-inherited settings
    }
    return count;
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      // Get current database permissions
      const currentDbPermMap = new Map<string, ChannelPermission>();
      for (const cp of channelPermissions) {
        const roleKey = cp.role_id || cp.role_name!;
        const key = `${roleKey}:${cp.permission}`;
        currentDbPermMap.set(key, cp);
      }

      // Save all changed permissions
      const savePromises: Promise<void>[] = [];

      for (const role of allRoles) {
        const roleKey = role.id || role.name!;
        const rolePerms = permissionStates.get(roleKey);

        if (!rolePerms) continue;

        for (const [permission, state] of rolePerms.entries()) {
          // Only process permissions that are part of our defined groups
          if (!PERMISSION_GROUPS.some(g => g.permissions.includes(permission))) {
            continue;
          }

          const dbKey = `${roleKey}:${permission}`;
          const currentDb = currentDbPermMap.get(dbKey);

          if (state !== null) {
            // Explicitly set (true or false)
            if (currentDb) {
              // Update if different
              if (currentDb.allowed !== state) {
                savePromises.push(
                  setChannelPermission(
                    channelId,
                    user.id,
                    permission,
                    state,
                    role.id ? role.id : undefined,
                    role.name ? role.name : undefined
                  )
                );
              }
            } else {
              // Create new override
              savePromises.push(
                setChannelPermission(
                  channelId,
                  user.id,
                  permission,
                  state,
                  role.id ? role.id : undefined,
                  role.name ? role.name : undefined
                )
              );
            }
          } else {
            // Neutral/Null - delete channel override if it exists (inherit)
            if (currentDb) {
              savePromises.push(deleteChannelPermission(currentDb.id, user.id));
            }
          }
        }
      }

      await Promise.all(savePromises);

      // Refresh permissions to ensure they're up to date
      await fetchChannelPermissions(channelId);

      toast.success('Channel permissions saved successfully');
      onClose();
    } catch (error) {
      console.error('Failed to save permissions:', error);
      toast.error('Failed to save permissions');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedRole = allRoles.find(r => (r.id || r.name!) === selectedRoleKey);

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
        <h3 className="text-sm font-semibold">Channel Permissions</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Override role permissions for this channel. Permissions can be allowed, denied, or inherited from role settings.
        </p>
      </div>

      <div className="flex gap-4" style={{ height: 'calc(85vh - 300px)', minHeight: '400px' }}>
        {/* Role List Sidebar */}
        <div className="w-48 border-r border-border">
          <ScrollArea className="h-full">
            <div className="space-y-1 p-2">
              {allRoles.map((role) => {
                const roleKey = role.id || role.name!;
                const isSelected = selectedRoleKey === roleKey;
                const overrideCount = getRoleOverrideCount(roleKey);

                return (
                  <button
                    key={roleKey}
                    onClick={() => setSelectedRoleKey(roleKey)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-secondary text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={
                          role.color.startsWith('linear-gradient')
                            ? { background: role.color }
                            : { backgroundColor: role.color }
                        }
                      />
                      <span className="truncate font-medium">{role.label}</span>
                    </div>
                    {overrideCount > 0 && (
                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                        {overrideCount}
                      </Badge>
                    )}
                    {isSelected && (
                      <ChevronRight className="w-4 h-4 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Permissions Panel */}
        <div className="flex-1">
          {selectedRole ? (
            <ScrollArea className="h-full pr-4">
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: selectedRole.color }}
                  />
                  <h4 className="font-semibold text-base">{selectedRole.label}</h4>
                  {selectedRole.id && (
                    <Badge variant="secondary" className="text-xs">
                      Custom Role
                    </Badge>
                  )}
                </div>

                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.label} className="space-y-3">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase">
                      {group.label}
                    </Label>
                    <div className="space-y-2">
                      {group.permissions.map((permission) => {
                        const state = getPermissionState(selectedRoleKey!, permission);

                        return (
                          <div key={permission} className="flex items-center justify-between p-2 rounded-md hover:bg-secondary/50 group/item">
                            <Label
                              htmlFor={`${selectedRoleKey}-${permission}`}
                              className="text-sm font-normal cursor-pointer flex-1"
                            >
                              {PERMISSION_LABELS[permission]}
                            </Label>
                            <div className="flex bg-secondary/80 rounded-lg p-0.5 border border-border/50">
                              <button
                                onClick={() => handlePermissionChange(selectedRoleKey!, permission, false)}
                                className={cn(
                                  "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                                  state === false
                                    ? "bg-destructive text-destructive-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                DENY
                              </button>
                              <button
                                onClick={() => handlePermissionChange(selectedRoleKey!, permission, null)}
                                className={cn(
                                  "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                                  state === null
                                    ? "bg-background text-foreground shadow-sm border border-border"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                INHERIT
                              </button>
                              <button
                                onClick={() => handlePermissionChange(selectedRoleKey!, permission, true)}
                                className={cn(
                                  "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                                  state === true
                                    ? "bg-emerald-500 text-white shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                ALLOW
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <Separator />
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a role to view permissions
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-4 border-t mt-4">
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
