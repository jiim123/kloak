import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { inviteCodeRateLimiter } from '@/lib/security';
import { saveLastChannel, getLastChannel } from '@/lib/storage';
import { bulkSetUsersInCache, deduplicatedFetch } from '@/lib/userCache';
import { useAuthStore } from './authStore';
import { useFriendStore } from './friendStore';
import type {
  Server,
  ServerWithMembership,
  ServerMember,
  Channel,
  ChannelCategory,
  ChannelType,
  ServerRole,
  CustomServerRole,
  RolePermission,
  ChannelPermission,
  CategoryPermission,
  Permission
} from '@/types';

// Permission queries can be triggered by multiple components/effects.
// Use a short TTL cache to avoid sequential re-fetch spam when switching channels.
const PERMISSIONS_TTL_MS = 60_000;
const rolePermissionsCache = new Map<string, { data: RolePermission[]; cachedAt: number }>();
const channelPermissionsCache = new Map<string, { data: ChannelPermission[]; cachedAt: number }>();

const MEMBERS_CACHE_TTL_MS = 60_000;
const membersCachedAt = new Map<string, number>();

interface ServerState {
  servers: ServerWithMembership[];
  currentServer: Server | null;
  currentChannel: Channel | null;
  categories: ChannelCategory[];
  channels: Channel[];
  members: ServerMember[];
  isMembersLoading: boolean;
  /** Which server the current `members` list belongs to (even if empty after a failed fetch). */
  membersServerId: string | null;
  isLoading: boolean;
  error: string | null;

  // Server actions
  fetchServers: (userId: string) => Promise<void>;
  createServer: (name: string, ownerId: string) => Promise<Server | null>;
  updateServer: (
    serverId: string,
    userId: string,
    updates: { name?: string; icon_url?: string | null; banner_url?: string | null; is_published?: boolean; about?: string | null }
  ) => Promise<void>;
  joinServer: (inviteCode: string, userId: string, joinSource?: 'discover' | 'invite_link') => Promise<Server | null>;
  leaveServer: (serverId: string, userId: string) => Promise<void>;
  toggleServerMute: (serverId: string, userId: string) => Promise<void>;
  deleteServer: (serverId: string) => Promise<void>;
  setCurrentServer: (server: Server | null) => void;
  setCurrentChannel: (channel: Channel | null) => void;

  // Channel actions
  fetchChannels: (serverId: string) => Promise<void>;
  createCategory: (serverId: string, name: string, userId: string) => Promise<ChannelCategory | null>;
  createChannel: (serverId: string, name: string, type: ChannelType, userId: string, categoryId?: string, icon?: string, isPrivate?: boolean, ghostMode?: boolean) => Promise<Channel | null>;
  
  // Channel member actions (for private channels)
  channelMembers: { channelId: string; members: import('@/types').ChannelMember[] }[];
  fetchChannelMembers: (channelId: string) => Promise<void>;
  addChannelMember: (channelId: string, targetUserId: string, addedBy: string) => Promise<boolean>;
  removeChannelMember: (channelId: string, targetUserId: string, removedBy: string) => Promise<boolean>;
  updateChannel: (channelId: string, updates: Partial<Channel>, userId: string) => Promise<void>;
  deleteChannel: (channelId: string, userId: string) => Promise<void>;
  updateCategory: (categoryId: string, updates: Partial<ChannelCategory>, userId: string) => Promise<void>;
  deleteCategory: (categoryId: string, userId: string) => Promise<void>;
  reorderCategories: (categoryIds: string[]) => Promise<void>;
  reorderChannels: (channelId: string, newCategoryId: string | null, newPosition: number) => Promise<void>;
  moveChannelToCategory: (channelId: string, categoryId: string | null) => Promise<void>;

  // Member actions
  fetchMembers: (serverId: string) => Promise<void>;
  updateMember: (memberId: string, updates: Partial<ServerMember>) => Promise<void>;
  kickMember: (serverId: string, userId: string) => Promise<void>;
  banMember: (serverId: string, userId: string) => Promise<void>;
  transferOwnership: (serverId: string, newOwnerId: string) => Promise<void>;

  // Role actions
  roles: CustomServerRole[];
  fetchRoles: (serverId: string) => Promise<void>;
  createRole: (serverId: string, userId: string, name: string, color: string, icon?: string | null) => Promise<CustomServerRole | null>;
  updateRole: (roleId: string, userId: string, updates: { name?: string; color?: string; icon?: string | null }) => Promise<void>;
  deleteRole: (roleId: string, userId: string) => Promise<void>;
  reorderRoles: (serverId: string, userId: string, orderedRoleIds: string[]) => Promise<void>;
  assignRoleToMember: (memberId: string, roleId: string, userId: string) => Promise<void>;
  removeRoleFromMember: (memberId: string, roleId: string, userId: string) => Promise<void>;

  // Permission actions
  rolePermissions: RolePermission[];
  channelPermissions: ChannelPermission[];
  categoryPermissions: CategoryPermission[];
  fetchRolePermissions: (serverId: string, opts?: { force?: boolean }) => Promise<void>;
  fetchChannelPermissions: (channelId: string, opts?: { force?: boolean }) => Promise<void>;
  fetchCategoryPermissions: (categoryId: string) => Promise<void>;
  setRolePermission: (serverId: string, userId: string, permission: Permission, roleId?: string, roleName?: ServerRole, allowed?: boolean) => Promise<void>;
  setChannelPermission: (channelId: string, userId: string, permission: Permission, allowed: boolean, roleId?: string, roleName?: ServerRole, targetUserId?: string) => Promise<void>;
  setCategoryPermission: (categoryId: string, userId: string, permission: Permission, allowed: boolean, roleId?: string, roleName?: ServerRole, targetUserId?: string) => Promise<void>;
  deleteRolePermission: (permissionId: string, userId: string) => Promise<void>;
  deleteChannelPermission: (permissionId: string, userId: string) => Promise<void>;
  deleteCategoryPermission: (permissionId: string, userId: string) => Promise<void>;
  syncCategoryPermissionsToChannels: (categoryId: string, userId: string) => Promise<void>;

  // Discord Template Import
  importDiscordTemplate: (serverId: string, userId: string, templateUrl: string) => Promise<{ success: boolean; error?: string; imported?: { categories: number; channels: number; roles: number } }>;

  // Utility
  clearServerState: () => void;
}

export const useServerStore = create<ServerState>((set, get) => ({
  servers: [],
  currentServer: null,
  currentChannel: null,
  categories: [],
  channels: [],
  members: [],
  isMembersLoading: false,
  membersServerId: null,
  roles: [],
  rolePermissions: [],
  channelPermissions: [],
  categoryPermissions: [],
  channelMembers: [],
  isLoading: false,
  error: null,

  fetchServers: async (userId: string) => {
    return deduplicatedFetch(`serverStore:fetchServers:${userId}`, async () => {
      set({ isLoading: true });
      try {
        // Use RPC function to bypass RLS (app uses custom auth, not Supabase Auth)
        const { data, error } = await supabase.rpc('get_user_servers', { _user_id: userId });

        if (error) throw error;

      // Cast the JSON result to array
      const serverData = (data || []) as unknown as Array<{
        id: string;
        name: string;
        owner_id: string;
        invite_code: string;
        icon_url: string | null;
        banner_url: string | null;
        is_published?: boolean;
        about?: string | null;
        system_channel_join_id?: string | null;
        system_channel_leave_id?: string | null;
        enable_join_messages?: boolean;
        enable_leave_messages?: boolean;
        created_at: string;
        role: ServerRole;
        nickname: string | null;
        joined_at: string;
        is_muted?: boolean;
        position?: number | null;
      }>;

      const servers: ServerWithMembership[] = serverData.map((item) => ({
          id: item.id,
          name: item.name,
          owner_id: item.owner_id,
          invite_code: item.invite_code,
          icon_url: item.icon_url,
          banner_url: item.banner_url,
          is_published: item.is_published ?? false,
          about: item.about ?? null,
          system_channel_join_id: item.system_channel_join_id ?? null,
          system_channel_leave_id: item.system_channel_leave_id ?? null,
          enable_join_messages: item.enable_join_messages ?? true,
          enable_leave_messages: item.enable_leave_messages ?? true,
          created_at: item.created_at,
          role: item.role,
          nickname: item.nickname,
          joined_at: item.joined_at,
          is_muted: item.is_muted ?? false,
          position: item.position ?? null,
        }));

      const { currentServer } = get();

      // Check if current server is still in the user's servers list (handles kick/ban/leave)
      if (currentServer) {
        const stillMember = servers.find(s => s.id === currentServer.id);
        if (!stillMember) {
          // User was kicked/banned/left this server - clear it
          localStorage.removeItem('kloak-current-server-id');
          localStorage.removeItem('kloak-current-channel-id');
          set({ 
            servers, 
            currentServer: null, 
            currentChannel: null,
            channels: [],
            categories: [],
            members: [],
            membersServerId: null,
            isLoading: false 
          });
          return;
        }
      }

      // Try to restore persisted server/channel from localStorage
      const persistedServerId = localStorage.getItem('kloak-current-server-id');
      const isDMViewActive = localStorage.getItem('kloak-dm-view-active') === 'true';

      // Only auto-select a server on initial load (when persistedServerId exists)
      // Don't auto-select if user has explicitly navigated to DM view
      if (servers.length > 0 && currentServer === null && persistedServerId && !isDMViewActive) {
        // Check if persisted server exists in user's servers
        const restoredServer = servers.find(s => s.id === persistedServerId);

        if (restoredServer) {
          set({ servers, currentServer: restoredServer, isLoading: false });
        } else {
          // Persisted server no longer exists (user was kicked/left/deleted)
          // Clear the persisted ID but don't auto-select - let user choose
          localStorage.removeItem('kloak-current-server-id');
          localStorage.removeItem('kloak-current-channel-id');
          set({ servers, isLoading: false });
        }
        } else {
          set({ servers, isLoading: false });
        }
      } catch (error) {
        console.error('Failed to fetch servers:', error);
        set({ error: 'Failed to load servers', isLoading: false });
      }
    });
  },

  createServer: async (name: string, ownerId: string) => {
    try {
      // Use RPC function to create server with all related records (bypasses RLS)
      const { data, error } = await supabase.rpc('create_server_with_owner', {
        _name: name,
        _owner_id: ownerId,
      });

      if (error) throw error;

      if (!data) {
        throw new Error('No server data returned');
      }

      // Cast the JSON result
      const serverData = data as unknown as {
        id: string;
        name: string;
        owner_id: string;
        invite_code: string;
        icon_url: string | null;
        banner_url: string | null;
        is_published?: boolean;
        about?: string | null;
        created_at: string;
      };

      const server: Server = {
        id: serverData.id,
        name: serverData.name,
        owner_id: serverData.owner_id,
        invite_code: serverData.invite_code,
        icon_url: serverData.icon_url,
        banner_url: serverData.banner_url,
        is_published: serverData.is_published ?? false,
        about: serverData.about ?? null,
        created_at: serverData.created_at,
      };

      // Refresh servers list
      await get().fetchServers(ownerId);

      return server;
    } catch (error) {
      console.error('Failed to create server:', error);
      set({ error: 'Failed to create server' });
      return null;
    }
  },

  updateServer: async (
    serverId: string,
    userId: string,
    updates: { 
      name?: string; 
      icon_url?: string | null; 
      banner_url?: string | null; 
      is_published?: boolean; 
      about?: string | null;
      system_channel_join_id?: string | null;
      system_channel_leave_id?: string | null;
      enable_join_messages?: boolean;
      enable_leave_messages?: boolean;
    }
  ) => {
    // Note: publishing is owner-only in the update_server RPC
    try {
      // Use RPC function to bypass RLS
      const { data, error } = await supabase.rpc('update_server', {
        _server_id: serverId,
        _user_id: userId,
        _updates: updates,
      });

      if (error) {
        console.error('update_server RPC error:', error);
        throw error;
      }

      const result = data as { success: boolean; error?: string; server?: any } | null;
      if (result && !result.success) {
        console.error('update_server failed:', result.error);
        throw new Error(result.error || 'Failed to update server');
      }

      // Use the server data returned from RPC if available, otherwise use updates
      const serverUpdates = result?.server ? {
        ...updates,
        system_channel_join_id: result.server.system_channel_join_id ?? null,
        system_channel_leave_id: result.server.system_channel_leave_id ?? null,
        enable_join_messages: result.server.enable_join_messages ?? false,
        enable_leave_messages: result.server.enable_leave_messages ?? false,
      } : updates;
      
      set((state) => ({
        servers: state.servers.map((s) =>
          s.id === serverId ? { ...s, ...serverUpdates } : s
        ),
        currentServer:
          state.currentServer?.id === serverId
            ? { ...state.currentServer, ...serverUpdates }
            : state.currentServer,
      }));
    } catch (error) {
      console.error('Failed to update server:', error);
      throw error;
    }
  },

  joinServer: async (inviteCode: string, userId: string, joinSource?: 'discover' | 'invite_link') => {
    try {
      // Rate limit invite code lookups to prevent abuse
      if (!inviteCodeRateLimiter.isAllowed(userId)) {
        const remainingTime = inviteCodeRateLimiter.getRemainingTime(userId);
        set({ error: `Too many attempts. Try again in ${remainingTime} seconds` });
        return null;
      }

      // Use RPC function to join server (bypasses RLS). joinSource: 'discover' when joining from Explore.
      const { data, error } = await supabase.rpc('join_server_by_invite', {
        _invite_code: inviteCode.toUpperCase(),
        _user_id: userId,
        _join_source: joinSource ?? 'invite_link',
      });

      if (error) {
        console.error('join_server_by_invite RPC error:', error);
        // Handle specific error messages
        if (error.message.includes('Invalid invite code')) {
          set({ error: 'Invalid invite code' });
          return null;
        }
        if (error.message.includes('banned')) {
          set({ error: 'You are banned from this server' });
          return null;
        }
        if (error.message.includes('already a member')) {
          set({ error: 'You are already a member of this server' });
          return null;
        }
        // Generic error fallback
        set({ error: error.message || 'Failed to join server' });
        return null;
      }

      if (!data) {
        set({ error: 'Invalid invite code' });
        return null;
      }

      // Parse the server data from the RPC response
      const serverData = data as unknown as {
        id: string;
        name: string;
        owner_id: string;
        invite_code: string;
        icon_url: string | null;
        banner_url: string | null;
        is_published?: boolean;
        about?: string | null;
        created_at: string;
        debug?: {
          system_channel_join_id: string | null;
          enable_join_messages: boolean | null;
          user_id?: string;
          message_inserted: boolean;
          message_id?: string | null;
          insert_error?: string | null;
          channel_exists?: boolean;
        };
      };

      // Log debug info if available
      if (serverData.debug) {
        console.log('[Join Server Debug]', {
          system_channel_join_id: serverData.debug.system_channel_join_id,
          enable_join_messages: serverData.debug.enable_join_messages,
          user_id: serverData.debug.user_id,
          message_inserted: serverData.debug.message_inserted,
          message_id: serverData.debug.message_id,
          insert_error: serverData.debug.insert_error,
          channel_exists: serverData.debug.channel_exists,
        });
      }

      const server: Server = {
        id: serverData.id,
        name: serverData.name,
        owner_id: serverData.owner_id,
        invite_code: serverData.invite_code,
        icon_url: serverData.icon_url,
        banner_url: serverData.banner_url,
        is_published: serverData.is_published ?? false,
        about: serverData.about ?? null,
        created_at: serverData.created_at,
      };

      // Defense-in-depth: verify user is not banned after RPC returns
      const { data: isBanned } = await supabase.rpc('is_server_banned_secure', {
        _server_id: server.id,
        _user_id: userId,
      });

      if (isBanned) {
        set({ error: 'You are banned from this server' });
        return null;
      }

      // Refresh servers list
      await get().fetchServers(userId);

      return server;
    } catch (error) {
      console.error('Failed to join server:', error);
      set({ error: 'Failed to join server' });
      return null;
    }
  },

  leaveServer: async (serverId: string, userId: string) => {
    try {
      // Use RPC function to properly leave server (posts leave message if enabled)
      const { error } = await supabase.rpc('leave_server', {
        _server_id: serverId,
        _user_id: userId,
      });

      if (error) throw error;

      set((state) => ({
        servers: state.servers.filter((s) => s.id !== serverId),
        currentServer: state.currentServer?.id === serverId ? null : state.currentServer,
        currentChannel: state.currentServer?.id === serverId ? null : state.currentChannel,
      }));
    } catch (error) {
      console.error('Failed to leave server:', error);
      set({ error: 'Failed to leave server' });
    }
  },

  toggleServerMute: async (serverId: string, userId: string) => {
    try {
      const { data, error } = await (supabase.rpc as any)('toggle_server_mute', {
        _server_id: serverId,
        _user_id: userId,
      });

      if (error) throw error;

      const newMuteState = data as unknown as boolean;

      // Update local state
      set((state) => ({
        servers: state.servers.map((s) =>
          s.id === serverId ? { ...s, is_muted: newMuteState } : s
        ),
      }));
    } catch (error) {
      console.error('Failed to toggle server mute:', error);
    }
  },

  deleteServer: async (serverId: string) => {
    try {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase.rpc('delete_server', {
        _server_id: serverId,
        _user_id: userId,
      });

      if (error) throw error;

      set((state) => ({
        servers: state.servers.filter((s) => s.id !== serverId),
        currentServer: state.currentServer?.id === serverId ? null : state.currentServer,
        currentChannel: null,
        channels: [],
        categories: [],
        members: [],
        membersServerId: null,
      }));
    } catch (error) {
      console.error('Failed to delete server:', error);
      set({ error: 'Failed to delete server' });
    }
  },

  setCurrentServer: (server) => {
    const { currentServer } = get();
    // If clicking the same server, don't clear state
    if (server?.id === currentServer?.id) {
      return;
    }
    // Persist to localStorage
    if (server) {
      localStorage.setItem('kloak-current-server-id', server.id);
      // Clear DM view flag when selecting a server
      localStorage.removeItem('kloak-dm-view-active');
    } else {
      // Going to DM view - set a flag so fetchServers knows not to auto-select
      localStorage.setItem('kloak-dm-view-active', 'true');
    }

    // Only clear channel state when switching TO a different server (not when going to null/DM)
    // This prevents losing state and ensures proper isolation
    if (server) {
      set({
        currentServer: server,
        // Clear channel state when switching servers to ensure proper isolation
        currentChannel: null,
        channels: [],
        categories: [],
        members: [],
        membersServerId: null,
        isMembersLoading: true,
      });
    } else {
      // Going to DM view - just set server to null, keep channel data for when we return
      set({ currentServer: null });
    }
  },
  setCurrentChannel: (channel) => {
    const { currentServer } = get();
    // Persist to localStorage (global for backwards compat)
    if (channel) {
      localStorage.setItem('kloak-current-channel-id', channel.id);
      // Also save per-server last channel
      if (currentServer) {
        saveLastChannel(currentServer.id, channel.id);
      }
    } else {
      localStorage.removeItem('kloak-current-channel-id');
    }
    set({ currentChannel: channel });
  },

  fetchChannels: async (serverId: string) => {
    const uid = useAuthStore.getState().user?.id ?? 'anon';
    return deduplicatedFetch(`serverStore:fetchChannels:${serverId}:${uid}`, async () => {
      try {
        // Get current user ID for private channel filtering
        const userId = useAuthStore.getState().user?.id;

        // Use RPC functions to bypass RLS
        const [categoriesResult, channelsResult] = await Promise.all([
          supabase.rpc('get_server_categories', { _server_id: serverId, _user_id: userId }),
          supabase.rpc('get_server_channels', { _server_id: serverId, _user_id: userId }),
        ]);

        if (categoriesResult.error) throw categoriesResult.error;
        if (channelsResult.error) throw channelsResult.error;

        const categories = (categoriesResult.data || []) as unknown as ChannelCategory[];
        const channels = (channelsResult.data || []) as unknown as Channel[];

        set({
          categories,
          channels,
        });

        // Also fetch roles when fetching channels
        await get().fetchRoles(serverId);

        // Try to restore the last visited channel for this specific server
        const { currentChannel } = get();
        const lastChannelForServer = getLastChannel(serverId);
        const persistedChannelId = localStorage.getItem('kloak-current-channel-id');

        // Restore channel priority: 
        // 1. Last channel for this specific server
        // 2. Global persisted channel (if it belongs to this server)
        // 3. First channel in the server
        if (channels.length > 0) {
          const lastChannel = lastChannelForServer
            ? channels.find(c => c.id === lastChannelForServer)
            : null;
          const restoredChannel = lastChannel || (persistedChannelId
            ? channels.find(c => c.id === persistedChannelId)
            : null);

          // If current channel is valid for this server, keep it
          const currentIsValid = currentChannel && channels.find(c => c.id === currentChannel.id);

          if (restoredChannel) {
            set({ currentChannel: restoredChannel });
          } else if (!currentIsValid) {
            set({ currentChannel: channels[0] });
          }
        } else {
          // No channels in this server
          set({ currentChannel: null });
        }
      } catch (error) {
        console.error('Failed to fetch channels:', error);
      }
    });
  },

  createCategory: async (serverId: string, name: string, userId: string) => {
    try {
      const { categories } = get();
      const position = categories.length;

      // Use RPC function to bypass RLS
      const { data, error } = await supabase.rpc('create_category', {
        _server_id: serverId,
        _user_id: userId,
        _name: name,
        _position: position,
      });

      if (error) throw error;

      const category = data as unknown as ChannelCategory;
      set((state) => ({
        categories: [...state.categories, category],
      }));

      return category;
    } catch (error) {
      console.error('Failed to create category:', error);
      return null;
    }
  },

  createChannel: async (serverId: string, name: string, type: ChannelType, userId: string, categoryId?: string, icon?: string, isPrivate?: boolean, ghostMode?: boolean) => {
    try {
      const { channels } = get();
      const categoryChannels = channels.filter((c) => c.category_id === categoryId);
      const position = categoryChannels.length;

      // Use RPC function to bypass RLS
      const rpcParams = {
        _server_id: serverId,
        _user_id: userId,
        _name: name,
        _type: type,
        _position: position,
        _is_private: isPrivate || false,
        _ghost_mode: ghostMode || false,
        _category_id: categoryId,
        _icon: icon,
      };
      
      const { data, error } = await supabase.rpc('create_channel', rpcParams);

      if (error) {
        console.error('[createChannel] RPC error:', error);
        throw error;
      }

      if (!data) {
        throw new Error('No data returned from create_channel RPC');
      }

      // Check if RPC returned an error object
      const result = data as unknown as { error?: string } | Record<string, unknown>;
      if (result && typeof result === 'object' && 'error' in result && result.error) {
        throw new Error(String(result.error));
      }

      // Parse the channel data ensuring all required fields
      const channelData = result as Record<string, unknown>;

      const channel: Channel = {
        id: String(channelData.id),
        server_id: String(channelData.server_id),
        category_id: channelData.category_id ? String(channelData.category_id) : null,
        name: String(channelData.name),
        topic: channelData.topic ? String(channelData.topic) : null,
        type: (String(channelData.type) as ChannelType) || 'text',
        position: Number(channelData.position) || 0,
        is_nsfw: Boolean(channelData.is_nsfw),
        slowmode_seconds: Number(channelData.slowmode_seconds) || 0,
        is_read_only: Boolean(channelData.is_read_only),
        is_private: Boolean(channelData.is_private),
        icon: channelData.icon ? String(channelData.icon) : null,
        created_at: String(channelData.created_at),
        block_links: Boolean(channelData.block_links),
        allowed_link_domains: Array.isArray(channelData.allowed_link_domains) ? channelData.allowed_link_domains as string[] : [],
        ghost_mode: Boolean(channelData.ghost_mode),
      };

      // For announcement channels, set is_read_only to true
      if (type === 'announcement' && !channel.is_read_only) {
        try {
          const { error: updateError } = await supabase.rpc('update_channel', {
            _channel_id: channel.id,
            _user_id: userId,
            _updates: JSON.stringify({ is_read_only: true }),
          });
          
          if (!updateError) {
            channel.is_read_only = true;
          }
        } catch (err) {
          console.error('Failed to set announcement channel as read-only:', err);
        }
      }

      // Update store with new channel
      set((state) => {
        // Prevent duplicates in case realtime already added it
        if (state.channels.some(c => c.id === channel.id)) {
          return state;
        }
        return {
          channels: [...state.channels, channel],
        };
      });

      return channel;
    } catch (error) {
      console.error('[createChannel] Failed:', error);
      return null;
    }
  },

  fetchChannelMembers: async (channelId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_channel_members', {
        _channel_id: channelId,
      });

      if (error) throw error;

      const members = (data as unknown as import('@/types').ChannelMember[]) || [];
      
      set((state) => {
        const existing = state.channelMembers.filter(cm => cm.channelId !== channelId);
        return {
          channelMembers: [...existing, { channelId, members }],
        };
      });
    } catch (error) {
      console.error('Failed to fetch channel members:', error);
    }
  },

  addChannelMember: async (channelId: string, targetUserId: string, addedBy: string) => {
    try {
      const { data, error } = await supabase.rpc('add_channel_member', {
        _channel_id: channelId,
        _target_user_id: targetUserId,
        _added_by: addedBy,
      });

      if (error) throw error;
      
      // Refresh channel members
      await get().fetchChannelMembers(channelId);
      
      return data as boolean;
    } catch (error) {
      console.error('Failed to add channel member:', error);
      return false;
    }
  },

  removeChannelMember: async (channelId: string, targetUserId: string, removedBy: string) => {
    try {
      const { data, error } = await supabase.rpc('remove_channel_member', {
        _channel_id: channelId,
        _target_user_id: targetUserId,
        _removed_by: removedBy,
      });

      if (error) throw error;
      
      // Refresh channel members
      await get().fetchChannelMembers(channelId);
      
      return data as boolean;
    } catch (error) {
      console.error('Failed to remove channel member:', error);
      return false;
    }
  },

  updateChannel: async (channelId: string, updates: Partial<Channel>, userId: string) => {
    // Use RPC function to bypass RLS
    const { data, error } = await supabase.rpc('update_channel', {
      _channel_id: channelId,
      _user_id: userId,
      _updates: JSON.stringify(updates),
    });

    if (error) {
      console.error('Failed to update channel:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        updates: updates
      });
      throw new Error(error.message || 'Failed to update channel');
    }

    // Use the returned data from the RPC call to ensure we have the actual database values
    if (data && typeof data === 'object') {
      const channelData = data as Record<string, unknown>;
      // Normalize the channel data to ensure proper types
      const normalizedChannel: Partial<Channel> = {
        id: channelData.id ? String(channelData.id) : undefined,
        server_id: channelData.server_id ? String(channelData.server_id) : undefined,
        category_id: channelData.category_id ? String(channelData.category_id) : null,
        name: channelData.name ? String(channelData.name) : undefined,
        topic: channelData.topic ? String(channelData.topic) : null,
        type: channelData.type ? (String(channelData.type) as ChannelType) : undefined,
        position: channelData.position !== undefined ? Number(channelData.position) : undefined,
        is_nsfw: channelData.is_nsfw !== undefined ? Boolean(channelData.is_nsfw) : undefined,
        slowmode_seconds: channelData.slowmode_seconds !== undefined ? Number(channelData.slowmode_seconds) : undefined,
        is_read_only: channelData.is_read_only !== undefined ? Boolean(channelData.is_read_only) : undefined,
        is_private: channelData.is_private !== undefined ? Boolean(channelData.is_private) : undefined,
        icon: channelData.icon ? String(channelData.icon) : null,
        created_at: channelData.created_at ? String(channelData.created_at) : undefined,
        block_links: channelData.block_links !== undefined ? Boolean(channelData.block_links) : undefined,
        allowed_link_domains: Array.isArray(channelData.allowed_link_domains) ? channelData.allowed_link_domains as string[] : undefined,
        ghost_mode: channelData.ghost_mode !== undefined ? Boolean(channelData.ghost_mode) : undefined,
      };
      
      // Remove undefined values
      Object.keys(normalizedChannel).forEach(key => {
        if (normalizedChannel[key as keyof Channel] === undefined) {
          delete normalizedChannel[key as keyof Channel];
        }
      });
      
      set((state) => ({
        channels: state.channels.map((c) =>
          c.id === channelId ? { ...c, ...normalizedChannel } : c
        ),
        currentChannel:
          state.currentChannel?.id === channelId
            ? { ...state.currentChannel, ...normalizedChannel }
            : state.currentChannel,
      }));
    }
  },

  deleteChannel: async (channelId: string, userId: string) => {
    // Use RPC function to bypass RLS
    const { error } = await supabase.rpc('delete_channel', {
      _channel_id: channelId,
      _user_id: userId,
    });

    if (error) {
      console.error('Failed to delete channel:', error);
      throw new Error(error.message || 'Failed to delete channel');
    }

    set((state) => ({
      channels: state.channels.filter((c) => c.id !== channelId),
      currentChannel:
        state.currentChannel?.id === channelId ? null : state.currentChannel,
    }));
  },

  updateCategory: async (categoryId: string, updates: Partial<ChannelCategory>, userId: string) => {
    const updatesJson: Record<string, unknown> = {};
    if (typeof updates.name !== 'undefined') updatesJson.name = updates.name;
    if (typeof updates.position !== 'undefined') updatesJson.position = updates.position;
    if (typeof updates.is_collapsed !== 'undefined') updatesJson.is_collapsed = updates.is_collapsed;

    // Use RPC function to bypass RLS
    const { data, error } = await supabase.rpc('update_category', {
      _category_id: categoryId,
      _user_id: userId,
      _updates: updatesJson as any,
    });

    if (error) {
      console.error('Failed to update category:', error);
      throw new Error(error.message || 'Failed to update category');
    }

    // Use returned values from the RPC to ensure UI matches DB
    const categoryData = data as unknown as Partial<ChannelCategory>;
    set((state) => ({
      categories: state.categories.map((c) =>
        c.id === categoryId ? { ...c, ...categoryData } : c
      ),
    }));
  },

  deleteCategory: async (categoryId: string, userId: string) => {
    // Use RPC function to bypass RLS (handles channel migration internally)
    const { error } = await supabase.rpc('delete_category', {
      _category_id: categoryId,
      _user_id: userId,
    });

    if (error) {
      console.error('Failed to delete category:', error);
      throw new Error(error.message || 'Failed to delete category');
    }

    set((state) => ({
      categories: state.categories.filter((c) => c.id !== categoryId),
      channels: state.channels.map((c) =>
        c.category_id === categoryId ? { ...c, category_id: null } : c
      ),
    }));
  },

  reorderCategories: async (categoryIds: string[]) => {
    try {
      const { currentServer } = get();
      const userId = useAuthStore.getState().user?.id;
      if (!currentServer || !userId) return;

      const { error } = await (supabase.rpc as any)('reorder_categories', {
        _server_id: currentServer.id,
        _user_id: userId,
        _category_ids: categoryIds,
      });

      if (error) throw error;

      // Update local state
      set((state) => ({
        categories: state.categories
          .map((cat) => ({
            ...cat,
            position: categoryIds.indexOf(cat.id),
          }))
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
      }));
    } catch (error) {
      console.error('Failed to reorder categories:', error);
    }
  },

  reorderChannels: async (channelId: string, newCategoryId: string | null, newPosition: number) => {
    try {
      const { currentServer } = get();
      const userId = useAuthStore.getState().user?.id;
      if (!currentServer || !userId) return;

      const { error } = await (supabase.rpc as any)('reorder_channels', {
        _server_id: currentServer.id,
        _user_id: userId,
        _channel_id: channelId,
        _new_category_id: newCategoryId,
        _new_position: newPosition,
      });

      if (error) throw error;

      // Update local state
      set((state) => ({
        channels: state.channels.map((c) => {
          if (c.id === channelId) {
            return { ...c, category_id: newCategoryId, position: newPosition };
          }
          return c;
        }),
      }));

      // Refresh to get accurate positions
      await get().fetchChannels(currentServer.id);
    } catch (error) {
      console.error('Failed to reorder channels:', error);
    }
  },

  moveChannelToCategory: async (channelId: string, categoryId: string | null) => {
    try {
      const { currentServer, channels } = get();
      if (!currentServer) return;

      const targetChannels = channels.filter(c => c.category_id === categoryId);
      const newPosition = targetChannels.length;

      const { error } = await (supabase.rpc as any)('move_channel_to_category', {
        _channel_id: channelId,
        _server_id: currentServer.id,
        _category_id: categoryId,
      });

      if (error) throw error;

      set((state) => ({
        channels: state.channels.map((c) =>
          c.id === channelId ? { ...c, category_id: categoryId, position: newPosition } : c
        ),
      }));
    } catch (error) {
      console.error('Failed to move channel:', error);
      throw error;
    }
  },

  fetchMembers: async (serverId: string) => {
    const state = get();
    const cachedAt = membersCachedAt.get(serverId);
    if (
      state.membersServerId === serverId &&
      cachedAt != null &&
      Date.now() - cachedAt < MEMBERS_CACHE_TTL_MS
    ) {
      return;
    }
    return deduplicatedFetch(`serverStore:fetchMembers:${serverId}`, async () => {
      set({ isMembersLoading: true, membersServerId: serverId });
      try {
        // Fetch roles first if not already loaded
        const { roles: currentRoles } = get();
        if (currentRoles.length === 0 || currentRoles[0]?.server_id !== serverId) {
          await get().fetchRoles(serverId);
        }

        // Use RPC function to bypass RLS
        const { data, error } = await supabase.rpc('get_server_members', { _server_id: serverId });

      if (error) {
        console.error('get_server_members RPC error:', error);
        throw error;
      }

      // Handle JSON response - Supabase RPC may return JSON string or parsed array
      let membersData: Array<any>;
      if (!data) {
        membersData = [];
      } else if (typeof data === 'string') {
        try {
          membersData = JSON.parse(data);
        } catch (e) {
          console.error('Failed to parse members JSON:', e);
          membersData = [];
        }
      } else if (Array.isArray(data)) {
        membersData = data;
      } else {
        // If it's an object, try to extract array or wrap it
        console.warn('Unexpected data format:', data);
        membersData = [];
      }

      // Cast and filter out banned members
      const typedMembersData = membersData as Array<{
        id: string;
        server_id: string;
        user_id: string;
        role: ServerRole;
        nickname: string | null;
        is_banned: boolean;
        is_muted: boolean;
        joined_at: string;
        join_source?: string | null;
        join_invite_code?: string | null;
        roles?: Array<{
          id: string;
          name: string;
          color: string;
          position: number;
        }>;
        user: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          avatar_decoration: string | null;
          banner_color: string;
          bio: string | null;
          status: string;
          custom_status: string | null;
          created_at: string;
          last_seen: string | null;
        };
      }>;

      const blockedUserIdSet = new Set(useFriendStore.getState().visibilityBlockedUserIds);

      const members: ServerMember[] = typedMembersData
        .filter(item => !item.is_banned)
        .filter(item => !blockedUserIdSet.has(item.user_id))
        .map((item) => ({
          id: item.id,
          server_id: item.server_id,
          user_id: item.user_id,
          role: item.role,
          nickname: item.nickname,
          is_banned: item.is_banned,
          is_muted: item.is_muted,
          joined_at: item.joined_at,
          join_source: item.join_source as ServerMember['join_source'],
          join_invite_code: item.join_invite_code ?? undefined,
          user: item.user as any,
          roles: item.roles as any,
        }));

      // Populate user cache with member user data
      const memberUsers = members.map(m => m.user).filter(Boolean);
      if (memberUsers.length > 0) {
        bulkSetUsersInCache(memberUsers as any);
      }

        membersCachedAt.set(serverId, Date.now());
        set({ members, isMembersLoading: false, membersServerId: serverId });
      } catch (error) {
        console.error('Failed to fetch members:', error);
        // Set empty array on error to prevent stale data
        set({ members: [], isMembersLoading: false, membersServerId: serverId });
      }
    });
  },

  updateMember: async (memberId: string, updates: Partial<ServerMember>) => {
    try {
      const { currentServer, members } = get();
      const userId = useAuthStore.getState().user?.id;
      if (!currentServer || !userId) throw new Error('Not authenticated or no server selected');

      const member = members.find((m) => m.id === memberId);
      if (!member) throw new Error('Member not found');
      const targetUserId = member.user_id;

      const serverId = currentServer.id;
      const rpcOptions = { _server_id: serverId, _user_id: userId, _target_user_id: targetUserId };

      if (updates.nickname !== undefined) {
        const { error } = await supabase.rpc('update_member_nickname', {
          ...rpcOptions,
          _nickname: updates.nickname ?? null,
        });
        if (error) throw error;
      }
      if (updates.is_muted !== undefined) {
        const { error } = await supabase.rpc('toggle_mute_member', {
          ...rpcOptions,
          _muted: updates.is_muted,
        });
        if (error) throw error;
      }
      if (updates.role !== undefined) {
        const { error } = await supabase.rpc('change_member_role', {
          ...rpcOptions,
          _new_role: updates.role,
        });
        if (error) throw error;
      }

      set((state) => ({
        members: state.members.map((m) =>
          m.id === memberId ? { ...m, ...updates } : m
        ),
      }));
    } catch (error) {
      console.error('Failed to update member:', error);
      throw error;
    }
  },

  kickMember: async (serverId: string, targetUserId: string) => {
    try {
      // Get current user from auth store to pass as the kicker
      const currentUserId = useAuthStore.getState().user?.id;
      if (!currentUserId) throw new Error('Not authenticated');

      const { error } = await supabase.rpc('kick_member', {
        _server_id: serverId,
        _user_id: currentUserId,
        _target_user_id: targetUserId,
      });

      if (error) throw error;

      membersCachedAt.delete(serverId);
      set((state) => ({
        members: state.members.filter((m) => m.user_id !== targetUserId),
      }));
    } catch (error) {
      console.error('Failed to kick member:', error);
      throw error;
    }
  },

  banMember: async (serverId: string, targetUserId: string) => {
    try {
      // Get current user from auth store to pass as the banner
      const currentUserId = useAuthStore.getState().user?.id;
      if (!currentUserId) throw new Error('Not authenticated');

      const { error } = await supabase.rpc('ban_member', {
        _server_id: serverId,
        _user_id: currentUserId,
        _target_user_id: targetUserId,
      });

      if (error) throw error;

      membersCachedAt.delete(serverId);
      set((state) => ({
        members: state.members.filter((m) => m.user_id !== targetUserId),
      }));
    } catch (error) {
      console.error('Failed to ban member:', error);
      throw error;
    }
  },

  transferOwnership: async (serverId: string, newOwnerId: string) => {
    try {
      const currentOwnerId = useAuthStore.getState().user?.id;
      if (!currentOwnerId) throw new Error('Not authenticated');

      let { error } = await supabase.rpc('transfer_ownership', {
        _server_id: serverId,
        _new_owner_id: newOwnerId,
      });

      // Backward compatibility: some DBs may still have only the legacy 3-arg signature.
      if (error?.code === 'PGRST202') {
        const legacy = await (supabase as any).rpc('transfer_ownership', {
          _server_id: serverId,
          _current_owner_id: currentOwnerId,
          _new_owner_id: newOwnerId,
        });
        error = legacy.error ?? null;
      }

      if (error) throw error;

      membersCachedAt.delete(serverId);
      const { members } = get();
      const currentOwnerMember = members.find(m => m.user_id === currentOwnerId && m.server_id === serverId);
      const newOwnerMember = members.find(m => m.user_id === newOwnerId && m.server_id === serverId);

      // Update local state
      set((state) => ({
        members: state.members.map((m) => {
          if (newOwnerMember && m.id === newOwnerMember.id) return { ...m, role: 'owner' as const };
          if (currentOwnerMember && m.id === currentOwnerMember.id) return { ...m, role: 'admin' as const };
          return m;
        }),
        currentServer: state.currentServer?.id === serverId
          ? { ...state.currentServer, owner_id: newOwnerId }
          : state.currentServer,
      }));
    } catch (error) {
      console.error('Failed to transfer ownership:', error);
      throw error;
    }
  },

  fetchRoles: async (serverId: string) => {
    return deduplicatedFetch(`serverStore:fetchRoles:${serverId}`, async () => {
      try {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) {
          set({ roles: [] });
          return;
        }

        const { data, error } = await supabase.rpc('get_server_roles_secure', {
          _server_id: serverId,
          _user_id: userId,
        });

        if (error) throw error;

        const roles = (Array.isArray(data) ? data : []) as unknown as CustomServerRole[];
        set({ roles });
      } catch (error) {
        console.error('Failed to fetch roles:', error);
      }
    });
  },

  createRole: async (serverId: string, userId: string, name: string, color: string, icon?: string | null) => {
    try {
      const { data, error } = await supabase.rpc('create_server_role', {
        _server_id: serverId,
        _user_id: userId,
        _name: name,
        _color: color,
        _icon: icon ?? null,
      } as any);

      if (error) {
        console.error('Failed to create role - error:', error);
        throw error;
      }

      const role = data as unknown as CustomServerRole;
      set((state) => ({
        roles: [...state.roles, role].sort((a, b) => a.position - b.position),
      }));

      return role;
    } catch (error: any) {
      console.error('Failed to create role:', error);
      throw error;
    }
  },

  updateRole: async (roleId: string, userId: string, updates: { name?: string; color?: string; icon?: string | null }) => {
    try {
      const { data, error } = await supabase.rpc('update_server_role', {
        _role_id: roleId,
        _user_id: userId,
        _name: updates.name ?? null,
        _color: updates.color ?? null,
      } as any);

      if (error) throw error;

      const role = data as unknown as CustomServerRole;
      set((state) => ({
        roles: state.roles.map((r) => (r.id === roleId ? role : r)),
      }));
    } catch (error) {
      console.error('Failed to update role:', error);
      throw error;
    }
  },

  deleteRole: async (roleId: string, userId: string) => {
    try {
      const { error } = await supabase.rpc('delete_server_role', {
        _role_id: roleId,
        _user_id: userId,
      });

      if (error) throw error;

      set((state) => ({
        roles: state.roles.filter((r) => r.id !== roleId),
        members: state.members.map((m) => ({
          ...m,
          roles: m.roles?.filter((r) => r.id !== roleId),
        })),
      }));
    } catch (error) {
      console.error('Failed to delete role:', error);
      throw error;
    }
  },

  reorderRoles: async (serverId: string, userId: string, orderedRoleIds: string[]) => {
    const { roles: currentRoles } = get();
    const roleById = new Map(currentRoles.map((r) => [r.id, r]));
    const sanitized = orderedRoleIds.filter((id) => roleById.has(id));

    // Optimistically update local state first
    set((state) => ({
      roles: state.roles
        .map((r) => {
          const idx = sanitized.indexOf(r.id);
          return idx >= 0 ? { ...r, position: idx } : r;
        })
        .sort((a, b) => a.position - b.position),
    }));

    try {
      const { error } = await (supabase.rpc as any)('reorder_server_roles', {
        _server_id: serverId,
        _user_id: userId,
        _ordered_role_ids: sanitized,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to reorder roles:', error);
      // Re-sync from server if persistence fails
      await get().fetchRoles(serverId);
      throw error;
    }
  },

  assignRoleToMember: async (memberId: string, roleId: string, userId: string) => {
    const { currentServer, members, roles: allRoles } = get();
    if (!currentServer) throw new Error('No server selected');

    // Optimistic update: add the role to the member locally
    const role = allRoles.find((r) => r.id === roleId);
    const prevMembers = members;
    if (role) {
      set({
        members: members.map((m) =>
          m.id === memberId
            ? {
                ...m,
                roles: [
                  ...(m.roles || []).filter((r) => r.id !== roleId),
                  { ...role, position: role.position ?? 0 } as CustomServerRole,
                ],
              }
            : m
        ),
      });
    }

    try {
      const { error } = await (supabase.rpc as any)('assign_role_to_member', {
        _user_id: userId,
        _member_id: memberId,
        _role_id: roleId,
      });

      if (error) throw error;

      // Refresh members to get authoritative data
      await get().fetchMembers(currentServer.id);
    } catch (error) {
      // Rollback on failure
      set({ members: prevMembers });
      console.error('Failed to assign role:', error);
      throw error;
    }
  },

  removeRoleFromMember: async (memberId: string, roleId: string, userId: string) => {
    const { currentServer, members } = get();
    if (!currentServer) throw new Error('No server selected');

    // Optimistic update: remove the role from the member locally
    const prevMembers = members;
    set({
      members: members.map((m) =>
        m.id === memberId
          ? { ...m, roles: (m.roles || []).filter((r) => r.id !== roleId) }
          : m
      ),
    });

    try {
      const { error } = await (supabase.rpc as any)('remove_role_from_member', {
        _user_id: userId,
        _member_id: memberId,
        _role_id: roleId,
      });

      if (error) throw error;

      // Refresh members to get authoritative data
      await get().fetchMembers(currentServer.id);
    } catch (error) {
      // Rollback on failure
      set({ members: prevMembers });
      console.error('Failed to remove role:', error);
      throw error;
    }
  },

  fetchRolePermissions: async (serverId: string, opts?: { force?: boolean }) => {
    return deduplicatedFetch(`serverStore:fetchRolePermissions:${serverId}`, async () => {
      try {
        const cached = rolePermissionsCache.get(serverId);
        if (!opts?.force && cached && Date.now() - cached.cachedAt < PERMISSIONS_TTL_MS) {
          set({ rolePermissions: cached.data });
          return;
        }

        // OPTIMIZATION: Specify only required columns instead of select('*')
        const { data, error } = await supabase
          .from('role_permissions')
          .select('id, server_id, role_id, role_name, permission, allowed, created_at')
          .eq('server_id', serverId);

        if (error) {
          console.error('Query error:', error);
          throw error;
        }

        const permissions: RolePermission[] = (data ?? []).map((row) => ({
          id: row.id,
          server_id: row.server_id,
          role_id: row.role_id,
          role_name: row.role_name as ServerRole | null,
          permission: row.permission as Permission,
          allowed: row.allowed,
          created_at: row.created_at ?? '',
        }));

        rolePermissionsCache.set(serverId, { data: permissions, cachedAt: Date.now() });
        set({ rolePermissions: permissions });
      } catch (error) {
        console.error('Failed to fetch role permissions:', error);
        throw error;
      }
    });
  },

  fetchChannelPermissions: async (channelId: string, opts?: { force?: boolean }) => {
    return deduplicatedFetch(`serverStore:fetchChannelPermissions:${channelId}`, async () => {
      try {
        const cached = channelPermissionsCache.get(channelId);
        if (!opts?.force && cached && Date.now() - cached.cachedAt < PERMISSIONS_TTL_MS) {
          set({ channelPermissions: cached.data });
          return;
        }

        // OPTIMIZATION: Specify only required columns instead of select('*')
        const { data, error } = await supabase
          .from('channel_permissions')
          .select('id, channel_id, role_id, role_name, user_id, permission, allowed, created_at')
          .eq('channel_id', channelId);

        if (error) {
          console.error('Query error:', error);
          throw error;
        }

        const permissions: ChannelPermission[] = (data ?? []).map((row: any) => ({
          id: row.id,
          channel_id: row.channel_id,
          role_id: row.role_id,
          role_name: row.role_name as ServerRole | null,
          user_id: row.user_id || null,
          permission: row.permission as Permission,
          allowed: row.allowed,
          created_at: row.created_at ?? '',
        }));

        channelPermissionsCache.set(channelId, { data: permissions, cachedAt: Date.now() });
        set({ channelPermissions: permissions });
      } catch (error) {
        console.error('Failed to fetch channel permissions:', error);
        throw error;
      }
    });
  },

  setRolePermission: async (
    serverId: string,
    userId: string,
    permission: Permission,
    roleId?: string,
    roleName?: ServerRole,
    allowed: boolean = true
  ) => {
    try {
      // Use RPC function instead of direct upsert to handle partial indexes correctly
      const { error } = await supabase.rpc('set_role_permission', {
        _server_id: serverId,
        _user_id: userId,
        _permission: permission as any,
        _role_id: roleId || null,
        _role_name: roleName || null,
        _allowed: allowed,
      });

      if (error) throw error;

      // Refresh role permissions
      await get().fetchRolePermissions(serverId, { force: true });
    } catch (error) {
      console.error('Failed to set role permission:', error);
      throw error;
    }
  },

  setChannelPermission: async (
    channelId: string,
    userId: string,
    permission: Permission,
    allowed: boolean,
    roleId?: string,
    roleName?: ServerRole,
    targetUserId?: string
  ) => {
    try {
      // Use RPC function instead of direct upsert to handle partial indexes correctly
      const { error } = await supabase.rpc('set_channel_permission', {
        _channel_id: channelId,
        _user_id: userId,
        _permission: permission as any,
        _allowed: allowed,
        _role_id: roleId || null,
        _role_name: roleName || null,
        _target_user_id: targetUserId || null,
      });

      if (error) throw error;

      // Refresh channel permissions
      await get().fetchChannelPermissions(channelId, { force: true });
    } catch (error) {
      console.error('Failed to set channel permission:', error);
      throw error;
    }
  },

  deleteRolePermission: async (permissionId: string, userId: string) => {
    try {
      const { error } = await (supabase.rpc as any)('delete_role_permission', {
        _permission_id: permissionId,
        _user_id: userId,
      });

      if (error) throw error;

      // Refresh role permissions
      const { currentServer } = get();
      if (currentServer) {
        await get().fetchRolePermissions(currentServer.id, { force: true });
      }
    } catch (error) {
      console.error('Failed to delete role permission:', error);
      throw error;
    }
  },

  deleteChannelPermission: async (permissionId: string, userId: string) => {
    try {
      const { channelPermissions } = get();
      const toDelete = channelPermissions.find((p) => p.id === permissionId);

      const { error } = await (supabase.rpc as any)('delete_channel_permission', {
        _permission_id: permissionId,
        _user_id: userId,
      });

      if (error) throw error;

      // Refresh channel permissions
      if (toDelete) {
        await get().fetchChannelPermissions(toDelete.channel_id, { force: true });
      }
    } catch (error) {
      console.error('Failed to delete channel permission:', error);
      throw error;
    }
  },

  fetchCategoryPermissions: async (categoryId: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from('category_permissions')
        .select('*')
        .eq('category_id', categoryId);

      if (error) {
        console.error('Query error:', error);
        throw error;
      }

      const permissions: CategoryPermission[] = (data ?? []).map((row: any) => ({
        id: row.id,
        category_id: row.category_id,
        role_id: row.role_id,
        role_name: row.role_name as ServerRole | null,
        user_id: row.user_id || null,
        permission: row.permission as Permission,
        allowed: row.allowed,
        created_at: row.created_at ?? '',
      }));

      set({ categoryPermissions: permissions });
    } catch (error) {
      console.error('Failed to fetch category permissions:', error);
      throw error;
    }
  },

  setCategoryPermission: async (
    categoryId: string,
    userId: string,
    permission: Permission,
    allowed: boolean,
    roleId?: string,
    roleName?: ServerRole,
    targetUserId?: string
  ) => {
    try {
      const { error } = await (supabase.rpc as any)('set_category_permission', {
        _category_id: categoryId,
        _user_id: userId,
        _permission: permission,
        _allowed: allowed,
        _role_id: roleId || null,
        _role_name: roleName || null,
        _target_user_id: targetUserId || null,
      });

      if (error) throw error;

      // Refresh category permissions
      await get().fetchCategoryPermissions(categoryId);
    } catch (error) {
      console.error('Failed to set category permission:', error);
      throw error;
    }
  },

  deleteCategoryPermission: async (permissionId: string, userId: string) => {
    try {
      const { categoryPermissions } = get();
      const toDelete = categoryPermissions.find((p) => p.id === permissionId);

      const { error } = await (supabase.rpc as any)('delete_category_permission', {
        _permission_id: permissionId,
        _user_id: userId,
      });

      if (error) throw error;

      // Refresh category permissions
      if (toDelete) {
        await get().fetchCategoryPermissions(toDelete.category_id);
      }
    } catch (error) {
      console.error('Failed to delete category permission:', error);
      throw error;
    }
  },

  syncCategoryPermissionsToChannels: async (categoryId: string, userId: string) => {
    try {
      const { error } = await (supabase.rpc as any)('sync_category_permissions_to_channels', {
        _category_id: categoryId,
        _user_id: userId,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to sync category permissions to channels:', error);
      throw error;
    }
  },

  importDiscordTemplate: async (serverId: string, userId: string, templateUrl: string) => {
    try {
      // Fetch template data from Edge Function
      const { data, error } = await supabase.functions.invoke('fetch-discord-template', {
        body: { templateUrl },
      });

      if (error) {
        return { success: false, error: error.message || 'Failed to fetch template' };
      }

      if (data?.error) {
        return { success: false, error: data.error };
      }

      const template = data as {
        name: string;
        description: string | null;
        categories: Array<{ name: string; position: number; channels: Array<{ name: string; type: string; topic?: string | null; position: number; is_nsfw: boolean; slowmode_seconds: number }> }>;
        channels: Array<{ name: string; type: string; topic?: string | null; position: number; is_nsfw: boolean; slowmode_seconds: number }>;
        roles: Array<{ name: string; color: string; position: number; icon: string | null }>;
      };

      let importedCategories = 0;
      let importedChannels = 0;
      let importedRoles = 0;

      // Import roles first (they might be referenced by channels)
      for (const role of template.roles) {
        try {
          await get().createRole(serverId, userId, role.name, role.color, role.icon);
          importedRoles++;
        } catch (err) {
          console.error(`Failed to import role ${role.name}:`, err);
        }
      }

      // Import categories
      const categoryMap = new Map<string, string>(); // Discord category name -> our category ID
      for (const category of template.categories) {
        try {
          const createdCategory = await get().createCategory(serverId, category.name, userId);
          if (createdCategory) {
            categoryMap.set(category.name, createdCategory.id);
            importedCategories++;

            // Import channels in this category
            for (const channel of category.channels) {
              try {
                const createdChannel = await get().createChannel(
                  serverId,
                  channel.name,
                  channel.type as ChannelType,
                  userId,
                  createdCategory.id,
                  undefined,
                  false,
                  false
                );
                // Update channel with topic, NSFW, and slowmode if needed
                if (createdChannel && (channel.topic || channel.is_nsfw || channel.slowmode_seconds > 0)) {
                  await get().updateChannel(createdChannel.id, {
                    topic: channel.topic || null,
                    is_nsfw: channel.is_nsfw,
                    slowmode_seconds: channel.slowmode_seconds,
                  }, userId);
                }
                importedChannels++;
              } catch (err) {
                console.error(`Failed to import channel ${channel.name}:`, err);
              }
            }
          }
        } catch (err) {
          console.error(`Failed to import category ${category.name}:`, err);
        }
      }

      // Import uncategorized channels
      for (const channel of template.channels) {
        try {
          const createdChannel = await get().createChannel(
            serverId,
            channel.name,
            channel.type as ChannelType,
            userId,
            undefined,
            undefined,
            false,
            false
          );
          // Update channel with topic, NSFW, and slowmode if needed
          if (createdChannel && (channel.topic || channel.is_nsfw || channel.slowmode_seconds > 0)) {
            await get().updateChannel(createdChannel.id, {
              topic: channel.topic || null,
              is_nsfw: channel.is_nsfw,
              slowmode_seconds: channel.slowmode_seconds,
            }, userId);
          }
          importedChannels++;
        } catch (err) {
          console.error(`Failed to import channel ${channel.name}:`, err);
        }
      }

      // Refresh channels and roles to show imported items
      await get().fetchChannels(serverId);
      await get().fetchRoles(serverId);

      return {
        success: true,
        imported: {
          categories: importedCategories,
          channels: importedChannels,
          roles: importedRoles,
        },
      };
    } catch (error: any) {
      console.error('Failed to import Discord template:', error);
      return { success: false, error: error.message || 'Failed to import template' };
    }
  },

  clearServerState: () =>
    set({
      currentServer: null,
      currentChannel: null,
      categories: [],
      channels: [],
      members: [],
      membersServerId: null,
      roles: [],
    }),
}));
