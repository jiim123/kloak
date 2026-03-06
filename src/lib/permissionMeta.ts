import type { Permission } from '@/types';

export interface PermissionMeta {
  label: string;
  description: string;
  enabled: boolean; // Whether this permission has backend enforcement
}

export const PERMISSION_META: Record<Permission, PermissionMeta> = {
  view_channels: { label: 'View Channels', description: 'Allows members to view channels and read messages in them.', enabled: true },
  read_message_history: { label: 'Read Message History', description: 'Allows members to read previously sent messages in channels.', enabled: true },
  send_messages: { label: 'Send Messages', description: 'Allows members to send messages in text channels.', enabled: true },
  add_reactions: { label: 'Add Reactions', description: 'Allows members to add emoji reactions to messages.', enabled: true },
  attach_files: { label: 'Attach Files', description: 'Allows members to upload files and images in messages.', enabled: true },
  embed_links: { label: 'Embed Links', description: 'Allows members to post links with embedded previews.', enabled: true },
  mention_everyone: { label: 'Mention @everyone', description: 'Allows members to use @everyone to notify all members.', enabled: false },
  mention_roles: { label: 'Mention Roles', description: 'Allows members to mention roles to notify role members.', enabled: false },
  use_external_emojis: { label: 'Use External Emojis', description: 'Allows members to use emojis from other servers.', enabled: true },
  kick_members: { label: 'Kick Members', description: 'Allows members to remove other members from the server. They can rejoin with an invite.', enabled: true },
  ban_members: { label: 'Ban Members', description: 'Allows members to permanently ban other members from the server.', enabled: true },
  mute_members: { label: 'Mute Members', description: 'Allows members to mute other members, preventing them from sending messages.', enabled: true },
  deafen_members: { label: 'Deafen Members', description: 'Allows members to deafen other members in voice channels.', enabled: false },
  move_members: { label: 'Move Members', description: 'Allows members to move other members between voice channels.', enabled: false },
  manage_nicknames: { label: 'Manage Nicknames', description: 'Allows members to change the nicknames of other members.', enabled: true },
  change_nickname: { label: 'Change Own Nickname', description: 'Allows members to change their own server nickname.', enabled: true },
  manage_channels: { label: 'Manage Channels', description: 'Allows members to create, edit, and delete channels and categories.', enabled: true },
  manage_messages: { label: 'Manage Messages', description: 'Allows members to delete and pin messages from other members.', enabled: true },
  pin_messages: { label: 'Pin Messages', description: 'Allows members to pin important messages in channels.', enabled: true },
  manage_threads: { label: 'Manage Threads', description: 'Allows members to manage and moderate forum threads.', enabled: false },
  manage_server: { label: 'Manage Server', description: 'Allows members to change the server name, icon, banner, and other settings.', enabled: true },
  manage_roles: { label: 'Manage Roles', description: 'Allows members to create, edit, and assign roles to other members.', enabled: true },
  manage_emojis: { label: 'Manage Emojis', description: 'Allows members to upload, edit, and delete custom server emojis.', enabled: true },
  manage_webhooks: { label: 'Manage Webhooks', description: 'Allows members to create, edit, and delete webhooks for integrations.', enabled: false },
  manage_invites: { label: 'Manage Invites', description: 'Allows members to create and revoke server invite links.', enabled: true },
  create_instant_invite: { label: 'Create Invite', description: 'Allows members to create invite links for the server.', enabled: false },
  transfer_ownership: { label: 'Transfer Ownership', description: 'Allows the owner to transfer server ownership to another member.', enabled: false },
  connect: { label: 'Connect', description: 'Allows members to join voice channels and listen.', enabled: true },
  speak: { label: 'Speak', description: 'Allows members to speak in voice channels.', enabled: true },
  use_voice_activation: { label: 'Voice Activity', description: 'Allows members to use voice activity detection instead of push-to-talk.', enabled: false },
  use_application_commands: { label: 'Use Commands', description: 'Allows members to use bot and application slash commands.', enabled: false },
  view_tasks: { label: 'View Tasks', description: 'Allows members to view tasks in task boards.', enabled: true },
  create_tasks: { label: 'Create Tasks', description: 'Allows members to create new tasks.', enabled: true },
  edit_own_tasks: { label: 'Edit Own Tasks', description: 'Allows members to edit tasks they created.', enabled: true },
  edit_all_tasks: { label: 'Edit All Tasks', description: 'Allows members to edit any task regardless of who created it.', enabled: true },
  assign_tasks: { label: 'Assign Tasks', description: 'Allows members to assign tasks to other members.', enabled: true },
  change_task_status: { label: 'Change Task Status', description: 'Allows members to change the status of tasks.', enabled: true },
  delete_tasks: { label: 'Delete Tasks', description: 'Allows members to delete tasks.', enabled: true },
};

export const PERMISSION_GROUPS: Array<{
  label: string;
  description: string;
  permissions: Permission[];
}> = [
  {
    label: 'General',
    description: 'Basic server access and interaction',
    permissions: ['view_channels', 'read_message_history', 'send_messages', 'add_reactions'],
  },
  {
    label: 'Messages',
    description: 'Messaging features and content',
    permissions: ['attach_files', 'embed_links', 'mention_everyone', 'mention_roles', 'use_external_emojis'],
  },
  {
    label: 'Moderation',
    description: 'Member management and moderation tools',
    permissions: ['kick_members', 'ban_members', 'mute_members', 'deafen_members', 'move_members', 'manage_nicknames', 'change_nickname'],
  },
  {
    label: 'Channel Management',
    description: 'Channel and message administration',
    permissions: ['manage_channels', 'manage_messages', 'pin_messages', 'manage_threads'],
  },
  {
    label: 'Server Administration',
    description: 'Server-wide settings and configuration',
    permissions: ['manage_server', 'manage_roles', 'manage_emojis', 'manage_webhooks', 'manage_invites', 'create_instant_invite', 'transfer_ownership'],
  },
  {
    label: 'Voice',
    description: 'Voice channel capabilities',
    permissions: ['connect', 'speak', 'use_voice_activation'],
  },
  {
    label: 'Advanced',
    description: 'Bots and application integrations',
    permissions: ['use_application_commands'],
  },
  {
    label: 'Tasks',
    description: 'Task board management',
    permissions: ['view_tasks', 'create_tasks', 'edit_own_tasks', 'edit_all_tasks', 'assign_tasks', 'change_task_status', 'delete_tasks'],
  },
];
