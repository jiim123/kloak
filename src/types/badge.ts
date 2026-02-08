/**
 * Badge type definitions
 */

export interface Badge {
  id: string;
  name: string;
  icon_url: string;
  description: string | null;
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  awarded_at: string;
  badge?: Badge;
}
