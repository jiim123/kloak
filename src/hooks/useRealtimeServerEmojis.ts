import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invalidateServerEmojis } from '@/lib/serverEmojis';
import { invalidateGlobalEmojiCache } from '@/lib/globalEmojiResolver';

/**
 * Realtime subscription for server emoji changes.
 *
 * Purpose:
 * - Keep emoji pickers and message renderers up-to-date without refresh.
 * - Invalidate emoji caches and notify interested UI via a window event.
 */
export function useRealtimeServerEmojis(serverId: string | null) {
  useEffect(() => {
    if (!serverId) return;

    const channel = supabase
      .channel(`server-emojis:${serverId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'server_emojis', filter: `server_id=eq.${serverId}` },
        (payload) => {
          try {
            invalidateServerEmojis(serverId);
            invalidateGlobalEmojiCache();

            const emojiId = (payload.new as any)?.id ?? (payload.old as any)?.id ?? null;
            const eventType = payload.eventType;
            window.dispatchEvent(
              new CustomEvent('server-emojis-changed', {
                detail: { serverId, emojiId, eventType },
              }),
            );
          } catch (e) {
            // Never throw from a realtime handler.
            console.warn('[useRealtimeServerEmojis] Failed to process emoji change', e);
          }
        },
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  }, [serverId]);
}

