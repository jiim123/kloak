import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Save, ShieldAlert, X } from 'lucide-react';
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

export const RolePermissionsEditor = ({ role, serverId, onClose }: RolePermissionsEditorProps) => {
  const { user } = useAuthStore();
  const {
    rolePermissions,
    fetchRolePermissions,
    setRolePermission,
    deleteRolePermission,
  } = useServerStore();

  const [permissionStates, setPermissionStates] = useState<Set<Permission>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ type: 'allow'; permissions: Permission[] } | null>(null);

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
    // Initialize permission states from database
    const states = new Set<Permission>();
    const relevantPermissions = rolePermissions.filter(
      (rp) => rp.role_id === role.id
    );

    for (const rp of relevantPermissions) {
      states.add(rp.permission);
    }

    setPermissionStates(states);
  }, [rolePermissions, role]);

  const permissionCounts = useMemo(() => {
    let granted = 0;
    let inherited = 0;

    for (const permission of allRolePermissions) {
      const state = permissionStates.has(permission);
      if (state) granted += 1;
      else inherited += 1;
    }

    return { granted, inherited, total: allRolePermissions.length };
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

  const handlePermissionChange = (permission: Permission, value: boolean) => {
    setPermissionStates((prev) => {
      const next = new Set(prev);
      if (value) {
        next.add(permission);
      } else {
        next.delete(permission);
      }
      return next;
    });
  };

  const handleBulkSet = (permissions: Permission[], value: boolean) => {
    setPermissionStates((prev) => {
      const next = new Set(prev);
      for (const perm of permissions) {
        if (value) {
          next.add(perm);
        } else {
          next.delete(perm);
        }
      }
      return next;
    });
  };

  const handleGlobalBulkSet = (value: boolean) => {
    if (value) {
      setConfirmAction({ type: 'allow', permissions: allRolePermissions });
    } else {
      setPermissionStates(new Set());
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const currentDbPermissions = rolePermissions.filter(
        (rp) => rp.role_id === role.id
      );

      const currentDbPermSet = new Set(currentDbPermissions.map((rp) => rp.permission));

      const savePromises: Promise<void>[] = [];

      // Process all permissions
      // If granted (in set) -> add permission
      // If not granted (not in set) -> remove permission if exists
      for (const permission of allRolePermissions) {
        const isGranted = permissionStates.has(permission);
        const existsInDb = currentDbPermSet.has(permission);

        if (isGranted) {
          if (!existsInDb) {
            savePromises.push(setRolePermission(serverId, user.id, permission, role.id));
          }
        } else if (existsInDb) {
          const dbPerm = currentDbPermissions.find((rp) => rp.permission === permission);
          if (dbPerm) {
            savePromises.push(deleteRolePermission(dbPerm.id, user.id));
          }
        }
      }

      await Promise.all(savePromises);

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
    <div className="flex max-h-[82vh] flex-col gap-4">
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

      <ScrollArea className="min-h-0 flex-1 pr-4">
        <div className="space-y-8 pb-1">
          {filteredGroups.map((group) => {
            return (
              <section key={group.label} className="space-y-3">
                <div>
                  <h4 className="text-xs font-medium uppercase tracking-widest text-muted-foreground/70">{group.label} permissions</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>
                </div>

                <BulkPermissionButtons
                  onSet={(value) => handleBulkSet(group.permissions, value)}
                  className="mb-2"
                />

                <div className="space-y-0.5">
                  {group.permissions.map((permission) => {
                    const state = permissionStates.has(permission);
                    const meta = PERMISSION_META[permission];

                    return (
                      <div key={permission} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{meta.label}</span>
                            {!meta.enabled && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-500">
                                <ShieldAlert className="h-3 w-3" />
                                Planned
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{meta.description}</p>
                        </div>

                        <div className="flex bg-secondary/80 rounded-lg p-0.5 border border-border/50 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handlePermissionChange(permission, false)}
                            disabled={!meta.enabled}
                            className={cn(
                              "px-2.5 py-1 text-[10px] font-medium rounded-md transition-all",
                              !state
                                ? "bg-background text-foreground shadow-sm border border-border"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            —
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePermissionChange(permission, true)}
                            disabled={!meta.enabled}
                            className={cn(
                              "px-2.5 py-1 text-[10px] font-medium rounded-md transition-all",
                              state
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
              </section>
            );
          })}
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

      {/* Confirmation dialog for global Allow All */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Allow All Permissions?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to grant ALL permissions? This will override any individual settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction) {
                  handleBulkSet(confirmAction.permissions, true);
                }
                setConfirmAction(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};