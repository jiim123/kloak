import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import type { Badge } from '@/types/badge';

/**
 * Hook to fetch badges for a specific user
 */
export const useUserBadges = (userId: string | undefined) => {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userId || !currentUserId) {
      setBadges([]);
      return;
    }

    const fetchBadges = async () => {
      setIsLoading(true);
      try {
        // Fetch user_badges with joined badge data using raw query
        // since the tables are not in the generated types yet
        const { data, error } = await supabase.rpc('get_user_badges_secure', {
          _target_user_id: userId,
          _requesting_user_id: currentUserId,
        });

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

        const userBadges: Badge[] = (Array.isArray(data) ? data : []) as Badge[];

        setBadges(userBadges);
      } catch (err) {
        console.error('Error fetching badges:', err);
        setBadges([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBadges();
  }, [userId, currentUserId]);

  return { badges, isLoading };
};
