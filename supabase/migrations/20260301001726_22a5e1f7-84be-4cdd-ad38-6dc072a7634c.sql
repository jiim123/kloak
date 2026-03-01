
-- ============================================================
-- PERFORMANCE & SECURITY FIX MIGRATION
-- 1. Fix dm_reactions permission denied (missing GRANT)
-- 2. Drop 13 duplicate indexes to reduce write overhead
-- 3. ANALYZE hot tables for better planner choices
-- ============================================================

-- ============ 1. FIX dm_reactions PERMISSION DENIED ============
-- Frontend queries dm_reactions directly but anon/authenticated have no GRANTs.
-- RLS policies already enforce proper authorization (participant checks).
GRANT SELECT, INSERT, DELETE ON public.dm_reactions TO anon;
GRANT SELECT, INSERT, DELETE ON public.dm_reactions TO authenticated;

-- ============ 2. DROP DUPLICATE INDEXES ============
-- Each pair has identical columns; we keep the UNIQUE constraint or the one
-- the planner actually uses (higher idx_scan count).

-- channel_members: keep unique key, drop regular btree duplicate
DROP INDEX IF EXISTS public.idx_channel_members_channel_user;

-- dm_participants: keep unique key, drop regular btree duplicate  
DROP INDEX IF EXISTS public.idx_dm_participants_conv_user;

-- messages: both are (channel_id, created_at DESC) - keep the one with 946 scans
DROP INDEX IF EXISTS public.idx_messages_channel_created;

-- polls: keep unique key polls_message_id_key, drop regular duplicate
DROP INDEX IF EXISTS public.idx_polls_message_id;

-- server_invites: keep unique key server_invites_code_key, drop regular duplicate
DROP INDEX IF EXISTS public.idx_server_invites_code;

-- server_member_roles: both on (member_id) - keep the one with 27 scans
DROP INDEX IF EXISTS public.idx_server_member_roles_member;

-- server_members: both on (server_id) - keep the one with 4963 scans
DROP INDEX IF EXISTS public.idx_server_members_server;

-- servers: keep unique key servers_invite_code_key, drop regular duplicate  
DROP INDEX IF EXISTS public.idx_servers_invite_code;

-- servers: servers_created_at_idx (0 scans, full) vs idx_servers_published_created (partial, used)
DROP INDEX IF EXISTS public.servers_created_at_idx;

-- threads: keep unique key threads_message_id_key, drop regular duplicate
DROP INDEX IF EXISTS public.idx_threads_message_id;

-- user_voice_settings: keep unique key, drop regular duplicate
DROP INDEX IF EXISTS public.idx_user_voice_settings_user_id;

-- users: keep unique key users_username_key, drop regular duplicate
DROP INDEX IF EXISTS public.idx_users_username;

-- ============ 3. ANALYZE HOT TABLES ============
-- Refresh planner statistics to improve query plans and reduce timeouts
ANALYZE public.messages;
ANALYZE public.notifications;
ANALYZE public.reactions;
ANALYZE public.dm_reactions;
ANALYZE public.direct_messages;
ANALYZE public.server_members;
ANALYZE public.channel_members;
ANALYZE public.friendships;
ANALYZE public.media_items;
ANALYZE public.media_comments;
