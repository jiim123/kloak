import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import type { TypingUser } from '@/types';

const TYPING_DEBOUNCE_MS = 2000;
const TYPING_TIMEOUT_MS = 5000;
const STALE_CLEANUP_INTERVAL_MS = 1000;

export const useTyping = (channelId: string | null) => {
  const { user } = useAuthStore();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const lastTypingTime = useRef<number>(0);
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
  }, [channelId]);

  // Subscribe to typing events
  useEffect(() => {
    if (!channelId || !user) return;

    const channel = supabase.channel(`typing:${channelId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.user_id === user.id) return;

        setTypingUsers((prev) => {
          const existing = prev.find((u) => u.user_id === payload.user_id);
          if (existing) {
            return prev.map((u) =>
              u.user_id === payload.user_id
                ? { ...u, started_at: Date.now() }
                : u
            );
          }
          return [
            ...prev,
            {
              user_id: payload.user_id,
              username: payload.username,
              display_name: payload.display_name || null,
              started_at: Date.now(),
            },
          ];
        });
      })
      .on('broadcast', { event: 'stop_typing' }, ({ payload }) => {
        setTypingUsers((prev) =>
          prev.filter((u) => u.user_id !== payload.user_id)
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [channelId, user]);

  const startTyping = useCallback(() => {
    if (!channelRef.current || !user) return;

    const now = Date.now();
    if (now - lastTypingTime.current < TYPING_DEBOUNCE_MS) return;

    lastTypingTime.current = now;

    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        user_id: user.id,
        username: user.username,
        display_name: user.display_name,
      },
    });

    // Auto-stop after timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, TYPING_TIMEOUT_MS);
  }, [user]);

  const stopTyping = useCallback(() => {
    if (!channelRef.current || !user) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    channelRef.current.send({
      type: 'broadcast',
      event: 'stop_typing',
      payload: {
        user_id: user.id,
      },
    });
  }, [user]);

  return {
    typingUsers: typingUsers.filter((u) => u.user_id !== user?.id),
    startTyping,
    stopTyping,
  };
};
