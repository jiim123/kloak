
-- CHECK constraints with NOT VALID to skip existing data violations
-- They still enforce on new inserts

ALTER TABLE public.messages ADD CONSTRAINT messages_content_max_length CHECK (length(content) <= 4000) NOT VALID;

ALTER TABLE public.direct_messages ADD CONSTRAINT direct_messages_content_max_length CHECK (length(content) <= 4000) NOT VALID;

ALTER TABLE public.thread_messages ADD CONSTRAINT thread_messages_content_max_length CHECK (length(content) <= 4000) NOT VALID;

-- =====================================================================
-- FORCE ROW LEVEL SECURITY on all remaining tables
-- =====================================================================

ALTER TABLE public.reactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dm_reactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.thread_reactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.friendships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.server_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.threads FORCE ROW LEVEL SECURITY;
ALTER TABLE public.thread_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.thread_attachments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dm_attachments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.channel_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.channel_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.category_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.channel_reads FORCE ROW LEVEL SECURITY;
ALTER TABLE public.channel_user_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.channels FORCE ROW LEVEL SECURITY;
ALTER TABLE public.mentions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE public.polls FORCE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.muted_users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.app_config FORCE ROW LEVEL SECURITY;
ALTER TABLE public.badges FORCE ROW LEVEL SECURITY;
ALTER TABLE public.server_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.server_member_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.server_invites FORCE ROW LEVEL SECURITY;
ALTER TABLE public.server_emojis FORCE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.declined_friend_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pow_challenges FORCE ROW LEVEL SECURITY;
ALTER TABLE public.auth_rate_limits FORCE ROW LEVEL SECURITY;
ALTER TABLE public.registration_rate_limits FORCE ROW LEVEL SECURITY;
ALTER TABLE public.media_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.media_comments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.media_comment_reactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_comments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_comment_reactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_server_folders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_server_tabs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_voice_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public._snapshot_direct_messages_compromise_20260221 FORCE ROW LEVEL SECURITY;
