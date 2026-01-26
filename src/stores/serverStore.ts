import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { inviteCodeRateLimiter } from '@/lib/security';
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
  Permission
} from '@/types';

interface ServerState {
  servers: ServerWithMembership[];
  currentServer: Server | null;
  currentChannel: Channel | null;
  categories: ChannelCategory[];
  channels: Channel[];
  members: ServerMember[];
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
  joinServer: (inviteCode: string, userId: string) => Promise<Server | null>;
  leaveServer: (serverId: string, userId: string) => Promise<void>;
  deleteServer: (serverId: string) => Promise<void>;
  setCurrentServer: (server: Server | null) => void;
  setCurrentChannel: (channel: Channel | null) => void;

  // Channel actions
  fetchChannels: (serverId: string) => Promise<void>;
  createCategory: (serverId: string, name: string, userId: string) => Promise<ChannelCategory | null>;
  createChannel: (serverId: string, name: string, type: ChannelType, userId: string, categoryId?: string, icon?: string, isPrivate?: boolean) => Promise<Channel | null>;
  
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
  transferOwnership: (serverId: string, currentOwnerId: string, newOwnerId: string) => Promise<void>;

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
  fetchRolePermissions: (serverId: string) => Promise<void>;
  fetchChannelPermissions: (channelId: string) => Promise<void>;
  setRolePermission: (serverId: string, userId: string, permission: Permission, roleId?: string, roleName?: ServerRole, allowed?: boolean) => Promise<void>;
  setChannelPermission: (channelId: string, userId: string, permission: Permission, allowed: boolean, roleId?: string, roleName?: ServerRole) => Promise<void>;
  deleteRolePermission: (permissionId: string, userId: string) => Promise<void>;
  deleteChannelPermission: (permissionId: string, userId: string) => Promise<void>;

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
  roles: [],
  rolePermissions: [],
  channelPermissions: [],
  channelMembers: [],
  isLoading: false,
  error: null,

  fetchServers: async (userId: string) => {
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

      const result = data as { success: boolean; error?: string; server?: any };
      if (!result.success) {
        console.error('update_server failed:', result.error);
        throw new Error(result.error || 'Failed to update server');
      }

      // Use the server data returned from RPC if available, otherwise use updates
      const serverUpdates = result.server ? {
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

  joinServer: async (inviteCode: string, userId: string) => {
    try {
      // Rate limit invite code lookups to prevent abuse
      if (!inviteCodeRateLimiter.isAllowed(userId)) {
        const remainingTime = inviteCodeRateLimiter.getRemainingTime(userId);
        set({ error: `Too many attempts. Try again in ${remainingTime} seconds` });
        return null;
      }

      // Use RPC function to join server (bypasses RLS)
      const { data, error } = await supabase.rpc('join_server_by_invite', {
        _invite_code: inviteCode.toUpperCase(),
        _user_id: userId,
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

  deleteServer: async (serverId: string) => {
    try {
      const { error } = await supabase
        .from('servers')
        .delete()
        .eq('id', serverId);

      if (error) throw error;

      set((state) => ({
        servers: state.servers.filter((s) => s.id !== serverId),
        currentServer: state.currentServer?.id === serverId ? null : state.currentServer,
        currentChannel: null,
        channels: [],
        categories: [],
        members: [],
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
      });
    } else {
      // Going to DM view - just set server to null, keep channel data for when we return
      set({ currentServer: null });
    }
  },
  setCurrentChannel: (channel) => {
    // Persist to localStorage
    if (channel) {
      localStorage.setItem('kloak-current-channel-id', channel.id);
    } else {
      localStorage.removeItem('kloak-current-channel-id');
    }
    set({ currentChannel: channel });
  },

  fetchChannels: async (serverId: string) => {
    try {
      // Get current user ID for private channel filtering
      const userId = useAuthStore.getState().user?.id;
      
      // Use RPC functions to bypass RLS
      const [categoriesResult, channelsResult] = await Promise.all([
        supabase.rpc('get_server_categories', { _server_id: serverId }),
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

      // Always try to restore the persisted channel when switching servers
      const { currentChannel } = get();
      const persistedChannelId = localStorage.getItem('kloak-current-channel-id');

      // Restore channel: try persisted first, then keep current if valid, else first channel
      if (channels.length > 0) {
        const restoredChannel = persistedChannelId
          ? channels.find(c => c.id === persistedChannelId)
          : null;

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

  createChannel: async (serverId: string, name: string, type: ChannelType, userId: string, categoryId?: string, icon?: string, isPrivate?: boolean) => {
    try {
      const { channels } = get();
      const categoryChannels = channels.filter((c) => c.category_id === categoryId);
      const position = categoryChannels.length;

      // Use RPC function to bypass RLS
      const { data, error } = await supabase.rpc('create_channel', {
        _server_id: serverId,
        _user_id: userId,
        _name: name,
        _type: type,
        _category_id: categoryId || null,
        _position: position,
        _icon: icon || null,
        _is_private: isPrivate || false,
      });

      if (error) throw error;

      const channel = data as unknown as Channel;
      set((state) => ({
        channels: [...state.channels, channel],
      }));

      return channel;
    } catch (error) {
      console.error('Failed to create channel:', error);
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
      const channelData = data as unknown as Partial<Channel>;
      set((state) => ({
        channels: state.channels.map((c) =>
          c.id === channelId ? { ...c, ...channelData } : c
        ),
        currentChannel:
          state.currentChannel?.id === channelId
            ? { ...state.currentChannel, ...channelData }
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
      // Update positions in database
      const updates = categoryIds.map((id, index) =>
        supabase
          .from('channel_categories')
          .update({ position: index })
          .eq('id', id)
      );

      await Promise.all(updates);

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
      const { channels } = get();
      const channel = channels.find(c => c.id === channelId);
      if (!channel) return;

      // Get channels in the target category
      const targetChannels = channels
        .filter(c => c.category_id === newCategoryId && c.id !== channelId)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

      // Insert at new position
      targetChannels.splice(newPosition, 0, { ...channel, category_id: newCategoryId });

      // Update all positions in target category
      const updates = targetChannels.map((c, index) =>
        supabase
          .from('channels')
          .update({ position: index, category_id: newCategoryId })
          .eq('id', c.id)
      );

      await Promise.all(updates);

      // Update local state
      set((state) => ({
        channels: state.channels.map((c) => {
          if (c.id === channelId) {
            return { ...c, category_id: newCategoryId, position: newPosition };
          }
          const idx = targetChannels.findIndex(tc => tc.id === c.id);
          if (idx !== -1 && c.category_id === newCategoryId) {
            return { ...c, position: idx };
          }
          return c;
        }),
      }));
    } catch (error) {
      console.error('Failed to reorder channels:', error);
    }
  },

  moveChannelToCategory: async (channelId: string, categoryId: string | null) => {
    try {
      const { channels } = get();
      const targetChannels = channels.filter(c => c.category_id === categoryId);
      const newPosition = targetChannels.length;

      const { error } = await supabase
        .from('channels')
        .update({ category_id: categoryId, position: newPosition })
        .eq('id', channelId);

      if (error) throw error;

      set((state) => ({
        channels: state.channels.map((c) =>
          c.id === channelId ? { ...c, category_id: categoryId, position: newPosition } : c
        ),
      }));
    } catch (error) {
      console.error('Failed to move channel:', error);
    }
  },

  fetchMembers: async (serverId: string) => {
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
          user: item.user as any,
          roles: item.roles as any,
        }));

      set({ members });
    } catch (error) {
      console.error('Failed to fetch members:', error);
      // Set empty array on error to prevent stale data
      set({ members: [] });
    }
  },

  updateMember: async (memberId: string, updates: Partial<ServerMember>) => {
    try {
      const { error } = await supabase
        .from('server_members')
        .update(updates)
        .eq('id', memberId);

      if (error) throw error;

      set((state) => ({
        members: state.members.map((m) =>
          m.id === memberId ? { ...m, ...updates } : m
        ),
      }));
    } catch (error) {
      console.error('Failed to update member:', error);
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

      set((state) => ({
        members: state.members.filter((m) => m.user_id !== targetUserId),
      }));
    } catch (error) {
      console.error('Failed to ban member:', error);
      throw error;
    }
  },

  transferOwnership: async (serverId: string, currentOwnerId: string, newOwnerId: string) => {
    try {
      const { members } = get();
      const currentOwnerMember = members.find(m => m.user_id === currentOwnerId && m.server_id === serverId);
      const newOwnerMember = members.find(m => m.user_id === newOwnerId && m.server_id === serverId);

      if (!currentOwnerMember || !newOwnerMember) {
        throw new Error('Member not found');
      }

      // Update the new owner's role to owner
      const { error: newOwnerError } = await supabase
        .from('server_members')
        .update({ role: 'owner' })
        .eq('id', newOwnerMember.id);

      if (newOwnerError) throw newOwnerError;

      // Update the current owner's role to admin
      const { error: currentOwnerError } = await supabase
        .from('server_members')
        .update({ role: 'admin' })
        .eq('id', currentOwnerMember.id);

      if (currentOwnerError) throw currentOwnerError;

      // Update the server's owner_id
      const { error: serverError } = await supabase
        .from('servers')
        .update({ owner_id: newOwnerId })
        .eq('id', serverId);

      if (serverError) throw serverError;

      // Update local state
      set((state) => ({
        members: state.members.map((m) => {
          if (m.id === newOwnerMember.id) return { ...m, role: 'owner' as const };
          if (m.id === currentOwnerMember.id) return { ...m, role: 'admin' as const };
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
    try {
      const { data, error } = await supabase
        .from('server_roles')
        .select('*')
        .eq('server_id', serverId)
        .order('position', { ascending: true });

      if (error) throw error;

      const roles = (data || []) as unknown as CustomServerRole[];
      set({ roles });
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    }
  },

  createRole: async (serverId: string, userId: string, name: string, color: string, icon?: string | null) => {
    try {
      // Get the max position for this server
      const { data: existingRoles } = await supabase
        .from('server_roles')
        .select('position')
        .eq('server_id', serverId)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = existingRoles && existingRoles.length > 0 ? existingRoles[0].position + 1 : 0;

      const { data, error } = await supabase
        .from('server_roles')
        .insert({
          server_id: serverId,
          name,
          color,
          icon: icon ?? null,
          position: nextPosition,
        })
        .select()
        .single();

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
      const updateData: Record<string, string | null> = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.color) updateData.color = updates.color;
      if (updates.icon !== undefined) updateData.icon = updates.icon;

      const { data, error } = await supabase
        .from('server_roles')
        .update(updateData)
        .eq('id', roleId)
        .select()
        .single();

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
      const { error } = await supabase
        .from('server_roles')
        .delete()
        .eq('id', roleId);

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
      // Update each row (safer than upsert: avoids accidental inserts needing required columns)
      const updates = sanitized.map((roleId, position) =>
        supabase
          .from('server_roles')
          .update({ position })
          .eq('id', roleId)
          .eq('server_id', serverId),
      );

      const results = await Promise.all(updates);
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) throw firstError;
    } catch (error) {
      console.error('Failed to reorder roles:', error);
      // Re-sync from server if persistence fails
      await get().fetchRoles(serverId);
      throw error;
    }
  },

  assignRoleToMember: async (memberId: string, roleId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('server_member_roles')
        .insert({
          member_id: memberId,
          role_id: roleId,
        });

      if (error) throw error;

      // Refresh members to get updated roles
      const { members } = get();
      const member = members.find((m) => m.id === memberId);
      if (member) {
        const { currentServer } = get();
        if (currentServer) {
          await get().fetchMembers(currentServer.id);
        }
      }
    } catch (error) {
      console.error('Failed to assign role:', error);
      throw error;
    }
  },

  removeRoleFromMember: async (memberId: string, roleId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('server_member_roles')
        .delete()
        .eq('member_id', memberId)
        .eq('role_id', roleId);

      if (error) throw error;

      // Refresh members to get updated roles
      const { members } = get();
      const member = members.find((m) => m.id === memberId);
      if (member) {
        const { currentServer } = get();
        if (currentServer) {
          await get().fetchMembers(currentServer.id);
        }
      }
    } catch (error) {
      console.error('Failed to remove role:', error);
      throw error;
    }
  },

  fetchRolePermissions: async (serverId: string) => {
    try {
      // Query role_permissions table directly
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
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

      set({ rolePermissions: permissions });
    } catch (error) {
      console.error('Failed to fetch role permissions:', error);
      throw error;
    }
  },

  fetchChannelPermissions: async (channelId: string) => {
    try {
      // Query channel_permissions table directly
      const { data, error } = await supabase
        .from('channel_permissions')
        .select('*')
        .eq('channel_id', channelId);

      if (error) {
        console.error('Query error:', error);
        throw error;
      }

      const permissions: ChannelPermission[] = (data ?? []).map((row) => ({
        id: row.id,
        channel_id: row.channel_id,
        role_id: row.role_id,
        role_name: row.role_name as ServerRole | null,
        permission: row.permission as Permission,
        allowed: row.allowed,
        created_at: row.created_at ?? '',
      }));

      set({ channelPermissions: permissions });
    } catch (error) {
      console.error('Failed to fetch channel permissions:', error);
      throw error;
    }
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
        _permission: permission,
        _role_id: roleId || null,
        _role_name: roleName || null,
        _allowed: allowed,
      });

      if (error) throw error;

      // Refresh role permissions
      await get().fetchRolePermissions(serverId);
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
    roleName?: ServerRole
  ) => {
    try {
      // Use RPC function instead of direct upsert to handle partial indexes correctly
      const { error } = await supabase.rpc('set_channel_permission', {
        _channel_id: channelId,
        _user_id: userId,
        _permission: permission,
        _allowed: allowed,
        _role_id: roleId || null,
        _role_name: roleName || null,
      });

      if (error) throw error;

      // Refresh channel permissions
      await get().fetchChannelPermissions(channelId);
    } catch (error) {
      console.error('Failed to set channel permission:', error);
      throw error;
    }
  },

  deleteRolePermission: async (permissionId: string, userId: string) => {
    try {
      // Get the permission first to know which server to refresh
      const { rolePermissions } = get();
      const toDelete = rolePermissions.find((p) => p.id === permissionId);

      const { error } = await supabase
        .from('role_permissions')
        .delete()
        .eq('id', permissionId);

      if (error) throw error;

      // Refresh role permissions
      if (toDelete) {
        const { currentServer } = get();
        if (currentServer) {
          await get().fetchRolePermissions(currentServer.id);
        }
      }
    } catch (error) {
      console.error('Failed to delete role permission:', error);
      throw error;
    }
  },

  deleteChannelPermission: async (permissionId: string, userId: string) => {
    try {
      // Get the permission first to know which channel to refresh
      const { channelPermissions } = get();
      const toDelete = channelPermissions.find((p) => p.id === permissionId);

      const { error } = await supabase
        .from('channel_permissions')
        .delete()
        .eq('id', permissionId);

      if (error) throw error;

      // Refresh channel permissions
      if (toDelete) {
        await get().fetchChannelPermissions(toDelete.channel_id);
      }
    } catch (error) {
      console.error('Failed to delete channel permission:', error);
      throw error;
    }
  },

  clearServerState: () =>
    set({
      currentServer: null,
      currentChannel: null,
      categories: [],
      channels: [],
      members: [],
      roles: [],
    }),
}));
