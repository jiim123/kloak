DELETE FROM public.user_achievements
WHERE achievement_slug IN (
  'avatar_set',
  'bio_written',
  'change_theme',
  'custom_status_set',
  'first_mention',
  'profile_theme_changed',
  'msg_10',
  'msg_50',
  'msg_100',
  'msg_500'
);
