import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNotificationStore } from '@/stores/notificationStore';
import { useServerStore } from '@/stores/serverStore';
import { useUIStore } from '@/stores/uiStore';
import type { Notification, NotificationType as DBNotificationType } from '@/types';
import { isTauri } from '@/lib/tauriRuntime';
import { playNotificationSound, type NotificationType as SoundNotificationType } from './useNotificationSound';

const isNotificationTypeEnabled = (type: DBNotificationType): boolean => {
  const state = useUIStore.getState();
  switch (type) {
    case 'mention':
      return state.enableMentionNotifications;
    case 'dm':
      return state.enableDMNotifications;
    case 'friend_request':
      return state.enableFriendRequestNotifications;
    case 'server_invite':
      return state.enableServerInviteNotifications;
    default:
      return true;
  }
};

const mapNotificationTypeToSoundType = (dbType: DBNotificationType): SoundNotificationType => {
  switch (dbType) {
    case 'mention':
      return 'user_mention';
    case 'dm':
      return 'dm';
    case 'friend_request':
    case 'server_invite':
    default:
      return 'general';
  }
};

type BroadcastMutationPayload<T> = {
  op?: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: T;
  old?: T;
};

export const useRealtimeNotifications = (userId: string | null) => {
  // FIX: Use refs for store functions to stabilize effect deps.
  // Previously, destructured store functions in deps caused the effect to re-run
  // every render, tearing down and recreating the channel subscription.
  const storeRef = useRef(useNotificationStore.getState());
  useEffect(() => {
    return useNotificationStore.subscribe((state) => {
      storeRef.current = state;
    });
  }, []);

  const isSubscribedRef = useRef(false);

  useEffect(() => {
    if (!userId) return;
    isSubscribedRef.current = false;

    // Delay initial fetch until auth key hash is available.
    const initFetch = async () => {
      const { getKeyHashAsync } = await import('@/integrations/supabase/client');
      const kh = await getKeyHashAsync();
      if (kh) storeRef.current.fetchNotifications(userId);
    };
    void initFetch();

    const processIncomingNotification = (notification: Notification) => {
      const existing = useNotificationStore.getState().notifications.some((n) => n.id === notification.id);
      if (existing) return;

      if (!isNotificationTypeEnabled(notification.type)) return;

      storeRef.current.addNotification(notification);

      if (notification.title === 'You have been kicked' || notification.title === 'You have been banned') {
        useServerStore.getState().fetchServers(userId);
      }

      const soundType = mapNotificationTypeToSoundType(notification.type);
      playNotificationSound(soundType);
      void showDesktopNotification(notification);
    };

    const channel = supabase
      .channel(`user:${userId}`)
      .on(
        'broadcast',
        {
          event: 'notifications',
        },
        (payload) => {
          const eventPayload = payload as BroadcastMutationPayload<Notification>;
          if (eventPayload.op === 'DELETE' && eventPayload.old?.id) {
            storeRef.current.removeNotification(eventPayload.old.id);
            return;
          }

          if ((eventPayload.op === 'INSERT' || eventPayload.op === 'UPDATE') && eventPayload.new) {
            processIncomingNotification(eventPayload.new);
          }
        },
      )
      .subscribe((status, err) => {
        isSubscribedRef.current = status === 'SUBSCRIBED';
        if (status !== 'SUBSCRIBED') {
          console.warn('[Realtime] Notifications subscription status:', { status, userId, err });
        }
      });

    const pollInterval = window.setInterval(async () => {
      if (isSubscribedRef.current) return;

      // Skip poll if auth key hash is unavailable (prevents 401s).
      const { getKeyHash } = await import('@/integrations/supabase/client');
      if (!getKeyHash()) return;

      const { data, error } = await supabase
        .from('notifications')
        .select('id, user_id, type, title, body, link, is_read, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error || !data?.length) return;

      const existingIds = new Set(useNotificationStore.getState().notifications.map((n) => n.id));
      const unseen = (data as Notification[])
        .filter((n) => !existingIds.has(n.id))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      unseen.forEach(processIncomingNotification);
    }, 300_000);

    return () => {
      isSubscribedRef.current = false;
      window.clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [userId]);
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (isTauri()) {
    try {
      const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
      let granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        granted = permission === 'granted';
      }
      return granted;
    } catch {
      return false;
    }
  }

  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return false;
  }

  try {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch {
    return false;
  }
};

const showDesktopNotification = async (notification: Notification) => {
  const ui = useUIStore.getState();
  if (isTauri()) {
    if (!ui.desktopNotificationsEnabled) return;
  } else {
    if (!ui.browserNotificationsEnabled) return;
  }

  if (isTauri()) {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const focused = await getCurrentWindow().isFocused();
      if (focused) return;
    } catch {
      // fall through
    }
  }

  if (isTauri()) {
    try {
      const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification');
      let granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        granted = permission === 'granted';
      }
      if (!granted) return;

      const link = notification.link || '/app';
      sendNotification({
        title: notification.title,
        body: notification.body || undefined,
        autoCancel: true,
        extra: { link } as Record<string, string>,
      });
    } catch (err) {
      console.error('Failed to send Tauri notification:', err);
    }
    return;
  }

  if (typeof Notification === 'undefined') return;

  try {
    if (Notification.permission !== 'granted') return;

    const browserNotification = new Notification(notification.title, {
      body: notification.body || undefined,
      icon: '/favicon.ico',
      tag: notification.id,
    });

    browserNotification.onclick = () => {
      window.focus();
      if (notification.link) {
        window.history.pushState({}, '', notification.link);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
      browserNotification.close();
    };
  } catch {
    // ignore notification construction failures
  }
};
