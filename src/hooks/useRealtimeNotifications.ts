import { useEffect } from 'react';
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

export const useRealtimeNotifications = (userId: string | null) => {
  const { fetchNotifications, addNotification, removeNotification } = useNotificationStore();

  useEffect(() => {
    if (!userId) return;

    fetchNotifications(userId);

    const processIncomingNotification = (notification: Notification) => {
      const existing = useNotificationStore.getState().notifications.some((n) => n.id === notification.id);
      if (existing) return;

      if (!isNotificationTypeEnabled(notification.type)) return;

      addNotification(notification);

      if (notification.title === 'You have been kicked' || notification.title === 'You have been banned') {
        useServerStore.getState().fetchServers(userId);
      }

      const soundType = mapNotificationTypeToSoundType(notification.type);
      playNotificationSound(soundType);
      void showDesktopNotification(notification);
    };

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => processIncomingNotification(payload.new as Notification),
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const oldNotification = payload.old as { id: string };
          removeNotification(oldNotification.id);
        },
      )
      .subscribe((status, err) => {
        if (status !== 'SUBSCRIBED') {
          console.warn('[Realtime] Notifications subscription status:', { status, userId, err });
        }
      });

    const pollInterval = window.setInterval(async () => {
      // Skip poll if auth key hash is unavailable (prevents 401s)
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
    }, 120_000); // 2 minutes — safety net only; realtime handles live updates

    return () => {
      window.clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [userId, fetchNotifications, addNotification, removeNotification]);
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
