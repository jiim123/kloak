import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUIStore, type Theme, THEMES, applyTheme } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';

/**
 * Hook to sync user preferences (theme, notifications, display) with the database
 * for authenticated users. Falls back to localStorage for unauthenticated users.
 */
export const usePreferencesSync = () => {
  const { user, isAuthenticated } = useAuthStore();
  const {
    theme,
    linkPreviewsEnabled,
    desktopNotificationsEnabled,
    notificationSoundEnabled,
    showMessagePreview,
    compactMode,
    showTimestamps,
    animateEmojis,
    setTheme,
    setLinkPreviewsEnabled,
    setDesktopNotificationsEnabled,
    setNotificationSoundEnabled,
    setShowMessagePreview,
    setCompactMode,
    setShowTimestamps,
    setAnimateEmojis,
  } = useUIStore();
  
  const hasLoadedFromDB = useRef(false);
  const isUpdating = useRef(false);

  // Load preferences from database when user logs in
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      hasLoadedFromDB.current = false;
      return;
    }

    const loadPreferences = async () => {
      try {
        // OPTIMIZATION: Specify only required columns instead of select('*')
        const { data, error } = await supabase
          .from('user_preferences')
          .select('theme, link_previews_enabled, desktop_notifications_enabled, notification_sound_enabled, show_message_preview, compact_mode, show_timestamps, animate_emojis')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error loading preferences:', error);
          return;
        }

        if (data) {
          isUpdating.current = true;
          
          // Theme
          const validTheme = THEMES.find(t => t.id === data.theme);
          if (validTheme) {
            setTheme(validTheme.id as Theme);
          }
          
          // Link previews
          if (typeof data.link_previews_enabled === 'boolean') {
            setLinkPreviewsEnabled(data.link_previews_enabled);
          }

          // Notification preferences
          if (typeof data.desktop_notifications_enabled === 'boolean') {
            setDesktopNotificationsEnabled(data.desktop_notifications_enabled);
          }
          if (typeof data.notification_sound_enabled === 'boolean') {
            setNotificationSoundEnabled(data.notification_sound_enabled);
          }
          if (typeof data.show_message_preview === 'boolean') {
            setShowMessagePreview(data.show_message_preview);
          }

          // Message display preferences
          if (typeof data.compact_mode === 'boolean') {
            setCompactMode(data.compact_mode);
          }
          if (typeof data.show_timestamps === 'boolean') {
            setShowTimestamps(data.show_timestamps);
          }
          if (typeof data.animate_emojis === 'boolean') {
            setAnimateEmojis(data.animate_emojis);
          }
          
          isUpdating.current = false;
        } else {
          // Create initial preferences record with current local values
          await supabase.from('user_preferences').insert({
            user_id: user.id,
            theme,
            link_previews_enabled: linkPreviewsEnabled,
            desktop_notifications_enabled: desktopNotificationsEnabled,
            notification_sound_enabled: notificationSoundEnabled,
            show_message_preview: showMessagePreview,
            compact_mode: compactMode,
            show_timestamps: showTimestamps,
            animate_emojis: animateEmojis,
          });
        }

        hasLoadedFromDB.current = true;
      } catch (err) {
        console.error('Failed to load preferences:', err);
      }
    };

    loadPreferences();
  }, [isAuthenticated, user?.id]);

  // Save all preferences to database when they change (for authenticated users)
  useEffect(() => {
    if (!isAuthenticated || !user?.id || !hasLoadedFromDB.current || isUpdating.current) {
      return;
    }

    const savePreferences = async () => {
      try {
        await supabase
          .from('user_preferences')
          .upsert({
            user_id: user.id,
            theme,
            link_previews_enabled: linkPreviewsEnabled,
            desktop_notifications_enabled: desktopNotificationsEnabled,
            notification_sound_enabled: notificationSoundEnabled,
            show_message_preview: showMessagePreview,
            compact_mode: compactMode,
            show_timestamps: showTimestamps,
            animate_emojis: animateEmojis,
          }, {
            onConflict: 'user_id',
          });
      } catch (err) {
        console.error('Failed to save preferences:', err);
      }
    };

    savePreferences();
  }, [
    theme,
    linkPreviewsEnabled,
    desktopNotificationsEnabled,
    notificationSoundEnabled,
    showMessagePreview,
    compactMode,
    showTimestamps,
    animateEmojis,
    isAuthenticated,
    user?.id,
  ]);
};
