import { useState, useEffect, useCallback } from 'react';
import { fetchServerEmojis, invalidateServerEmojis, ServerEmoji } from '@/lib/serverEmojis';

/**
 * React hook that provides server emojis with cached URLs.
 * Uses the centralized fetchServerEmojis which has in-memory caching with TTL.
 * This prevents regenerating URLs on every render.
 */
export function useServerEmojis(serverId: string | null | undefined) {
  const [emojis, setEmojis] = useState<ServerEmoji[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadEmojis = useCallback(async (force = false) => {
    if (!serverId) {
      setEmojis([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchServerEmojis(serverId, { force });
      setEmojis(result);
    } catch (err) {
      console.error('[useServerEmojis] Failed to fetch emojis:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch emojis'));
    } finally {
      setIsLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    loadEmojis();
  }, [loadEmojis]);

  const refresh = useCallback(() => {
    if (serverId) {
      invalidateServerEmojis(serverId);
    }
    return loadEmojis(true);
  }, [serverId, loadEmojis]);

  return {
    emojis,
    isLoading,
    error,
    refresh,
  };
}
