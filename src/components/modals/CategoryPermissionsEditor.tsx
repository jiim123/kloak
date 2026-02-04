import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, ChevronRight, RefreshCw } from 'lucide-react';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import type { Permission, ServerRole, CategoryPermission } from '@/types';
import { cn } from '@/lib/utils';

interface CategoryPermissionsEditorProps {
  categoryId: string;
  serverId: string;
  onClose: () => void;
}

const PERMISSION_GROUPS: Array<{
  label: string;
  permissions: Permission[];
}> = [
    {
      label: 'General Permissions',
      permissions: ['view_channels', 'read_message_history', 'send_messages', 'add_reactions'],
    },
    {
      label: 'Text Permissions',
      permissions: ['attach_files', 'embed_links', 'mention_everyone', 'mention_roles', 'use_external_emojis'],
    },
    {
      label: 'Member Permissions',
      permissions: ['kick_members', 'ban_members', 'mute_members', 'deafen_members', 'move_members', 'manage_nicknames', 'change_nickname'],
    },
    {
      label: 'Channel Permissions',
      permissions: ['manage_channels', 'manage_messages', 'pin_messages', 'manage_threads'],
    },
    {
      label: 'Administrative Permissions',
      permissions: ['manage_server', 'manage_roles', 'manage_emojis', 'manage_webhooks', 'manage_invites', 'create_instant_invite'],
    },
    {
      label: 'Voice Permissions',
      permissions: ['connect', 'speak', 'use_voice_activation'],
    },
    {
      label: 'Advanced Permissions',
      permissions: ['use_application_commands'],
    },
  ];

const PERMISSION_LABELS: Record<Permission, string> = {
  view_channels: 'View Channels',
  read_message_history: 'Read Message History',
  send_messages: 'Send Messages',
  add_reactions: 'Add Reactions',
  attach_files: 'Attach Files',
  embed_links: 'Embed Links',
  mention_everyone: 'Mention @everyone',
  mention_roles: 'Mention Roles',
  use_external_emojis: 'Use External Emojis',
  kick_members: 'Kick Members',
  ban_members: 'Ban Members',
  mute_members: 'Mute Members',
  deafen_members: 'Deafen Members',
  move_members: 'Move Members',
  manage_nicknames: 'Manage Nicknames',
  change_nickname: 'Change Nickname',
  manage_channels: 'Manage Channels',
  manage_messages: 'Manage Messages',
  pin_messages: 'Pin Messages',
  manage_threads: 'Manage Threads',
  manage_server: 'Manage Server',
  manage_roles: 'Manage Roles',
  manage_emojis: 'Manage Emojis',
  manage_webhooks: 'Manage Webhooks',
  manage_invites: 'Manage Invites',
  create_instant_invite: 'Create Instant Invite',
  transfer_ownership: 'Transfer Ownership',
  connect: 'Connect (Voice)',
  speak: 'Speak (Voice)',
  use_voice_activation: 'Use Voice Activation',
  use_application_commands: 'Use Application Commands',
};

const DEFAULT_ROLES: Array<{ name: ServerRole; label: string; color: string }> = [
  { name: 'owner', label: 'Owner', color: '#ef4444' },
  { name: 'member', label: 'Member', color: '#6b7280' },
];

export const CategoryPermissionsEditor = ({ categoryId, serverId, onClose }: CategoryPermissionsEditorProps) => {
  const { user } = useAuthStore();
  const {
    roles,
    channels,
    categoryPermissions,
    fetchCategoryPermissions,
    fetchRoles,
    setCategoryPermission,
    deleteCategoryPermission,
    syncCategoryPermissionsToChannels,
  } = useServerStore();

  const [selectedRoleKey, setSelectedRoleKey] = useState<string | null>(null);
  const [permissionStates, setPermissionStates] = useState<Map<string, Map<Permission, boolean | null>>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Count channels in this category
  const channelsInCategory = useMemo(() => {
    return channels.filter(c => c.category_id === categoryId);
  }, [channels, categoryId]);

  // Combine default roles and custom roles
  const allRoles = useMemo(() => {
    return [
      ...DEFAULT_ROLES.map(r => ({ id: null, name: r.name, label: r.label, color: r.color, position: -1 })),
      ...roles.map(r => ({ id: r.id, name: null, label: r.name, color: r.color, position: r.position })),
    ].sort((a, b) => {
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
          fetchCategoryPermissions(categoryId),
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
  }, [categoryId, serverId, user, fetchCategoryPermissions, fetchRoles]);

  useEffect(() => {
    // Initialize permission states for all roles
    const states = new Map<string, Map<Permission, boolean | null>>();

    const allPermissions: Permission[] = [
      'view_channels', 'read_message_history', 'send_messages', 'add_reactions',
      'attach_files', 'embed_links', 'mention_everyone', 'mention_roles', 'use_external_emojis',
      'manage_messages', 'pin_messages', 'manage_channels', 'manage_threads',
      'kick_members', 'ban_members', 'mute_members', 'deafen_members', 'move_members',
      'manage_nicknames', 'change_nickname', 'manage_server', 'manage_roles',
      'manage_emojis', 'manage_webhooks', 'manage_invites', 'create_instant_invite',
      'connect', 'speak', 'use_voice_activation', 'use_application_commands'
    ];

    // Initialize all roles with null (inherit) permissions
    for (const role of allRoles) {
      const roleKey = role.id || role.name!;
      const rolePerms = new Map<Permission, boolean | null>();

      for (const perm of allPermissions) {
        rolePerms.set(perm, null);
      }

      states.set(roleKey, rolePerms);
    }

    // Apply category-specific overrides from database
    for (const cp of categoryPermissions) {
      const roleKey = cp.role_id || cp.role_name!;
      const roleState = states.get(roleKey);

      if (roleState) {
        roleState.set(cp.permission, cp.allowed);
      }
    }

    setPermissionStates(states);
  }, [categoryPermissions, allRoles]);

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
      if (state !== null) count++;
    }
    return count;
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      // Get current database permissions
      const currentDbPermMap = new Map<string, CategoryPermission>();
      for (const cp of categoryPermissions) {
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
          if (!PERMISSION_GROUPS.some(g => g.permissions.includes(permission))) {
            continue;
          }

          const dbKey = `${roleKey}:${permission}`;
          const currentDb = currentDbPermMap.get(dbKey);

          if (state !== null) {
            if (currentDb) {
              if (currentDb.allowed !== state) {
                savePromises.push(
                  setCategoryPermission(
                    categoryId,
                    user.id,
                    permission,
                    state,
                    role.id ? role.id : undefined,
                    role.name ? role.name : undefined
                  )
                );
              }
            } else {
              savePromises.push(
                setCategoryPermission(
                  categoryId,
                  user.id,
                  permission,
                  state,
                  role.id ? role.id : undefined,
                  role.name ? role.name : undefined
                )
              );
            }
          } else {
            if (currentDb) {
              savePromises.push(deleteCategoryPermission(currentDb.id, user.id));
            }
          }
        }
      }

      await Promise.all(savePromises);
      await fetchCategoryPermissions(categoryId);

      toast.success('Category permissions saved successfully');
      onClose();
    } catch (error) {
      console.error('Failed to save permissions:', error);
      toast.error('Failed to save permissions');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncToChannels = async () => {
    if (!user) return;

    setIsSyncing(true);
    try {
      // First save current permissions
      await handleSaveWithoutClose();
      
      // Then sync to channels
      await syncCategoryPermissionsToChannels(categoryId, user.id);
      
      toast.success(`Permissions synced to ${channelsInCategory.length} channel(s)`);
    } catch (error) {
      console.error('Failed to sync permissions:', error);
      toast.error('Failed to sync permissions to channels');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveWithoutClose = async () => {
    if (!user) return;

    const currentDbPermMap = new Map<string, CategoryPermission>();
    for (const cp of categoryPermissions) {
      const roleKey = cp.role_id || cp.role_name!;
      const key = `${roleKey}:${cp.permission}`;
      currentDbPermMap.set(key, cp);
    }

    const savePromises: Promise<void>[] = [];

    for (const role of allRoles) {
      const roleKey = role.id || role.name!;
      const rolePerms = permissionStates.get(roleKey);

      if (!rolePerms) continue;

      for (const [permission, state] of rolePerms.entries()) {
        if (!PERMISSION_GROUPS.some(g => g.permissions.includes(permission))) {
          continue;
        }

        const dbKey = `${roleKey}:${permission}`;
        const currentDb = currentDbPermMap.get(dbKey);

        if (state !== null) {
          if (currentDb) {
            if (currentDb.allowed !== state) {
              savePromises.push(
                setCategoryPermission(
                  categoryId,
                  user.id,
                  permission,
                  state,
                  role.id ? role.id : undefined,
                  role.name ? role.name : undefined
                )
              );
            }
          } else {
            savePromises.push(
              setCategoryPermission(
                categoryId,
                user.id,
                permission,
                state,
                role.id ? role.id : undefined,
                role.name ? role.name : undefined
              )
            );
          }
        } else {
          if (currentDb) {
            savePromises.push(deleteCategoryPermission(currentDb.id, user.id));
          }
        }
      }
    }

    await Promise.all(savePromises);
    await fetchCategoryPermissions(categoryId);
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
      {/* Sync to Channels Button */}
      <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Sync to Channels</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Apply these permissions to all {channelsInCategory.length} channel(s) in this category
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSyncToChannels}
            disabled={isSyncing || channelsInCategory.length === 0}
            className="flex-shrink-0 rounded-xl"
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sync Now
          </Button>
        </div>
      </div>

      <div className="flex gap-4" style={{ height: 'calc(60vh - 200px)', minHeight: '350px' }}>
        {/* Role List Sidebar */}
        <div className="w-48 border-r border-border/50 flex-shrink-0">
          <ScrollArea className="h-full">
            <div className="space-y-1 pr-3">
              {allRoles.map((role) => {
                const roleKey = role.id || role.name!;
                const isSelected = selectedRoleKey === roleKey;
                const overrideCount = getRoleOverrideCount(roleKey);

                return (
                  <button
                    key={roleKey}
                    onClick={() => setSelectedRoleKey(roleKey)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
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
        <div className="flex-1 min-w-0">
          {selectedRole ? (
            <ScrollArea className="h-full pr-4">
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
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
                          <div key={permission} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 group/item">
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

      <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/50">
        <Button variant="outline" onClick={onClose} disabled={isSaving} className="rounded-xl">
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving} className="rounded-xl">
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Permissions
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
