import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNotificationStore } from '@/stores/notificationStore';
import type { Notification } from '@/types';
import { isTauri } from '@/lib/tauriRuntime';

export const useRealtimeNotifications = (userId: string | null) => {
  const { fetchNotifications, addNotification, removeNotification } = useNotificationStore();

  useEffect(() => {
    if (!userId) return;

    // Initial fetch
    fetchNotifications(userId);

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
        (payload) => {
          const notification = payload.new as Notification;
          addNotification(notification);
          
          // Show desktop notification if permitted
          void showDesktopNotification(notification);
        }
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchNotifications, addNotification, removeNotification]);
};

// Request browser notification permission
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

  if (!('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

// Show desktop notification
const showDesktopNotification = async (notification: Notification) => {
  // Only show if tab is not focused
  if (document.visibilityState === 'visible') return;

  if (isTauri()) {
    try {
      const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification');
      let granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        granted = permission === 'granted';
      }
      if (!granted) return;

      sendNotification({
        title: notification.title,
        body: notification.body || undefined,
      });
    } catch {
      // Ignore in browser / non-tauri environments
    }
    return;
  }

  if (Notification.permission !== 'granted') return;

  const browserNotification = new window.Notification(notification.title, {
    body: notification.body || undefined,
    icon: '/favicon.ico',
    tag: notification.id, // Prevents duplicate notifications
  });

  browserNotification.onclick = () => {
    window.focus();
    if (notification.link) {
      // Use history.pushState for SPA navigation instead of full page reload
      window.history.pushState({}, '', notification.link);
      // Dispatch a popstate event to trigger React Router navigation
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    browserNotification.close();
  };
};
