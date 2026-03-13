import { useCallback, useEffect, useRef } from "react";
import { supabase, getKeyHashAsync } from "@/integrations/supabase/client";
import { useUIStore, type Theme, type DmPrivacy, THEMES } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import type { Database } from "@/integrations/supabase/types";
import { acquireChannel, subscribeChannel, releaseChannel } from '@/lib/sharedChannel';

type UserPreferencesRow = Database["public"]["Tables"]["user_preferences"]["Row"];
type BroadcastMutationPayload<T> = {
  op?: "INSERT" | "UPDATE" | "DELETE";
  new?: T | null;
  old?: T | null;
};

const pickCurrentPreferences = () => {
  const state = useUIStore.getState();
  return {
    theme: state.theme,
    link_previews_enabled: state.linkPreviewsEnabled,
    desktop_notifications_enabled: state.desktopNotificationsEnabled,
    browser_notifications_enabled: state.browserNotificationsEnabled,
    notification_sound_enabled: state.notificationSoundEnabled,
    notification_sound_server_mentions: state.notificationSoundServerMentions,
    notification_sound_user_mentions: state.notificationSoundUserMentions,
    notification_sound_replies: state.notificationSoundReplies,
    notification_volume: state.notificationVolume,
    show_message_preview: state.showMessagePreview,
    show_preview_server_mentions: state.showPreviewServerMentions,
    show_preview_user_mentions: state.showPreviewUserMentions,
    show_preview_replies: state.showPreviewReplies,
    compact_mode: state.compactMode,
    show_timestamps: state.showTimestamps,
    animate_emojis: state.animateEmojis,
    dm_privacy: state.dmPrivacy,
    enable_mention_notifications: state.enableMentionNotifications,
    enable_dm_notifications: state.enableDMNotifications,
    enable_friend_request_notifications: state.enableFriendRequestNotifications,
    enable_server_invite_notifications: state.enableServerInviteNotifications,
  };
};

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
    enableMentionNotifications,
    setEnableMentionNotifications,
    enableDMNotifications,
    setEnableDMNotifications,
    enableFriendRequestNotifications,
    setEnableFriendRequestNotifications,
    enableServerInviteNotifications,
    setEnableServerInviteNotifications,
  } = useUIStore();

  const hasLoadedFromDB = useRef(false);
  const isUpdating = useRef(false);
  const hydratedUserIdRef = useRef<string | null>(null);

  const applyPreferenceRow = useCallback((data: Partial<UserPreferencesRow> | null | undefined) => {
    if (!data) return;

    isUpdating.current = true;

    const validTheme = THEMES.find((t) => t.id === data.theme);
    if (validTheme) {
      setTheme(validTheme.id as Theme);
    }

    if (typeof data.link_previews_enabled === "boolean") {
      setLinkPreviewsEnabled(data.link_previews_enabled);
    }
    if (typeof data.desktop_notifications_enabled === "boolean") {
      setDesktopNotificationsEnabled(data.desktop_notifications_enabled);
    }
    if (typeof data.browser_notifications_enabled === "boolean") {
      setBrowserNotificationsEnabled(data.browser_notifications_enabled);
    }
    if (typeof data.notification_sound_enabled === "boolean") {
      setNotificationSoundEnabled(data.notification_sound_enabled);
    }
    if (typeof data.notification_sound_server_mentions === "boolean") {
      setNotificationSoundServerMentions(data.notification_sound_server_mentions);
    }
    if (typeof data.notification_sound_user_mentions === "boolean") {
      setNotificationSoundUserMentions(data.notification_sound_user_mentions);
    }
    if (typeof data.notification_sound_replies === "boolean") {
      setNotificationSoundReplies(data.notification_sound_replies);
    }
    if (typeof data.notification_volume === "number") {
      setNotificationVolume(data.notification_volume);
    }
    if (typeof data.show_message_preview === "boolean") {
      setShowMessagePreview(data.show_message_preview);
    }
    if (typeof data.show_preview_server_mentions === "boolean") {
      setShowPreviewServerMentions(data.show_preview_server_mentions);
    }
    if (typeof data.show_preview_user_mentions === "boolean") {
      setShowPreviewUserMentions(data.show_preview_user_mentions);
    }
    if (typeof data.show_preview_replies === "boolean") {
      setShowPreviewReplies(data.show_preview_replies);
    }
    if (typeof data.compact_mode === "boolean") {
      setCompactMode(data.compact_mode);
    }
    if (typeof data.show_timestamps === "boolean") {
      setShowTimestamps(data.show_timestamps);
    }
    if (typeof data.animate_emojis === "boolean") {
      setAnimateEmojis(data.animate_emojis);
    }
    if (typeof data.dm_privacy === "string") {
      setDmPrivacy(data.dm_privacy as DmPrivacy);
    }
    if (typeof data.enable_mention_notifications === "boolean") {
      setEnableMentionNotifications(data.enable_mention_notifications);
    }
    if (typeof data.enable_dm_notifications === "boolean") {
      setEnableDMNotifications(data.enable_dm_notifications);
    }
    if (typeof data.enable_friend_request_notifications === "boolean") {
      setEnableFriendRequestNotifications(data.enable_friend_request_notifications);
    }
    if (typeof data.enable_server_invite_notifications === "boolean") {
      setEnableServerInviteNotifications(data.enable_server_invite_notifications);
    }

    isUpdating.current = false;
  }, [
    setAnimateEmojis,
    setBrowserNotificationsEnabled,
    setCompactMode,
    setDesktopNotificationsEnabled,
    setDmPrivacy,
    setEnableDMNotifications,
    setEnableFriendRequestNotifications,
    setEnableMentionNotifications,
    setEnableServerInviteNotifications,
    setLinkPreviewsEnabled,
    setNotificationSoundEnabled,
    setNotificationSoundReplies,
    setNotificationSoundServerMentions,
    setNotificationSoundUserMentions,
    setNotificationVolume,
    setShowMessagePreview,
    setShowPreviewReplies,
    setShowPreviewServerMentions,
    setShowPreviewUserMentions,
    setShowTimestamps,
    setTheme,
  ]);

  // Load preferences from database when user logs in
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      hasLoadedFromDB.current = false;
      hydratedUserIdRef.current = null;
      return;
    }

    const loadPreferences = async () => {
      try {
        // Wait for auth key hash before querying (prevents 401/RLS errors during init)
        const kh = await getKeyHashAsync();
        if (!kh) return;

        const { data, error } = await supabase
          .from("user_preferences")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error loading preferences:", error);
          return;
        }

        if (data) {
          applyPreferenceRow(data);
        } else {
          await supabase.from("user_preferences").upsert({
            user_id: user.id,
            ...pickCurrentPreferences(),
          });
        }

        hydratedUserIdRef.current = user.id;
        hasLoadedFromDB.current = true;
      } catch (err) {
        console.error("Failed to load preferences:", err);
      }
    };

    loadPreferences();
  }, [applyPreferenceRow, isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const topic = `user:${user.id}`;
    const channel = acquireChannel(topic);
    channel.on(
      "broadcast",
      { event: "preferences" },
      (payload) => {
        const eventPayload = payload as BroadcastMutationPayload<UserPreferencesRow>;
        if (eventPayload.op === "DELETE" || !eventPayload.new) return;
        applyPreferenceRow(eventPayload.new);
        hasLoadedFromDB.current = true;
        hydratedUserIdRef.current = user.id;
      },
    );
    subscribeChannel(topic);

    return () => {
      releaseChannel(topic);
    };
  }, [applyPreferenceRow, isAuthenticated, user?.id]);

  // Save all preferences to database when they change (for authenticated users)
  useEffect(() => {
    if (
      !isAuthenticated ||
      !user?.id ||
      !hasLoadedFromDB.current ||
      isUpdating.current ||
      hydratedUserIdRef.current !== user.id
    ) {
      return;
    }

    const savePreferences = async () => {
      try {
        await supabase.from("user_preferences").upsert({
          user_id: user.id,
          ...pickCurrentPreferences(),
        });
      } catch (err) {
        console.error("Failed to save preferences:", err);
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
    enableMentionNotifications,
    enableDMNotifications,
    enableFriendRequestNotifications,
    enableServerInviteNotifications,
    isAuthenticated,
    user?.id,
  ]);
};
