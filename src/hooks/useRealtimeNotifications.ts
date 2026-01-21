import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNotificationStore } from '@/stores/notificationStore';
import { useUIStore } from '@/stores/uiStore';
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

// Track the last notification link for window focus fallback (Windows may not fire onAction for body clicks)
let lastNotificationLink: string | null = null;

// Show desktop notification
const showDesktopNotification = async (notification: Notification) => {
  // Respect user preference
  if (!useUIStore.getState().desktopNotificationsEnabled) return;

  // Only show if app isn't focused (browser tab or Tauri window).
  // Note: In Tauri, `document.visibilityState` is often always "visible", even when unfocused/minimized,
  // so we must rely on the window focus API when available.
  if (isTauri()) {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const focused = await getCurrentWindow().isFocused();
      if (focused) return;
      // If we can check Tauri focus, don't use visibilityState gating.
      // Proceed to native notification.
    } catch {
      // If focus check fails, fall back to visibilityState below.
    }
  }

  // Browser gating: only notify when the tab isn't visible.
  // (In Tauri this is unreliable; see note above.)
  if (!isTauri() && document.visibilityState === 'visible') return;

  if (isTauri()) {
    try {
      const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification');
      let granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        granted = permission === 'granted';
      }
      if (!granted) return;

      const link = notification.link || "/app";

      // Use plugin's sendNotification (this works for showing notifications)
      sendNotification({
        title: notification.title,
        body: notification.body || undefined,
        autoCancel: true,
        extra: {
          link: link,
        } as any,
      });
    } catch (err) {
      console.error("Failed to send Tauri notification:", err);
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
