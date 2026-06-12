import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, ArrowLeft, Shield } from 'lucide-react';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import type { Permission, ChannelPermission } from '@/types';
import { cn } from '@/lib/utils';
import { PERMISSION_META, PERMISSION_GROUPS } from '@/lib/permissionMeta';
import { BulkPermissionButtons } from '@/components/permissions/BulkPermissionButtons';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
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
  const isMobile = useIsMobile();

  const [selectedRoleKey, setSelectedRoleKey] = useState<string | null>(null);
  const [permissionStates, setPermissionStates] = useState<Map<string, Set<Permission>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const allRoles = useMemo(() => {
    return roles
      .map(r => ({ id: r.id, name: r.name, label: r.name, color: r.color, position: r.position }))
      .sort((a, b) => {
        if (a.label === '@everyone') return 1;
        if (b.label === '@everyone') return -1;
        return a.position - b.position;
      });
  }, [roles]);

  useEffect(() => {
    if (!isMobile && allRoles.length > 0 && !selectedRoleKey) {
      const firstRole = allRoles[0];
      setSelectedRoleKey(firstRole.id);
    }
  }, [allRoles, selectedRoleKey, isMobile]);

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
    const states = new Map<string, Set<Permission>>();
    for (const role of allRoles) {
      states.set(role.id, new Set());
    }

    for (const cp of channelPermissions) {
      const roleState = states.get(cp.role_id);
      if (roleState) {
        roleState.add(cp.permission);
      }
    }

    setPermissionStates(states);
  }, [channelPermissions, allRoles]);

  const [confirmAction, setConfirmAction] = useState<{ type: 'allow' } | null>(null);

  const handlePermissionChange = (roleId: string, permission: Permission, value: boolean) => {
    setPermissionStates((prev) => {
      const next = new Map(prev);
      const rolePerms = next.get(roleId) || new Set();
      if (value) {
        rolePerms.add(permission);
      } else {
        rolePerms.delete(permission);
      }
      next.set(roleId, rolePerms);
      return next;
    });
  };

  const handleBulkSet = (permissions: Permission[], value: boolean) => {
    if (!selectedRoleKey) return;
    setPermissionStates((prev) => {
      const next = new Map(prev);
      const rolePerms = next.get(selectedRoleKey) || new Set();
      for (const perm of permissions) {
        const meta = PERMISSION_META[perm];
        if (meta.enabled) {
          if (value) {
            rolePerms.add(perm);
          } else {
            rolePerms.delete(perm);
          }
        }
      }
      next.set(selectedRoleKey, rolePerms);
      return next;
    });
  };

  const allEnabledPermissions = PERMISSION_GROUPS.flatMap(g => g.permissions).filter(p => PERMISSION_META[p].enabled);

  const handleGlobalBulkSet = (value: boolean) => {
    if (!selectedRoleKey) return;
    setConfirmAction({ type: 'allow' });
  };

  const hasPermission = (roleId: string, permission: Permission): boolean => {
    return permissionStates.get(roleId)?.has(permission) ?? false;
  };

  const getRoleOverrideCount = (roleId: string): number => {
    return permissionStates.get(roleId)?.size ?? 0;
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const currentDbPermMap = new Map<string, ChannelPermission>();
      for (const cp of channelPermissions) {
        const key = `${cp.role_id}:${cp.permission}`;
        currentDbPermMap.set(key, cp);
      }

      const savePromises: Promise<void>[] = [];

      for (const role of allRoles) {
        const rolePerms = permissionStates.get(role.id);
        if (!rolePerms) continue;

        for (const permission of allEnabledPermissions) {
          const state = rolePerms.has(permission);
          const dbKey = `${role.id}:${permission}`;
          const currentDb = currentDbPermMap.get(dbKey);

          if (state) {
            if (!currentDb) {
              savePromises.push(
                setChannelPermission(channelId, user.id, permission, role.id)
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

  const selectedRole = allRoles.find(r => r.id === selectedRoleKey);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const showList = !isMobile || !selectedRoleKey;
  const showDetail = !isMobile || !!selectedRoleKey;

  return (
    <div className="flex h-full">
      {showList && (
        <div className={cn("border-r border-border flex flex-col", isMobile ? "w-full" : "w-64")}>
          <div className="p-4 border-b border-border">
            <h4 className="text-sm font-medium">Roles</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Select a role to override its permissions in this channel
            </p>
          </div>
          <ScrollArea className="flex-1">
            {allRoles.length > 0 ? (
              <div className="p-2 space-y-1">
                {allRoles.map((role) => {
                  const isSelected = selectedRoleKey === role.id;
                  const overrideCount = getRoleOverrideCount(role.id);
                  const isGradient = role.color.startsWith('linear-gradient');
                  const roleNameStyle = isGradient
                    ? ({
                        background: role.color,
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        color: "transparent",
                      } as React.CSSProperties)
                    : ({ color: role.color } as React.CSSProperties);

                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setSelectedRoleKey(role.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors text-left",
                        isSelected && "bg-secondary/70 ring-1 ring-primary/50"
                      )}
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={isGradient ? { background: role.color } : { backgroundColor: role.color }}
                      />
                      <span
                        className={cn(
                          "text-sm font-medium truncate flex-1",
                          isGradient && "text-transparent"
                        )}
                        style={roleNameStyle}
                      >
                        {role.label}
                      </span>
                      {overrideCount > 0 && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0"
                        >
                          {overrideCount}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <Shield className="w-10 h-10 text-muted-foreground/50 mb-2" />
                <p className="text-xs text-muted-foreground">No roles yet</p>
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {showDetail && (
        <div className="flex-1 overflow-y-auto">
          {selectedRole ? (
            <div className="p-6 space-y-6 max-w-2xl">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedRoleKey(null)}
                  className="flex items-center gap-1 -ml-2 mb-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Roles
                </Button>
              )}

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                    style={
                      selectedRole.color.startsWith('linear-gradient')
                        ? { background: selectedRole.color }
                        : { backgroundColor: selectedRole.color }
                    }
                  />
                  <h3 className="text-lg font-medium">Permissions for {selectedRole.label}</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Override role permissions for this channel. Settings here take priority over server-wide role settings.
                </p>
              </div>

              <div className="pb-3 border-b border-border/50">
                <BulkPermissionButtons
                  onSet={(value) => handleBulkSet(allEnabledPermissions, value)}
                  label="Set all permissions:"
                />
              </div>

              {PERMISSION_GROUPS.map((group) => (
                <div key={group.label} className="space-y-1">
                  <div className="mb-3">
                    <h4 className="text-xs font-medium uppercase tracking-widest text-muted-foreground/70">
                      {group.label}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>
                  </div>
                  <BulkPermissionButtons
                    onSet={(value) => handleBulkSet(group.permissions, value)}
                    className="mb-2"
                  />
                  <div className="space-y-0.5">
                    {group.permissions.map((permission) => {
                      const meta = PERMISSION_META[permission];
                      const state = hasPermission(selectedRoleKey!, permission);
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
                          <div className="flex bg-secondary/80 rounded-lg p-0.5 border border-border/50 flex-shrink-0">
                            <button
                              onClick={() => handlePermissionChange(selectedRoleKey!, permission, false)}
                              disabled={isDisabled}
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
                              onClick={() => handlePermissionChange(selectedRoleKey!, permission, true)}
                              disabled={isDisabled}
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
                </div>
              ))}

              <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm py-3 flex items-center justify-between border-t border-border/50 -mx-6 px-6">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">✓</span> Allow · <span className="font-medium text-foreground">—</span> Inherit
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
          ) : (
            <div className="flex items-center justify-center h-full p-6">
              <div className="text-center max-w-xs">
                <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center mx-auto mb-3">
                  <Shield className="w-6 h-6 text-muted-foreground/60" />
                </div>
                <p className="text-sm font-medium">Select a role</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Choose a role on the left to customize its permissions for this channel
                </p>
              </div>
            </div>
          )}
        </div>
      )}

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
                if (confirmAction && selectedRoleKey) {
                  handleBulkSet(allEnabledPermissions, true);
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