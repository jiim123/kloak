import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Badge } from '@/types/badge';

/**
 * Hook to fetch badges for a specific user
 */
export const useUserBadges = (userId: string | undefined) => {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setBadges([]);
      return;
    }

    const fetchBadges = async () => {
      setIsLoading(true);
      try {
        // Fetch user_badges with joined badge data using raw query
        // since the tables are not in the generated types yet
        const { data, error } = await supabase
          .from('user_badges' as any)
          .select(`
            badge_id,
            badges:badge_id (
              id,
              name,
              icon_url,
              description
            )
          `)
          .eq('user_id', userId);

        if (error) {
          // Table might not exist yet - this is expected before migration
          if (error.code === '42P01') {
            setBadges([]);
            return;
          }
          console.error('Failed to fetch user badges:', error);
          setBadges([]);
          return;
        }

        // Extract badge objects from the joined data
        const userBadges: Badge[] = ((data as any[]) || [])
          .map((row) => row.badges)
          .filter((badge): badge is Badge => badge !== null);

        setBadges(userBadges);
      } catch (err) {
        console.error('Error fetching badges:', err);
        setBadges([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBadges();
  }, [userId]);

  return { badges, isLoading };
};
