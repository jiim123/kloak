import { CircleNotch, FloppyDisk, PaperPlaneTilt } from "@phosphor-icons/react";
import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Permission, ServerRole, CustomServerRole } from '@/types';
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
 permissions: ['manage_server', 'manage_roles', 'manage_emojis', 'manage_webhooks', 'manage_invites', 'create_instant_invite', 'transfer_ownership'],
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
 view_tasks: 'View Tasks',
 create_tasks: 'Create Tasks',
 edit_own_tasks: 'Edit Own Tasks',
 edit_all_tasks: 'Edit All Tasks',
 assign_tasks: 'Assign Tasks',
 change_task_status: 'Change Task Status',
 delete_tasks: 'Delete Tasks',
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
 'view_channels', 'read_message_history', 'send_messages', 'add_reactions',
 'attach_files', 'embed_links', 'mention_everyone', 'mention_roles', 'use_external_emojis',
 'manage_messages', 'pin_messages', 'manage_channels', 'manage_threads',
 'kick_members', 'ban_members', 'mute_members', 'deafen_members', 'move_members',
 'manage_nicknames', 'change_nickname', 'manage_roles', 'manage_server', 'manage_emojis',
 'manage_webhooks', 'manage_invites', 'create_instant_invite', 'transfer_ownership',
 'connect', 'speak', 'use_voice_activation', 'use_application_commands'
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

 const [confirmAction, setConfirmAction] = useState<{ type: 'deny' | 'allow'; permissions: Permission[] } | null>(null);

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

 const allPermissions = PERMISSION_GROUPS.flatMap(g => g.permissions);

 const handleGlobalBulkSet = (value: boolean | null) => {
 if (value !== null) {
 setConfirmAction({ type: value ? 'allow' : 'deny', permissions: allPermissions });
 } else {
 handleBulkSet(allPermissions, null);
 }
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
 <CircleNotch className="w-6 h-6 animate-spin" />
 </div>
 );
 }

 return (
 <div className="space-y-4">
 <div>
 <h3 className="text-sm font-medium">Role Permissions</h3>
 <p className="text-xs text-muted-foreground mt-1">
 Configure permissions for {roleName}
 </p>
 </div>

 <ScrollArea className="h-[400px] pr-4">
 <div className="space-y-6">
 {/* Global bulk set */}
 <div className="pb-3 border-b border-border/50">
 <BulkPermissionButtons
 onSet={handleGlobalBulkSet}
 label="Set all permissions:"
 />
 </div>

 {PERMISSION_GROUPS.map((group) => (
 <div key={group.label} className="space-y-3">
 <Label className="text-xs font-medium text-muted-foreground uppercase">
 {group.label}
 </Label>
 <BulkPermissionButtons
 onSet={(value) => handleBulkSet(group.permissions, value)}
 className="mb-1"
 />
 <div className="space-y-2 pl-1">
 {group.permissions.map((permission) => {
 const state = permissionStates.get(permission);

 return (
 <div key={permission} className="flex items-center justify-between p-2 rounded-md hover:bg-secondary/50 group/item">
 <Label
 htmlFor={permission}
 className="text-sm font-normal cursor-pointer flex-1"
 >
 {PERMISSION_LABELS[permission]}
 </Label>
 <div className="flex bg-secondary/80 rounded-lg p-0.5 border border-border/50">
 <button
 onClick={() => handlePermissionChange(permission, false)}
 className={cn(
 "px-3 py-1 text-[10px] font-medium rounded-md transition-all",
 state === false
 ? "bg-destructive text-destructive-foreground shadow-sm"
 : "text-muted-foreground hover:text-foreground"
 )}
 >
 DENY
 </button>
 <button
 onClick={() => handlePermissionChange(permission, null)}
 className={cn(
 "px-3 py-1 text-[10px] font-medium rounded-md transition-all",
 state === null
 ? "bg-background text-foreground shadow-sm border border-border"
 : "text-muted-foreground hover:text-foreground"
 )}
 >
 INHERIT
 </button>
 <button
 onClick={() => handlePermissionChange(permission, true)}
 className={cn(
 "px-3 py-1 text-[10px] font-medium rounded-md transition-all",
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

 <div className="flex items-center justify-end gap-2 pt-4 border-t">
 <Button variant="outline" onClick={onClose} disabled={isSaving}>
 Cancel
 </Button>
 <Button onClick={handleSave} disabled={isSaving}>
 {isSaving ? (
 <>
 <CircleNotch className="w-4 h-4 mr-2 animate-spin" />
 Saving...
 </>
 ) : (
 <>
 <FloppyDisk className="w-4 h-4 mr-2" />
 FloppyDisk Changes
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
