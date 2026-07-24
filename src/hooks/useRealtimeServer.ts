import { useEffect, useRef, useCallback } from 'react';
import { useMessageStore } from '@/stores/messageStore';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { useConnectionStatus } from './useConnectionStatus';
import { toast } from 'sonner';
import { acquireChannel, subscribeChannel, releaseChannel } from '@/lib/sharedChannel';
type RealtimeRow = Record<string, unknown>;
type RealtimeErrorLike = { message?: string; name?: string; cause?: unknown };
type ServerSurfaceSnapshot = {
  categories?: RealtimeRow[];
  channels?: RealtimeRow[];
  roles?: RealtimeRow[];
  members_lite?: RealtimeRow[];
  current_member?: RealtimeRow | null;
};

type ServerSurfaceBroadcastPayload = {
  table?: string;
  op?: 'INSERT' | 'UPDATE' | 'DELETE';
  server_id?: string;
  new?: RealtimeRow | null;
  old?: RealtimeRow | null;
  surface?: ServerSurfaceSnapshot | null;
  removed?: boolean;
};

function makeDebouncedFn(fn: () => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return debounced;
}

const applyUserScopedServerSurface = (serverId: string, event: ServerSurfaceBroadcastPayload) => {
  if (event.removed || event.op === 'DELETE' && !event.surface) {
    useServerStore.setState((state) => ({
      servers: state.servers.filter((server) => server.id !== serverId),
      currentServer: state.currentServer?.id === serverId ? null : state.currentServer,
      currentChannel: state.currentServer?.id === serverId ? null : state.currentChannel,
      channels: state.currentServer?.id === serverId ? [] : state.channels,
      categories: state.currentServer?.id === serverId ? [] : state.categories,
      members: state.currentServer?.id === serverId ? [] : state.members,
      membersServerId: state.currentServer?.id === serverId ? null : state.membersServerId,
      membersFetchMode: state.currentServer?.id === serverId ? null : state.membersFetchMode,
      roles: state.currentServer?.id === serverId ? [] : state.roles,
    }));
    return true;
  }

  const surface = event.surface;
  if (!surface) return false;

  const categories = Array.isArray(surface.categories) ? surface.categories : [];
  const channels = Array.isArray(surface.channels) ? surface.channels : [];
  const roles = Array.isArray(surface.roles) ? surface.roles : undefined;
  const membersLite = Array.isArray(surface.members_lite) ? surface.members_lite : undefined;

  useServerStore.setState((state) => {
    const isActiveServer = state.currentServer?.id === serverId;
    const nextCurrentChannel =
      isActiveServer && state.currentChannel && !channels.some((channel) => channel.id === state.currentChannel?.id)
        ? ((channels[0] as any) ?? null)
        : state.currentChannel;

    return {
      categories: isActiveServer ? (categories as any) : state.categories,
      channels: isActiveServer ? (channels as any) : state.channels,
      currentChannel: nextCurrentChannel as any,
      roles: isActiveServer && roles ? (roles as any) : state.roles,
      members:
        isActiveServer && membersLite && state.membersFetchMode !== 'full'
          ? (membersLite as any)
          : state.members,
      membersServerId:
        isActiveServer && membersLite && state.membersFetchMode !== 'full' ? serverId : state.membersServerId,
      membersFetchMode:
        isActiveServer && membersLite && state.membersFetchMode !== 'full' ? 'lite' : state.membersFetchMode,
      isMembersLoading: isActiveServer && membersLite ? false : state.isMembersLoading,
    };
  });

  return true;
};

const applyServerRowBroadcast = (serverId: string, event: ServerSurfaceBroadcastPayload) => {
  if (event.op === 'DELETE') {
    useServerStore.setState((state) => ({
      servers: state.servers.filter((server) => server.id !== serverId),
      currentServer: state.currentServer?.id === serverId ? null : state.currentServer,
      currentChannel: state.currentServer?.id === serverId ? null : state.currentChannel,
      channels: state.currentServer?.id === serverId ? [] : state.channels,
      categories: state.currentServer?.id === serverId ? [] : state.categories,
      members: state.currentServer?.id === serverId ? [] : state.members,
      membersServerId: state.currentServer?.id === serverId ? null : state.membersServerId,
      membersFetchMode: state.currentServer?.id === serverId ? null : state.membersFetchMode,
    }));
    return true;
  }

  const row = event.new;
  if (!row?.id) return false;

  useServerStore.setState((state) => ({
    servers: state.servers.map((server) => (server.id === row.id ? { ...server, ...row } : server)),
    currentServer: state.currentServer?.id === row.id ? { ...state.currentServer, ...row } : state.currentServer,
  }));
  return true;
};

export const useRealtimeServer = (serverId: string | null) => {
  const { isConnected } = useConnectionStatus();
  const serverStoreRef = useRef(useServerStore.getState());
  const authStoreRef = useRef(useAuthStore.getState());
  const prevConnectedRef = useRef<boolean | null>(null);

  useEffect(() => {
    const unsubServer = useServerStore.subscribe((state) => {
      serverStoreRef.current = state;
    });
    const unsubAuth = useAuthStore.subscribe((state) => {
      authStoreRef.current = state;
    });
    return () => {
      unsubServer();
      unsubAuth();
    };
  }, []);

  const handleChannelAccessLost = useCallback((sid: string, message: string) => {
    const { channels, setCurrentChannel } = useServerStore.getState();
    const remaining = channels.filter((c) => c.server_id === sid);
    const fallback = remaining[0] || null;
    setCurrentChannel(fallback);
    toast.warning(message);
  }, []);

  const debouncedRefreshRef = useRef<ReturnType<typeof makeDebouncedFn> | null>(null);

  useEffect(() => {
    if (!serverId) return;
    if (prevConnectedRef.current === false && isConnected) {
      console.log('[Realtime] Reconnected - waiting for user-scoped server surface', serverId);
    }
    prevConnectedRef.current = isConnected;
  }, [isConnected, serverId]);

  useEffect(() => {
    if (!serverId) return;
    const debounced = makeDebouncedFn(() => undefined, 500);
    debouncedRefreshRef.current = debounced;
    return () => {
      debounced.cancel();
    };
  }, [serverId]);

  useEffect(() => {
    if (!serverId) return;

    const topic = `server:${serverId}`;
    const channel = acquireChannel(topic);
    channel.on(
      'broadcast',
      { event: 'server_surface' },
      ({ payload }) => {
        const event = payload as ServerSurfaceBroadcastPayload | null;
        if (!event?.table) return;

        if (event.table === 'servers') {
          applyServerRowBroadcast(serverId, event);
        }

        // Full private channel/member/role updates now arrive on the user-scoped `user:<id>` topic.
      },
    );
    subscribeChannel(topic);

    return () => {
      releaseChannel(topic);
    };
  }, [serverId]);

  useEffect(() => {
    const userId = authStoreRef.current.user?.id;
    if (!serverId || !userId) return;

    const topic = `user:${userId}`;
    const channel = acquireChannel(topic);
    channel.on('broadcast', { event: 'server_surface' }, ({ payload }) => {
      const event = payload as ServerSurfaceBroadcastPayload | null;
      if (!event || event.server_id !== serverId) return;

      const previousMemberUserIds = new Set(useServerStore.getState().members.map((member) => member.user_id));
      const applied = applyUserScopedServerSurface(serverId, event);
      if (!applied) return;

      const currentMemberUserIds = new Set(useServerStore.getState().members.map((member) => member.user_id));
      for (const memberUserId of previousMemberUserIds) {
        if (!currentMemberUserIds.has(memberUserId)) {
          useMessageStore.getState().removeMessagesByUser(memberUserId);
        }
      }
    });
    subscribeChannel(topic);

    return () => {
      releaseChannel(topic);
    };
  }, [serverId]);
};
