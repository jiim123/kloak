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
    browserNotificationsEnabled,
    notificationSoundEnabled,
    notificationSoundServerMentions,
    notificationSoundUserMentions,
    notificationSoundReplies,
    notificationVolume,
    showMessagePreview,
    showPreviewServerMentions,
    showPreviewUserMentions,
    showPreviewReplies,
    compactMode,
    showTimestamps,
    animateEmojis,
    dmPrivacy,
    setTheme,
    setLinkPreviewsEnabled,
    setDesktopNotificationsEnabled,
    setBrowserNotificationsEnabled,
    setNotificationSoundEnabled,
    setNotificationSoundServerMentions,
    setNotificationSoundUserMentions,
    setNotificationSoundReplies,
    setNotificationVolume,
    setShowMessagePreview,
    setShowPreviewServerMentions,
    setShowPreviewUserMentions,
    setShowPreviewReplies,
    setCompactMode,
    setShowTimestamps,
    setAnimateEmojis,
    setDmPrivacy,
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
        const { data, error } = await supabase
          .from('user_preferences')
          .select('*')
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
          if (typeof data.browser_notifications_enabled === 'boolean') {
            setBrowserNotificationsEnabled(data.browser_notifications_enabled);
          }
          if (typeof data.notification_sound_enabled === 'boolean') {
            setNotificationSoundEnabled(data.notification_sound_enabled);
          }
          if (typeof data.notification_sound_server_mentions === 'boolean') {
            setNotificationSoundServerMentions(data.notification_sound_server_mentions);
          }
          if (typeof data.notification_sound_user_mentions === 'boolean') {
            setNotificationSoundUserMentions(data.notification_sound_user_mentions);
          }
          if (typeof data.notification_sound_replies === 'boolean') {
            setNotificationSoundReplies(data.notification_sound_replies);
          }
          if (typeof data.notification_volume === 'number') {
            setNotificationVolume(data.notification_volume);
          }
          if (typeof data.show_message_preview === 'boolean') {
            setShowMessagePreview(data.show_message_preview);
          }
          if (typeof data.show_preview_server_mentions === 'boolean') {
            setShowPreviewServerMentions(data.show_preview_server_mentions);
          }
          if (typeof data.show_preview_user_mentions === 'boolean') {
            setShowPreviewUserMentions(data.show_preview_user_mentions);
          }
          if (typeof data.show_preview_replies === 'boolean') {
            setShowPreviewReplies(data.show_preview_replies);
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
          if (typeof (data as any).dm_privacy === 'string') {
            setDmPrivacy((data as any).dm_privacy);
          }
          
          isUpdating.current = false;
        } else {
          // Create initial preferences record via secure RPC
          await supabase.rpc('upsert_user_preferences' as any, {
            _user_id: user.id,
            _prefs: {
              theme,
              link_previews_enabled: linkPreviewsEnabled,
              desktop_notifications_enabled: desktopNotificationsEnabled,
              browser_notifications_enabled: browserNotificationsEnabled,
              notification_sound_enabled: notificationSoundEnabled,
              notification_sound_server_mentions: notificationSoundServerMentions,
              notification_sound_user_mentions: notificationSoundUserMentions,
              notification_sound_replies: notificationSoundReplies,
              notification_volume: notificationVolume,
              show_message_preview: showMessagePreview,
              show_preview_server_mentions: showPreviewServerMentions,
              show_preview_user_mentions: showPreviewUserMentions,
              show_preview_replies: showPreviewReplies,
              compact_mode: compactMode,
              show_timestamps: showTimestamps,
              animate_emojis: animateEmojis,
              dm_privacy: dmPrivacy,
            },
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
        await supabase.rpc('upsert_user_preferences' as any, {
          _user_id: user.id,
          _prefs: {
            theme,
            link_previews_enabled: linkPreviewsEnabled,
            desktop_notifications_enabled: desktopNotificationsEnabled,
            browser_notifications_enabled: browserNotificationsEnabled,
            notification_sound_enabled: notificationSoundEnabled,
            notification_sound_server_mentions: notificationSoundServerMentions,
            notification_sound_user_mentions: notificationSoundUserMentions,
            notification_sound_replies: notificationSoundReplies,
            notification_volume: notificationVolume,
            show_message_preview: showMessagePreview,
            show_preview_server_mentions: showPreviewServerMentions,
            show_preview_user_mentions: showPreviewUserMentions,
            show_preview_replies: showPreviewReplies,
            compact_mode: compactMode,
            show_timestamps: showTimestamps,
            animate_emojis: animateEmojis,
            dm_privacy: dmPrivacy,
          },
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
    browserNotificationsEnabled,
    notificationSoundEnabled,
    notificationSoundServerMentions,
    notificationSoundUserMentions,
    notificationSoundReplies,
    notificationVolume,
    showMessagePreview,
    showPreviewServerMentions,
    showPreviewUserMentions,
    showPreviewReplies,
    compactMode,
    showTimestamps,
    animateEmojis,
    dmPrivacy,
    isAuthenticated,
    user?.id,
  ]);
};
