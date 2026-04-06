import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save } from 'lucide-react';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import type { Permission, ChannelPermission } from '@/types';
import { cn } from '@/lib/utils';
import { PERMISSION_META, PERMISSION_GROUPS } from '@/lib/permissionMeta';
import { BulkPermissionButtons } from '@/components/permissions/BulkPermissionButtons';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ChannelPermissionsEditorProps {
  channelId: string;
  serverId: string;
  onClose: () => void;
}

// No more DEFAULT_ROLES - we use @everyone from server roles instead

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

  // All roles = custom roles (including @everyone)
  const allRoles = useMemo(() => {
    return roles
      .map(r => ({ id: r.id, name: null as string | null, label: r.name, color: r.color, position: r.position }))
      .sort((a, b) => {
        // @everyone always last
        if (a.label === '@everyone') return 1;
        if (b.label === '@everyone') return -1;
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
    const states = new Map<string, Map<Permission, boolean | null>>();
    const allPermissions = Object.keys(PERMISSION_META) as Permission[];

    for (const role of allRoles) {
      const roleKey = role.id || role.name!;
      const rolePerms = new Map<Permission, boolean | null>();
      for (const perm of allPermissions) {
        rolePerms.set(perm, null);
      }
      states.set(roleKey, rolePerms);
    }

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
      if (state !== null) count++;
    }
    return count;
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const currentDbPermMap = new Map<string, ChannelPermission>();
      for (const cp of channelPermissions) {
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
          if (!PERMISSION_GROUPS.some(g => g.permissions.includes(permission))) continue;

          const dbKey = `${roleKey}:${permission}`;
          const currentDb = currentDbPermMap.get(dbKey);

          if (state !== null) {
            if (!currentDb || currentDb.allowed !== state) {
              savePromises.push(
                setChannelPermission(channelId, user.id, permission, state, role.id ? role.id : undefined, undefined)
              );
            }
          } else if (currentDb) {
            savePromises.push(deleteChannelPermission(currentDb.id, user.id));
          }
        }
      }

      await Promise.all(savePromises);
      await fetchChannelPermissions(channelId);
      toast.success('Channel permissions saved successfully');
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
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Override role permissions for this channel. Permissions set here take priority over server-wide role settings.
      </p>

      {/* Role selector */}
      <div className="flex gap-2 flex-wrap">
        {allRoles.map((role) => {
          const roleKey = role.id || role.name!;
          const isSelected = selectedRoleKey === roleKey;
          const overrideCount = getRoleOverrideCount(roleKey);

          return (
            <button
              key={roleKey}
              onClick={() => setSelectedRoleKey(roleKey)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors border",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-secondary/60 text-foreground border-border/50"
              )}
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={
                  role.color.startsWith('linear-gradient')
                    ? { background: role.color }
                    : { backgroundColor: role.color }
                }
              />
              <span className="font-medium">{role.label}</span>
              {overrideCount > 0 && !isSelected && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0">
                  {overrideCount}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Permissions list */}
      {selectedRole && (
        <div className="space-y-6">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="mb-3">
                <h4 className="text-xs font-medium uppercase tracking-widest text-muted-foreground/70">
                  {group.label}
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>
              </div>
              <div className="space-y-0.5">
                {group.permissions.map((permission) => {
                  const meta = PERMISSION_META[permission];
                  const state = getPermissionState(selectedRoleKey!, permission);
                  const isDisabled = !meta.enabled;

                  return (
                    <div
                      key={permission}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg transition-colors",
                        isDisabled ? "opacity-50" : "hover:bg-secondary/50"
                      )}
                    >
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{meta.label}</span>
                          {isDisabled && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-medium text-muted-foreground border-muted-foreground/30">
                              Coming soon
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {meta.description}
                        </p>
                      </div>
                      <div className={cn(
                        "flex bg-secondary/80 rounded-lg p-0.5 border border-border/50 flex-shrink-0",
                        isDisabled && "pointer-events-none"
                      )}>
                        <button
                          onClick={() => handlePermissionChange(selectedRoleKey!, permission, false)}
                          disabled={isDisabled}
                          className={cn(
                            "px-2.5 py-1 text-[10px] font-medium rounded-md transition-all",
                            state === false
                              ? "bg-destructive text-destructive-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          ✕
                        </button>
                        <button
                          onClick={() => handlePermissionChange(selectedRoleKey!, permission, null)}
                          disabled={isDisabled}
                          className={cn(
                            "px-2.5 py-1 text-[10px] font-medium rounded-md transition-all",
                            state === null
                              ? "bg-background text-foreground shadow-sm border border-border"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          /
                        </button>
                        <button
                          onClick={() => handlePermissionChange(selectedRoleKey!, permission, true)}
                          disabled={isDisabled}
                          className={cn(
                            "px-2.5 py-1 text-[10px] font-medium rounded-md transition-all",
                            state === true
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          ✓
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Save bar */}
          <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm py-3 flex items-center justify-between border-t border-border/50 -mx-1 px-1">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">✕</span> Deny · <span className="font-medium text-foreground">/</span> Inherit · <span className="font-medium text-foreground">✓</span> Allow
            </p>
            <Button onClick={handleSave} disabled={isSaving} size="sm">
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
      )}
    </div>
  );
};
