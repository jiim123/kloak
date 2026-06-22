import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, Loader2, Minus, Save, Search, ShieldAlert, X } from 'lucide-react';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Permission, CustomServerRole } from '@/types';
import { BulkPermissionButtons } from '@/components/permissions/BulkPermissionButtons';
import { PERMISSION_GROUPS, PERMISSION_META } from '@/lib/permissionMeta';
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

interface RolePermissionsEditorProps {
  role: CustomServerRole;
  serverId: string;
  onClose: () => void;
}

const allRolePermissions = PERMISSION_GROUPS.flatMap((group) => group.permissions);

const permissionValueOptions = [
  {
    value: false,
    label: 'Deny',
    Icon: X,
    activeClass: 'bg-destructive text-destructive-foreground border-destructive shadow-sm',
    inactiveClass: 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30',
  },
  {
    value: null,
    label: 'Inherit',
    Icon: Minus,
    activeClass: 'bg-background text-foreground border-border shadow-sm',
    inactiveClass: 'text-muted-foreground hover:bg-muted hover:text-foreground',
  },
  {
    value: true,
    label: 'Allow',
    Icon: Check,
    activeClass: 'bg-emerald-500 text-white border-emerald-500 shadow-sm',
    inactiveClass: 'text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/30',
  },
] as const;

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
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ type: 'deny' | 'allow'; permissions: Permission[] } | null>(null);

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

    // Initialize all permissions as null (not set)
    for (const perm of allRolePermissions) {
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

  const permissionCounts = useMemo(() => {
    let allowed = 0;
    let denied = 0;
    let inherited = 0;

    for (const permission of allRolePermissions) {
      const state = permissionStates.get(permission) ?? null;
      if (state === true) allowed += 1;
      else if (state === false) denied += 1;
      else inherited += 1;
    }

    return { allowed, denied, inherited, total: allRolePermissions.length };
  }, [permissionStates]);

  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return PERMISSION_GROUPS;

    return PERMISSION_GROUPS.map((group) => ({
      ...group,
      permissions: group.permissions.filter((permission) => {
        const meta = PERMISSION_META[permission];
        return (
          meta.label.toLowerCase().includes(query) ||
          meta.description.toLowerCase().includes(query) ||
          permission.toLowerCase().includes(query) ||
          group.label.toLowerCase().includes(query)
        );
      }),
    })).filter((group) => group.permissions.length > 0);
  }, [searchQuery]);

  const handlePermissionChange = (permission: Permission, value: boolean | null) => {
    setPermissionStates((prev) => {
      const next = new Map(prev);
      next.set(permission, value);
      return next;
    });
  };

  const handleBulkSet = (permissions: Permission[], value: boolean | null) => {
    setPermissionStates((prev) => {
      const next = new Map(prev);
      for (const perm of permissions) {
        next.set(perm, value);
      }
      return next;
    });
  };

  const handleGlobalBulkSet = (value: boolean | null) => {
    if (value !== null) {
      setConfirmAction({ type: value ? 'allow' : 'deny', permissions: allRolePermissions });
    } else {
      handleBulkSet(allRolePermissions, null);
    }
  };

  const getGroupCounts = (permissions: Permission[]) => {
    let allowed = 0;
    let denied = 0;

    for (const permission of permissions) {
      const state = permissionStates.get(permission) ?? null;
      if (state === true) allowed += 1;
      if (state === false) denied += 1;
    }

    return {
      allowed,
      denied,
      inherited: permissions.length - allowed - denied,
    };
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

      const savePromises: Promise<void>[] = [];

      // Process all permissions
      // If true -> allowed=true
      // If false -> allowed=false (Explicit Deny)
      // If null -> delete (Inherit/Neutral)
      for (const [permission, state] of permissionStates.entries()) {
        const currentDb = currentDbPermMap.get(permission);

        if (state !== null) {
          // Explicitly set (true or false)
          if (currentDb) {
            // Update if different
            if (currentDb.allowed !== state) {
              savePromises.push(
                setRolePermission(serverId, user.id, permission, role.id, undefined, state)
              );
            }
          } else {
            // Create new permission
            savePromises.push(
              setRolePermission(serverId, user.id, permission, role.id, undefined, state)
            );
          }
        } else if (currentDb) {
          // Permission is null but exists in DB - delete it (inherit)
          savePromises.push(deleteRolePermission(currentDb.id, user.id));
        }
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
    <div className="flex h-[52vh] min-h-[22rem] max-h-[34rem] flex-col gap-4 sm:h-[70vh] sm:max-h-[44rem]">
      <div className="space-y-3">
        <div>
          <h3 className="text-base font-semibold">Role Permissions</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure what <span className="font-medium text-foreground">{roleName}</span> can do across the server.
          </p>
        </div>

        <div className="border-b border-border/50 pb-3">
          <BulkPermissionButtons onSet={handleGlobalBulkSet} label="All permissions" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y pr-2 sm:pr-4">
        <div className="space-y-8 pb-1">
          {filteredGroups.map((group) => {
            return (
              <section key={group.label} className="space-y-3">
                <div>
                  <Label className="text-sm font-semibold text-foreground">{group.label} permissions</Label>
                </div>

                <div className="divide-y divide-border/50">
                  {group.permissions.map((permission) => {
                    const state = permissionStates.get(permission) ?? null;
                    const meta = PERMISSION_META[permission];

                    return (
                      <div key={permission} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Label className="text-sm font-medium">{meta.label}</Label>
                            {!meta.enabled && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-500">
                                <ShieldAlert className="h-3 w-3" />
                                Planned
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{meta.description}</p>
                        </div>

                        <div className="grid w-[108px] grid-cols-3 overflow-hidden rounded-[3px] border border-border/70 bg-muted/30">
                          {permissionValueOptions.map(({ value, label, Icon, activeClass, inactiveClass }) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => handlePermissionChange(permission, value)}
                              className={cn(
                                'inline-flex h-7 items-center justify-center border-0 text-xs font-medium transition-colors',
                                state === value ? activeClass : inactiveClass,
                              )}
                              aria-pressed={state === value}
                              aria-label={`${label} ${meta.label}`}
                              title={label}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-4 border-t">
        <Button variant="outline" rounded="full" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button rounded="full" onClick={handleSave} disabled={isSaving}>
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

      {/* Confirmation dialog for global Deny/Allow All */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'deny' ? 'Deny All Permissions?' : 'Allow All Permissions?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to set ALL permissions to {confirmAction?.type === 'deny' ? 'Deny' : 'Allow'}? This will override any individual settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction) {
                  handleBulkSet(confirmAction.permissions, confirmAction.type === 'allow');
                }
                setConfirmAction(null);
              }}
              className={confirmAction?.type === 'deny' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
