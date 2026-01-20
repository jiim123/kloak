import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle2, XCircle, Info, Shield, Users, Hash } from 'lucide-react';
import type { Permission } from '@/types';

interface PermissionDebugInfo {
    has_permission: boolean;
    source: 'owner_override' | 'channel_override' | 'role_permission' | 'default_permission';
    base_role: string;
    custom_roles: Array<{ id: string; name: string }>;
    channel_override?: {
        allowed: boolean;
        source: string;
    };
    role_permission?: {
        allowed: boolean;
        source: string;
    };
    default_permission?: {
        allowed: boolean;
        source: string;
    };
    error?: string;
}

const ALL_PERMISSIONS: Permission[] = [
    'view_channels',
    'send_messages',
    'add_reactions',
    'manage_messages',
    'pin_messages',
    'manage_channels',
    'kick_members',
    'ban_members',
    'mute_members',
    'manage_nicknames',
    'manage_roles',
    'manage_server',
    'manage_invites',
    'manage_emojis',
    'transfer_ownership',
];

const PERMISSION_LABELS: Record<Permission, string> = {
    view_channels: 'View Channels',
    send_messages: 'Send Messages',
    add_reactions: 'Add Reactions',
    manage_messages: 'Manage Messages',
    pin_messages: 'Pin Messages',
    manage_channels: 'Manage Channels',
    kick_members: 'Kick Members',
    ban_members: 'Ban Members',
    mute_members: 'Mute Members',
    manage_nicknames: 'Manage Nicknames',
    manage_roles: 'Manage Roles',
    manage_server: 'Manage Server',
    manage_invites: 'Manage Invites',
    manage_emojis: 'Manage Emojis',
    transfer_ownership: 'Transfer Ownership',
};

export function PermissionDebugPanel() {
    const { serverId, channelId } = useParams();
    const { user } = useAuthStore();
    const { activeModal, closeModal } = useUIStore();
    const [loading, setLoading] = useState(false);
    const [debugInfo, setDebugInfo] = useState<Record<Permission, PermissionDebugInfo>>({} as any);
    const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null);

    const isOpen = activeModal === 'permission-debug';

    const debugPermissions = async () => {
        if (!user || !channelId) return;

        setLoading(true);
        try {
            const results: Record<Permission, PermissionDebugInfo> = {} as any;

            // Check each permission
            for (const permission of ALL_PERMISSIONS) {
                const { data, error } = await supabase.rpc('debug_user_permission' as any, {
                    _user_id: user.id,
                    _channel_id: channelId,
                    _permission: permission,
                });

                if (error) {
                    console.error(`Error debugging ${permission}:`, error);
                    results[permission] = {
                        has_permission: false,
                        source: 'default_permission',
                        base_role: '',
                        custom_roles: [],
                        error: error.message,
                    };
                } else {
                    results[permission] = data as PermissionDebugInfo;
                }
            }

            setDebugInfo(results);
        } catch (error) {
            console.error('Error debugging permissions:', error);
        } finally {
            setLoading(false);
        }
    };

    const getSourceIcon = (source: string) => {
        switch (source) {
            case 'owner_override':
                return <Shield className="h-4 w-4 text-yellow-500" />;
            case 'channel_override':
                return <Hash className="h-4 w-4 text-blue-500" />;
            case 'role_permission':
                return <Users className="h-4 w-4 text-purple-500" />;
            case 'default_permission':
                return <Info className="h-4 w-4 text-gray-500" />;
            default:
                return <Info className="h-4 w-4 text-gray-500" />;
        }
    };

    const getSourceLabel = (source: string) => {
        switch (source) {
            case 'owner_override':
                return 'Owner Override';
            case 'channel_override':
                return 'Channel Override';
            case 'role_permission':
                return 'Role Permission';
            case 'default_permission':
                return 'Default Permission';
            default:
                return source;
        }
    };

    const getSourceColor = (source: string) => {
        switch (source) {
            case 'owner_override':
                return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            case 'channel_override':
                return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'role_permission':
                return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
            case 'default_permission':
                return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
            default:
                return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={closeModal}>
            <DialogContent className="max-w-6xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Permission Debugging Panel
                    </DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[calc(90vh-8rem)]">
                    <div className="space-y-4 p-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Shield className="h-5 w-5" />
                                    Permission Debugging Panel
                                </CardTitle>
                                <CardDescription>
                                    Debug and inspect permission resolution for the current user in this channel
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button onClick={debugPermissions} disabled={loading}>
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Debugging...
                                        </>
                                    ) : (
                                        'Debug Permissions'
                                    )}
                                </Button>

                                {Object.keys(debugInfo).length > 0 && (
                                    <div className="space-y-4">
                                        <Alert>
                                            <Info className="h-4 w-4" />
                                            <AlertDescription>
                                                <div className="space-y-2">
                                                    <p className="font-semibold">Permission Resolution Order:</p>
                                                    <ol className="list-decimal list-inside space-y-1 text-sm">
                                                        <li>
                                                            <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                                                                Owner Override
                                                            </Badge>{' '}
                                                            - Owners always have all permissions
                                                        </li>
                                                        <li>
                                                            <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                                                                Channel Override
                                                            </Badge>{' '}
                                                            - Channel-specific permission overrides (highest priority)
                                                        </li>
                                                        <li>
                                                            <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20">
                                                                Role Permission
                                                            </Badge>{' '}
                                                            - Custom role permissions from database
                                                        </li>
                                                        <li>
                                                            <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">
                                                                Default Permission
                                                            </Badge>{' '}
                                                            - Base role default permissions
                                                        </li>
                                                    </ol>
                                                </div>
                                            </AlertDescription>
                                        </Alert>

                                        {/* Permission Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {ALL_PERMISSIONS.map((permission) => {
                                                const info = debugInfo[permission];
                                                if (!info) return null;

                                                return (
                                                    <Card
                                                        key={permission}
                                                        className={`cursor-pointer transition-all hover:shadow-md ${selectedPermission === permission ? 'ring-2 ring-primary' : ''
                                                            }`}
                                                        onClick={() => setSelectedPermission(permission)}
                                                    >
                                                        <CardContent className="p-4 space-y-2">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-medium text-sm truncate">
                                                                        {PERMISSION_LABELS[permission]}
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground">{permission}</p>
                                                                </div>
                                                                {info.has_permission ? (
                                                                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                                                                ) : (
                                                                    <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {getSourceIcon(info.source)}
                                                                <Badge className={`text-xs ${getSourceColor(info.source)}`}>
                                                                    {getSourceLabel(info.source)}
                                                                </Badge>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })}
                                        </div>

                                        {/* Detailed View */}
                                        {selectedPermission && debugInfo[selectedPermission] && (
                                            <Card className="border-2 border-primary">
                                                <CardHeader>
                                                    <CardTitle className="text-lg">
                                                        {PERMISSION_LABELS[selectedPermission]} - Detailed Resolution
                                                    </CardTitle>
                                                    <CardDescription>
                                                        How this permission was resolved for the current user
                                                    </CardDescription>
                                                </CardHeader>
                                                <CardContent className="space-y-4">
                                                    {(() => {
                                                        const info = debugInfo[selectedPermission];

                                                        return (
                                                            <>
                                                                {/* Final Result */}
                                                                <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                                                                    {info.has_permission ? (
                                                                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                                                                    ) : (
                                                                        <XCircle className="h-6 w-6 text-red-500" />
                                                                    )}
                                                                    <div>
                                                                        <p className="font-semibold">
                                                                            {info.has_permission ? 'Permission Granted' : 'Permission Denied'}
                                                                        </p>
                                                                        <p className="text-sm text-muted-foreground">
                                                                            Source: {getSourceLabel(info.source)}
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                {/* Error */}
                                                                {info.error && (
                                                                    <Alert variant="destructive">
                                                                        <AlertDescription>{info.error}</AlertDescription>
                                                                    </Alert>
                                                                )}

                                                                {/* Base Role */}
                                                                <div className="space-y-2">
                                                                    <p className="text-sm font-semibold">Base Role</p>
                                                                    <Badge variant="outline">{info.base_role}</Badge>
                                                                </div>

                                                                {/* Custom Roles */}
                                                                {info.custom_roles && info.custom_roles.length > 0 && (
                                                                    <div className="space-y-2">
                                                                        <p className="text-sm font-semibold">Custom Roles</p>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {info.custom_roles.map((role) => (
                                                                                <Badge key={role.id} variant="secondary">
                                                                                    {role.name}
                                                                                </Badge>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Channel Override */}
                                                                {info.channel_override && (
                                                                    <div className="space-y-2 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                                                                        <div className="flex items-center gap-2">
                                                                            <Hash className="h-4 w-4 text-blue-500" />
                                                                            <p className="text-sm font-semibold">Channel Override</p>
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <div className="flex items-center gap-2">
                                                                                {info.channel_override.allowed ? (
                                                                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                                                ) : (
                                                                                    <XCircle className="h-4 w-4 text-red-500" />
                                                                                )}
                                                                                <span className="text-sm">
                                                                                    {info.channel_override.allowed ? 'Allowed' : 'Denied'}
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-xs text-muted-foreground">
                                                                                {info.channel_override.source}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Role Permission */}
                                                                {info.role_permission && (
                                                                    <div className="space-y-2 p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                                                                        <div className="flex items-center gap-2">
                                                                            <Users className="h-4 w-4 text-purple-500" />
                                                                            <p className="text-sm font-semibold">Role Permission</p>
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <div className="flex items-center gap-2">
                                                                                {info.role_permission.allowed ? (
                                                                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                                                ) : (
                                                                                    <XCircle className="h-4 w-4 text-red-500" />
                                                                                )}
                                                                                <span className="text-sm">
                                                                                    {info.role_permission.allowed ? 'Allowed' : 'Denied'}
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-xs text-muted-foreground">
                                                                                {info.role_permission.source}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Default Permission */}
                                                                {info.default_permission && (
                                                                    <div className="space-y-2 p-3 bg-gray-500/5 border border-gray-500/20 rounded-lg">
                                                                        <div className="flex items-center gap-2">
                                                                            <Info className="h-4 w-4 text-gray-500" />
                                                                            <p className="text-sm font-semibold">Default Permission</p>
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <div className="flex items-center gap-2">
                                                                                {info.default_permission.allowed ? (
                                                                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                                                ) : (
                                                                                    <XCircle className="h-4 w-4 text-red-500" />
                                                                                )}
                                                                                <span className="text-sm">
                                                                                    {info.default_permission.allowed ? 'Allowed' : 'Denied'}
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-xs text-muted-foreground">
                                                                                {info.default_permission.source}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </CardContent>
                                            </Card>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
