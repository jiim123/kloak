import { useEffect, useState, useCallback, useRef } from 'react';
import { getKeyHash, supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import { getUserFromCache, getOrFetchUser } from '@/stores/userCacheStore';
import type { TypingUser } from '@/types';

const TYPING_DEBOUNCE_MS = 4500;
const TYPING_TIMEOUT_MS = 5000;
const STALE_CLEANUP_INTERVAL_MS = 1000;
const UUID_V4ish_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type TypingEvent = 'typing' | 'stop_typing';

export const useTyping = (channelId: string | null) => {
  const { user } = useAuthStore();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const lastTypingTime = useRef<number>(0);
  const hasAnnouncedTypingRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Clean up stale typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        const filtered = prev.filter((u) => now - u.started_at < TYPING_TIMEOUT_MS);
        if (filtered.length === prev.length) return prev; // No change — skip re-render
        return filtered;
      });
    }, STALE_CLEANUP_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  // Clear typing users when channel changes
  useEffect(() => {
    setTypingUsers([]);
    hasAnnouncedTypingRef.current = false;
  }, [channelId]);

  // Subscribe to typing events
  useEffect(() => {
    if (!channelId || !user) return;

    const channel = supabase.channel(`typing:${channelId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const incomingUserId = typeof payload?.user_id === 'string' ? payload.user_id : '';
        if (!UUID_V4ish_RE.test(incomingUserId) || incomingUserId === user.id) return;

        const members = useServerStore.getState().members;
        const memberUser =
          members.find((m) => !m.is_banned && m.user_id === incomingUserId)?.user ?? null;
        const cachedUser = getUserFromCache(incomingUserId);
        const trustedUsername = memberUser?.username ?? cachedUser?.username ?? 'Someone';
        const trustedDisplayName =
          memberUser?.display_name ?? cachedUser?.display_name ?? null;

        setTypingUsers((prev) => {
          const existing = prev.find((u) => u.user_id === incomingUserId);
          if (existing) {
            return prev.map((u) =>
              u.user_id === incomingUserId
                ? {
                    ...u,
                    username: trustedUsername,
                    display_name: trustedDisplayName,
                    started_at: Date.now(),
                  }
                : u
            );
          }
          return [
            ...prev,
            {
              user_id: incomingUserId,
              username: trustedUsername,
              display_name: trustedDisplayName,
              started_at: Date.now(),
            },
          ];
        });

        // Resolve a trusted profile name when not available locally (common on DM/cold cache paths).
        if (!memberUser && !cachedUser) {
          void getOrFetchUser(incomingUserId).then((fetched) => {
            if (!fetched) return;
            setTypingUsers((prev) =>
              prev.map((u) =>
                u.user_id === incomingUserId
                  ? {
                      ...u,
                      username: fetched.username || u.username,
                      display_name: fetched.display_name ?? u.display_name,
                    }
                  : u
              )
            );
          });
        }
      })
      .on('broadcast', { event: 'stop_typing' }, ({ payload }) => {
        const incomingUserId = typeof payload?.user_id === 'string' ? payload.user_id : '';
        if (!UUID_V4ish_RE.test(incomingUserId)) return;
        setTypingUsers((prev) =>
          prev.filter((u) => u.user_id !== incomingUserId)
        );
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Typing channel subscribe failed', status, err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [channelId, user]);

  const publishTypingEvent = useCallback(async (event: TypingEvent) => {
    if (!channelId || !user) return;
    const keyHash = getKeyHash();
    if (!keyHash) return;

    const { error } = await supabase.functions.invoke('broadcast-typing', {
      body: { channel_id: channelId, event },
      headers: { 'x-key-hash': keyHash },
    });
    if (error) throw error;
  }, [channelId, user]);

  const stopTyping = useCallback(() => {
    if (!user) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (!hasAnnouncedTypingRef.current) return;
    hasAnnouncedTypingRef.current = false;
    void publishTypingEvent('stop_typing').catch(() => undefined);
  }, [user, publishTypingEvent]);

  const startTyping = useCallback(() => {
    if (!user) return;

    const now = Date.now();
    if (hasAnnouncedTypingRef.current && now - lastTypingTime.current < TYPING_DEBOUNCE_MS) return;

    lastTypingTime.current = now;
    hasAnnouncedTypingRef.current = true;
    void publishTypingEvent('typing').catch(() => undefined);

    // Auto-stop after timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, TYPING_TIMEOUT_MS);
  }, [user, publishTypingEvent, stopTyping]);

  return {
    typingUsers: typingUsers.filter((u) => u.user_id !== user?.id),
    startTyping,
    stopTyping,
  };
};
