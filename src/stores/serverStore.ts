import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { 
  Server, 
  ServerWithMembership, 
  ServerMember, 
  Channel, 
  ChannelCategory,
  ChannelType,
  ServerRole 
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
  joinServer: (inviteCode: string, userId: string) => Promise<boolean>;
  leaveServer: (serverId: string, userId: string) => Promise<void>;
  deleteServer: (serverId: string) => Promise<void>;
  setCurrentServer: (server: Server | null) => void;
  setCurrentChannel: (channel: Channel | null) => void;

  // Channel actions
  fetchChannels: (serverId: string) => Promise<void>;
  createCategory: (serverId: string, name: string) => Promise<ChannelCategory | null>;
  createChannel: (serverId: string, name: string, type: ChannelType, categoryId?: string, icon?: string) => Promise<Channel | null>;
  updateChannel: (channelId: string, updates: Partial<Channel>) => Promise<void>;
  deleteChannel: (channelId: string) => Promise<void>;
  updateCategory: (categoryId: string, updates: Partial<ChannelCategory>) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  reorderCategories: (categoryIds: string[]) => Promise<void>;
  reorderChannels: (channelId: string, newCategoryId: string | null, newPosition: number) => Promise<void>;
  moveChannelToCategory: (channelId: string, categoryId: string | null) => Promise<void>;

  // Member actions
  fetchMembers: (serverId: string) => Promise<void>;
  updateMember: (memberId: string, updates: Partial<ServerMember>) => Promise<void>;
  kickMember: (serverId: string, userId: string) => Promise<void>;
  banMember: (serverId: string, userId: string) => Promise<void>;
  transferOwnership: (serverId: string, currentOwnerId: string, newOwnerId: string) => Promise<void>;

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
  isLoading: false,
  error: null,

  fetchServers: async (userId: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('server_members')
        .select(`
          server_id,
          role,
          nickname,
          joined_at,
          servers (*)
        `)
        .eq('user_id', userId)
        .eq('is_banned', false);

      if (error) throw error;

      const servers: ServerWithMembership[] = (data || []).map((item: any) => ({
        ...item.servers,
        role: item.role,
        nickname: item.nickname,
        joined_at: item.joined_at,
      }));

      const { currentServer } = get();
      
      // Auto-select the first server if user has servers and none is selected
      if (servers.length > 0 && !currentServer) {
        set({ servers, currentServer: servers[0], isLoading: false });
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
      // Generate invite code
      const { data: inviteCode } = await supabase.rpc('generate_invite_code');

      // Create server
      const { data: server, error: serverError } = await supabase
        .from('servers')
        .insert({
          name,
          owner_id: ownerId,
          invite_code: inviteCode,
        })
        .select()
        .single();

      if (serverError) throw serverError;

      // Add owner as member with owner role
      const { error: memberError } = await supabase
        .from('server_members')
        .insert({
          server_id: server.id,
          user_id: ownerId,
          role: 'owner',
        });

      if (memberError) throw memberError;

      // Create default #general channel
      const { error: channelError } = await supabase
        .from('channels')
        .insert({
          server_id: server.id,
          name: 'general',
          type: 'text',
          position: 0,
        });

      if (channelError) throw channelError;

      // Refresh servers list
      await get().fetchServers(ownerId);

      return server as Server;
    } catch (error) {
      console.error('Failed to create server:', error);
      set({ error: 'Failed to create server' });
      return null;
    }
  },

  joinServer: async (inviteCode: string, userId: string) => {
    try {
      // Find server by invite code
      const { data: server, error: serverError } = await supabase
        .from('servers')
        .select('*')
        .eq('invite_code', inviteCode.toUpperCase())
        .single();

      if (serverError || !server) {
        set({ error: 'Invalid invite code' });
        return false;
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('server_members')
        .select('*')
        .eq('server_id', server.id)
        .eq('user_id', userId)
        .single();

      if (existingMember) {
        if (existingMember.is_banned) {
          set({ error: 'You are banned from this server' });
          return false;
        }
        set({ error: 'You are already a member of this server' });
        return false;
      }

      // Join server
      const { error: joinError } = await supabase
        .from('server_members')
        .insert({
          server_id: server.id,
          user_id: userId,
          role: 'member',
        });

      if (joinError) throw joinError;

      // Refresh servers list
      await get().fetchServers(userId);
      return true;
    } catch (error) {
      console.error('Failed to join server:', error);
      set({ error: 'Failed to join server' });
      return false;
    }
  },

  leaveServer: async (serverId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('server_members')
        .delete()
        .eq('server_id', serverId)
        .eq('user_id', userId);

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
    set({ 
      currentServer: server,
      // Clear channel state when switching servers to ensure proper isolation
      currentChannel: null,
      channels: [],
      categories: [],
      members: [],
    });
  },
  setCurrentChannel: (channel) => set({ currentChannel: channel }),

  fetchChannels: async (serverId: string) => {
    try {
      // Fetch categories
      const { data: categories, error: catError } = await supabase
        .from('channel_categories')
        .select('*')
        .eq('server_id', serverId)
        .order('position');

      if (catError) throw catError;

      // Fetch channels
      const { data: channels, error: chanError } = await supabase
        .from('channels')
        .select('*')
        .eq('server_id', serverId)
        .order('position');

      if (chanError) throw chanError;

      set({
        categories: categories as ChannelCategory[],
        channels: channels as Channel[],
      });
    } catch (error) {
      console.error('Failed to fetch channels:', error);
    }
  },

  createCategory: async (serverId: string, name: string) => {
    try {
      const { categories } = get();
      const position = categories.length;

      const { data, error } = await supabase
        .from('channel_categories')
        .insert({
          server_id: serverId,
          name,
          position,
        })
        .select()
        .single();

      if (error) throw error;

      const category = data as ChannelCategory;
      set((state) => ({
        categories: [...state.categories, category],
      }));

      return category;
    } catch (error) {
      console.error('Failed to create category:', error);
      return null;
    }
  },

  createChannel: async (serverId: string, name: string, type: ChannelType, categoryId?: string, icon?: string) => {
    try {
      const { channels } = get();
      const categoryChannels = channels.filter((c) => c.category_id === categoryId);
      const position = categoryChannels.length;

      const { data, error } = await supabase
        .from('channels')
        .insert({
          server_id: serverId,
          name: name.toLowerCase().replace(/\s+/g, '-'),
          type,
          category_id: categoryId || null,
          position,
          icon: icon || null,
        })
        .select()
        .single();

      if (error) throw error;

      const channel = data as Channel;
      set((state) => ({
        channels: [...state.channels, channel],
      }));

      return channel;
    } catch (error) {
      console.error('Failed to create channel:', error);
      return null;
    }
  },

  updateChannel: async (channelId: string, updates: Partial<Channel>) => {
    try {
      const { error } = await supabase
        .from('channels')
        .update(updates)
        .eq('id', channelId);

      if (error) throw error;

      set((state) => ({
        channels: state.channels.map((c) =>
          c.id === channelId ? { ...c, ...updates } : c
        ),
        currentChannel:
          state.currentChannel?.id === channelId
            ? { ...state.currentChannel, ...updates }
            : state.currentChannel,
      }));
    } catch (error) {
      console.error('Failed to update channel:', error);
    }
  },

  deleteChannel: async (channelId: string) => {
    const { error } = await supabase
      .from('channels')
      .delete()
      .eq('id', channelId);

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

  updateCategory: async (categoryId: string, updates: Partial<ChannelCategory>) => {
    try {
      const { error } = await supabase
        .from('channel_categories')
        .update(updates)
        .eq('id', categoryId);

      if (error) throw error;

      set((state) => ({
        categories: state.categories.map((c) =>
          c.id === categoryId ? { ...c, ...updates } : c
        ),
      }));
    } catch (error) {
      console.error('Failed to update category:', error);
    }
  },

  deleteCategory: async (categoryId: string) => {
    // First, move all channels in this category to uncategorized
    const { channels } = get();
    const categoryChannels = channels.filter(c => c.category_id === categoryId);
    
    for (const channel of categoryChannels) {
      await supabase
        .from('channels')
        .update({ category_id: null })
        .eq('id', channel.id);
    }

    // Then delete the category
    const { error } = await supabase
      .from('channel_categories')
      .delete()
      .eq('id', categoryId);

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
      const { data, error } = await supabase
        .from('server_members')
        .select(`
          *,
          user:users (*)
        `)
        .eq('server_id', serverId)
        .eq('is_banned', false);

      if (error) throw error;

      const members: ServerMember[] = (data || []).map((item: any) => ({
        ...item,
        user: item.user,
      }));

      set({ members });
    } catch (error) {
      console.error('Failed to fetch members:', error);
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

  kickMember: async (serverId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('server_members')
        .delete()
        .eq('server_id', serverId)
        .eq('user_id', userId);

      if (error) throw error;

      set((state) => ({
        members: state.members.filter((m) => m.user_id !== userId),
      }));
    } catch (error) {
      console.error('Failed to kick member:', error);
    }
  },

  banMember: async (serverId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('server_members')
        .update({ is_banned: true })
        .eq('server_id', serverId)
        .eq('user_id', userId);

      if (error) throw error;

      set((state) => ({
        members: state.members.filter((m) => m.user_id !== userId),
      }));
    } catch (error) {
      console.error('Failed to ban member:', error);
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

  clearServerState: () =>
    set({
      currentServer: null,
      currentChannel: null,
      categories: [],
      channels: [],
      members: [],
    }),
}));
