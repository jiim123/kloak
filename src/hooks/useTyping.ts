import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import { getUserFromCache, getOrFetchUser } from '@/stores/userCacheStore';
import { acquireChannel, releaseChannel, subscribeChannel } from '@/lib/sharedChannel';
import { isKloakSocketEnabled, kloakSocket } from '@/lib/kloakSocket';
import type { TypingUser } from '@/types';

const TYPING_DEBOUNCE_MS = 4500;
const TYPING_TIMEOUT_MS = 5000;
const UUID_V4ish_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type TypingEvent = 'typing' | 'stop_typing';

export const useTyping = (channelId: string | null) => {
  const { user } = useAuthStore();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const lastTypingTime = useRef<number>(0);
  const hasAnnouncedTypingRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const staleTypingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearTypingTimer = useCallback((userId: string) => {
    const timer = staleTypingTimersRef.current.get(userId);
    if (timer) clearTimeout(timer);
    staleTypingTimersRef.current.delete(userId);
  }, []);

  const scheduleTypingExpiry = useCallback((userId: string) => {
    clearTypingTimer(userId);
    const timer = setTimeout(() => {
      staleTypingTimersRef.current.delete(userId);
      setTypingUsers((prev) => prev.filter((u) => u.user_id !== userId));
    }, TYPING_TIMEOUT_MS);
    staleTypingTimersRef.current.set(userId, timer);
  }, [clearTypingTimer]);

  // Clear typing users when channel changes
  useEffect(() => {
    staleTypingTimersRef.current.forEach((timer) => clearTimeout(timer));
    staleTypingTimersRef.current.clear();
    setTypingUsers([]);
    hasAnnouncedTypingRef.current = false;
  }, [channelId]);

  // Subscribe to typing events
  useEffect(() => {
    if (!channelId || !user) return;

    let socketUnsubscribe: (() => void) | null = null;
    let socketCancelled = false;

    if (isKloakSocketEnabled()) {

      void kloakSocket
        .subscribe(`channel:${channelId}`, ({ event, payload }) => {
          if (event !== 'typing.start' && event !== 'typing.stop') return;
          const incomingUserId = typeof (payload as { user_id?: unknown })?.user_id === 'string'
            ? (payload as { user_id: string }).user_id
            : '';
          if (!UUID_V4ish_RE.test(incomingUserId) || incomingUserId === user.id) return;

          if (event === 'typing.stop') {
            clearTypingTimer(incomingUserId);
            setTypingUsers((prev) => prev.filter((u) => u.user_id !== incomingUserId));
            return;
          }

          const members = useServerStore.getState().members;
          const memberUser = members.find((m) => !m.is_banned && m.user_id === incomingUserId)?.user ?? null;
          const cachedUser = getUserFromCache(incomingUserId);
          const trustedUsername = memberUser?.username ?? cachedUser?.username ?? 'Someone';
          const trustedDisplayName = memberUser?.display_name ?? cachedUser?.display_name ?? null;

          setTypingUsers((prev) => {
            const existing = prev.find((u) => u.user_id === incomingUserId);
            if (existing) {
              return prev.map((u) =>
                u.user_id === incomingUserId
                  ? { ...u, username: trustedUsername, display_name: trustedDisplayName, started_at: Date.now() }
                  : u,
              );
            }
            return [
              ...prev,
              { user_id: incomingUserId, username: trustedUsername, display_name: trustedDisplayName, started_at: Date.now() },
            ];
          });

          scheduleTypingExpiry(incomingUserId);

          if (!memberUser && !cachedUser) {
            void getOrFetchUser(incomingUserId).then((fetched) => {
              if (!fetched) return;
              setTypingUsers((prev) =>
                prev.map((u) =>
                  u.user_id === incomingUserId
                    ? { ...u, username: fetched.username || u.username, display_name: fetched.display_name ?? u.display_name }
                    : u,
                ),
              );
            });
          }
        })
        .then((fn) => {
          if (socketCancelled) {
            fn();
            return;
          }
          socketUnsubscribe = fn;
        })
        .catch(() => undefined);

    }
    const topic = `typing:${channelId}`;
    const channel = acquireChannel(topic);
    const typingFilter = { event: 'typing', scope: `typing:${channelId}:${user.id}` };
    const stopTypingFilter = { event: 'stop_typing', scope: `typing-stop:${channelId}:${user.id}` };
    channelRef.current = channel;

    channel
      .on('broadcast', typingFilter as { event: string }, ({ payload }) => {
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

        scheduleTypingExpiry(incomingUserId);

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
      .on('broadcast', stopTypingFilter as { event: string }, ({ payload }) => {
        const incomingUserId = typeof payload?.user_id === 'string' ? payload.user_id : '';
        if (!UUID_V4ish_RE.test(incomingUserId)) return;
        clearTypingTimer(incomingUserId);
        setTypingUsers((prev) =>
          prev.filter((u) => u.user_id !== incomingUserId)
        );
      });
    subscribeChannel(topic);

    return () => {
      socketCancelled = true;
      socketUnsubscribe?.();
      (channel as unknown as { _off?: (type: string, filter: Record<string, unknown>) => void })._off?.(
        'broadcast',
        typingFilter,
      );
      (channel as unknown as { _off?: (type: string, filter: Record<string, unknown>) => void })._off?.(
        'broadcast',
        stopTypingFilter,
      );
      releaseChannel(topic);
      staleTypingTimersRef.current.forEach((timer) => clearTimeout(timer));
      staleTypingTimersRef.current.clear();
      channelRef.current = null;
    };
  }, [channelId, user, scheduleTypingExpiry, clearTypingTimer]);

  const publishTypingEvent = useCallback(async (event: TypingEvent) => {
    if (!channelId || !user || !UUID_V4ish_RE.test(channelId)) return;
    if (isKloakSocketEnabled()) {
      try {
        await kloakSocket.sendTyping({ channelId, isTyping: event === 'typing' });
      } catch {
        // Keep the existing Supabase broadcast as the compatibility path.
      }
    }
    const channel = channelRef.current;
    if (!channel) return;

    const result = await channel.send({
      type: 'broadcast',
      event,
      payload: {
        user_id: user.id,
        channel_id: channelId,
        started_at: Date.now(),
      },
    });

    if (result !== 'ok') {
      throw new Error(`Typing broadcast failed: ${result}`);
    }
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

