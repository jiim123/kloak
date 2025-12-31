import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUIStore, type Theme, THEMES, applyTheme } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';

/**
 * Hook to sync user preferences (theme, link previews) with the database
 * for authenticated users. Falls back to localStorage for unauthenticated users.
 */
export const usePreferencesSync = () => {
  const { user, isAuthenticated } = useAuthStore();
  const { theme, linkPreviewsEnabled, setTheme, setLinkPreviewsEnabled } = useUIStore();
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
          .select('theme, link_previews_enabled')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error loading preferences:', error);
          return;
        }

        if (data) {
          // Validate theme exists in available themes
          const validTheme = THEMES.find(t => t.id === data.theme);
          if (validTheme) {
            isUpdating.current = true;
            setTheme(validTheme.id as Theme);
            isUpdating.current = false;
          }
          
          if (typeof data.link_previews_enabled === 'boolean') {
            isUpdating.current = true;
            setLinkPreviewsEnabled(data.link_previews_enabled);
            isUpdating.current = false;
          }
        } else {
          // Create initial preferences record with current local values
          await supabase.from('user_preferences').insert({
            user_id: user.id,
            theme,
            link_previews_enabled: linkPreviewsEnabled,
          });
        }

        hasLoadedFromDB.current = true;
      } catch (err) {
        console.error('Failed to load preferences:', err);
      }
    };

    loadPreferences();
  }, [isAuthenticated, user?.id]);

  // Save theme to database when it changes (for authenticated users)
  useEffect(() => {
    if (!isAuthenticated || !user?.id || !hasLoadedFromDB.current || isUpdating.current) {
      return;
    }

    const saveTheme = async () => {
      try {
        await supabase
          .from('user_preferences')
          .upsert({
            user_id: user.id,
            theme,
          }, {
            onConflict: 'user_id',
          });
      } catch (err) {
        console.error('Failed to save theme preference:', err);
      }
    };

    saveTheme();
  }, [theme, isAuthenticated, user?.id]);

  // Save link preview preference to database when it changes
  useEffect(() => {
    if (!isAuthenticated || !user?.id || !hasLoadedFromDB.current || isUpdating.current) {
      return;
    }

    const saveLinkPreviewPref = async () => {
      try {
        await supabase
          .from('user_preferences')
          .upsert({
            user_id: user.id,
            link_previews_enabled: linkPreviewsEnabled,
          }, {
            onConflict: 'user_id',
          });
      } catch (err) {
        console.error('Failed to save link preview preference:', err);
      }
    };

    saveLinkPreviewPref();
  }, [linkPreviewsEnabled, isAuthenticated, user?.id]);
};
