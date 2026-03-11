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
      .channel(`server:${serverId}`)
      .on(
        'broadcast',
        { event: 'server_emojis' },
        (payload) => {
          try {
            invalidateServerEmojis(serverId);
            invalidateGlobalEmojiCache();

            const eventPayload = payload as { op?: string; new?: { id?: string } | null; old?: { id?: string } | null };
            const emojiId = eventPayload.new?.id ?? eventPayload.old?.id ?? null;
            const eventType = eventPayload.op ?? null;
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

