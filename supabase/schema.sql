--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 15.8

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: _realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA _realtime;


--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql;


--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql_public;


--
-- Name: pg_net; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_net; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_net IS 'Async HTTP';


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: supabase_functions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA supabase_functions;


--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vault;


--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;


--
-- Name: EXTENSION pg_graphql; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_graphql IS 'pg_graphql: GraphQL support';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: pgjwt; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgjwt WITH SCHEMA extensions;


--
-- Name: EXTENSION pgjwt; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgjwt IS 'JSON Web Token API for Postgresql';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: channel_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.channel_type AS ENUM (
    'text',
    'voice',
    'announcement',
    'forum',
    'tasks',
    'media'
);


--
-- Name: friendship_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.friendship_status AS ENUM (
    'pending',
    'accepted',
    'blocked',
    'declined'
);


--
-- Name: mention_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.mention_type AS ENUM (
    'user',
    'everyone',
    'here',
    'role'
);


--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_type AS ENUM (
    'mention',
    'dm',
    'friend_request',
    'server_invite',
    'task_assignment'
);


--
-- Name: permission_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.permission_type AS ENUM (
    'manage_server',
    'manage_roles',
    'manage_channels',
    'kick_members',
    'ban_members',
    'mute_members',
    'manage_nicknames',
    'manage_messages',
    'pin_messages',
    'send_messages',
    'add_reactions',
    'view_channels',
    'transfer_ownership',
    'manage_invites',
    'manage_emojis',
    'attach_files',
    'embed_links',
    'read_message_history',
    'mention_everyone',
    'mention_roles',
    'change_nickname',
    'use_external_emojis',
    'manage_webhooks',
    'manage_threads',
    'create_instant_invite',
    'connect',
    'speak',
    'use_voice_activation',
    'deafen_members',
    'move_members',
    'use_application_commands',
    'view_tasks',
    'create_tasks',
    'edit_own_tasks',
    'edit_all_tasks',
    'assign_tasks',
    'change_task_status',
    'delete_tasks'
);


--
-- Name: server_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.server_role AS ENUM (
    'owner',
    'admin',
    'moderator',
    'member'
);


--
-- Name: task_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.task_priority AS ENUM (
    'low',
    'medium',
    'high'
);


--
-- Name: task_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.task_status AS ENUM (
    'open',
    'in_progress',
    'completed',
    'archived'
);


--
-- Name: user_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_status AS ENUM (
    'online',
    'idle',
    'dnd',
    'offline'
);


--
-- Name: action; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);


--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);


--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
begin
    raise debug 'PgBouncer auth request: %', p_usename;

    return query
    select 
        rolname::text, 
        case when rolvaliduntil < now() 
            then null 
            else rolpassword::text 
        end 
    from pg_authid 
    where rolname=$1 and rolcanlogin;
end;
$_$;


--
-- Name: accept_friend_request(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_friend_request(_friendship_id uuid, _user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  result json;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.friendships
    WHERE id = _friendship_id
      AND addressee_id = _user_id
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Cannot accept this friend request';
  END IF;

  UPDATE public.friendships
  SET status = 'accepted'
  WHERE id = _friendship_id;

  SELECT json_build_object(
    'id', f.id,
    'requester_id', f.requester_id,
    'addressee_id', f.addressee_id,
    'status', f.status,
    'created_at', f.created_at
  )
  INTO result
  FROM public.friendships f
  WHERE f.id = _friendship_id;

  RETURN result;
END;
$$;


--
-- Name: add_channel_member(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_channel_member(_channel_id uuid, _target_user_id uuid, _added_by uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _channel RECORD;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_added_by) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get channel info
  SELECT id, server_id, is_private INTO _channel
  FROM channels WHERE id = _channel_id;
  
  IF NOT FOUND OR NOT _channel.is_private THEN
    RETURN false;
  END IF;
  
  -- Check if adder has access to the channel (must be existing member or admin)
  IF NOT EXISTS (
    SELECT 1 FROM channel_members WHERE channel_id = _channel_id AND user_id = _added_by
  ) AND NOT EXISTS (
    SELECT 1 FROM server_members 
    WHERE server_id = _channel.server_id 
    AND user_id = _added_by 
    AND role IN ('owner', 'admin')
  ) THEN
    RETURN false;
  END IF;
  
  -- Check if target is a server member
  IF NOT EXISTS (
    SELECT 1 FROM server_members 
    WHERE server_id = _channel.server_id 
    AND user_id = _target_user_id 
    AND is_banned = false
  ) THEN
    RETURN false;
  END IF;
  
  -- Insert member
  INSERT INTO channel_members (channel_id, user_id, added_by)
  VALUES (_channel_id, _target_user_id, _added_by)
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  RETURN true;
END;
$$;


--
-- Name: add_dm_reaction(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_dm_reaction(_message_id uuid, _user_id uuid, _emoji text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  msg_conversation_id uuid;
  new_reaction_id uuid;
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT conversation_id INTO msg_conversation_id FROM direct_messages WHERE id = _message_id;
  
  IF NOT EXISTS (
    SELECT 1 FROM dm_participants 
    WHERE conversation_id = msg_conversation_id AND user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;
  
  INSERT INTO dm_reactions (message_id, user_id, emoji)
  VALUES (_message_id, _user_id, _emoji)
  ON CONFLICT (message_id, user_id, emoji) DO NOTHING
  RETURNING id INTO new_reaction_id;
  
  IF new_reaction_id IS NULL THEN
    SELECT id INTO new_reaction_id FROM dm_reactions 
    WHERE message_id = _message_id AND user_id = _user_id AND emoji = _emoji;
  END IF;
  
  SELECT json_build_object('id', r.id, 'message_id', r.message_id, 'user_id', r.user_id, 'emoji', r.emoji)
  INTO result FROM dm_reactions r WHERE r.id = new_reaction_id;
  
  RETURN result;
END;
$$;


--
-- Name: add_group_dm_members(uuid, uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_group_dm_members(_conversation_id uuid, _user_id uuid, _new_member_ids uuid[]) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_is_group boolean;
  v_is_participant boolean;
  v_member_id uuid;
  v_added_count int := 0;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Check if conversation exists and is a group
  SELECT is_group INTO v_is_group
  FROM dm_conversations
  WHERE id = _conversation_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;
  
  IF NOT COALESCE(v_is_group, false) THEN
    RAISE EXCEPTION 'Cannot add members to a 1:1 conversation';
  END IF;
  
  -- Check if user is a participant
  SELECT EXISTS (
    SELECT 1 FROM dm_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  ) INTO v_is_participant;
  
  IF NOT v_is_participant THEN
    RAISE EXCEPTION 'User is not a participant';
  END IF;
  
  -- Add each new member if not already in the group
  FOREACH v_member_id IN ARRAY _new_member_ids
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM dm_participants
      WHERE conversation_id = _conversation_id AND user_id = v_member_id
    ) THEN
      INSERT INTO dm_participants (conversation_id, user_id)
      VALUES (_conversation_id, v_member_id);
      v_added_count := v_added_count + 1;
    END IF;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'added_count', v_added_count
  );
END;
$$;


--
-- Name: add_reaction(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_reaction(_message_id uuid, _user_id uuid, _emoji text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  channel_id uuid;
  channel_server_id uuid;
  new_reaction_id uuid;
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get the channel_id from the message
  SELECT m.channel_id, c.server_id INTO channel_id, channel_server_id
  FROM messages m
  JOIN channels c ON c.id = m.channel_id
  WHERE m.id = _message_id;
  
  IF channel_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  
  -- Check permission using database-backed permission system
  IF NOT public.check_user_permission(_user_id, channel_id, 'add_reactions') THEN
    RAISE EXCEPTION 'You do not have permission to add reactions in this channel';
  END IF;
  
  -- Check if reaction already exists
  IF EXISTS (
    SELECT 1 FROM reactions
    WHERE message_id = _message_id AND user_id = _user_id AND emoji = _emoji
  ) THEN
    -- Reaction already exists, return existing
    SELECT json_build_object(
      'id', r.id,
      'message_id', r.message_id,
      'user_id', r.user_id,
      'emoji', r.emoji
    ) INTO result
    FROM reactions r
    WHERE r.message_id = _message_id AND r.user_id = _user_id AND r.emoji = _emoji
    LIMIT 1;
    
    RETURN result;
  END IF;
  
  -- Insert new reaction
  INSERT INTO reactions (message_id, user_id, emoji)
  VALUES (_message_id, _user_id, _emoji)
  RETURNING id INTO new_reaction_id;
  
  -- Return the reaction
  SELECT json_build_object(
    'id', r.id,
    'message_id', r.message_id,
    'user_id', r.user_id,
    'emoji', r.emoji
  ) INTO result
  FROM reactions r
  WHERE r.id = new_reaction_id;
  
  RETURN result;
END;
$$;


--
-- Name: assert_function_execute_surface_strict(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assert_function_execute_surface_strict() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  public_exec_count integer;
BEGIN
  SELECT count(*)
    INTO public_exec_count
  FROM public.audit_function_execute_surface()
  WHERE public_exec = true;

  IF public_exec_count > 0 THEN
    RAISE EXCEPTION 'Security guard failed: % public functions still executable by PUBLIC', public_exec_count;
  END IF;
END;
$$;


--
-- Name: assert_no_dangerous_table_privileges(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assert_no_dangerous_table_privileges() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  dangerous_count integer;
BEGIN
  SELECT count(*)
    INTO dangerous_count
  FROM public.audit_table_dangerous_privileges();

  IF dangerous_count > 0 THEN
    RAISE EXCEPTION 'Security guard failed: % dangerous table privileges remain for API roles', dangerous_count;
  END IF;
END;
$$;


--
-- Name: assert_request_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assert_request_user(_expected_user_id uuid) RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _caller_id uuid;
BEGIN
  _caller_id := public.get_request_user_id();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _expected_user_id IS DISTINCT FROM _caller_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN _caller_id;
END;
$$;


--
-- Name: assign_role_to_member(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_role_to_member(_user_id uuid, _member_id uuid, _role_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _member_server_id uuid;
  _role_server_id uuid;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT server_id INTO _member_server_id
  FROM public.server_members
  WHERE id = _member_id;

  SELECT server_id INTO _role_server_id
  FROM public.server_roles
  WHERE id = _role_id;

  IF _member_server_id IS NULL OR _role_server_id IS NULL OR _member_server_id <> _role_server_id THEN
    RAISE EXCEPTION 'Invalid member/role combination';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _member_server_id, 'manage_roles') THEN
    RAISE EXCEPTION 'Only admins and owners can assign roles';
  END IF;

  INSERT INTO public.server_member_roles (member_id, role_id)
  VALUES (_member_id, _role_id)
  ON CONFLICT DO NOTHING;
END;
$$;


--
-- Name: assign_task_users(uuid, uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_task_users(_task_id uuid, _user_id uuid, _assignee_ids uuid[]) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  task_channel_id uuid;
  assignee_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get task channel
  SELECT channel_id INTO task_channel_id
  FROM tasks
  WHERE id = _task_id;
  
  IF task_channel_id IS NULL THEN
    RETURN json_build_object('error', 'Task not found');
  END IF;
  
  -- Check permission: assign_tasks
  IF NOT check_user_permission(_user_id, task_channel_id, 'assign_tasks'::permission_type) THEN
    RETURN json_build_object('error', 'Permission denied: assign_tasks');
  END IF;
  
  -- Add assignees
  FOREACH assignee_id IN ARRAY _assignee_ids
  LOOP
    INSERT INTO task_assignees (task_id, user_id, assigned_by)
    VALUES (_task_id, assignee_id, _user_id)
    ON CONFLICT (task_id, user_id) DO NOTHING;
  END LOOP;
  
  RETURN json_build_object('success', true);
END;
$$;


--
-- Name: audit_function_execute_surface(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_function_execute_surface() RETURNS TABLE(function_name text, identity_args text, is_security_definer boolean, public_exec boolean, anon_exec boolean, authenticated_exec boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    p.proname::text AS function_name,
    pg_get_function_identity_arguments(p.oid)::text AS identity_args,
    p.prosecdef AS is_security_definer,
    has_function_privilege('public', p.oid, 'EXECUTE') AS public_exec,
    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_exec
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
$$;


--
-- Name: audit_table_dangerous_privileges(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_table_dangerous_privileges() RETURNS TABLE(table_name text, grantee text, privilege_type text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    g.table_name::text,
    g.grantee::text,
    g.privilege_type::text
  FROM information_schema.role_table_grants g
  WHERE g.table_schema = 'public'
    AND g.grantee IN ('public', 'anon', 'authenticated')
    AND g.privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES')
  ORDER BY g.table_name, g.grantee, g.privilege_type
$$;


--
-- Name: ban_member(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ban_member(_server_id uuid, _user_id uuid, _target_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'ban_members') THEN
    RAISE EXCEPTION 'You do not have permission to ban members';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.servers
    WHERE id = _server_id AND owner_id = _target_user_id
  ) THEN
    RAISE EXCEPTION 'Cannot ban the server owner';
  END IF;

  UPDATE public.server_members
  SET is_banned = true
  WHERE server_id = _server_id
    AND user_id = _target_user_id;
END;
$$;


--
-- Name: block_user(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.block_user(_user_id uuid, _blocked_user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  existing_friendship record;
  result json;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF _user_id = _blocked_user_id THEN
    RAISE EXCEPTION 'Cannot block yourself';
  END IF;

  SELECT *
  INTO existing_friendship
  FROM public.friendships
  WHERE (requester_id = _user_id AND addressee_id = _blocked_user_id)
     OR (requester_id = _blocked_user_id AND addressee_id = _user_id);

  IF existing_friendship IS NOT NULL THEN
    UPDATE public.friendships
    SET status = 'blocked',
        requester_id = _user_id,
        addressee_id = _blocked_user_id
    WHERE id = existing_friendship.id;

    SELECT json_build_object(
      'id', f.id,
      'requester_id', f.requester_id,
      'addressee_id', f.addressee_id,
      'status', f.status,
      'created_at', f.created_at
    )
    INTO result
    FROM public.friendships f
    WHERE f.id = existing_friendship.id;
  ELSE
    INSERT INTO public.friendships (requester_id, addressee_id, status)
    VALUES (_user_id, _blocked_user_id, 'blocked')
    RETURNING json_build_object(
      'id', id,
      'requester_id', requester_id,
      'addressee_id', addressee_id,
      'status', status,
      'created_at', created_at
    )
    INTO result;
  END IF;

  RETURN result;
END;
$$;


--
-- Name: can_access_channel(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_channel(_channel_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _channel RECORD;
BEGIN
  IF _user_id IS NULL OR NOT public.verify_request_identity(_user_id) THEN
    RETURN false;
  END IF;

  SELECT id, server_id, is_private
  INTO _channel
  FROM public.channels
  WHERE id = _channel_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF NOT _channel.is_private THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.server_members sm
      WHERE sm.server_id = _channel.server_id
        AND sm.user_id = _user_id
        AND COALESCE(sm.is_banned, false) = false
    );
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.channel_members cm
    WHERE cm.channel_id = _channel_id
      AND cm.user_id = _user_id
  );
END;
$$;


--
-- Name: can_view_user(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_view_user(_target_user_id uuid, _requesting_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    _requesting_user_id IS NOT NULL
    AND public.verify_request_identity(_requesting_user_id)
    AND (
      _target_user_id = _requesting_user_id
      OR EXISTS (
        SELECT 1
        FROM public.server_members sm_target
        JOIN public.server_members sm_requester
          ON sm_requester.server_id = sm_target.server_id
        WHERE sm_target.user_id = _target_user_id
          AND sm_requester.user_id = _requesting_user_id
          AND COALESCE(sm_target.is_banned, false) = false
          AND COALESCE(sm_requester.is_banned, false) = false
      )
      OR EXISTS (
        SELECT 1
        FROM public.friendships f
        WHERE (
          (f.requester_id = _requesting_user_id AND f.addressee_id = _target_user_id)
          OR (f.requester_id = _target_user_id AND f.addressee_id = _requesting_user_id)
        )
          AND f.status = 'accepted'
      )
      OR EXISTS (
        SELECT 1
        FROM public.dm_participants dp_target
        JOIN public.dm_participants dp_requester
          ON dp_requester.conversation_id = dp_target.conversation_id
        WHERE dp_target.user_id = _target_user_id
          AND dp_requester.user_id = _requesting_user_id
      )
    )
$$;


--
-- Name: change_member_role(uuid, uuid, uuid, public.server_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.change_member_role(_server_id uuid, _user_id uuid, _target_user_id uuid, _new_role public.server_role) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  user_role text;
  target_role text;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT role INTO user_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;
  
  SELECT role INTO target_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _target_user_id AND is_banned = false;
  
  IF user_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;
  
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not a member of this server';
  END IF;
  
  -- Cannot change to or from owner role (use transfer ownership instead)
  IF _new_role = 'owner' OR target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot change owner role. Use transfer ownership instead.';
  END IF;
  
  -- Only owner can promote to admin
  IF _new_role = 'admin' AND user_role != 'owner' THEN
    RAISE EXCEPTION 'Only the server owner can promote to admin';
  END IF;
  
  -- Owner and admin can change roles (within their permission)
  IF user_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Admins cannot change other admins' roles
  IF user_role = 'admin' AND target_role = 'admin' THEN
    RAISE EXCEPTION 'Cannot change role of users with equal role';
  END IF;
  
  UPDATE server_members SET role = _new_role WHERE server_id = _server_id AND user_id = _target_user_id;
  RETURN true;
END;
$$;


--
-- Name: check_e2e_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_e2e_status(_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM user_identity_keys
    WHERE user_id = _user_id
  );
END;
$$;


--
-- Name: check_rate_limit(text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_rate_limit(_ip_hash text, _action text, _max_attempts integer, _window_seconds integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _record RECORD;
BEGIN
  SELECT * INTO _record
  FROM auth_rate_limits
  WHERE ip_hash = _ip_hash AND action = _action;

  IF NOT FOUND THEN
    INSERT INTO auth_rate_limits (ip_hash, action)
    VALUES (_ip_hash, _action);
    RETURN true;
  END IF;

  -- Reset window if expired
  IF EXTRACT(EPOCH FROM (now() - _record.window_start)) > _window_seconds THEN
    UPDATE auth_rate_limits
    SET attempts = 1, window_start = now()
    WHERE ip_hash = _ip_hash AND action = _action;
    RETURN true;
  END IF;

  -- Block if over limit
  IF _record.attempts >= _max_attempts THEN
    RETURN false;
  END IF;

  UPDATE auth_rate_limits
  SET attempts = attempts + 1
  WHERE ip_hash = _ip_hash AND action = _action;

  RETURN true;
END;
$$;


--
-- Name: check_server_membership(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_server_membership(_server_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _user_id uuid;
  _is_member boolean;
  _server jsonb;
BEGIN
  _user_id := public.requesting_user_id();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('is_member', false);
  END IF;

  _is_member := public.is_server_member(_server_id, _user_id);
  IF NOT _is_member THEN
    RETURN jsonb_build_object('is_member', false);
  END IF;

  SELECT jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'owner_id', s.owner_id,
    'icon_url', s.icon_url,
    'banner_url', s.banner_url,
    'invite_code', s.invite_code,
    'is_published', s.is_published,
    'about', s.about,
    'created_at', s.created_at,
    'system_channel_join_id', s.system_channel_join_id,
    'system_channel_leave_id', s.system_channel_leave_id,
    'enable_join_messages', s.enable_join_messages,
    'enable_leave_messages', s.enable_leave_messages
  ) INTO _server
  FROM servers s
  WHERE s.id = _server_id;

  RETURN jsonb_build_object('is_member', true, 'server', _server);
END;
$$;


--
-- Name: check_user_permission(uuid, uuid, public.permission_type); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_user_permission(_user_id uuid, _channel_id uuid, _permission public.permission_type) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  channel_server_id uuid;
  user_base_role public.server_role;
  user_custom_role_ids uuid[];
  user_override_result boolean;
  channel_result boolean;
  role_result boolean;
BEGIN
  IF _user_id IS NULL OR NOT public.verify_request_identity(_user_id) THEN
    RETURN false;
  END IF;

  SELECT server_id INTO channel_server_id FROM public.channels WHERE id = _channel_id;
  IF channel_server_id IS NULL THEN RETURN false; END IF;

  SELECT sm.role INTO user_base_role
  FROM public.server_members sm
  WHERE sm.server_id = channel_server_id
    AND sm.user_id = _user_id
    AND sm.is_banned = false;

  IF user_base_role IS NULL THEN RETURN false; END IF;
  IF user_base_role = 'owner' THEN RETURN true; END IF;

  SELECT COALESCE(ARRAY_AGG(DISTINCT smr.role_id) FILTER (WHERE smr.role_id IS NOT NULL), ARRAY[]::uuid[])
  INTO user_custom_role_ids
  FROM public.server_member_roles smr
  JOIN public.server_members sm ON sm.id = smr.member_id
  WHERE sm.user_id = _user_id
    AND sm.server_id = channel_server_id;

  SELECT cp.allowed INTO user_override_result
  FROM public.channel_permissions cp
  WHERE cp.channel_id = _channel_id
    AND cp.permission = _permission
    AND cp.user_id = _user_id
    AND cp.role_id IS NULL
    AND cp.role_name IS NULL
  LIMIT 1;

  IF user_override_result IS NOT NULL THEN
    RETURN user_override_result;
  END IF;

  SELECT cp.allowed INTO channel_result
  FROM public.channel_permissions cp
  WHERE cp.channel_id = _channel_id
    AND cp.permission = _permission
    AND cp.user_id IS NULL
    AND (
      (cp.role_id = ANY(user_custom_role_ids)) OR
      (cp.role_name = user_base_role AND cp.role_id IS NULL)
    )
  ORDER BY
    CASE WHEN cp.role_id IS NOT NULL THEN 1 ELSE 2 END,
    CASE WHEN cp.allowed = false THEN 1 ELSE 2 END,
    cp.created_at DESC
  LIMIT 1;

  IF channel_result IS NOT NULL THEN
    RETURN channel_result;
  END IF;

  SELECT rp.allowed INTO role_result
  FROM public.role_permissions rp
  WHERE rp.server_id = channel_server_id
    AND rp.permission = _permission
    AND (
      (rp.role_id = ANY(user_custom_role_ids)) OR
      (rp.role_name = user_base_role AND rp.role_id IS NULL)
    )
  ORDER BY
    CASE WHEN rp.role_id IS NOT NULL THEN 1 ELSE 2 END,
    CASE WHEN rp.allowed = false THEN 1 ELSE 2 END,
    rp.created_at DESC
  LIMIT 1;

  IF role_result IS NOT NULL THEN
    RETURN role_result;
  END IF;

  CASE _permission
    WHEN 'view_channels' THEN RETURN true;
    WHEN 'read_message_history' THEN RETURN true;
    WHEN 'send_messages' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'attach_files' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'embed_links' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'add_reactions' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'use_external_emojis' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'mention_everyone' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'mention_roles' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'manage_messages' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'pin_messages' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'manage_channels' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'manage_threads' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'kick_members' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'ban_members' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'mute_members' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'deafen_members' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'move_members' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'manage_nicknames' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'change_nickname' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'manage_roles' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'manage_server' THEN RETURN user_base_role = 'owner';
    WHEN 'manage_invites' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'create_instant_invite' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'manage_webhooks' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'transfer_ownership' THEN RETURN user_base_role = 'owner';
    WHEN 'manage_emojis' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'connect' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'speak' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'use_voice_activation' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'use_application_commands' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    ELSE RETURN false;
  END CASE;
END;
$$;


--
-- Name: check_user_server_permission(uuid, uuid, public.permission_type); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_user_server_permission(_user_id uuid, _server_id uuid, _permission public.permission_type) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _is_owner boolean;
  _everyone_role_id uuid;
  _member_id uuid;
  _result boolean;
BEGIN
  IF _user_id IS NULL OR NOT public.verify_request_identity(_user_id) THEN
    RETURN false;
  END IF;

  SELECT (owner_id = _user_id) INTO _is_owner
  FROM public.servers
  WHERE id = _server_id;

  IF _is_owner THEN
    RETURN true;
  END IF;

  SELECT id INTO _member_id
  FROM public.server_members
  WHERE server_id = _server_id
    AND user_id = _user_id
    AND COALESCE(is_banned, false) = false;

  IF _member_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT id INTO _everyone_role_id
  FROM public.server_roles
  WHERE server_id = _server_id
    AND name = '@everyone';

  SELECT CASE
    WHEN bool_or(allowed = false) THEN false
    WHEN bool_or(allowed = true) THEN true
    ELSE NULL
  END INTO _result
  FROM public.role_permissions rp
  JOIN public.server_member_roles smr
    ON smr.role_id = rp.role_id
   AND smr.member_id = _member_id
  WHERE rp.permission = _permission;

  IF _result IS NOT NULL THEN
    RETURN _result;
  END IF;

  IF _everyone_role_id IS NOT NULL THEN
    SELECT allowed INTO _result
    FROM public.role_permissions
    WHERE role_id = _everyone_role_id
      AND permission = _permission
    LIMIT 1;

    IF _result IS NOT NULL THEN
      RETURN _result;
    END IF;
  END IF;

  RETURN false;
END;
$$;


--
-- Name: check_username_available(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_username_available(_username text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  _client_id text;
BEGIN
  _client_id := public.request_client_identifier();

  IF _client_id <> 'unknown'
     AND NOT public.check_rate_limit(_client_id, 'check_username_available', 90, 60) THEN
    RAISE EXCEPTION 'Rate limited: too many username checks';
  END IF;

  IF _username IS NULL THEN
    RETURN false;
  END IF;

  IF length(_username) < 3 OR length(_username) > 20 THEN
    RETURN false;
  END IF;

  IF _username !~ '^[a-z0-9_]+$' THEN
    RETURN false;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE username = lower(_username)
  );
END;
$_$;


--
-- Name: cleanup_pow_challenges(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_pow_challenges() RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  DELETE FROM pow_challenges WHERE expires_at < now();
$$;


--
-- Name: close_expired_polls(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_expired_polls(_channel_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _count integer := 0;
  _caller uuid;
  r record;
BEGIN
  _caller := public.requesting_user_id();
  IF _caller IS NULL OR NOT public.verify_request_identity(_caller) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.can_access_channel(_channel_id, _caller) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  FOR r IN
    SELECT id
    FROM public.polls
    WHERE channel_id = _channel_id
      AND is_closed = false
      AND ends_at <= now()
  LOOP
    UPDATE public.polls
    SET is_closed = true
    WHERE id = r.id;

    PERFORM public.recompute_poll_results(r.id);
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;


--
-- Name: close_poll(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_poll(_poll_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  poll_row  record;
  opt_count int;
  i         int;
  v         int;
  max_votes int := 0;
  winner    text := '';
  result_text text;
BEGIN
  UPDATE polls
     SET is_closed = true
   WHERE id = _poll_id
     AND is_closed = false
  RETURNING * INTO poll_row;

  IF poll_row IS NULL THEN
    RETURN true;
  END IF;

  opt_count := jsonb_array_length(COALESCE(poll_row.results, '[]'::jsonb));

  IF opt_count > 0 AND COALESCE(poll_row.total_votes, 0) > 0 THEN
    FOR i IN 0..(opt_count - 1) LOOP
      v := COALESCE((poll_row.results ->> i)::int, 0);
      IF v > max_votes THEN
        max_votes := v;
        winner := COALESCE(poll_row.options[i + 1], 'Option ' || (i + 1));
      END IF;
    END LOOP;

    result_text := 'Poll ended: "' || poll_row.question || '" — Winner: ' || winner || ' (' || max_votes || ' vote' || CASE WHEN max_votes = 1 THEN '' ELSE 's' END || ')';
  ELSE
    result_text := 'Poll ended: "' || poll_row.question || '" — No votes were cast';
  END IF;

  INSERT INTO messages (channel_id, user_id, content, is_system_message, reply_to_id)
  VALUES (poll_row.channel_id, poll_row.created_by, result_text, true, poll_row.message_id);

  RETURN true;
END;
$$;


--
-- Name: count_available_prekeys(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.count_available_prekeys(_user_id uuid, _device_id integer) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  key_count INTEGER;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT COUNT(*) INTO key_count
  FROM user_prekeys
  WHERE user_id = _user_id
    AND device_id = _device_id
    AND is_used = FALSE;

  RETURN key_count;
END;
$$;


--
-- Name: create_category(uuid, uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_category(_server_id uuid, _user_id uuid, _name text, _position integer DEFAULT 0) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  new_category_id uuid;
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  INSERT INTO channel_categories (server_id, name, position)
  VALUES (_server_id, _name, _position)
  RETURNING id INTO new_category_id;
  
  SELECT json_build_object(
    'id', cc.id, 'server_id', cc.server_id, 'name', cc.name,
    'position', cc.position, 'is_collapsed', cc.is_collapsed, 'created_at', cc.created_at
  ) INTO result FROM channel_categories cc WHERE cc.id = new_category_id;
  
  RETURN result;
END;
$$;


--
-- Name: create_channel(uuid, text, text, uuid, uuid, integer, text, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_channel(_server_id uuid, _name text, _type text DEFAULT 'text'::text, _user_id uuid DEFAULT NULL::uuid, _category_id uuid DEFAULT NULL::uuid, _position integer DEFAULT NULL::integer, _icon text DEFAULT NULL::text, _is_private boolean DEFAULT false, _ghost_mode boolean DEFAULT false) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  new_channel public.channels%ROWTYPE;
  final_position integer;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: user_id required';
  END IF;

  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF _position IS NULL THEN
    SELECT COALESCE(MAX(position), -1) + 1
      INTO final_position
    FROM public.channels
    WHERE server_id = _server_id
      AND ((_category_id IS NULL AND category_id IS NULL) OR category_id = _category_id);
  ELSE
    final_position := _position;
  END IF;

  INSERT INTO public.channels (
    server_id, name, type, category_id, position, icon, is_private, ghost_mode, is_read_only
  )
  VALUES (
    _server_id, _name, _type::public.channel_type, _category_id, final_position, _icon,
    _is_private, _ghost_mode, false
  )
  RETURNING * INTO new_channel;

  IF _is_private THEN
    INSERT INTO public.channel_members (channel_id, user_id, added_by)
    VALUES (new_channel.id, _user_id, _user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN row_to_json(new_channel);
END;
$$;


--
-- Name: create_group_dm(uuid, uuid[], text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_group_dm(_creator_id uuid, _participant_ids uuid[], _name text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  new_conv_id uuid;
  result json;
  normalized_ids uuid[];
  missing_count integer;
  recent_groups_10m integer;
  recent_groups_1d integer;
  creator_created_at timestamptz;
  final_name text;
BEGIN
  IF NOT public.verify_request_identity(_creator_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  -- Normalize participant list: remove nulls, duplicates, and self.
  SELECT COALESCE(array_agg(DISTINCT pid), ARRAY[]::uuid[])
    INTO normalized_ids
  FROM unnest(COALESCE(_participant_ids, ARRAY[]::uuid[])) AS pid
  WHERE pid IS NOT NULL
    AND pid <> _creator_id;

  IF cardinality(normalized_ids) < 2 THEN
    RAISE EXCEPTION 'Groups require at least 2 other participants';
  END IF;

  IF cardinality(normalized_ids) > 25 THEN
    RAISE EXCEPTION 'Group DM participant limit exceeded';
  END IF;

  SELECT u.created_at INTO creator_created_at
  FROM public.users u
  WHERE u.id = _creator_id;

  IF creator_created_at IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF creator_created_at > now() - interval '10 minutes' THEN
    RAISE EXCEPTION 'Group DMs are temporarily restricted for new accounts';
  END IF;

  -- Anti-abuse caps on group creation.
  SELECT count(*) INTO recent_groups_10m
  FROM public.dm_conversations dc
  WHERE dc.created_by = _creator_id
    AND COALESCE(dc.is_group, false) = true
    AND dc.created_at > now() - interval '10 minutes';

  IF recent_groups_10m >= 3 THEN
    RAISE EXCEPTION 'Rate limited: too many new group DMs';
  END IF;

  SELECT count(*) INTO recent_groups_1d
  FROM public.dm_conversations dc
  WHERE dc.created_by = _creator_id
    AND COALESCE(dc.is_group, false) = true
    AND dc.created_at > now() - interval '1 day';

  IF recent_groups_1d >= 10 THEN
    RAISE EXCEPTION 'Rate limited: group DM daily limit reached';
  END IF;

  -- Validate all participants exist.
  SELECT count(*) INTO missing_count
  FROM unnest(normalized_ids) pid
  LEFT JOIN public.users u ON u.id = pid
  WHERE u.id IS NULL;

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'One or more users not found';
  END IF;

  -- Prevent contacting blocked users in bulk.
  IF EXISTS (
    SELECT 1
    FROM unnest(normalized_ids) pid
    JOIN public.friendships f
      ON f.status = 'blocked'
     AND (
       (f.requester_id = _creator_id AND f.addressee_id = pid)
       OR (f.requester_id = pid AND f.addressee_id = _creator_id)
     )
  ) THEN
    RAISE EXCEPTION 'Cannot include blocked users in group DM';
  END IF;

  -- Require some relationship context (friend or shared server) for each added user.
  IF EXISTS (
    SELECT 1
    FROM unnest(normalized_ids) pid
    WHERE NOT public.is_friend_with(_creator_id, pid)
      AND NOT public.shares_server_with(_creator_id, pid)
  ) THEN
    RAISE EXCEPTION 'Cannot create group DM with unrelated users';
  END IF;

  final_name := NULLIF(btrim(COALESCE(_name, '')), '');
  IF final_name IS NOT NULL AND char_length(final_name) > 80 THEN
    RAISE EXCEPTION 'Group DM name too long';
  END IF;

  INSERT INTO public.dm_conversations (is_group, name, created_by)
  VALUES (true, final_name, _creator_id)
  RETURNING id INTO new_conv_id;

  INSERT INTO public.dm_participants (conversation_id, user_id)
  VALUES (new_conv_id, _creator_id);

  INSERT INTO public.dm_participants (conversation_id, user_id)
  SELECT new_conv_id, pid
  FROM unnest(normalized_ids) AS pid;

  SELECT json_build_object(
    'id', dc.id,
    'created_at', dc.created_at,
    'is_group', dc.is_group,
    'name', dc.name,
    'created_by', dc.created_by,
    'participants', (
      SELECT json_agg(
        json_build_object(
          'user_id', dp.user_id,
          'user', json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'status', u.status,
            'last_seen', CASE WHEN u.id = _creator_id THEN u.last_seen ELSE NULL END
          )
        )
      )
      FROM public.dm_participants dp
      JOIN public.users u ON u.id = dp.user_id
      WHERE dp.conversation_id = dc.id
    )
  ) INTO result
  FROM public.dm_conversations dc
  WHERE dc.id = new_conv_id;

  RETURN result;
END;
$$;


--
-- Name: create_notification(uuid, public.notification_type, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_notification(_user_id uuid, _type public.notification_type, _title text, _body text DEFAULT NULL::text, _link text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (_user_id, _type, _title, _body, _link)
  RETURNING id INTO notification_id;
  RETURN notification_id;
END;
$$;


--
-- Name: create_server_invite(uuid, uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_server_invite(_server_id uuid, _user_id uuid, _expires_in_seconds integer DEFAULT NULL::integer, _max_uses integer DEFAULT NULL::integer) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  new_code char(8);
  try_count int := 0;
  expires_at_value timestamptz;
  _scope text;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_invites') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  _scope := _user_id::text || ':' || _server_id::text;
  IF NOT public.check_rate_limit(_scope, 'create_server_invite_burst', 12, 60) THEN
    RAISE EXCEPTION 'Rate limited: too many invites created';
  END IF;
  IF NOT public.check_rate_limit(_scope, 'create_server_invite_hourly', 120, 3600) THEN
    RAISE EXCEPTION 'Rate limited: invite creation quota reached';
  END IF;

  IF _max_uses IS NOT NULL AND _max_uses < 1 THEN
    RAISE EXCEPTION 'max_uses must be at least 1';
  END IF;

  expires_at_value := CASE
    WHEN _expires_in_seconds IS NULL THEN NULL
    ELSE now() + make_interval(secs => _expires_in_seconds)
  END;

  LOOP
    try_count := try_count + 1;
    IF try_count > 25 THEN
      RAISE EXCEPTION 'Failed to generate a unique invite code';
    END IF;

    new_code := public.generate_invite_code();

    BEGIN
      INSERT INTO public.server_invites (server_id, code, created_by, expires_at, max_uses, uses_count)
      VALUES (_server_id, new_code, _user_id, expires_at_value, _max_uses, 0);
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- retry
    END;
  END LOOP;

  RETURN trim(new_code::text);
END;
$$;


--
-- Name: create_server_role(uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_server_role(_server_id uuid, _user_id uuid, _name text, _color text DEFAULT '#5865F2'::text, _icon text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  new_role_id uuid;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_roles') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden';
  END IF;

  INSERT INTO public.server_roles (server_id, name, color, icon, position)
  VALUES (
    _server_id,
    _name,
    _color,
    _icon,
    COALESCE((SELECT MAX(position) FROM public.server_roles WHERE server_id = _server_id), 0) + 1
  )
  RETURNING id INTO new_role_id;

  RETURN (
    SELECT json_build_object(
      'id', sr.id,
      'server_id', sr.server_id,
      'name', sr.name,
      'color', sr.color,
      'icon', sr.icon,
      'position', sr.position,
      'created_at', sr.created_at
    )
    FROM public.server_roles sr
    WHERE sr.id = new_role_id
  );
END;
$$;


--
-- Name: create_server_with_owner(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_server_with_owner(_name text, _owner_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  new_server_id uuid;
  new_invite_code text;
  new_category_id uuid;
  new_channel_id uuid;
  everyone_role_id uuid;
  result jsonb;
  owner_created_at timestamptz;
  recent_servers_10m integer;
  recent_servers_1d integer;
  safe_name text;
BEGIN
  IF NOT public.verify_request_identity(_owner_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  safe_name := btrim(COALESCE(_name, ''));
  IF safe_name = '' THEN
    RAISE EXCEPTION 'Server name cannot be empty';
  END IF;
  IF char_length(safe_name) > 100 THEN
    RAISE EXCEPTION 'Server name is too long';
  END IF;

  SELECT u.created_at INTO owner_created_at
  FROM public.users u
  WHERE u.id = _owner_id;

  IF owner_created_at IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  SELECT count(*) INTO recent_servers_10m
  FROM public.servers s
  WHERE s.owner_id = _owner_id
    AND s.created_at > now() - interval '10 minutes';

  IF recent_servers_10m >= 3 THEN
    RAISE EXCEPTION 'Rate limited: too many servers created recently';
  END IF;

  SELECT count(*) INTO recent_servers_1d
  FROM public.servers s
  WHERE s.owner_id = _owner_id
    AND s.created_at > now() - interval '1 day';

  IF recent_servers_1d >= 10 THEN
    RAISE EXCEPTION 'Rate limited: daily server creation limit reached';
  END IF;

  new_server_id := gen_random_uuid();
  new_category_id := gen_random_uuid();
  new_channel_id := gen_random_uuid();
  everyone_role_id := gen_random_uuid();

  SELECT public.generate_invite_code() INTO new_invite_code;

  INSERT INTO public.servers (id, name, owner_id, invite_code)
  VALUES (new_server_id, safe_name, _owner_id, new_invite_code);

  INSERT INTO public.server_members (server_id, user_id, role)
  VALUES (new_server_id, _owner_id, 'owner');

  INSERT INTO public.channel_categories (id, server_id, name, position)
  VALUES (new_category_id, new_server_id, 'Text Channels', 0);

  INSERT INTO public.channels (id, server_id, category_id, name, type, position)
  VALUES (new_channel_id, new_server_id, new_category_id, 'general', 'text', 0);

  INSERT INTO public.server_roles (id, server_id, name, color, position, created_at)
  VALUES (everyone_role_id, new_server_id, '@everyone', '#99AAB5', 999, now());

  INSERT INTO public.role_permissions (id, server_id, role_id, permission, allowed, created_at)
  SELECT gen_random_uuid(), new_server_id, everyone_role_id, p.perm::permission_type, true, now()
  FROM (
    VALUES
      ('send_messages'), ('add_reactions'), ('view_channels'), ('read_message_history'),
      ('attach_files'), ('embed_links'), ('use_external_emojis'), ('change_nickname'),
      ('create_instant_invite'), ('connect'), ('speak'), ('use_voice_activation'),
      ('use_application_commands'), ('mention_roles')
  ) AS p(perm);

  SELECT jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'owner_id', s.owner_id,
    'invite_code', s.invite_code,
    'icon_url', s.icon_url,
    'banner_url', s.banner_url,
    'is_published', s.is_published,
    'about', s.about,
    'created_at', s.created_at
  ) INTO result
  FROM public.servers s
  WHERE s.id = new_server_id;

  RETURN result;
END;
$$;


--
-- Name: create_task(uuid, uuid, text, text, text, timestamp with time zone, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_task(_channel_id uuid, _user_id uuid, _title text, _description text DEFAULT NULL::text, _priority text DEFAULT 'medium'::text, _due_date timestamp with time zone DEFAULT NULL::timestamp with time zone, _assignee_ids uuid[] DEFAULT ARRAY[]::uuid[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  new_task record;
  channel_record record;
  max_position integer;
  assignee_id uuid;
BEGIN
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT c.id, c.server_id INTO channel_record
  FROM channels c WHERE c.id = _channel_id;

  IF channel_record IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  SELECT COALESCE(MAX(task_position), -1) + 1 INTO max_position
  FROM tasks WHERE channel_id = _channel_id;

  INSERT INTO tasks (channel_id, server_id, created_by, title, description, priority, due_date, task_position)
  VALUES (_channel_id, channel_record.server_id, _user_id, _title, _description, _priority::task_priority, _due_date, max_position)
  RETURNING * INTO new_task;

  IF array_length(_assignee_ids, 1) > 0 THEN
    FOREACH assignee_id IN ARRAY _assignee_ids LOOP
      INSERT INTO task_assignees (task_id, user_id, assigned_by)
      VALUES (new_task.id, assignee_id, _user_id)
      ON CONFLICT (task_id, user_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'id', new_task.id,
    'channel_id', new_task.channel_id,
    'server_id', new_task.server_id,
    'created_by', new_task.created_by,
    'title', new_task.title,
    'description', new_task.description,
    'priority', new_task.priority::text,
    'status', new_task.status::text,
    'due_date', new_task.due_date,
    'position', new_task.task_position,
    'completed_by', new_task.completed_by,
    'completed_at', new_task.completed_at,
    'created_at', new_task.created_at,
    'updated_at', new_task.updated_at
  );
END;
$$;


--
-- Name: create_task_comment(uuid, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_task_comment(_task_id uuid, _user_id uuid, _content text, _reply_to_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  task_channel_id uuid;
  new_comment_id uuid;
  reply_to_task_id uuid;
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get task channel
  SELECT channel_id INTO task_channel_id
  FROM tasks
  WHERE id = _task_id;
  
  IF task_channel_id IS NULL THEN
    RETURN json_build_object('error', 'Task not found');
  END IF;
  
  -- If replying, verify the reply_to comment belongs to the same task
  IF _reply_to_id IS NOT NULL THEN
    SELECT task_id INTO reply_to_task_id
    FROM task_comments
    WHERE id = _reply_to_id;
    
    IF reply_to_task_id IS NULL THEN
      RETURN json_build_object('error', 'Reply target comment not found');
    END IF;
    
    IF reply_to_task_id != _task_id THEN
      RETURN json_build_object('error', 'Reply target must be in the same task');
    END IF;
  END IF;
  
  -- Check permission: view_tasks (need to view to comment)
  IF NOT check_user_permission(_user_id, task_channel_id, 'view_tasks'::permission_type) THEN
    RETURN json_build_object('error', 'Permission denied: view_tasks');
  END IF;
  
  -- Insert comment
  INSERT INTO task_comments (task_id, user_id, content, reply_to_id)
  VALUES (_task_id, _user_id, _content, _reply_to_id)
  RETURNING id INTO new_comment_id;
  
  -- Return the created comment
  SELECT json_build_object(
    'id', tc.id,
    'task_id', tc.task_id,
    'user_id', tc.user_id,
    'content', tc.content,
    'created_at', tc.created_at,
    'edited_at', tc.edited_at,
    'reply_to_id', tc.reply_to_id
  ) INTO result
  FROM task_comments tc
  WHERE tc.id = new_comment_id;
  
  RETURN result;
END;
$$;


--
-- Name: create_thread(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_thread(_message_id uuid, _user_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  message_channel_id uuid;
  message_user_id uuid;
  channel_server_id uuid;
  is_muted boolean;
  new_thread_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get message details
  SELECT channel_id, user_id INTO message_channel_id, message_user_id
  FROM messages
  WHERE id = _message_id;

  IF message_channel_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  -- Verify the user is the message author or has permission
  IF message_user_id != _user_id THEN
    -- Check if user has permission to create threads (could be extended for moderation)
    SELECT server_id INTO channel_server_id
    FROM channels
    WHERE id = message_channel_id;

    SELECT sm.is_muted INTO is_muted
    FROM server_members sm
    WHERE sm.server_id = channel_server_id
      AND sm.user_id = _user_id
      AND sm.is_banned = false;

    IF is_muted IS NULL THEN
      RAISE EXCEPTION 'Not a member of this server';
    END IF;
  END IF;

  -- Check if thread already exists for this message
  SELECT id INTO new_thread_id
  FROM threads
  WHERE message_id = _message_id;

  IF new_thread_id IS NOT NULL THEN
    RETURN new_thread_id;
  END IF;

  -- Create the thread
  INSERT INTO threads (channel_id, message_id, created_by)
  VALUES (message_channel_id, _message_id, _user_id)
  RETURNING id INTO new_thread_id;

  RETURN new_thread_id;
END;
$$;


--
-- Name: debug_channel_permissions(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.debug_channel_permissions(_channel_id uuid, _user_id uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  channel_server_id uuid;
  user_base_role server_role;
  user_custom_role_ids uuid[];
  result json;
BEGIN
  -- Get channel's server
  SELECT server_id INTO channel_server_id
  FROM channels
  WHERE id = _channel_id;
  
  IF channel_server_id IS NULL THEN
    RETURN json_build_object('error', 'Channel not found');
  END IF;
  
  -- Get user's base role
  SELECT sm.role INTO user_base_role
  FROM server_members sm
  WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;
  
  -- Get user's custom role IDs
  SELECT COALESCE(ARRAY_AGG(DISTINCT smr.role_id) FILTER (WHERE smr.role_id IS NOT NULL), ARRAY[]::uuid[]) 
  INTO user_custom_role_ids
  FROM server_member_roles smr
  JOIN server_members sm ON sm.id = smr.member_id
  WHERE sm.user_id = _user_id AND sm.server_id = channel_server_id;
  
  -- Get all channel permissions for this channel
  -- Get channel permissions that match this user's roles
  RETURN json_build_object(
    'channel_id', _channel_id,
    'user_id', _user_id,
    'base_role', user_base_role,
    'custom_role_ids', user_custom_role_ids,
    'channel_permissions', (
      SELECT json_agg(
        json_build_object(
          'id', cp.id,
          'role_id', cp.role_id,
          'role_name', cp.role_name,
          'permission', cp.permission,
          'allowed', cp.allowed
        )
      )
      FROM channel_permissions cp
      WHERE cp.channel_id = _channel_id
        AND (
          (cp.role_name = user_base_role AND cp.role_id IS NULL) OR
          (cp.role_id = ANY(COALESCE(user_custom_role_ids, ARRAY[]::uuid[])))
        )
    ),
    'all_channel_permissions', (
      SELECT json_agg(
        json_build_object(
          'id', cp.id,
          'role_id', cp.role_id,
          'role_name', cp.role_name,
          'permission', cp.permission,
          'allowed', cp.allowed
        )
      )
      FROM channel_permissions cp
      WHERE cp.channel_id = _channel_id
    )
  );
END;
$$;


--
-- Name: debug_request_headers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.debug_request_headers() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN json_build_object(
    'raw_header', current_setting('request.headers', true)::json->>'x-key-hash',
    'header_exists', (current_setting('request.headers', true)::json->>'x-key-hash') IS NOT NULL
  );
END;
$$;


--
-- Name: debug_server_system_messages(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.debug_server_system_messages(_server_id uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  server_data record;
  result json;
BEGIN
  SELECT 
    id,
    name,
    system_channel_join_id,
    system_channel_leave_id,
    enable_join_messages,
    enable_leave_messages,
    invite_code
  INTO server_data
  FROM servers
  WHERE id = _server_id;
  
  IF server_data IS NULL THEN
    RETURN json_build_object('error', 'Server not found');
  END IF;
  
  RETURN json_build_object(
    'server_id', server_data.id,
    'server_name', server_data.name,
    'system_channel_join_id', server_data.system_channel_join_id,
    'system_channel_leave_id', server_data.system_channel_leave_id,
    'enable_join_messages', server_data.enable_join_messages,
    'enable_leave_messages', server_data.enable_leave_messages,
    'invite_code', server_data.invite_code,
    'join_channel_exists', EXISTS(SELECT 1 FROM channels WHERE id = server_data.system_channel_join_id),
    'leave_channel_exists', EXISTS(SELECT 1 FROM channels WHERE id = server_data.system_channel_leave_id)
  );
END;
$$;


--
-- Name: debug_user_permission(uuid, uuid, public.permission_type); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.debug_user_permission(_user_id uuid, _channel_id uuid, _permission public.permission_type) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  channel_server_id uuid;
  user_base_role server_role;
  user_custom_role_ids uuid[];
  channel_override_allowed boolean;
  channel_override_source text;
  role_permission_allowed boolean;
  role_permission_source text;
  final_result boolean;
BEGIN
  -- 1. Context
  SELECT server_id INTO channel_server_id FROM channels WHERE id = _channel_id;
  IF channel_server_id IS NULL THEN
    RETURN json_build_object('error', 'Channel not found', 'has_permission', false);
  END IF;

  SELECT sm.role INTO user_base_role
  FROM server_members sm
  WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;
  
  IF user_base_role IS NULL THEN
    RETURN json_build_object('error', 'User not a member', 'has_permission', false);
  END IF;

  -- 2. Owner
  IF user_base_role = 'owner' THEN
    RETURN json_build_object(
      'has_permission', true,
      'source', 'owner_override',
      'base_role', user_base_role,
      'custom_roles', '[]'::json
    );
  END IF;

  -- 3. Custom Roles
  SELECT COALESCE(ARRAY_AGG(DISTINCT smr.role_id) FILTER (WHERE smr.role_id IS NOT NULL), ARRAY[]::uuid[]) 
  INTO user_custom_role_ids
  FROM server_member_roles smr
  JOIN server_members sm ON sm.id = smr.member_id
  WHERE sm.user_id = _user_id AND sm.server_id = channel_server_id;

  -- 4. Channel Check
  SELECT cp.allowed, 
         CASE WHEN cp.role_id IS NOT NULL THEN 'custom_role' ELSE 'base_role' END || ': ' || COALESCE(sr.name, user_base_role::text)
  INTO channel_override_allowed, channel_override_source
  FROM channel_permissions cp
  LEFT JOIN server_roles sr ON sr.id = cp.role_id
  WHERE cp.channel_id = _channel_id
    AND cp.permission = _permission
    AND (
      (cp.role_id = ANY(user_custom_role_ids)) OR
      (cp.role_name = user_base_role AND cp.role_id IS NULL)
    )
  ORDER BY 
    CASE WHEN cp.role_id IS NOT NULL THEN 1 ELSE 2 END,
    CASE WHEN cp.allowed = false THEN 1 ELSE 2 END,
    cp.created_at DESC
  LIMIT 1;

  IF channel_override_allowed IS NOT NULL THEN
    RETURN json_build_object(
      'has_permission', channel_override_allowed,
      'source', 'channel_override',
      'channel_override', json_build_object('allowed', channel_override_allowed, 'source', channel_override_source),
      'base_role', user_base_role
    );
  END IF;

  -- 5. Role Check
  SELECT rp.allowed,
         CASE WHEN rp.role_id IS NOT NULL THEN 'custom_role' ELSE 'base_role' END || ': ' || COALESCE(sr.name, user_base_role::text)
  INTO role_permission_allowed, role_permission_source
  FROM role_permissions rp
  LEFT JOIN server_roles sr ON sr.id = rp.role_id
  WHERE rp.server_id = channel_server_id
    AND rp.permission = _permission
    AND (
      (rp.role_id = ANY(user_custom_role_ids)) OR
      (rp.role_name = user_base_role AND rp.role_id IS NULL)
    )
  ORDER BY 
    CASE WHEN rp.role_id IS NOT NULL THEN 1 ELSE 2 END,
    CASE WHEN rp.allowed = false THEN 1 ELSE 2 END,
    rp.created_at DESC
  LIMIT 1;

  IF role_permission_allowed IS NOT NULL THEN
    RETURN json_build_object(
      'has_permission', role_permission_allowed,
      'source', 'role_permission',
      'role_permission', json_build_object('allowed', role_permission_allowed, 'source', role_permission_source),
      'base_role', user_base_role
    );
  END IF;

  -- 6. Default Fallback
  CASE _permission
    WHEN 'view_channels' THEN final_result := true;
    WHEN 'send_messages' THEN final_result := user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'add_reactions' THEN final_result := user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'manage_messages' THEN final_result := user_base_role IN ('owner', 'admin', 'moderator');
    -- ... add others for complete debug info ...
    ELSE final_result := false;
  END CASE;

  RETURN json_build_object(
    'has_permission', final_result,
    'source', 'default_permission',
    'base_role', user_base_role
  );
END;
$$;


--
-- Name: decline_friend_request(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decline_friend_request(_friendship_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.friendships
    WHERE id = _friendship_id
      AND addressee_id = _user_id
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Cannot decline this friend request';
  END IF;

  DELETE FROM public.friendships
  WHERE id = _friendship_id;

  RETURN true;
END;
$$;


--
-- Name: delete_announcement_comment(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_announcement_comment(_comment_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  comment_owner_id uuid;
  msg_channel_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT ac.user_id, m.channel_id INTO comment_owner_id, msg_channel_id
  FROM announcement_comments ac
  JOIN messages m ON m.id = ac.message_id
  WHERE ac.id = _comment_id;
  IF comment_owner_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;
  IF comment_owner_id != _user_id THEN
    IF NOT check_user_permission(_user_id, msg_channel_id, 'manage_messages') THEN
      RAISE EXCEPTION 'Permission denied: you can only delete your own comments';
    END IF;
  END IF;
  DELETE FROM announcement_comments WHERE id = _comment_id;
  RETURN true;
END;
$$;


--
-- Name: delete_category(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_category(_category_id uuid, _user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _server_id uuid;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT server_id INTO _server_id
  FROM public.channel_categories
  WHERE id = _category_id;

  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'Only users with manage_channels permission can delete categories';
  END IF;

  UPDATE public.channels
  SET category_id = NULL
  WHERE category_id = _category_id;

  DELETE FROM public.channel_categories
  WHERE id = _category_id;
END;
$$;


--
-- Name: delete_category_permission(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_category_permission(_permission_id uuid, _user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _server_id uuid;
  _category_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT cp.category_id INTO _category_id FROM category_permissions cp WHERE cp.id = _permission_id;
  IF _category_id IS NULL THEN
    RAISE EXCEPTION 'Permission not found';
  END IF;

  SELECT server_id INTO _server_id FROM channel_categories WHERE id = _category_id;
  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT check_user_server_permission(_user_id, _server_id, 'manage_channels'::permission_type) THEN
      RAISE EXCEPTION 'You do not have permission to manage category permissions';
    END IF;
  END IF;

  DELETE FROM category_permissions WHERE id = _permission_id;
END;
$$;


--
-- Name: delete_channel(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_channel(_channel_id uuid, _user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _server_id uuid;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT server_id INTO _server_id
  FROM public.channels
  WHERE id = _channel_id;

  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'Only users with manage_channels permission can delete channels';
  END IF;

  DELETE FROM public.messages WHERE channel_id = _channel_id;
  DELETE FROM public.channels WHERE id = _channel_id;
END;
$$;


--
-- Name: delete_channel_permission(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_channel_permission(_permission_id uuid, _user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _server_id uuid;
  _channel_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT cp.channel_id INTO _channel_id FROM channel_permissions cp WHERE cp.id = _permission_id;
  IF _channel_id IS NULL THEN
    RAISE EXCEPTION 'Permission not found';
  END IF;
  SELECT server_id INTO _server_id FROM channels WHERE id = _channel_id;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT public.check_user_permission(_user_id, _channel_id, 'manage_channels'::permission_type) THEN
      RAISE EXCEPTION 'You do not have permission to manage channel permissions';
    END IF;
  END IF;
  DELETE FROM channel_permissions WHERE id = _permission_id;
END;
$$;


--
-- Name: delete_dm(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_dm(_message_id uuid, _sender_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_sender_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Only sender can delete their message
  IF NOT EXISTS (SELECT 1 FROM direct_messages WHERE id = _message_id AND sender_id = _sender_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  DELETE FROM direct_messages WHERE id = _message_id;
  RETURN true;
END;
$$;


--
-- Name: delete_forum_thread(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_forum_thread(_thread_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_thread RECORD;
  v_member RECORD;
  v_can_manage BOOLEAN := FALSE;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get the thread
  SELECT * INTO v_thread FROM threads WHERE id = _thread_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Thread not found';
  END IF;

  -- Check if user is the thread creator
  IF v_thread.created_by = _user_id THEN
    v_can_manage := TRUE;
  END IF;

  -- If not creator, check if user has manage_messages permission (owner/admin/moderator with permission)
  IF NOT v_can_manage THEN
    -- Get channel's server_id
    DECLARE
      v_server_id UUID;
    BEGIN
      SELECT server_id INTO v_server_id FROM channels WHERE id = v_thread.channel_id;
      
      -- Get member role
      SELECT * INTO v_member FROM server_members 
        WHERE server_id = v_server_id AND user_id = _user_id;
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Not a server member';
      END IF;

      -- Owner and admin always can
      IF v_member.role IN ('owner', 'admin') THEN
        v_can_manage := TRUE;
      END IF;

      -- Check role_permissions for manage_messages
      IF NOT v_can_manage THEN
        SELECT EXISTS (
          SELECT 1 FROM role_permissions 
          WHERE server_id = v_server_id 
            AND role_name = v_member.role 
            AND permission = 'manage_messages' 
            AND allowed = TRUE
        ) INTO v_can_manage;
      END IF;

      -- Check custom roles
      IF NOT v_can_manage THEN
        SELECT EXISTS (
          SELECT 1 FROM role_permissions rp
          JOIN server_member_roles smr ON smr.role_id = rp.role_id
          WHERE smr.member_id = v_member.id
            AND rp.permission = 'manage_messages'
            AND rp.allowed = TRUE
        ) INTO v_can_manage;
      END IF;
    END;
  END IF;

  IF NOT v_can_manage THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Delete thread replies (thread_messages)
  DELETE FROM thread_messages WHERE thread_id = _thread_id;

  -- Delete thread reactions for the original message
  DELETE FROM thread_reactions WHERE message_id = v_thread.message_id;

  -- Delete the thread record
  DELETE FROM threads WHERE id = _thread_id;

  -- Delete the original message's reactions
  DELETE FROM reactions WHERE message_id = v_thread.message_id;

  -- Delete the original message
  DELETE FROM messages WHERE id = v_thread.message_id;

  RETURN TRUE;
END;
$$;


--
-- Name: delete_media_comment(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_media_comment(_comment_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  comment_owner_id uuid;
  media_channel_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT mc.user_id, mi.channel_id INTO comment_owner_id, media_channel_id
  FROM media_comments mc
  JOIN media_items mi ON mi.id = mc.media_id
  WHERE mc.id = _comment_id;
  IF comment_owner_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;
  IF comment_owner_id != _user_id THEN
    IF NOT check_user_permission(_user_id, media_channel_id, 'manage_messages') THEN
      RAISE EXCEPTION 'Permission denied: you can only delete your own comments';
    END IF;
  END IF;
  DELETE FROM media_comments WHERE id = _comment_id;
  RETURN true;
END;
$$;


--
-- Name: delete_media_item(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_media_item(_item_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  item_channel_id uuid;
  item_owner_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT channel_id, user_id INTO item_channel_id, item_owner_id FROM media_items WHERE id = _item_id;
  IF item_channel_id IS NULL THEN
    RAISE EXCEPTION 'Media item not found';
  END IF;
  IF item_owner_id != _user_id THEN
    IF NOT check_user_permission(_user_id, item_channel_id, 'manage_messages') THEN
      RAISE EXCEPTION 'Permission denied: you can only delete your own media or need manage_messages permission';
    END IF;
  END IF;
  DELETE FROM media_items WHERE id = _item_id;
  RETURN true;
END;
$$;


--
-- Name: delete_message(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_message(_message_id uuid, _user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _msg_user_id uuid;
  _channel_id uuid;
  _server_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT user_id, channel_id INTO _msg_user_id, _channel_id FROM messages WHERE id = _message_id;
  IF _msg_user_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  IF _msg_user_id = _user_id THEN
    DELETE FROM messages WHERE id = _message_id;
    RETURN;
  END IF;
  SELECT server_id INTO _server_id FROM channels WHERE id = _channel_id;
  IF EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    DELETE FROM messages WHERE id = _message_id;
    RETURN;
  END IF;
  IF public.check_user_permission(_user_id, _channel_id, 'manage_messages'::permission_type) THEN
    DELETE FROM messages WHERE id = _message_id;
    RETURN;
  END IF;
  RAISE EXCEPTION 'You do not have permission to delete this message';
END;
$$;


--
-- Name: delete_old_declined_requests(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_old_declined_requests() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Delete declined friendships older than 30 minutes (table has created_at, not updated_at)
  DELETE FROM public.friendships
  WHERE status = 'declined'
  AND created_at < (NOW() - INTERVAL '30 minutes');

  -- Clean up declined_friend_requests log (column is declined_at)
  DELETE FROM public.declined_friend_requests
  WHERE declined_at < (NOW() - INTERVAL '30 minutes');

  RETURN NULL;
END;
$$;


--
-- Name: delete_role_permission(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_role_permission(_permission_id uuid, _user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE _server_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT server_id INTO _server_id FROM role_permissions WHERE id = _permission_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Permission not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN server_member_roles smr ON smr.role_id = rp.role_id
      JOIN server_members sm ON sm.id = smr.member_id
      WHERE sm.user_id = _user_id AND rp.server_id = _server_id
        AND rp.permission = 'manage_roles' AND rp.allowed = true
    ) THEN RAISE EXCEPTION 'Only admins and owners can manage role permissions'; END IF;
  END IF;
  DELETE FROM role_permissions WHERE id = _permission_id;
END; $$;


--
-- Name: delete_server(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_server(_server_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Check permission using database-backed permission system
  -- Only users with manage_server permission (which only owner has by default) can delete
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_server') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Delete in order: messages -> channels -> categories -> members -> server
  DELETE FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = _server_id);
  DELETE FROM channels WHERE server_id = _server_id;
  DELETE FROM channel_categories WHERE server_id = _server_id;
  DELETE FROM server_members WHERE server_id = _server_id;
  DELETE FROM servers WHERE id = _server_id;
  
  RETURN true;
END;
$$;


--
-- Name: delete_server_emoji(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_server_emoji(_emoji_id uuid, _user_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  emoji_server_id uuid;
  emoji_file_path text;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT server_id, file_path INTO emoji_server_id, emoji_file_path FROM server_emojis WHERE id = _emoji_id;
  IF emoji_server_id IS NULL THEN
    RAISE EXCEPTION 'Emoji not found';
  END IF;
  IF NOT check_user_server_permission(_user_id, emoji_server_id, 'manage_emojis') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to manage emojis';
  END IF;
  DELETE FROM server_emojis WHERE id = _emoji_id;
  RETURN emoji_file_path;
END;
$$;


--
-- Name: delete_server_role(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_server_role(_role_id uuid, _user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _server_id uuid;
  _role_name text;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT server_id, name
    INTO _server_id, _role_name
  FROM public.server_roles
  WHERE id = _role_id;

  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Role not found';
  END IF;

  IF _role_name = '@everyone' THEN
    RAISE EXCEPTION 'Cannot delete the @everyone role';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_roles') THEN
    RAISE EXCEPTION 'Only users with manage_roles permission can delete roles';
  END IF;

  DELETE FROM public.server_member_roles WHERE role_id = _role_id;
  DELETE FROM public.role_permissions WHERE role_id = _role_id;
  DELETE FROM public.server_roles WHERE id = _role_id;
END;
$$;


--
-- Name: delete_task(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_task(_task_id uuid, _user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  task_channel_id uuid;
  task_created_by uuid;
  can_delete boolean := false;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get task info
  SELECT channel_id, created_by
  INTO task_channel_id, task_created_by
  FROM tasks
  WHERE id = _task_id;
  
  IF task_channel_id IS NULL THEN
    RETURN json_build_object('error', 'Task not found');
  END IF;
  
  -- Check delete permission - only check delete_tasks, no fallbacks
  IF task_created_by = _user_id THEN
    -- Can delete own tasks if has delete_tasks permission
    can_delete := check_user_permission(_user_id, task_channel_id, 'delete_tasks'::permission_type);
  END IF;
  
  -- Can delete all tasks if has delete_tasks permission
  IF NOT can_delete THEN
    can_delete := check_user_permission(_user_id, task_channel_id, 'delete_tasks'::permission_type);
  END IF;
  
  IF NOT can_delete THEN
    RETURN json_build_object('error', 'Permission denied: delete tasks');
  END IF;
  
  -- Delete task (cascade will handle assignees and comments)
  DELETE FROM tasks WHERE id = _task_id;
  
  RETURN json_build_object('success', true);
END;
$$;


--
-- Name: delete_task_comment(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_task_comment(_comment_id uuid, _user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  comment_user_id uuid;
  task_channel_id uuid;
  can_delete boolean := false;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get comment info
  SELECT tc.user_id, t.channel_id
  INTO comment_user_id, task_channel_id
  FROM task_comments tc
  JOIN tasks t ON t.id = tc.task_id
  WHERE tc.id = _comment_id;
  
  IF comment_user_id IS NULL THEN
    RETURN json_build_object('error', 'Comment not found');
  END IF;
  
  -- Comment owner can delete
  IF comment_user_id = _user_id THEN
    can_delete := true;
  END IF;
  
  -- Users with manage_messages can delete any comment
  IF NOT can_delete AND task_channel_id IS NOT NULL THEN
    can_delete := check_user_permission(_user_id, task_channel_id, 'manage_messages'::permission_type);
  END IF;
  
  IF NOT can_delete THEN
    RETURN json_build_object('error', 'Permission denied: delete comment');
  END IF;
  
  -- Delete comment
  DELETE FROM task_comments WHERE id = _comment_id;
  
  RETURN json_build_object('success', true);
END;
$$;


--
-- Name: delete_thread_message(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_thread_message(_message_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  msg_user_id uuid;
  thread_channel_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get message details
  SELECT tm.user_id, t.channel_id INTO msg_user_id, thread_channel_id
  FROM thread_messages tm
  JOIN threads t ON t.id = tm.thread_id
  WHERE tm.id = _message_id;
  
  IF msg_user_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  
  -- Author can always delete their own messages
  IF msg_user_id = _user_id THEN
    DELETE FROM thread_messages WHERE id = _message_id;
    RETURN true;
  END IF;
  
  -- Check if user has manage_messages permission (uses full permission hierarchy)
  IF public.check_user_permission(_user_id, thread_channel_id, 'manage_messages') THEN
    DELETE FROM thread_messages WHERE id = _message_id;
    RETURN true;
  END IF;
  
  RAISE EXCEPTION 'Permission denied';
END;
$$;


--
-- Name: delete_user_account(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_user_account(_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  owned_server RECORD;
  new_owner_id uuid;
  member_count integer;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Verify the user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Handle servers owned by this user
  FOR owned_server IN SELECT id FROM servers WHERE owner_id = _user_id LOOP
    -- Count other members in the server
    SELECT COUNT(*) INTO member_count 
    FROM server_members 
    WHERE server_id = owned_server.id AND user_id != _user_id AND is_banned = false;
    
    IF member_count = 0 THEN
      -- No other members, delete the entire server and related data
      DELETE FROM channel_permissions WHERE channel_id IN (SELECT id FROM channels WHERE server_id = owned_server.id);
      DELETE FROM channel_reads WHERE channel_id IN (SELECT id FROM channels WHERE server_id = owned_server.id);
      DELETE FROM reactions WHERE message_id IN (SELECT id FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = owned_server.id));
      DELETE FROM mentions WHERE message_id IN (SELECT id FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = owned_server.id));
      DELETE FROM message_attachments WHERE message_id IN (SELECT id FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = owned_server.id));
      DELETE FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = owned_server.id);
      DELETE FROM channels WHERE server_id = owned_server.id;
      DELETE FROM channel_categories WHERE server_id = owned_server.id;
      DELETE FROM role_permissions WHERE server_id = owned_server.id;
      DELETE FROM server_member_roles WHERE member_id IN (SELECT id FROM server_members WHERE server_id = owned_server.id);
      DELETE FROM server_members WHERE server_id = owned_server.id;
      DELETE FROM server_roles WHERE server_id = owned_server.id;
      DELETE FROM servers WHERE id = owned_server.id;
    ELSE
      -- Find a new owner: first try to find someone with transfer_ownership permission
      SELECT sm.user_id INTO new_owner_id
      FROM server_members sm
      WHERE sm.server_id = owned_server.id 
        AND sm.user_id != _user_id 
        AND sm.is_banned = false
        AND sm.role IN ('admin', 'owner')
      ORDER BY sm.joined_at ASC
      LIMIT 1;
      
      -- If no admin found, get the oldest member
      IF new_owner_id IS NULL THEN
        SELECT sm.user_id INTO new_owner_id
        FROM server_members sm
        WHERE sm.server_id = owned_server.id 
          AND sm.user_id != _user_id 
          AND sm.is_banned = false
        ORDER BY sm.joined_at ASC
        LIMIT 1;
      END IF;
      
      -- Transfer ownership
      IF new_owner_id IS NOT NULL THEN
        UPDATE servers SET owner_id = new_owner_id WHERE id = owned_server.id;
        UPDATE server_members SET role = 'owner' WHERE server_id = owned_server.id AND user_id = new_owner_id;
      END IF;
    END IF;
  END LOOP;

  -- Delete user's reactions (on regular messages)
  DELETE FROM reactions WHERE user_id = _user_id;
  
  -- Delete user's DM reactions
  DELETE FROM dm_reactions WHERE user_id = _user_id;
  
  -- Delete mentions of this user
  DELETE FROM mentions WHERE user_id = _user_id;
  
  -- Delete user's notifications
  DELETE FROM notifications WHERE user_id = _user_id;
  
  -- Delete user's channel reads
  DELETE FROM channel_reads WHERE user_id = _user_id;
  
  -- Delete message attachments for user's messages
  DELETE FROM message_attachments WHERE message_id IN (SELECT id FROM messages WHERE user_id = _user_id);
  
  -- Delete user's messages (set to deleted or actually delete)
  DELETE FROM messages WHERE user_id = _user_id;
  
  -- Delete DM attachments for user's DMs
  DELETE FROM dm_attachments WHERE message_id IN (SELECT id FROM direct_messages WHERE sender_id = _user_id);
  
  -- Delete user's direct messages
  DELETE FROM direct_messages WHERE sender_id = _user_id;
  
  -- Delete DM participants entries for this user
  DELETE FROM dm_participants WHERE user_id = _user_id;
  
  -- Clean up empty DM conversations (no participants left)
  DELETE FROM dm_conversations WHERE id NOT IN (SELECT DISTINCT conversation_id FROM dm_participants);
  
  -- Delete friendships involving this user
  DELETE FROM friendships WHERE requester_id = _user_id OR addressee_id = _user_id;
  
  -- Delete user's server member roles
  DELETE FROM server_member_roles WHERE member_id IN (SELECT id FROM server_members WHERE user_id = _user_id);
  
  -- Delete user from all servers (as member)
  DELETE FROM server_members WHERE user_id = _user_id;
  
  -- Delete user preferences
  DELETE FROM user_preferences WHERE user_id = _user_id;
  
  -- Finally delete the user
  DELETE FROM users WHERE id = _user_id;
  
  RETURN true;
END;
$$;


--
-- Name: edit_announcement_comment(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.edit_announcement_comment(_comment_id uuid, _user_id uuid, _content text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  comment_owner_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT user_id INTO comment_owner_id FROM announcement_comments WHERE id = _comment_id;
  IF comment_owner_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;
  IF comment_owner_id != _user_id THEN
    RAISE EXCEPTION 'Permission denied: you can only edit your own comments';
  END IF;
  UPDATE announcement_comments SET content = _content, edited_at = now() WHERE id = _comment_id;
  RETURN true;
END;
$$;


--
-- Name: edit_dm(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.edit_dm(_message_id uuid, _sender_id uuid, _content text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_sender_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  IF _content IS NULL OR trim(_content) = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;
  IF char_length(_content) > 2000 THEN
    RAISE EXCEPTION 'Message must be 2000 characters or less';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM direct_messages WHERE id = _message_id AND sender_id = _sender_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE direct_messages SET content = _content, edited_at = now() WHERE id = _message_id;

  SELECT json_build_object(
    'id', dm.id, 'conversation_id', dm.conversation_id, 'sender_id', dm.sender_id,
    'content', dm.content, 'reply_to_id', dm.reply_to_id,
    'created_at', dm.created_at, 'edited_at', dm.edited_at
  ) INTO result FROM direct_messages dm WHERE dm.id = _message_id;

  RETURN result;
END;
$$;


--
-- Name: edit_media_comment(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.edit_media_comment(_comment_id uuid, _user_id uuid, _content text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  comment_owner_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT user_id INTO comment_owner_id FROM media_comments WHERE id = _comment_id;
  IF comment_owner_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;
  IF comment_owner_id != _user_id THEN
    RAISE EXCEPTION 'Permission denied: you can only edit your own comments';
  END IF;
  UPDATE media_comments SET content = _content, edited_at = now() WHERE id = _comment_id;
  RETURN true;
END;
$$;


--
-- Name: edit_message(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.edit_message(_message_id uuid, _user_id uuid, _content text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  result json;
  msg_channel_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  IF _content IS NULL OR trim(_content) = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;
  IF char_length(_content) > 2000 THEN
    RAISE EXCEPTION 'Message must be 2000 characters or less';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM messages WHERE id = _message_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT m.channel_id INTO msg_channel_id FROM messages m WHERE m.id = _message_id;

  IF NOT public.check_user_permission(_user_id, msg_channel_id, 'send_messages') THEN
    RAISE EXCEPTION 'You do not have permission to send messages in this channel';
  END IF;
  
  UPDATE messages SET content = _content, edited_at = now() WHERE id = _message_id;
  
  SELECT json_build_object(
    'id', m.id, 'channel_id', m.channel_id, 'user_id', m.user_id,
    'content', m.content, 'reply_to_id', m.reply_to_id, 'is_pinned', m.is_pinned,
    'edited_at', m.edited_at, 'created_at', m.created_at
  ) INTO result FROM messages m WHERE m.id = _message_id;
  
  RETURN result;
END;
$$;


--
-- Name: enforce_friendship_pending_on_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_friendship_pending_on_insert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.status := 'pending'::friendship_status;
  RETURN NEW;
END;
$$;


--
-- Name: enforce_server_emoji_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_server_emoji_limit() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  emoji_count integer;
BEGIN
  SELECT COUNT(*) INTO emoji_count
  FROM public.server_emojis
  WHERE server_id = NEW.server_id;

  IF emoji_count >= 30 THEN
    RAISE EXCEPTION 'server emoji limit reached';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: fetch_key_backup(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fetch_key_backup(_user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
    result JSON;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
    SELECT json_build_object(
        'encrypted_identity_private_key', kb.encrypted_identity_private_key,
        'iv', kb.iv,
        'salt', kb.salt,
        'version', kb.version,
        'registration_id', ik.registration_id,
        'public_key', ik.public_key,
        'key_fingerprint', ik.key_fingerprint
    ) INTO result
    FROM user_key_backups kb
    JOIN user_identity_keys ik ON ik.user_id = kb.user_id
    WHERE kb.user_id = _user_id;

    RETURN result;
END;
$$;


--
-- Name: fetch_prekey_bundle(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fetch_prekey_bundle(_target_user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  result JSON;
  _prekey_id INTEGER;
  _prekey_public TEXT;
BEGIN
  IF public.requesting_user_id() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE user_prekeys
  SET is_used = TRUE
  WHERE id = (
    SELECT id FROM user_prekeys
    WHERE user_id = _target_user_id
      AND is_used = FALSE
    ORDER BY key_id ASC
    LIMIT 1
  )
  RETURNING key_id, public_key INTO _prekey_id, _prekey_public;

  SELECT json_build_object(
    'registration_id', ik.registration_id,
    'identity_public_key', ik.public_key,
    'signed_prekey_id', sp.key_id,
    'signed_prekey_public', sp.public_key,
    'signed_prekey_signature', sp.signature,
    'prekey_id', _prekey_id,
    'prekey_public', _prekey_public
  ) INTO result
  FROM user_identity_keys ik
  LEFT JOIN user_signed_prekeys sp
    ON sp.user_id = ik.user_id AND sp.is_active = TRUE
  WHERE ik.user_id = _target_user_id;

  RETURN result;
END;
$$;


--
-- Name: generate_invite_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invite_code() RETURNS character
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;


--
-- Name: get_all_channel_unread_counts(uuid, uuid[], uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_channel_unread_counts(_user_id uuid, _channel_ids uuid[], _blocked_user_ids uuid[] DEFAULT '{}'::uuid[]) RETURNS TABLE(channel_id uuid, unread_count bigint, mention_count integer, last_read_at timestamp with time zone, last_read_message_id uuid, first_unread_message_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  RETURN QUERY
  WITH channel_reads_data AS (
    SELECT 
      cr.channel_id,
      cr.last_read_at,
      cr.last_read_message_id,
      COALESCE(cr.mention_count, 0) AS mention_count
    FROM channel_reads cr
    WHERE cr.user_id = _user_id
      AND cr.channel_id = ANY(_channel_ids)
  ),
  unread_messages AS (
    SELECT 
      m.channel_id,
      m.id as message_id,
      m.created_at
    FROM messages m
    LEFT JOIN channel_reads_data crd ON crd.channel_id = m.channel_id
    WHERE m.channel_id = ANY(_channel_ids)
      AND m.user_id != _user_id
      AND (crd.last_read_at IS NULL OR m.created_at > crd.last_read_at)
      AND (array_length(_blocked_user_ids, 1) IS NULL 
           OR m.user_id != ALL(_blocked_user_ids))
  ),
  unread_counts AS (
    SELECT 
      um.channel_id,
      COUNT(*) AS unread_count
    FROM unread_messages um
    GROUP BY um.channel_id
  ),
  first_unread AS (
    SELECT DISTINCT ON (um.channel_id)
      um.channel_id,
      um.message_id
    FROM unread_messages um
    ORDER BY um.channel_id, um.created_at ASC
  )
  SELECT 
    c.id AS channel_id,
    COALESCE(uc.unread_count, 0)::BIGINT AS unread_count,
    COALESCE(crd.mention_count, 0)::INTEGER AS mention_count,
    crd.last_read_at,
    crd.last_read_message_id,
    fu.message_id AS first_unread_message_id
  FROM unnest(_channel_ids) AS c(id)
  LEFT JOIN channel_reads_data crd ON crd.channel_id = c.id
  LEFT JOIN unread_counts uc ON uc.channel_id = c.id
  LEFT JOIN first_unread fu ON fu.channel_id = c.id;
END;
$$;


--
-- Name: get_banned_members(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_banned_members(_server_id uuid, _user_id uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'ban_members') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  RETURN (
    SELECT json_agg(
      json_build_object(
        'id', sm.id,
        'user_id', sm.user_id,
        'joined_at', sm.joined_at,
        'user', json_build_object(
          'id', u.id,
          'username', u.username,
          'display_name', u.display_name,
          'avatar_url', u.avatar_url
        )
      )
    )
    FROM server_members sm
    JOIN users u ON u.id = sm.user_id
    WHERE sm.server_id = _server_id AND sm.is_banned = true
  );
END;
$$;


--
-- Name: get_blocked_user_ids_for_visibility(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_blocked_user_ids_for_visibility(_user_id uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(x.other_user_id)
      FROM (
        SELECT DISTINCT
          CASE
            WHEN f.requester_id = _user_id THEN f.addressee_id
            ELSE f.requester_id
          END AS other_user_id
        FROM public.friendships f
        WHERE f.status = 'blocked'
          AND (f.requester_id = _user_id OR f.addressee_id = _user_id)
      ) x
    ),
    '[]'::json
  );
END;
$$;


--
-- Name: get_blocked_users(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_blocked_users(_user_id uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN (
    SELECT json_agg(blocked)
    FROM (
      SELECT json_build_object(
        'id', f.id,
        'created_at', f.created_at,
        'user', (
          SELECT json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'banner_color', u.banner_color
          )
          FROM public.users u
          WHERE u.id = f.addressee_id
        )
      ) AS blocked
      FROM public.friendships f
      WHERE f.requester_id = _user_id
        AND f.status = 'blocked'
    ) sub
  );
END;
$$;


--
-- Name: get_channel_members(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_channel_members(_channel_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _caller uuid;
BEGIN
  _caller := public.requesting_user_id();
  IF _caller IS NULL OR NOT public.verify_request_identity(_caller) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.can_access_channel(_channel_id, _caller) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'id', cm.id,
          'channel_id', cm.channel_id,
          'user_id', cm.user_id,
          'added_by', cm.added_by,
          'created_at', cm.created_at,
          'user', json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'status', u.status
          )
        )
      ),
      '[]'::json
    )
    FROM public.channel_members cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.channel_id = _channel_id
  );
END;
$$;


--
-- Name: get_channel_messages(uuid, uuid, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_channel_messages(_channel_id uuid, _user_id uuid, _limit integer DEFAULT 50, _before_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  channel_server_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT server_id INTO channel_server_id FROM channels WHERE id = _channel_id;

  IF NOT EXISTS (
    SELECT 1 FROM server_members
    WHERE server_id = channel_server_id AND user_id = _user_id AND is_banned = false
  ) THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;

  RETURN (
    SELECT json_agg(msg ORDER BY msg.created_at DESC)
    FROM (
      SELECT json_build_object(
        'id', m.id,
        'channel_id', m.channel_id,
        'user_id', m.user_id,
        'content', m.content,
        'reply_to_id', m.reply_to_id,
        'is_pinned', m.is_pinned,
        'edited_at', m.edited_at,
        'created_at', m.created_at,
        'user', json_build_object(
          'id', u.id, 'username', u.username, 'display_name', u.display_name,
          'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status
        )
      ) as msg, m.created_at
      FROM messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.channel_id = _channel_id
        AND (_before_id IS NULL OR m.created_at < (SELECT created_at FROM messages WHERE id = _before_id))
        AND NOT EXISTS (
          SELECT 1
          FROM friendships f
          WHERE f.status = 'blocked'
            AND ((f.requester_id = _user_id AND f.addressee_id = m.user_id)
              OR (f.requester_id = m.user_id AND f.addressee_id = _user_id))
        )
      ORDER BY m.created_at DESC
      LIMIT _limit
    ) sub
  );
END;
$$;


--
-- Name: get_channel_messages_secure(uuid, uuid, integer, timestamp with time zone, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_channel_messages_secure(_channel_id uuid, _user_id uuid, _limit integer DEFAULT 50, _before timestamp with time zone DEFAULT NULL::timestamp with time zone, _blocked_user_ids uuid[] DEFAULT ARRAY[]::uuid[]) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.can_access_channel(_channel_id, _user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(t) ORDER BY t.created_at DESC)
      FROM (
        SELECT
          m.id,
          m.channel_id,
          m.user_id,
          m.content,
          m.reply_to_id,
          m.is_pinned,
          m.edited_at,
          m.created_at,
          row_to_json(u) AS "user",
          COALESCE(
            (
              SELECT json_agg(row_to_json(ma))
              FROM public.message_attachments ma
              WHERE ma.message_id = m.id
            ),
            '[]'::json
          ) AS attachments,
          COALESCE(
            (
              SELECT json_agg(row_to_json(r))
              FROM public.reactions r
              WHERE r.message_id = m.id
            ),
            '[]'::json
          ) AS reactions
        FROM public.messages m
        JOIN public.users u ON u.id = m.user_id
        WHERE m.channel_id = _channel_id
          AND (_before IS NULL OR m.created_at < _before)
          AND (
            COALESCE(array_length(_blocked_user_ids, 1), 0) = 0
            OR NOT (m.user_id = ANY(_blocked_user_ids))
          )
        ORDER BY m.created_at DESC
        LIMIT _limit
      ) t
    ),
    '[]'::json
  );
END;
$$;


--
-- Name: get_channel_permissions(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_channel_permissions(_channel_id uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', cp.id,
          'channel_id', cp.channel_id,
          'role_id', cp.role_id,
          'role_name', cp.role_name,
          'user_id', cp.user_id,
          'permission', cp.permission,
          'allowed', cp.allowed,
          'created_at', cp.created_at
        ) ORDER BY cp.created_at ASC
      )
      FROM channel_permissions cp
      WHERE cp.channel_id = _channel_id
    ),
    '[]'::json
  );
END;
$$;


--
-- Name: get_channel_server_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_channel_server_id(_channel_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT server_id FROM channels WHERE id = _channel_id
$$;


--
-- Name: get_channel_tasks(uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_channel_tasks(_channel_id uuid, _user_id uuid, _status_filter text DEFAULT NULL::text, _sort_by text DEFAULT 'position'::text, _sort_order text DEFAULT 'asc'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
    result jsonb;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
    WITH task_data AS (
        SELECT 
            t.id,
            t.channel_id,
            t.server_id,
            t.created_by,
            t.title,
            t.description,
            t.priority::text AS priority,
            t.status::text AS status,
            t.due_date,
            t.task_position AS position,
            t.completed_by,
            t.completed_at,
            t.created_at,
            t.updated_at,
            jsonb_build_object(
                'id', creator.id,
                'username', creator.username,
                'display_name', creator.display_name,
                'avatar_url', creator.avatar_url,
                'banner_color', creator.banner_color
            ) AS creator,
            CASE WHEN t.completed_by IS NOT NULL THEN
                jsonb_build_object(
                    'id', completer.id,
                    'username', completer.username,
                    'display_name', completer.display_name,
                    'avatar_url', completer.avatar_url,
                    'banner_color', completer.banner_color
                )
            ELSE NULL END AS completer,
            COALESCE(
                (SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', ta.id,
                        'task_id', ta.task_id,
                        'user_id', ta.user_id,
                        'assigned_by', ta.assigned_by,
                        'assigned_at', ta.assigned_at,
                        'user', jsonb_build_object(
                            'id', au.id,
                            'username', au.username,
                            'display_name', au.display_name,
                            'avatar_url', au.avatar_url,
                            'banner_color', au.banner_color
                        )
                    )
                ) FROM task_assignees ta
                JOIN users au ON au.id = ta.user_id
                WHERE ta.task_id = t.id),
                '[]'::jsonb
            ) AS assignees
        FROM tasks t
        JOIN users creator ON creator.id = t.created_by
        LEFT JOIN users completer ON completer.id = t.completed_by
        WHERE t.channel_id = _channel_id
            AND (_status_filter IS NULL OR t.status::text = _status_filter)
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', td.id,
            'channel_id', td.channel_id,
            'server_id', td.server_id,
            'created_by', td.created_by,
            'title', td.title,
            'description', td.description,
            'priority', td.priority,
            'status', td.status,
            'due_date', td.due_date,
            'position', td.position,
            'completed_by', td.completed_by,
            'completed_at', td.completed_at,
            'created_at', td.created_at,
            'updated_at', td.updated_at,
            'creator', td.creator,
            'completer', td.completer,
            'assignees', td.assignees
        )
        ORDER BY 
            CASE WHEN _sort_order = 'asc' THEN
                CASE _sort_by 
                    WHEN 'position' THEN td.position::text
                    WHEN 'created_at' THEN td.created_at::text
                    WHEN 'due_date' THEN COALESCE(td.due_date::text, '9999-12-31')
                    ELSE td.position::text
                END
            END ASC,
            CASE WHEN _sort_order = 'desc' THEN
                CASE _sort_by 
                    WHEN 'position' THEN td.position::text
                    WHEN 'created_at' THEN td.created_at::text
                    WHEN 'due_date' THEN COALESCE(td.due_date::text, '9999-12-31')
                    ELSE td.position::text
                END
            END DESC
    )
    INTO result
    FROM task_data td;
    
    RETURN COALESCE(result, '[]'::jsonb);
END;
$$;


--
-- Name: get_deletion_preview(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_deletion_preview(_user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  result json;
  owned_servers_count integer;
  servers_to_transfer json;
  servers_to_delete json;
  message_count integer;
  dm_count integer;
  reaction_count integer;
  friendship_count integer;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Verify the user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Count messages in server channels
  SELECT COUNT(*) INTO message_count FROM messages WHERE user_id = _user_id;
  
  -- Count direct messages
  SELECT COUNT(*) INTO dm_count FROM direct_messages WHERE sender_id = _user_id;
  
  -- Count reactions
  SELECT COUNT(*) INTO reaction_count FROM reactions WHERE user_id = _user_id;
  SELECT reaction_count + COUNT(*) INTO reaction_count FROM dm_reactions WHERE user_id = _user_id;
  
  -- Count friendships
  SELECT COUNT(*) INTO friendship_count FROM friendships 
  WHERE (requester_id = _user_id OR addressee_id = _user_id) AND status = 'accepted';

  -- Get servers to transfer (owned servers with other members)
  SELECT json_agg(json_build_object(
    'id', s.id,
    'name', s.name,
    'member_count', (SELECT COUNT(*) FROM server_members sm WHERE sm.server_id = s.id AND sm.user_id != _user_id AND sm.is_banned = false),
    'new_owner', (
      SELECT json_build_object('id', u.id, 'username', u.username)
      FROM server_members sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.server_id = s.id 
        AND sm.user_id != _user_id 
        AND sm.is_banned = false
        AND sm.role IN ('admin', 'owner')
      ORDER BY sm.joined_at ASC
      LIMIT 1
    )
  ))
  INTO servers_to_transfer
  FROM servers s
  WHERE s.owner_id = _user_id
    AND EXISTS (
      SELECT 1 FROM server_members sm 
      WHERE sm.server_id = s.id AND sm.user_id != _user_id AND sm.is_banned = false
    );

  -- Get servers to delete (owned servers with no other members)
  SELECT json_agg(json_build_object(
    'id', s.id,
    'name', s.name
  ))
  INTO servers_to_delete
  FROM servers s
  WHERE s.owner_id = _user_id
    AND NOT EXISTS (
      SELECT 1 FROM server_members sm 
      WHERE sm.server_id = s.id AND sm.user_id != _user_id AND sm.is_banned = false
    );

  -- Build the result
  SELECT json_build_object(
    'message_count', message_count,
    'dm_count', dm_count,
    'reaction_count', reaction_count,
    'friendship_count', friendship_count,
    'servers_to_transfer', COALESCE(servers_to_transfer, '[]'::json),
    'servers_to_delete', COALESCE(servers_to_delete, '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;


--
-- Name: get_dm_conversation_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dm_conversation_id(_message_id uuid) RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _caller uuid;
  _conversation_id uuid;
BEGIN
  _caller := public.requesting_user_id();
  IF _caller IS NULL OR NOT public.verify_request_identity(_caller) THEN
    RETURN NULL;
  END IF;

  SELECT dm.conversation_id
    INTO _conversation_id
  FROM public.direct_messages dm
  WHERE dm.id = _message_id
    AND EXISTS (
      SELECT 1
      FROM public.dm_participants dp
      WHERE dp.conversation_id = dm.conversation_id
        AND dp.user_id = _caller
    )
  LIMIT 1;

  RETURN _conversation_id;
END;
$$;


--
-- Name: get_dm_message_conversation_secure(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dm_message_conversation_secure(_message_id uuid, _user_id uuid) RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _conversation_id uuid;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT dm.conversation_id
    INTO _conversation_id
  FROM public.direct_messages dm
  WHERE dm.id = _message_id
    AND EXISTS (
      SELECT 1
      FROM public.dm_participants dp
      WHERE dp.conversation_id = dm.conversation_id
        AND dp.user_id = _user_id
    )
  LIMIT 1;

  RETURN _conversation_id;
END;
$$;


--
-- Name: get_dm_messages(uuid, uuid, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dm_messages(_conversation_id uuid, _user_id uuid, _limit integer DEFAULT 50, _before_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.dm_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;

  RETURN (
    SELECT json_agg(msg ORDER BY created_at DESC)
    FROM (
      SELECT json_build_object(
        'id', dm.id,
        'conversation_id', dm.conversation_id,
        'sender_id', dm.sender_id,
        'content', dm.content,
        'reply_to_id', dm.reply_to_id,
        'edited_at', dm.edited_at,
        'created_at', dm.created_at,
        'sender', json_build_object(
          'id', u.id, 'username', u.username, 'display_name', u.display_name,
          'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status
        )
      ) as msg, dm.created_at
      FROM public.direct_messages dm
      JOIN public.users u ON u.id = dm.sender_id
      WHERE dm.conversation_id = _conversation_id
        AND (_before_id IS NULL OR dm.created_at < (SELECT created_at FROM public.direct_messages WHERE id = _before_id))
        AND NOT EXISTS (
          SELECT 1
          FROM public.friendships f
          WHERE f.status = 'blocked'
            AND ((f.requester_id = _user_id AND f.addressee_id = dm.sender_id)
              OR (f.requester_id = dm.sender_id AND f.addressee_id = _user_id))
        )
      ORDER BY dm.created_at DESC
      LIMIT _limit
    ) sub
  );
END;
$$;


--
-- Name: get_dm_messages_by_ids_secure(uuid[], uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dm_messages_by_ids_secure(_message_ids uuid[], _user_id uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT
          dm.id,
          dm.conversation_id,
          dm.sender_id,
          dm.content,
          dm.created_at,
          json_build_object('username', u.username) AS sender
        FROM public.direct_messages dm
        JOIN public.users u ON u.id = dm.sender_id
        WHERE dm.id = ANY(_message_ids)
          AND EXISTS (
            SELECT 1
            FROM public.dm_participants dp
            WHERE dp.conversation_id = dm.conversation_id
              AND dp.user_id = _user_id
          )
      ) t
    ),
    '[]'::json
  );
END;
$$;


--
-- Name: get_dm_other_participant(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dm_other_participant(_conversation_id uuid, _user_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT dp.user_id
  FROM public.dm_participants dp
  WHERE dp.conversation_id = _conversation_id
    AND dp.user_id <> _user_id
    AND EXISTS (
      SELECT 1
      FROM public.dm_participants self_dp
      WHERE self_dp.conversation_id = _conversation_id
        AND self_dp.user_id = _user_id
    )
    AND (
      public.requesting_user_id() IS NULL
      OR _user_id = public.requesting_user_id()
    )
  LIMIT 1
$$;


--
-- Name: get_dm_unread_counts(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dm_unread_counts(_user_id uuid) RETURNS TABLE(conversation_id uuid, unread_count bigint, last_read_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- GUARD: Maintenance Mode (Return empty table instead of error to prevent frontend crashes)
  IF is_maintenance_active() THEN
    RETURN;
  END IF;

  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN QUERY
  SELECT 
    dp.conversation_id,
    COALESCE(COUNT(dm.id) FILTER (
      WHERE dm.sender_id != _user_id 
      AND (dp.last_read_at IS NULL OR dm.created_at > dp.last_read_at)
    ), 0) as unread_count,
    dp.last_read_at
  FROM dm_participants dp
  LEFT JOIN direct_messages dm ON dm.conversation_id = dp.conversation_id
  WHERE dp.user_id = _user_id
  GROUP BY dp.conversation_id, dp.last_read_at;
END;
$$;


--
-- Name: get_explore_servers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_explore_servers() RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT COALESCE(
    json_agg(row_to_json(t) ORDER BY t.member_count DESC NULLS LAST, t.created_at DESC NULLS LAST),
    '[]'::json
  )
  FROM (
    SELECT
      s.id,
      s.name,
      s.icon_url,
      s.banner_url,
      s.owner_id,
      s.created_at,
      s.is_published,
      s.about,
      (cnt.c::bigint) AS member_count
    FROM public.servers s
    LEFT JOIN (
      SELECT server_id, count(*) AS c
      FROM public.server_members
      WHERE is_banned IS NOT TRUE
      GROUP BY server_id
    ) cnt ON cnt.server_id = s.id
    WHERE s.is_published = true
  ) t;
$$;


--
-- Name: FUNCTION get_explore_servers(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_explore_servers() IS 'Explore page: published servers with member count in one query (avoids N LATERAL joins)';


--
-- Name: get_friend_dashboard(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_friend_dashboard(_user_id uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _friends json;
  _pending json;
  _outgoing json;
  _blocked json;
  _visibility_blocked json;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  -- Friends (accepted)
  SELECT json_agg(friend) INTO _friends
  FROM (
    SELECT json_build_object(
      'id', f.id,
      'status', f.status,
      'created_at', f.created_at,
      'user', CASE
        WHEN f.requester_id = _user_id THEN (SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status, 'custom_status', u.custom_status) FROM users u WHERE u.id = f.addressee_id)
        ELSE (SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status, 'custom_status', u.custom_status) FROM users u WHERE u.id = f.requester_id)
      END
    ) AS friend
    FROM friendships f
    WHERE (f.requester_id = _user_id OR f.addressee_id = _user_id) AND f.status = 'accepted'
  ) sub;

  -- Pending (incoming)
  SELECT json_agg(request) INTO _pending
  FROM (
    SELECT json_build_object(
      'id', f.id,
      'status', f.status,
      'created_at', f.created_at,
      'user', (SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status) FROM users u WHERE u.id = f.requester_id)
    ) AS request
    FROM friendships f
    WHERE f.addressee_id = _user_id AND f.status = 'pending'
    ORDER BY f.created_at DESC
  ) sub;

  -- Outgoing
  SELECT json_agg(request) INTO _outgoing
  FROM (
    SELECT json_build_object(
      'id', f.id,
      'status', f.status,
      'created_at', f.created_at,
      'user', (SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status) FROM users u WHERE u.id = f.addressee_id)
    ) AS request
    FROM friendships f
    WHERE f.requester_id = _user_id AND f.status = 'pending'
    ORDER BY f.created_at DESC
  ) sub;

  -- Blocked
  SELECT json_agg(blocked) INTO _blocked
  FROM (
    SELECT json_build_object(
      'id', f.id,
      'created_at', f.created_at,
      'user', (SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color) FROM users u WHERE u.id = f.addressee_id)
    ) AS blocked
    FROM friendships f
    WHERE f.requester_id = _user_id AND f.status = 'blocked'
  ) sub;

  -- Visibility blocked IDs
  SELECT COALESCE(json_agg(x.other_user_id), '[]'::json) INTO _visibility_blocked
  FROM (
    SELECT DISTINCT CASE WHEN f.requester_id = _user_id THEN f.addressee_id ELSE f.requester_id END AS other_user_id
    FROM friendships f
    WHERE f.status = 'blocked' AND (f.requester_id = _user_id OR f.addressee_id = _user_id)
  ) x;

  RETURN json_build_object(
    'friends', COALESCE(_friends, '[]'::json),
    'pending_requests', COALESCE(_pending, '[]'::json),
    'outgoing_requests', COALESCE(_outgoing, '[]'::json),
    'blocked_users', COALESCE(_blocked, '[]'::json),
    'visibility_blocked_user_ids', COALESCE(_visibility_blocked, '[]'::json)
  );
END;
$$;


--
-- Name: FUNCTION get_friend_dashboard(_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_friend_dashboard(_user_id uuid) IS 'Single RPC for all friend data (replaces 5 separate RPCs per app load)';


--
-- Name: get_invite_details_by_code(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_invite_details_by_code(_invite_code text) RETURNS TABLE(id uuid, name character varying, icon_url text, banner_url text, about text, invite_code character, inviter_username text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _client_id text;
  _clean_code text;
BEGIN
  _clean_code := upper(trim(_invite_code));
  IF _clean_code IS NULL OR _clean_code = '' THEN
    RETURN;
  END IF;

  _client_id := public.request_client_identifier();
  IF _client_id <> 'unknown'
     AND NOT public.check_rate_limit(_client_id, 'invite_lookup', 60, 60) THEN
    RAISE EXCEPTION 'Rate limited: too many invite lookups';
  END IF;

  RETURN QUERY
  WITH clean AS (
    SELECT _clean_code as code
  )
  SELECT
    s.id,
    s.name,
    s.icon_url,
    s.banner_url,
    s.about,
    s.invite_code,
    ou.username as inviter_username
  FROM public.servers s
  JOIN clean ON true
  JOIN public.users ou ON ou.id = s.owner_id
  WHERE trim(s.invite_code::text) = clean.code

  UNION ALL

  SELECT
    s.id,
    s.name,
    s.icon_url,
    s.banner_url,
    s.about,
    (clean.code)::char(8) as invite_code,
    cu.username as inviter_username
  FROM public.server_invites si
  JOIN clean ON true
  JOIN public.servers s ON s.id = si.server_id
  JOIN public.users cu ON cu.id = si.created_by
  WHERE si.revoked_at IS NULL
    AND (si.expires_at IS NULL OR si.expires_at > now())
    AND (si.max_uses IS NULL OR si.uses_count < si.max_uses)
    AND trim(si.code::text) = clean.code
  LIMIT 1;
END;
$$;


--
-- Name: get_maintenance_mode(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_maintenance_mode() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT COALESCE((value->>'enabled')::boolean, false) FROM public.app_config WHERE key = 'maintenance_mode';
$$;


--
-- Name: get_message_replies_secure(uuid[], uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_message_replies_secure(_message_ids uuid[], _user_id uuid, _blocked_user_ids uuid[] DEFAULT ARRAY[]::uuid[]) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT
          m.id,
          m.content,
          row_to_json(u) AS "user"
        FROM public.messages m
        JOIN public.users u ON u.id = m.user_id
        WHERE m.id = ANY(_message_ids)
          AND public.can_access_channel(m.channel_id, _user_id)
          AND (
            COALESCE(array_length(_blocked_user_ids, 1), 0) = 0
            OR NOT (m.user_id = ANY(_blocked_user_ids))
          )
      ) t
    ),
    '[]'::json
  );
END;
$$;


--
-- Name: get_messages_by_ids_secure(uuid[], uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_messages_by_ids_secure(_message_ids uuid[], _user_id uuid, _blocked_user_ids uuid[] DEFAULT ARRAY[]::uuid[]) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT
          m.id,
          m.channel_id,
          m.user_id,
          m.content,
          m.reply_to_id,
          m.is_pinned,
          m.edited_at,
          m.created_at,
          row_to_json(u) AS "user",
          COALESCE(
            (
              SELECT json_agg(row_to_json(ma))
              FROM public.message_attachments ma
              WHERE ma.message_id = m.id
            ),
            '[]'::json
          ) AS attachments,
          COALESCE(
            (
              SELECT json_agg(row_to_json(r))
              FROM public.reactions r
              WHERE r.message_id = m.id
            ),
            '[]'::json
          ) AS reactions
        FROM public.messages m
        JOIN public.users u ON u.id = m.user_id
        WHERE m.id = ANY(_message_ids)
          AND public.can_access_channel(m.channel_id, _user_id)
          AND (
            COALESCE(array_length(_blocked_user_ids, 1), 0) = 0
            OR NOT (m.user_id = ANY(_blocked_user_ids))
          )
      ) t
    ),
    '[]'::json
  );
END;
$$;


--
-- Name: get_outgoing_friend_requests(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_outgoing_friend_requests(_user_id uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN (
    SELECT json_agg(request)
    FROM (
      SELECT json_build_object(
        'id', f.id,
        'status', f.status,
        'created_at', f.created_at,
        'user', (
          SELECT json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'banner_color', u.banner_color,
            'status', u.status
          )
          FROM public.users u
          WHERE u.id = f.addressee_id
        )
      ) AS request
      FROM public.friendships f
      WHERE f.requester_id = _user_id
        AND f.status = 'pending'
      ORDER BY f.created_at DESC
    ) sub
  );
END;
$$;


--
-- Name: get_pending_friend_requests(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_pending_friend_requests(_user_id uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN (
    SELECT json_agg(request)
    FROM (
      SELECT json_build_object(
        'id', f.id,
        'status', f.status,
        'created_at', f.created_at,
        'user', (
          SELECT json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'banner_color', u.banner_color,
            'status', u.status
          )
          FROM public.users u
          WHERE u.id = f.requester_id
        )
      ) AS request
      FROM public.friendships f
      WHERE f.addressee_id = _user_id
        AND f.status = 'pending'
      ORDER BY f.created_at DESC
    ) sub
  );
END;
$$;


--
-- Name: get_pinned_messages_secure(uuid, uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_pinned_messages_secure(_channel_id uuid, _user_id uuid, _blocked_user_ids uuid[] DEFAULT ARRAY[]::uuid[]) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.can_access_channel(_channel_id, _user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(t) ORDER BY t.created_at DESC)
      FROM (
        SELECT
          m.id,
          m.channel_id,
          m.user_id,
          m.content,
          m.reply_to_id,
          m.is_pinned,
          m.edited_at,
          m.created_at,
          row_to_json(u) AS "user",
          COALESCE(
            (
              SELECT json_agg(row_to_json(ma))
              FROM public.message_attachments ma
              WHERE ma.message_id = m.id
            ),
            '[]'::json
          ) AS attachments
        FROM public.messages m
        JOIN public.users u ON u.id = m.user_id
        WHERE m.channel_id = _channel_id
          AND m.is_pinned = true
          AND (
            COALESCE(array_length(_blocked_user_ids, 1), 0) = 0
            OR NOT (m.user_id = ANY(_blocked_user_ids))
          )
        ORDER BY m.created_at DESC
      ) t
    ),
    '[]'::json
  );
END;
$$;


--
-- Name: get_request_user_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_request_user_id() RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _key_hash text;
  _user_id uuid;
BEGIN
  _key_hash := current_setting('request.headers', true)::json->>'x-key-hash';
  IF _key_hash IS NULL OR _key_hash = '' THEN
    RETURN NULL;
  END IF;
  SELECT ua.user_id INTO _user_id FROM user_auth ua WHERE ua.key_hash = _key_hash LIMIT 1;
  RETURN _user_id;
END;
$$;


--
-- Name: get_role_permissions(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_role_permissions(_server_id uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', rp.id,
          'server_id', rp.server_id,
          'role_id', rp.role_id,
          'role_name', rp.role_name,
          'permission', rp.permission,
          'allowed', rp.allowed,
          'created_at', rp.created_at
        ) ORDER BY rp.created_at ASC
      )
      FROM role_permissions rp
      WHERE rp.server_id = _server_id
    ),
    '[]'::json
  );
END;
$$;


--
-- Name: get_server_by_invite_code(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_server_by_invite_code(_invite_code text) RETURNS TABLE(id uuid, name character varying, icon_url text, invite_code character)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  WITH clean AS (
    SELECT upper(trim(_invite_code)) as code
  )
  SELECT s.id, s.name, s.icon_url, s.invite_code
  FROM public.servers s
  JOIN clean ON true
  WHERE trim(s.invite_code::text) = clean.code

  UNION ALL

  SELECT s.id, s.name, s.icon_url, (clean.code)::char(8)
  FROM public.server_invites si
  JOIN clean ON true
  JOIN public.servers s ON s.id = si.server_id
  WHERE si.revoked_at IS NULL
    AND (si.expires_at IS NULL OR si.expires_at > now())
    AND (si.max_uses IS NULL OR si.uses_count < si.max_uses)
    AND trim(si.code::text) = clean.code
  LIMIT 1;
$$;


--
-- Name: get_server_categories(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_server_categories(_server_id uuid, _user_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _is_member boolean := false;
BEGIN
  -- Identity verification (conditional for optional user_id)
  IF _user_id IS NOT NULL AND NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- If user_id provided, verify they are a non-banned member
  IF _user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM server_members 
      WHERE server_id = _server_id 
      AND user_id = _user_id 
      AND is_banned = false
    ) INTO _is_member;

    IF NOT _is_member THEN
      RETURN '[]'::json;
    END IF;
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', cc.id,
        'server_id', cc.server_id,
        'name', cc.name,
        'position', cc.position,
        'is_collapsed', cc.is_collapsed,
        'created_at', cc.created_at
      ) ORDER BY cc.position
    ), '[]'::json)
    FROM channel_categories cc
    WHERE cc.server_id = _server_id
  );
END;
$$;


--
-- Name: get_server_channels(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_server_channels(_server_id uuid, _user_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _is_admin boolean := false;
  _is_member boolean := false;
BEGIN
  -- Identity verification (conditional for optional user_id)
  IF _user_id IS NOT NULL AND NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- If user_id provided, verify they are a non-banned member
  IF _user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM server_members 
      WHERE server_id = _server_id 
      AND user_id = _user_id 
      AND is_banned = false
    ) INTO _is_member;

    -- If not a non-banned member, return empty array
    IF NOT _is_member THEN
      RETURN '[]'::json;
    END IF;

    -- Check if admin/owner
    SELECT EXISTS (
      SELECT 1 FROM server_members 
      WHERE server_id = _server_id 
      AND user_id = _user_id 
      AND role IN ('owner', 'admin')
    ) INTO _is_admin;
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', c.id,
        'server_id', c.server_id,
        'category_id', c.category_id,
        'name', c.name,
        'topic', c.topic,
        'type', c.type,
        'position', c.position,
        'is_nsfw', c.is_nsfw,
        'slowmode_seconds', c.slowmode_seconds,
        'is_read_only', c.is_read_only,
        'icon', c.icon,
        'is_private', c.is_private,
        'block_links', c.block_links,
        'allowed_link_domains', c.allowed_link_domains,
        'ghost_mode', c.ghost_mode,
        'created_at', c.created_at
      ) ORDER BY c.position
    ), '[]'::json)
    FROM channels c
    WHERE c.server_id = _server_id
    AND (
      NOT c.is_private
      OR _is_admin
      OR (_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM channel_members cm 
        WHERE cm.channel_id = c.id AND cm.user_id = _user_id
      ))
    )
  );
END;
$$;


--
-- Name: get_server_members(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_server_members(_server_id uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _caller uuid;
BEGIN
  _caller := public.requesting_user_id();
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_server_member(_server_id, _caller) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', sm.id,
          'server_id', sm.server_id,
          'user_id', sm.user_id,
          'role', sm.role,
          'nickname', sm.nickname,
          'is_banned', sm.is_banned,
          'is_muted', sm.is_muted,
          'joined_at', sm.joined_at,
          'join_source', sm.join_source,
          'join_invite_code', sm.join_invite_code,
          'user', json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'banner_url', u.banner_url,
            'avatar_decoration', u.avatar_decoration,
            'profile_effect', u.profile_effect,
            'banner_color', u.banner_color,
            'profile_theme_primary', u.profile_theme_primary,
            'profile_theme_accent', u.profile_theme_accent,
            'bio', u.bio,
            'status', u.status,
            'custom_status', u.custom_status,
            'created_at', u.created_at,
            'last_seen', u.last_seen
          ),
          'roles', COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', sr.id,
                  'name', sr.name,
                  'color', sr.color,
                  'position', sr.position
                ) ORDER BY sr.position ASC
              )
              FROM public.server_member_roles smr
              JOIN public.server_roles sr ON sr.id = smr.role_id
              WHERE smr.member_id = sm.id
            ),
            '[]'::json
          )
        )
      )
      FROM public.server_members sm
      JOIN public.users u ON u.id = sm.user_id
      WHERE sm.server_id = _server_id
    ),
    '[]'::json
  );
END;
$$;


--
-- Name: get_server_recent_announcements_secure(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_server_recent_announcements_secure(_server_id uuid, _user_id uuid, _limit integer DEFAULT 5) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.is_server_member(_server_id, _user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(t) ORDER BY t.created_at DESC)
      FROM (
        SELECT
          m.id,
          m.content,
          m.created_at,
          m.channel_id,
          c.name AS channel_name,
          row_to_json(u) AS "user"
        FROM public.messages m
        JOIN public.channels c ON c.id = m.channel_id
        JOIN public.users u ON u.id = m.user_id
        WHERE c.server_id = _server_id
          AND c.type = 'announcement'
        ORDER BY m.created_at DESC
        LIMIT _limit
      ) t
    ),
    '[]'::json
  );
END;
$$;


--
-- Name: get_server_roles(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_server_roles(_server_id uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', sr.id,
          'server_id', sr.server_id,
          'name', sr.name,
          'color', sr.color,
          'position', sr.position,
          'created_at', sr.created_at
        ) ORDER BY sr.position ASC, sr.created_at ASC
      )
      FROM server_roles sr
      WHERE sr.server_id = _server_id
    ),
    '[]'::json
  );
END;
$$;


--
-- Name: get_server_roles_secure(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_server_roles_secure(_server_id uuid, _user_id uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.is_server_member(_server_id, _user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(t) ORDER BY t.position ASC)
      FROM (
        SELECT id, server_id, name, color, icon, position, created_at
        FROM public.server_roles
        WHERE server_id = _server_id
      ) t
    ),
    '[]'::json
  );
END;
$$;


--
-- Name: get_shared_server_ids_secure(uuid, uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_shared_server_ids_secure(_target_user_id uuid, _requesting_user_id uuid, _server_ids uuid[]) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_requesting_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(sm.server_id)
      FROM public.server_members sm
      WHERE sm.user_id = _target_user_id
        AND sm.server_id = ANY(_server_ids)
        AND COALESCE(sm.is_banned, false) = false
    ),
    '[]'::json
  );
END;
$$;


--
-- Name: get_task_comments(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_task_comments(_task_id uuid, _user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  task_channel_id uuid;
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get task channel
  SELECT channel_id INTO task_channel_id
  FROM tasks
  WHERE id = _task_id;
  
  IF task_channel_id IS NULL THEN
    RETURN json_build_object('error', 'Task not found');
  END IF;
  
  -- Check permission: view_tasks
  IF NOT check_user_permission(_user_id, task_channel_id, 'view_tasks'::permission_type) THEN
    RETURN json_build_object('error', 'Permission denied: view_tasks');
  END IF;
  
  -- Get top-level comments (no reply_to_id) with their replies
  SELECT json_agg(
    json_build_object(
      'id', tc.id,
      'task_id', tc.task_id,
      'user_id', tc.user_id,
      'content', tc.content,
      'created_at', tc.created_at,
      'edited_at', tc.edited_at,
      'reply_to_id', tc.reply_to_id,
      'replies', (
        SELECT json_agg(
          json_build_object(
            'id', r.id,
            'task_id', r.task_id,
            'user_id', r.user_id,
            'content', r.content,
            'created_at', r.created_at,
            'edited_at', r.edited_at,
            'reply_to_id', r.reply_to_id
          )
          ORDER BY r.created_at ASC
        )
        FROM task_comments r
        WHERE r.reply_to_id = tc.id
      )
    )
    ORDER BY tc.created_at ASC
  ) INTO result
  FROM task_comments tc
  WHERE tc.task_id = _task_id AND tc.reply_to_id IS NULL;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;


--
-- Name: get_thread_by_message_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_thread_by_message_id(_message_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  result json;
BEGIN
  SELECT row_to_json(t) INTO result
  FROM threads t
  WHERE t.message_id = _message_id;

  RETURN result;
END;
$$;


--
-- Name: get_thread_info(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_thread_info(_message_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'id', t.id,
    'channel_id', t.channel_id,
    'message_id', t.message_id,
    'created_by', t.created_by,
    'created_at', t.created_at,
    'message_count', (
      SELECT COUNT(*)
      FROM thread_messages
      WHERE thread_id = t.id
    )
  ) INTO result
  FROM threads t
  WHERE t.message_id = _message_id;

  RETURN result;
END;
$$;


--
-- Name: get_thread_message_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_thread_message_count(_message_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  thread_id_val uuid;
  message_count integer;
BEGIN
  -- Get thread ID from message
  SELECT id INTO thread_id_val
  FROM threads
  WHERE message_id = _message_id;

  IF thread_id_val IS NULL THEN
    RETURN 0;
  END IF;

  -- Count messages in thread
  SELECT COUNT(*) INTO message_count
  FROM thread_messages
  WHERE thread_id = thread_id_val;

  RETURN message_count;
END;
$$;


--
-- Name: get_thread_messages(uuid, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_thread_messages(_thread_id uuid, _limit integer DEFAULT 50, _before text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _caller uuid;
  _channel_id uuid;
  result json;
BEGIN
  _caller := public.requesting_user_id();
  IF _caller IS NULL OR NOT public.verify_request_identity(_caller) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT t.channel_id
    INTO _channel_id
  FROM public.threads t
  WHERE t.id = _thread_id;

  IF _channel_id IS NULL THEN
    RETURN '[]'::json;
  END IF;

  IF NOT public.can_access_channel(_channel_id, _caller) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  WITH ordered_messages AS (
    SELECT tm.*
    FROM public.thread_messages tm
    WHERE tm.thread_id = _thread_id
      AND (_before IS NULL OR tm.created_at < _before::timestamptz)
    ORDER BY tm.created_at DESC
    LIMIT _limit
  )
  SELECT json_agg(
    json_build_object(
      'id', om.id,
      'thread_id', om.thread_id,
      'user_id', om.user_id,
      'content', om.content,
      'reply_to_id', om.reply_to_id,
      'edited_at', om.edited_at,
      'created_at', om.created_at,
      'user', (
        SELECT json_build_object(
          'id', u.id,
          'username', u.username,
          'display_name', u.display_name,
          'avatar_url', u.avatar_url,
          'avatar_decoration', u.avatar_decoration,
          'profile_effect', u.profile_effect,
          'banner_color', u.banner_color,
          'banner_url', u.banner_url,
          'profile_theme_primary', u.profile_theme_primary,
          'profile_theme_accent', u.profile_theme_accent,
          'bio', u.bio,
          'status', u.status,
          'custom_status', u.custom_status
        )
        FROM public.users u
        WHERE u.id = om.user_id
      ),
      'reply_to', CASE
        WHEN om.reply_to_id IS NOT NULL THEN (
          SELECT json_build_object(
            'id', rt.id,
            'user_id', rt.user_id,
            'content', rt.content,
            'created_at', rt.created_at,
            'user', (
              SELECT json_build_object(
                'id', ru.id,
                'username', ru.username,
                'display_name', ru.display_name,
                'avatar_url', ru.avatar_url
              )
              FROM public.users ru
              WHERE ru.id = rt.user_id
            )
          )
          FROM public.thread_messages rt
          WHERE rt.id = om.reply_to_id
        )
        ELSE NULL
      END
    )
    ORDER BY om.created_at ASC
  )
  INTO result
  FROM ordered_messages om;

  RETURN COALESCE(result, '[]'::json);
END;
$$;


--
-- Name: get_thread_summaries(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_thread_summaries(_thread_ids uuid[]) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _caller uuid;
  result json;
BEGIN
  _caller := public.requesting_user_id();
  IF _caller IS NULL OR NOT public.verify_request_identity(_caller) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF _thread_ids IS NULL OR array_length(_thread_ids, 1) IS NULL THEN
    RETURN '[]'::json;
  END IF;

  WITH input AS (
    SELECT DISTINCT unnest(_thread_ids) AS thread_id
  ),
  visible_threads AS (
    SELECT i.thread_id, t.channel_id, t.created_at
    FROM input i
    JOIN public.threads t ON t.id = i.thread_id
    WHERE public.can_access_channel(t.channel_id, _caller)
  ),
  counts AS (
    SELECT tm.thread_id, COUNT(*)::int AS message_count
    FROM public.thread_messages tm
    WHERE tm.thread_id IN (SELECT vt.thread_id FROM visible_threads vt)
    GROUP BY tm.thread_id
  ),
  last_tm AS (
    SELECT DISTINCT ON (tm.thread_id)
      tm.thread_id,
      tm.created_at AS last_activity,
      tm.user_id AS last_user_id
    FROM public.thread_messages tm
    WHERE tm.thread_id IN (SELECT vt.thread_id FROM visible_threads vt)
    ORDER BY tm.thread_id, tm.created_at DESC
  )
  SELECT json_agg(
    json_build_object(
      'thread_id', vt.thread_id,
      'message_count', COALESCE(c.message_count, 0),
      'last_activity', COALESCE(l.last_activity, vt.created_at),
      'last_message_author', CASE
        WHEN l.last_user_id IS NULL THEN NULL
        ELSE (
          SELECT json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'avatar_decoration', u.avatar_decoration,
            'profile_effect', u.profile_effect,
            'banner_color', u.banner_color,
            'banner_url', u.banner_url,
            'profile_theme_primary', u.profile_theme_primary,
            'profile_theme_accent', u.profile_theme_accent,
            'bio', u.bio,
            'status', u.status,
            'custom_status', u.custom_status
          )
          FROM public.users u
          WHERE u.id = l.last_user_id
        )
      END
    )
    ORDER BY COALESCE(l.last_activity, vt.created_at) DESC NULLS LAST
  )
  INTO result
  FROM visible_threads vt
  LEFT JOIN counts c ON c.thread_id = vt.thread_id
  LEFT JOIN last_tm l ON l.thread_id = vt.thread_id;

  RETURN COALESCE(result, '[]'::json);
END;
$$;


--
-- Name: get_user_badges_secure(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_badges_secure(_target_user_id uuid, _requesting_user_id uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_requesting_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.can_view_user(_target_user_id, _requesting_user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', b.id,
          'name', b.name,
          'icon_url', b.icon_url,
          'description', b.description
        )
      )
      FROM public.user_badges ub
      JOIN public.badges b ON b.id = ub.badge_id
      WHERE ub.user_id = _target_user_id
    ),
    '[]'::json
  );
END;
$$;


--
-- Name: get_user_by_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_by_id(_user_id uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _caller uuid;
BEGIN
  _caller := public.requesting_user_id();
  IF _caller IS NULL OR NOT public.verify_request_identity(_caller) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.can_view_user(_user_id, _caller) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN (
    SELECT json_build_object(
      'id', u.id,
      'username', u.username,
      'display_name', u.display_name,
      'avatar_url', u.avatar_url,
      'banner_url', u.banner_url,
      'avatar_decoration', u.avatar_decoration,
      'profile_effect', u.profile_effect,
      'banner_color', u.banner_color,
      'profile_theme_primary', u.profile_theme_primary,
      'profile_theme_accent', u.profile_theme_accent,
      'bio', u.bio,
      'status', u.status,
      'custom_status', u.custom_status,
      'created_at', u.created_at,
      'last_seen', u.last_seen
    )
    FROM public.users u
    WHERE u.id = _user_id
  );
END;
$$;


--
-- Name: get_user_dm_conversation_ids_secure(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_dm_conversation_ids_secure(_user_id uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(dp.conversation_id)
      FROM public.dm_participants dp
      WHERE dp.user_id = _user_id
    ),
    '[]'::json
  );
END;
$$;


--
-- Name: get_user_dm_conversations(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_dm_conversations(_user_id uuid) RETURNS TABLE(conversation json, participants json, last_message json)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN QUERY
  SELECT
    json_build_object(
      'id', c.id,
      'created_at', c.created_at,
      'is_group', c.is_group,
      'name', c.name,
      'created_by', c.created_by
    ) as conversation,
    (
      SELECT json_agg(
        json_build_object(
          'user_id', dp2.user_id,
          'user', json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'avatar_decoration', u.avatar_decoration,
            'status', u.status,
            'custom_status', u.custom_status,
            'banner_color', u.banner_color,
            'last_seen', CASE WHEN u.id = _user_id THEN u.last_seen ELSE NULL END
          )
        )
      )
      FROM dm_participants dp2
      JOIN users u ON u.id = dp2.user_id
      WHERE dp2.conversation_id = c.id
    ) as participants,
    (
      SELECT json_build_object(
        'id', dm.id,
        'content', dm.content,
        'created_at', dm.created_at,
        'sender_id', dm.sender_id
      )
      FROM direct_messages dm
      WHERE dm.conversation_id = c.id
      ORDER BY dm.created_at DESC
      LIMIT 1
    ) as last_message
  FROM dm_conversations c
  JOIN dm_participants dp ON dp.conversation_id = c.id
  WHERE dp.user_id = _user_id
  ORDER BY (
    SELECT MAX(dm.created_at)
    FROM direct_messages dm
    WHERE dm.conversation_id = c.id
  ) DESC NULLS LAST;
END;
$$;


--
-- Name: get_user_friends(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_friends(_user_id uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN (
    SELECT json_agg(friend)
    FROM (
      SELECT json_build_object(
        'id', f.id,
        'status', f.status,
        'created_at', f.created_at,
        'user',
          CASE
            WHEN f.requester_id = _user_id THEN (
              SELECT json_build_object(
                'id', u.id,
                'username', u.username,
                'display_name', u.display_name,
                'avatar_url', u.avatar_url,
                'banner_color', u.banner_color,
                'status', u.status,
                'custom_status', u.custom_status
              )
              FROM public.users u
              WHERE u.id = f.addressee_id
            )
            ELSE (
              SELECT json_build_object(
                'id', u.id,
                'username', u.username,
                'display_name', u.display_name,
                'avatar_url', u.avatar_url,
                'banner_color', u.banner_color,
                'status', u.status,
                'custom_status', u.custom_status
              )
              FROM public.users u
              WHERE u.id = f.requester_id
            )
          END
      ) AS friend
      FROM public.friendships f
      WHERE (f.requester_id = _user_id OR f.addressee_id = _user_id)
        AND f.status = 'accepted'
    ) sub
  );
END;
$$;


--
-- Name: get_user_poll_votes(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_poll_votes(_poll_id uuid, _user_id uuid) RETURNS integer[]
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  votes integer[];
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT ARRAY_AGG(option_index ORDER BY option_index)
  INTO votes
  FROM poll_votes
  WHERE poll_id = _poll_id AND user_id = _user_id;
  
  RETURN COALESCE(votes, ARRAY[]::integer[]);
END;
$$;


--
-- Name: get_user_preferences(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_preferences(_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT to_jsonb(up)
    INTO result
  FROM public.user_preferences up
  WHERE up.user_id = _user_id
  LIMIT 1;

  RETURN result;
END;
$$;


--
-- Name: get_user_profile_secure(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_profile_secure(_target_user_id uuid, _requesting_user_id uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_requesting_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.can_view_user(_target_user_id, _requesting_user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN (
    SELECT row_to_json(u)
    FROM (
      SELECT id, username, display_name, avatar_url, banner_url, avatar_decoration, profile_effect,
             banner_color, profile_theme_primary, profile_theme_accent, bio, status,
             custom_status, created_at, last_seen, pronouns
      FROM public.users
      WHERE id = _target_user_id
      LIMIT 1
    ) u
  );
END;
$$;


--
-- Name: get_user_server_folders(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_server_folders(_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT folder_data
    INTO result
  FROM public.user_server_folders
  WHERE user_id = _user_id;

  IF result IS NULL THEN
    RETURN '{"folders":[],"serverToFolder":{}}'::jsonb;
  END IF;

  RETURN result;
END;
$$;


--
-- Name: get_user_server_tabs(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_server_tabs(_user_id uuid) RETURNS text[]
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  RETURN COALESCE(
    (SELECT tab_order FROM user_server_tabs WHERE user_id = _user_id),
    '{}'::TEXT[]
  );
END;
$$;


--
-- Name: get_user_servers(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_servers(_user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
    FROM (
      SELECT 
        s.id,
        s.name,
        s.owner_id,
        s.invite_code,
        s.icon_url,
        s.banner_url,
        s.is_published,
        s.about,
        s.system_channel_join_id,
        s.system_channel_leave_id,
        s.enable_join_messages,
        s.enable_leave_messages,
        s.created_at,
        sm.role,
        sm.nickname,
        sm.joined_at,
        sm.is_muted,
        sm.position
      FROM servers s
      INNER JOIN server_members sm ON sm.server_id = s.id
      WHERE sm.user_id = _user_id
        AND (sm.is_banned IS NULL OR sm.is_banned = false)
      ORDER BY sm.position ASC NULLS LAST, s.name ASC
    ) t
  );
END;
$$;


--
-- Name: get_user_voice_settings(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_voice_settings(p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  result JSONB;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(p_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT settings INTO result
  FROM user_voice_settings
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;


--
-- Name: get_users_basic_secure(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_users_basic_secure(_user_id uuid, _target_user_ids uuid[]) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT u.id, u.username, u.display_name, u.avatar_url, u.banner_color
        FROM public.users u
        WHERE u.id = ANY(_target_user_ids)
          AND public.can_view_user(u.id, _user_id)
      ) t
    ),
    '[]'::json
  );
END;
$$;


--
-- Name: get_users_presence_secure(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_users_presence_secure(_user_id uuid, _target_user_ids uuid[]) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT u.id, u.status, u.last_seen
        FROM public.users u
        WHERE u.id = ANY(_target_user_ids)
          AND public.can_view_user(u.id, _user_id)
      ) t
    ),
    '[]'::json
  );
END;
$$;


--
-- Name: handle_message_mentions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_message_mentions() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- 1. Automatically populate the mentions table by parsing the text
  -- It looks for the <@UUID> pattern we create in React
  INSERT INTO public.mentions (message_id, user_id, mention_type)
  SELECT DISTINCT NEW.id, (m[1])::uuid, 'user'
  FROM regexp_matches(NEW.content, '<@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})>', 'g') AS m
  ON CONFLICT DO NOTHING;

  -- 2. Update the mention counts for the recipients
  UPDATE public.channel_reads
  SET mention_count = mention_count + 1
  WHERE channel_id = NEW.channel_id
    AND user_id IN (
      SELECT user_id FROM public.mentions WHERE message_id = NEW.id
    )
    AND user_id != NEW.user_id; -- Don't ping yourself

  RETURN NEW;
END;
$$;


--
-- Name: handle_new_mention_ping(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_mention_ping() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- We look at the 'mentions' table (which should be populated when a message is sent)
  -- and increment the count for those specific users in that channel.
  UPDATE public.channel_reads
  SET mention_count = mention_count + 1
  WHERE channel_id = NEW.channel_id
    AND user_id IN (
      SELECT user_id 
      FROM public.mentions 
      WHERE message_id = NEW.id
    );
    
  RETURN NEW;
END;
$$;


--
-- Name: has_channel_access(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_channel_access(_channel_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM channels c
    WHERE c.id = _channel_id
    AND (
      c.is_private = false
      OR EXISTS (SELECT 1 FROM channel_members cm WHERE cm.channel_id = _channel_id AND cm.user_id = _user_id)
    )
  );
$$;


--
-- Name: has_private_channel_access(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_private_channel_access(_channel_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    _user_id IS NOT NULL
    AND public.verify_request_identity(_user_id)
    AND public.can_access_channel(_channel_id, _user_id)
$$;


--
-- Name: increment_mention_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_mention_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _channel_id UUID;
BEGIN
  -- Get the channel_id from the message
  SELECT channel_id INTO _channel_id
  FROM public.messages
  WHERE id = NEW.message_id;

  IF _channel_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Upsert channel_reads record and increment mention_count
  INSERT INTO public.channel_reads (user_id, channel_id, mention_count)
  VALUES (NEW.user_id, _channel_id, 1)
  ON CONFLICT (user_id, channel_id)
  DO UPDATE SET mention_count = COALESCE(channel_reads.mention_count, 0) + 1;

  RETURN NEW;
END;
$$;


--
-- Name: insert_announcement_comment(uuid, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_announcement_comment(_message_id uuid, _user_id uuid, _content text, _reply_to_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  msg_channel_id uuid;
  new_comment announcement_comments%ROWTYPE;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT channel_id INTO msg_channel_id FROM messages WHERE id = _message_id;
  IF msg_channel_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  IF NOT check_user_permission(_user_id, msg_channel_id, 'send_messages') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to comment';
  END IF;
  INSERT INTO announcement_comments (message_id, user_id, content, reply_to_id)
  VALUES (_message_id, _user_id, _content, _reply_to_id)
  RETURNING * INTO new_comment;
  RETURN row_to_json(new_comment);
END;
$$;


--
-- Name: insert_media_comment(uuid, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_media_comment(_media_id uuid, _user_id uuid, _content text, _reply_to_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  media_channel_id uuid;
  new_comment media_comments%ROWTYPE;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT channel_id INTO media_channel_id FROM media_items WHERE id = _media_id;
  IF media_channel_id IS NULL THEN
    RAISE EXCEPTION 'Media item not found';
  END IF;
  IF NOT check_user_permission(_user_id, media_channel_id, 'send_messages') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to comment';
  END IF;
  INSERT INTO media_comments (media_id, user_id, content, reply_to_id)
  VALUES (_media_id, _user_id, _content, _reply_to_id)
  RETURNING * INTO new_comment;
  RETURN row_to_json(new_comment);
END;
$$;


--
-- Name: insert_media_item(uuid, uuid, text, text, text, text, text, text, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_media_item(_channel_id uuid, _user_id uuid, _title text DEFAULT NULL::text, _description text DEFAULT NULL::text, _media_url text DEFAULT ''::text, _media_type text DEFAULT 'image'::text, _thumbnail_url text DEFAULT NULL::text, _youtube_video_id text DEFAULT NULL::text, _width integer DEFAULT NULL::integer, _height integer DEFAULT NULL::integer, _file_size integer DEFAULT NULL::integer) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  new_item media_items%ROWTYPE;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  IF NOT check_user_permission(_user_id, _channel_id, 'send_messages') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to send messages in this channel';
  END IF;
  IF NOT check_user_permission(_user_id, _channel_id, 'attach_files') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to attach files in this channel';
  END IF;
  INSERT INTO media_items (channel_id, user_id, title, description, media_url, media_type, thumbnail_url, youtube_video_id, width, height, file_size)
  VALUES (_channel_id, _user_id, _title, _description, _media_url, _media_type, _thumbnail_url, _youtube_video_id, _width, _height, _file_size)
  RETURNING * INTO new_item;
  RETURN row_to_json(new_item);
END;
$$;


--
-- Name: insert_mentions(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_mentions(_user_id uuid, _mentions jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  INSERT INTO mentions (message_id, user_id, mention_type)
  SELECT
    (m->>'message_id')::uuid,
    (m->>'user_id')::uuid,
    (m->>'mention_type')::mention_type
  FROM jsonb_array_elements(_mentions) AS m
  ON CONFLICT DO NOTHING;
END;
$$;


--
-- Name: is_category_server_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_category_server_member(_category_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM channel_categories cc
    JOIN server_members sm ON sm.server_id = cc.server_id
    WHERE cc.id = _category_id AND sm.user_id = _user_id
  );
$$;


--
-- Name: is_channel_server_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_channel_server_member(_channel_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    _user_id IS NOT NULL
    AND public.verify_request_identity(_user_id)
    AND EXISTS (
      SELECT 1
      FROM public.channels c
      JOIN public.server_members sm ON sm.server_id = c.server_id
      WHERE c.id = _channel_id
        AND sm.user_id = _user_id
        AND COALESCE(sm.is_banned, false) = false
    )
$$;


--
-- Name: is_dm_message_participant(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_dm_message_participant(_message_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM direct_messages dm
    JOIN dm_participants dp ON dp.conversation_id = dm.conversation_id
    WHERE dm.id = _message_id AND dp.user_id = _user_id
  );
$$;


--
-- Name: is_dm_participant(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_dm_participant(_conversation_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    _user_id IS NOT NULL
    AND public.verify_request_identity(_user_id)
    AND EXISTS (
      SELECT 1
      FROM public.dm_participants dp
      WHERE dp.conversation_id = _conversation_id
        AND dp.user_id = _user_id
    )
$$;


--
-- Name: is_friend_with(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_friend_with(_user_id uuid, _other_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    _user_id IS NOT NULL
    AND _other_user_id IS NOT NULL
    AND public.verify_request_identity(_user_id)
    AND EXISTS (
      SELECT 1
      FROM public.friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.requester_id = _user_id AND f.addressee_id = _other_user_id)
          OR (f.requester_id = _other_user_id AND f.addressee_id = _user_id)
        )
    )
$$;


--
-- Name: is_maintenance_active(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_maintenance_active() RETURNS boolean
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN COALESCE(
    (SELECT (value::jsonb->>'enabled')::boolean 
     FROM public.app_config 
     WHERE key = 'maintenance_mode'), 
    false
  );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;


--
-- Name: is_media_channel_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_media_channel_member(_media_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM media_items mi
    JOIN server_members sm ON sm.server_id = (
      SELECT c.server_id FROM channels c WHERE c.id = mi.channel_id
    ) AND sm.user_id = _user_id AND sm.is_banned = false
    WHERE mi.id = _media_id
  );
$$;


--
-- Name: is_member_in_same_server(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_member_in_same_server(_member_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM server_members sm1
    JOIN server_members sm2 ON sm1.server_id = sm2.server_id
    WHERE sm1.id = _member_id AND sm2.user_id = _user_id
  );
$$;


--
-- Name: is_message_channel_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_message_channel_member(_message_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM messages m
    JOIN server_members sm ON sm.server_id = (
      SELECT c.server_id FROM channels c WHERE c.id = m.channel_id
    ) AND sm.user_id = _user_id AND sm.is_banned = false
    WHERE m.id = _message_id
  );
$$;


--
-- Name: is_server_admin_or_owner(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_server_admin_or_owner(_server_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.server_members sm
    WHERE sm.server_id = _server_id
      AND sm.user_id   = _user_id
      AND sm.is_banned = false
      AND sm.role IN ('owner', 'admin')
  );
$$;


--
-- Name: is_server_banned_secure(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_server_banned_secure(_server_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _is_banned boolean;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT COALESCE(sm.is_banned, false)
    INTO _is_banned
  FROM public.server_members sm
  WHERE sm.server_id = _server_id
    AND sm.user_id = _user_id
  LIMIT 1;

  RETURN COALESCE(_is_banned, false);
END;
$$;


--
-- Name: is_server_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_server_member(_server_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    _user_id IS NOT NULL
    AND public.verify_request_identity(_user_id)
    AND EXISTS (
      SELECT 1
      FROM public.server_members sm
      WHERE sm.server_id = _server_id
        AND sm.user_id = _user_id
        AND COALESCE(sm.is_banned, false) = false
    )
$$;


--
-- Name: is_thread_channel_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_thread_channel_member(_thread_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    _user_id IS NOT NULL
    AND public.verify_request_identity(_user_id)
    AND EXISTS (
      SELECT 1
      FROM public.threads t
      JOIN public.channels c ON c.id = t.channel_id
      JOIN public.server_members sm
        ON sm.server_id = c.server_id
       AND sm.user_id = _user_id
      WHERE t.id = _thread_id
        AND COALESCE(sm.is_banned, false) = false
    )
$$;


--
-- Name: is_username_blocked(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_username_blocked(username text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
DECLARE
  normalized_username TEXT;
  blocked_words TEXT[] := ARRAY[
    -- Kloak brand
    'kloak', 'kloakapp', 'kloakofficial', 'kloakhq', 'kloakteam', 'kloaksupport',
    'kloakhelp', 'kloakadmin', 'kloakmod', 'kloakbot', 'kloakstaff', 'kloaksecurity',
    -- Administrative
    'admin', 'administrator', 'moderator', 'owner', 'staff', 'official', 'manager',
    'supervisor', 'superuser', 'sysadmin', 'systemadmin', 'root', 'sudo', 'operator',
    -- Support
    'support', 'helpdesk', 'customerservice', 'customersupport', 'contact', 'billing',
    -- System
    'system', 'server', 'bot', 'robot', 'automated', 'api', 'webhook', 'database',
    'localhost', 'null', 'undefined', 'void', 'none', 'test', 'testing',
    -- Security
    'security', 'abuse', 'spam', 'phishing', 'hack', 'hacker', 'exploit',
    'noreply', 'donotreply', 'postmaster', 'webmaster',
    -- Identity
    'everyone', 'anybody', 'someone', 'nobody', 'anonymous', 'anon', 'guest',
    'unknown', 'default', 'user', 'member', 'all',
    -- Platform
    'login', 'logout', 'signup', 'register', 'account', 'profile', 'settings',
    'dashboard', 'home', 'password', 'auth'
  ];
  blocked_substrings TEXT[] := ARRAY[
    'admin', 'moderator', 'support', 'official', 'staff', 'kloak', 'system',
    'security', 'hack', 'phish', 'spam', 'abuse', 'root', 'sudo', 'owner'
  ];
  word TEXT;
BEGIN
  -- Normalize: lowercase, remove underscores/hyphens, decode basic leet speak
  normalized_username := lower(username);
  normalized_username := regexp_replace(normalized_username, '[-_]', '', 'g');
  -- Basic leet speak decoding
  normalized_username := replace(normalized_username, '0', 'o');
  normalized_username := replace(normalized_username, '1', 'i');
  normalized_username := replace(normalized_username, '3', 'e');
  normalized_username := replace(normalized_username, '4', 'a');
  normalized_username := replace(normalized_username, '5', 's');
  normalized_username := replace(normalized_username, '7', 't');
  normalized_username := replace(normalized_username, '@', 'a');
  normalized_username := replace(normalized_username, '$', 's');

  -- Check exact match against blocked list
  FOREACH word IN ARRAY blocked_words LOOP
    IF normalized_username = word THEN
      RETURN TRUE;
    END IF;
  END LOOP;

  -- Check if contains blocked substrings
  FOREACH word IN ARRAY blocked_substrings LOOP
    IF position(word IN normalized_username) > 0 THEN
      RETURN TRUE;
    END IF;
  END LOOP;

  RETURN FALSE;
END;
$_$;


--
-- Name: join_server_by_invite(text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.join_server_by_invite(_invite_code text, _user_id uuid, _join_source text DEFAULT 'invite_link'::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  target_server_id uuid;
  existing_member record;
  result json;
  clean_code text;
  system_channel_id uuid;
  enable_join boolean;
  join_message_content text;
  invite_row_id uuid;
  invite_max_uses integer;
  invite_uses_count integer;
  invite_expires_at timestamptz;
  message_id uuid;
  message_inserted boolean := false;
  insert_error text;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_rate_limit(_user_id::text, 'join_server_by_invite_burst', 20, 60) THEN
    RAISE EXCEPTION 'Rate limited: too many join attempts';
  END IF;

  IF NOT public.check_rate_limit(_user_id::text, 'join_server_by_invite_hourly', 200, 3600) THEN
    RAISE EXCEPTION 'Rate limited: join quota reached';
  END IF;

  clean_code := upper(trim(_invite_code));

  SELECT id, system_channel_join_id, enable_join_messages
    INTO target_server_id, system_channel_id, enable_join
  FROM public.servers
  WHERE trim(invite_code::text) = clean_code;

  IF target_server_id IS NULL THEN
    SELECT si.id, si.server_id, si.max_uses, si.uses_count, si.expires_at
      INTO invite_row_id, target_server_id, invite_max_uses, invite_uses_count, invite_expires_at
    FROM public.server_invites si
    WHERE si.revoked_at IS NULL
      AND trim(si.code::text) = clean_code
    FOR UPDATE
    LIMIT 1;

    IF invite_row_id IS NOT NULL THEN
      IF invite_expires_at IS NOT NULL AND invite_expires_at <= now() THEN
        RAISE EXCEPTION 'Invalid invite code';
      END IF;
      IF invite_max_uses IS NOT NULL AND invite_uses_count >= invite_max_uses THEN
        RAISE EXCEPTION 'Invalid invite code';
      END IF;

      SELECT system_channel_join_id, enable_join_messages
        INTO system_channel_id, enable_join
      FROM public.servers
      WHERE id = target_server_id;
    END IF;
  END IF;

  IF target_server_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  SELECT * INTO existing_member
  FROM public.server_members
  WHERE server_id = target_server_id
    AND user_id = _user_id;

  IF existing_member IS NOT NULL THEN
    IF existing_member.is_banned = true THEN
      RAISE EXCEPTION 'You are banned from this server';
    END IF;

    SELECT json_build_object(
      'id', s.id,
      'name', s.name,
      'owner_id', s.owner_id,
      'invite_code', trim(s.invite_code::text),
      'icon_url', s.icon_url,
      'banner_url', s.banner_url,
      'created_at', s.created_at,
      'already_member', true
    ) INTO result
    FROM public.servers s
    WHERE s.id = target_server_id;

    RETURN result;
  END IF;

  INSERT INTO public.server_members (server_id, user_id, role, is_banned)
  VALUES (target_server_id, _user_id, 'member', false)
  ON CONFLICT (server_id, user_id) DO NOTHING;

  IF invite_row_id IS NOT NULL THEN
    UPDATE public.server_invites
    SET uses_count = uses_count + 1
    WHERE id = invite_row_id;
  END IF;

  IF system_channel_id IS NOT NULL AND enable_join THEN
    BEGIN
      join_message_content := format('<@%s> joined', _user_id);
      INSERT INTO public.messages (channel_id, user_id, content, is_system_message)
      VALUES (system_channel_id, _user_id, join_message_content, true)
      RETURNING id INTO message_id;
      message_inserted := true;
    EXCEPTION WHEN OTHERS THEN
      insert_error := SQLERRM;
      message_inserted := false;
      RAISE WARNING 'Failed to insert join message: %', SQLERRM;
    END;
  END IF;

  SELECT json_build_object(
    'id', s.id,
    'name', s.name,
    'owner_id', s.owner_id,
    'invite_code', trim(s.invite_code::text),
    'icon_url', s.icon_url,
    'banner_url', s.banner_url,
    'created_at', s.created_at,
    'already_member', false
  ) INTO result
  FROM public.servers s
  WHERE s.id = target_server_id;

  RETURN result;
END;
$$;


--
-- Name: kick_group_dm_member(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.kick_group_dm_member(_conversation_id uuid, _kicker_id uuid, _target_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_is_group boolean;
  v_creator_id uuid;
BEGIN
  -- ADD THIS CHECK
  IF NOT public.verify_request_identity(_kicker_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  -- Existing logic continues...
  SELECT is_group, created_by INTO v_is_group, v_creator_id
  FROM dm_conversations
  WHERE id = _conversation_id;
  
  IF _kicker_id != v_creator_id THEN
    RAISE EXCEPTION 'Only the group creator can kick members';
  END IF;
  
  -- ... rest of function
END;
$$;


--
-- Name: kick_member(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.kick_member(_server_id uuid, _user_id uuid, _target_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'kick_members') THEN
    RAISE EXCEPTION 'You do not have permission to kick members';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.servers
    WHERE id = _server_id AND owner_id = _target_user_id
  ) THEN
    RAISE EXCEPTION 'Cannot kick the server owner';
  END IF;

  DELETE FROM public.server_member_roles
  WHERE member_id IN (
    SELECT id FROM public.server_members
    WHERE server_id = _server_id AND user_id = _target_user_id
  );

  DELETE FROM public.server_members
  WHERE server_id = _server_id
    AND user_id = _target_user_id;
END;
$$;


--
-- Name: leave_group_dm(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.leave_group_dm(_conversation_id uuid, _user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_is_group boolean;
  v_is_participant boolean;
  v_username text;
  v_display_name text;
  v_participant_count int;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Check if conversation exists and is a group
  SELECT is_group INTO v_is_group
  FROM dm_conversations
  WHERE id = _conversation_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;
  
  IF NOT COALESCE(v_is_group, false) THEN
    RAISE EXCEPTION 'Cannot leave a 1:1 conversation';
  END IF;
  
  -- Check if user is a participant
  SELECT EXISTS (
    SELECT 1 FROM dm_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  ) INTO v_is_participant;
  
  IF NOT v_is_participant THEN
    RAISE EXCEPTION 'User is not a participant';
  END IF;
  
  -- Get username for the system message
  SELECT username, display_name INTO v_username, v_display_name
  FROM users
  WHERE id = _user_id;
  
  -- Send system message about leaving
  INSERT INTO direct_messages (conversation_id, sender_id, content)
  VALUES (
    _conversation_id,
    _user_id,
    '📤 ' || COALESCE(v_display_name, v_username) || ' has left the group chat'
  );
  
  -- Remove user from participants
  DELETE FROM dm_participants
  WHERE conversation_id = _conversation_id AND user_id = _user_id;
  
  -- Check remaining participant count
  SELECT COUNT(*) INTO v_participant_count
  FROM dm_participants
  WHERE conversation_id = _conversation_id;
  
  -- If only 1 or 0 participants left, delete the conversation
  IF v_participant_count <= 1 THEN
    DELETE FROM dm_conversations WHERE id = _conversation_id;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'left_user', COALESCE(v_display_name, v_username)
  );
END;
$$;


--
-- Name: leave_server(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.leave_server(_user_id uuid, _server_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE user_role text; system_channel_id uuid; enable_leave boolean; leave_message_content text; message_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT role INTO user_role FROM server_members WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;
  IF user_role IS NULL THEN RAISE EXCEPTION 'Not a member of this server'; END IF;
  IF user_role = 'owner' THEN RAISE EXCEPTION 'Server owner cannot leave. Transfer ownership first or delete the server.'; END IF;
  SELECT system_channel_leave_id, enable_leave_messages INTO system_channel_id, enable_leave FROM servers WHERE id = _server_id;
  DELETE FROM server_members WHERE server_id = _server_id AND user_id = _user_id;
  IF system_channel_id IS NOT NULL THEN
    BEGIN
      leave_message_content := format('<@%s> left', _user_id);
      INSERT INTO messages (channel_id, user_id, content, is_system_message) VALUES (system_channel_id, _user_id, leave_message_content, TRUE) RETURNING id INTO message_id;
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Failed to post leave message: %', SQLERRM;
    END;
  END IF;
  RETURN true;
END; $$;


--
-- Name: list_server_invites(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_server_invites(_server_id uuid, _user_id uuid) RETURNS TABLE(id uuid, code text, created_at timestamp with time zone, created_by uuid, created_by_username text, expires_at timestamp with time zone, max_uses integer, uses_count integer, revoked_at timestamp with time zone, revoked_by uuid, revoked_by_username text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    si.id,
    trim(si.code::text) as code,
    si.created_at,
    si.created_by,
    u.username::text as created_by_username,
    si.expires_at,
    si.max_uses,
    si.uses_count,
    si.revoked_at,
    si.revoked_by,
    ru.username::text as revoked_by_username
  FROM public.server_invites si
  JOIN public.users u ON u.id = si.created_by
  LEFT JOIN public.users ru ON ru.id = si.revoked_by
  WHERE si.server_id = _server_id
    AND public.check_user_server_permission(_user_id, _server_id, 'manage_invites')
  ORDER BY si.created_at DESC
$$;


--
-- Name: login_user(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.login_user(_key_hash text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
DECLARE
  result json;
  _user_id uuid;
  _dummy_hash text := 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  _client_id text;
  _key_bucket text;
BEGIN
  _client_id := public.request_client_identifier();

  -- Input validation
  IF _key_hash IS NULL OR length(_key_hash) != 64 OR _key_hash !~ '^[a-fA-F0-9]{64}$' THEN
    IF _client_id <> 'unknown'
       AND NOT public.check_rate_limit(_client_id, 'login_user_invalid', 30, 60) THEN
      RAISE EXCEPTION 'Rate limited: login temporarily blocked';
    END IF;
    PERFORM pg_sleep(0.1);
    RETURN NULL;
  END IF;

  _key_bucket := left(lower(_key_hash), 16);
  IF NOT public.check_rate_limit(_key_bucket, 'login_user_keyhash', 20, 60) THEN
    RAISE EXCEPTION 'Rate limited: too many login attempts';
  END IF;

  IF _client_id <> 'unknown'
     AND NOT public.check_rate_limit(_client_id, 'login_user_client', 60, 60) THEN
    RAISE EXCEPTION 'Rate limited: too many login attempts';
  END IF;

  -- Lookup user
  SELECT ua.user_id INTO _user_id
  FROM public.user_auth ua
  WHERE ua.key_hash = _key_hash
  LIMIT 1;

  -- Timing attack mitigation
  IF _user_id IS NULL THEN
    PERFORM key_hash FROM public.user_auth WHERE key_hash = _dummy_hash LIMIT 1;
    RETURN NULL;
  END IF;

  -- Get user data
  SELECT json_build_object(
    'id', u.id,
    'username', u.username,
    'display_name', u.display_name,
    'avatar_url', u.avatar_url,
    'banner_url', u.banner_url,
    'avatar_decoration', u.avatar_decoration,
    'profile_effect', u.profile_effect,
    'banner_color', u.banner_color,
    'profile_theme_primary', u.profile_theme_primary,
    'profile_theme_accent', u.profile_theme_accent,
    'bio', u.bio,
    'status', u.status,
    'custom_status', u.custom_status,
    'allow_nsfw', u.allow_nsfw,
    'created_at', u.created_at,
    'last_seen', u.last_seen
  ) INTO result
  FROM public.users u
  WHERE u.id = _user_id;

  IF result IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.users
  SET status = 'online',
      last_seen = now()
  WHERE id = _user_id;

  RETURN result;
END;
$_$;


--
-- Name: mark_channel_read(uuid, uuid, uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_channel_read(_channel_id uuid, _user_id uuid, _last_read_message_id uuid, _last_read_at timestamp with time zone DEFAULT now()) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  INSERT INTO public.channel_reads (channel_id, user_id, last_read_message_id, last_read_at, mention_count)
  VALUES (_channel_id, _user_id, _last_read_message_id, _last_read_at, 0)
  ON CONFLICT (channel_id, user_id)
  DO UPDATE SET
    last_read_message_id = EXCLUDED.last_read_message_id,
    last_read_at = EXCLUDED.last_read_at,
    mention_count = 0;

  RETURN true;
END;
$$;


--
-- Name: mark_channels_read(uuid[], uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_channels_read(_channel_ids uuid[], _user_id uuid, _last_read_at timestamp with time zone DEFAULT now()) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  WITH latest AS (
    SELECT DISTINCT ON (m.channel_id)
      m.channel_id,
      m.id AS last_message_id
    FROM public.messages m
    WHERE m.channel_id = ANY(_channel_ids)
    ORDER BY m.channel_id, m.created_at DESC
  )
  INSERT INTO public.channel_reads (channel_id, user_id, last_read_message_id, last_read_at, mention_count)
  SELECT l.channel_id, _user_id, l.last_message_id, _last_read_at, 0
  FROM latest l
  ON CONFLICT (channel_id, user_id)
  DO UPDATE SET
    last_read_message_id = EXCLUDED.last_read_message_id,
    last_read_at = EXCLUDED.last_read_at,
    mention_count = 0;

  RETURN true;
END;
$$;


--
-- Name: mark_dm_read(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_dm_read(_conversation_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  UPDATE dm_participants 
  SET last_read_at = now()
  WHERE conversation_id = _conversation_id AND user_id = _user_id;
  
  RETURN true;
END;
$$;


--
-- Name: move_channel_to_category(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.move_channel_to_category(_channel_id uuid, _server_id uuid, _category_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  new_position integer;
  _caller uuid;
BEGIN
  _caller := public.requesting_user_id();
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.verify_request_identity(_caller) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_caller, _server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.channels
    WHERE id = _channel_id
      AND server_id = _server_id
  ) THEN
    RAISE EXCEPTION 'Channel not found in server';
  END IF;

  SELECT COALESCE(MAX(position), -1) + 1 INTO new_position
  FROM public.channels
  WHERE server_id = _server_id
    AND category_id IS NOT DISTINCT FROM _category_id;

  UPDATE public.channels
  SET category_id = _category_id, position = new_position
  WHERE id = _channel_id
    AND server_id = _server_id;

  RETURN true;
END;
$$;


--
-- Name: mute_member(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mute_member(_server_id uuid, _user_id uuid, _target_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'mute_members') THEN
    RAISE EXCEPTION 'You do not have permission to mute members';
  END IF;

  UPDATE public.server_members
  SET is_muted = true
  WHERE server_id = _server_id
    AND user_id = _target_user_id;
END;
$$;


--
-- Name: open_dm_conversation(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.open_dm_conversation(_user_id uuid, _other_user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  existing_conversation_id uuid;
  new_conversation_id uuid;
  result json;
  target_dm_privacy text;
  allowed_by_privacy boolean := false;
  recent_dm_opens_10m integer := 0;
  recent_dm_opens_1h integer := 0;
  account_created_at timestamptz;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF _user_id = _other_user_id THEN
    RAISE EXCEPTION 'Cannot open DM with yourself';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = _other_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  SELECT dp1.conversation_id INTO existing_conversation_id
  FROM public.dm_participants dp1
  JOIN public.dm_participants dp2 ON dp1.conversation_id = dp2.conversation_id
  JOIN public.dm_conversations dc ON dc.id = dp1.conversation_id
  WHERE dp1.user_id = _user_id
    AND dp2.user_id = _other_user_id
    AND COALESCE(dc.is_group, false) = false
  LIMIT 1;

  IF existing_conversation_id IS NOT NULL THEN
    SELECT json_build_object('id', dc.id, 'created_at', dc.created_at)
      INTO result
    FROM public.dm_conversations dc
    WHERE dc.id = existing_conversation_id;
    RETURN result;
  END IF;

  SELECT u.created_at INTO account_created_at
  FROM public.users u
  WHERE u.id = _user_id;

  IF account_created_at IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF account_created_at > now() - interval '15 minutes' THEN
    RAISE EXCEPTION 'DMs are temporarily restricted for new accounts';
  END IF;

  SELECT count(*) INTO recent_dm_opens_10m
  FROM public.dm_conversations dc
  WHERE dc.created_by = _user_id
    AND COALESCE(dc.is_group, false) = false
    AND dc.created_at > now() - interval '10 minutes';

  IF recent_dm_opens_10m >= 8 THEN
    RAISE EXCEPTION 'Rate limited: too many new DM conversations';
  END IF;

  SELECT count(*) INTO recent_dm_opens_1h
  FROM public.dm_conversations dc
  WHERE dc.created_by = _user_id
    AND COALESCE(dc.is_group, false) = false
    AND dc.created_at > now() - interval '1 hour';

  IF recent_dm_opens_1h >= 25 THEN
    RAISE EXCEPTION 'Rate limited: DM conversation limit reached';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status = 'blocked'
      AND (
        (f.requester_id = _user_id AND f.addressee_id = _other_user_id)
        OR (f.requester_id = _other_user_id AND f.addressee_id = _user_id)
      )
  ) THEN
    RAISE EXCEPTION 'Cannot message this user';
  END IF;

  SELECT COALESCE(up.dm_privacy, 'friends')
    INTO target_dm_privacy
  FROM public.user_preferences up
  WHERE up.user_id = _other_user_id;

  IF target_dm_privacy = 'everyone' THEN
    allowed_by_privacy := true;
  ELSIF target_dm_privacy = 'shared_servers' THEN
    allowed_by_privacy := public.shares_server_with(_user_id, _other_user_id);
  ELSIF target_dm_privacy = 'friends' THEN
    allowed_by_privacy := public.is_friend_with(_user_id, _other_user_id);
  ELSIF target_dm_privacy = 'no_one' THEN
    allowed_by_privacy := false;
  END IF;

  IF NOT allowed_by_privacy THEN
    RAISE EXCEPTION 'Cannot message this user';
  END IF;

  INSERT INTO public.dm_conversations (is_group, created_by)
  VALUES (false, _user_id)
  RETURNING id INTO new_conversation_id;

  INSERT INTO public.dm_participants (conversation_id, user_id)
  VALUES (new_conversation_id, _user_id), (new_conversation_id, _other_user_id);

  SELECT json_build_object('id', dc.id, 'created_at', dc.created_at)
    INTO result
  FROM public.dm_conversations dc
  WHERE dc.id = new_conversation_id;

  RETURN result;
END;
$$;


--
-- Name: pin_message(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pin_message(_message_id uuid, _user_id uuid, _pinned boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _channel_id uuid;
  _server_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT channel_id INTO _channel_id FROM messages WHERE id = _message_id;
  IF _channel_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  SELECT server_id INTO _server_id FROM channels WHERE id = _channel_id;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT public.check_user_permission(_user_id, _channel_id, 'pin_messages'::permission_type) THEN
      RAISE EXCEPTION 'You do not have permission to pin messages';
    END IF;
  END IF;
  UPDATE messages SET is_pinned = _pinned WHERE id = _message_id;
END;
$$;


--
-- Name: ping_health(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ping_health() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT true
$$;


--
-- Name: post_system_message(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_system_message(_channel_id uuid, _user_id uuid, _content text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _message_id UUID;
  channel_exists boolean;
  user_exists boolean;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT EXISTS(SELECT 1 FROM channels WHERE id = _channel_id) INTO channel_exists;
  IF NOT channel_exists THEN
    RAISE EXCEPTION 'Channel not found: %', _channel_id;
  END IF;

  SELECT EXISTS(SELECT 1 FROM users WHERE id = _user_id) INTO user_exists;
  IF NOT user_exists THEN
    RAISE EXCEPTION 'User not found: %', _user_id;
  END IF;

  INSERT INTO messages (channel_id, user_id, content, is_system_message)
  VALUES (_channel_id, _user_id, _content, TRUE)
  RETURNING id INTO _message_id;

  RETURN _message_id;
END;
$$;


--
-- Name: prevent_channel_member_identity_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_channel_member_identity_change() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.channel_id != OLD.channel_id THEN
    RAISE EXCEPTION 'channel_id cannot be changed';
  END IF;
  IF NEW.user_id != OLD.user_id THEN
    RAISE EXCEPTION 'user_id cannot be changed';
  END IF;
  IF NEW.added_by != OLD.added_by THEN
    RAISE EXCEPTION 'added_by cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: prevent_device_key_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_device_key_change() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.user_id != OLD.user_id THEN
    RAISE EXCEPTION 'Device user_id cannot be changed';
  END IF;
  IF NEW.identity_public_key != OLD.identity_public_key THEN
    RAISE EXCEPTION 'Identity public key cannot be changed after registration';
  END IF;
  IF NEW.device_id != OLD.device_id THEN
    RAISE EXCEPTION 'Device ID cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: prevent_dm_participant_identity_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_dm_participant_identity_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'DM participant user_id cannot be changed';
  END IF;
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id THEN
    RAISE EXCEPTION 'DM participant conversation_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: prevent_friendship_identity_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_friendship_identity_change() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.requester_id != OLD.requester_id THEN
    RAISE EXCEPTION 'Friendship requester_id cannot be changed';
  END IF;
  IF NEW.addressee_id != OLD.addressee_id THEN
    RAISE EXCEPTION 'Friendship addressee_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: prevent_message_identity_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_message_identity_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Message user_id cannot be changed';
  END IF;
  IF NEW.channel_id IS DISTINCT FROM OLD.channel_id THEN
    RAISE EXCEPTION 'Message channel_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: prevent_server_member_privilege_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_server_member_privilege_change() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.role != OLD.role THEN
    RAISE EXCEPTION 'Role changes must go through assigned role functions';
  END IF;
  IF NEW.is_banned != OLD.is_banned THEN
    RAISE EXCEPTION 'Ban status must be changed through moderation functions';
  END IF;
  IF NEW.is_muted != OLD.is_muted THEN
    RAISE EXCEPTION 'Mute status must be changed through moderation functions';
  END IF;
  IF NEW.server_id != OLD.server_id THEN
    RAISE EXCEPTION 'Server ID cannot be changed';
  END IF;
  IF NEW.user_id != OLD.user_id THEN
    RAISE EXCEPTION 'User ID cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: prevent_username_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_username_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    RAISE EXCEPTION 'Username cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: publish_e2e_key_bundle(uuid, text, character varying, integer, text, text, text, integer, character varying, jsonb, integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.publish_e2e_key_bundle(_user_id uuid, _public_key text, _key_fingerprint character varying, _registration_id integer, _encrypted_private_key text, _backup_iv text, _backup_salt text, _device_id integer, _device_name character varying, _prekeys jsonb, _signed_prekey_id integer, _signed_prekey_public text, _signed_prekey_signature text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
    -- Insert identity key (or update if re-registering device)
    INSERT INTO user_identity_keys (user_id, public_key, key_fingerprint, registration_id)
    VALUES (_user_id, _public_key, _key_fingerprint, _registration_id)
    ON CONFLICT (user_id) DO UPDATE SET
        public_key = EXCLUDED.public_key,
        key_fingerprint = EXCLUDED.key_fingerprint,
        registration_id = EXCLUDED.registration_id;

    -- Insert encrypted key backup
    INSERT INTO user_key_backups (user_id, encrypted_identity_private_key, iv, salt)
    VALUES (_user_id, _encrypted_private_key, _backup_iv, _backup_salt)
    ON CONFLICT (user_id) DO UPDATE SET
        encrypted_identity_private_key = EXCLUDED.encrypted_identity_private_key,
        iv = EXCLUDED.iv,
        salt = EXCLUDED.salt,
        updated_at = NOW();

    -- Register device
    INSERT INTO user_devices (user_id, device_id, device_name, identity_public_key)
    VALUES (_user_id, _device_id, _device_name, _public_key)
    ON CONFLICT (user_id, device_id) DO UPDATE SET
        device_name = EXCLUDED.device_name,
        identity_public_key = EXCLUDED.identity_public_key,
        last_active = NOW();

    -- Insert one-time pre-keys
    INSERT INTO user_prekeys (user_id, device_id, key_id, public_key)
    SELECT _user_id, _device_id, 
           (item->>'key_id')::INTEGER, 
           item->>'public_key'
    FROM jsonb_array_elements(_prekeys) AS item
    ON CONFLICT (user_id, device_id, key_id) DO NOTHING;

    -- Insert signed pre-key
    INSERT INTO user_signed_prekeys (user_id, device_id, key_id, public_key, signature)
    VALUES (_user_id, _device_id, _signed_prekey_id, _signed_prekey_public, _signed_prekey_signature)
    ON CONFLICT (user_id, device_id, key_id) DO UPDATE SET
        public_key = EXCLUDED.public_key,
        signature = EXCLUDED.signature,
        is_active = TRUE;

    RETURN TRUE;
END;
$$;


--
-- Name: rate_limit_channel_creation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rate_limit_channel_creation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM channels
  WHERE created_at > NOW() - INTERVAL '1 hour'
  AND server_id = NEW.server_id;

  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded: too many channels created recently';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: recompute_poll_results(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recompute_poll_results(_poll_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _options text[];
  _n integer;
  _results jsonb;
  _total integer;
BEGIN
  SELECT options INTO _options FROM public.polls WHERE id = _poll_id;
  IF _options IS NULL THEN
    RAISE EXCEPTION 'Poll not found';
  END IF;

  _n := COALESCE(array_length(_options, 1), 0);

  SELECT jsonb_agg(COALESCE(v.cnt, 0) ORDER BY s.i)
  INTO _results
  FROM generate_series(0, GREATEST(_n - 1, 0)) AS s(i)
  LEFT JOIN (
    SELECT option_index, COUNT(*)::int AS cnt
    FROM public.poll_votes
    WHERE poll_id = _poll_id
    GROUP BY option_index
  ) v ON v.option_index = s.i;

  SELECT COUNT(*)::int INTO _total FROM public.poll_votes WHERE poll_id = _poll_id;

  UPDATE public.polls
  SET results = COALESCE(_results, '[]'::jsonb),
      total_votes = COALESCE(_total, 0)
  WHERE id = _poll_id;
END;
$$;


--
-- Name: regenerate_invite_code(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.regenerate_invite_code(_server_id uuid, _user_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  new_code text;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_invites') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Generate new invite code (8 characters, alphanumeric, excluding ambiguous chars)
  new_code := upper(
    substring(
      md5(random()::text || clock_timestamp()::text) 
      from 1 for 8
    )
  );
  
  -- Update server with new invite code
  UPDATE servers 
  SET invite_code = new_code 
  WHERE id = _server_id;
  
  RETURN new_code;
END;
$$;


--
-- Name: register_user(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_user(_username text, _key_hash text, _banner_color text DEFAULT '#5865F2'::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
      DECLARE
        new_user_id uuid;
        result json;
        _client_id text;
        _key_bucket text;
      BEGIN
        _client_id := public.request_client_identifier();
        _key_bucket := left(lower(COALESCE(_key_hash, '')), 16);

        IF _client_id <> 'unknown'
           AND NOT public.check_rate_limit(_client_id, 'register_user_client', 8, 60) THEN
          RAISE EXCEPTION 'Rate limited: too many registration attempts';
        END IF;

        IF _client_id <> 'unknown'
           AND NOT public.check_rate_limit(_client_id, 'register_user_hourly', 25, 3600) THEN
          RAISE EXCEPTION 'Rate limited: registration quota reached';
        END IF;

        IF _key_bucket <> ''
           AND NOT public.check_rate_limit(_key_bucket, 'register_user_keyhash', 3, 3600) THEN
          RAISE EXCEPTION 'Rate limited: key hash attempt quota reached';
        END IF;

        IF _key_hash IS NULL OR length(_key_hash) != 64 OR _key_hash !~ '^[a-fA-F0-9]{64}$' THEN
          RAISE EXCEPTION 'Invalid key hash format';
        END IF;

        IF _username IS NULL THEN
          RAISE EXCEPTION 'Username is required';
        END IF;

        _username := lower(trim(_username));

        IF length(_username) < 3 OR length(_username) > 20 THEN
          RAISE EXCEPTION 'Username must be between 3 and 20 characters';
        END IF;

        IF _username !~ '^[a-z0-9_]+$' THEN
          RAISE EXCEPTION 'Username can only contain lowercase letters, numbers, and underscores';
        END IF;

        IF _username IN ('admin', 'administrator', 'moderator', 'user', 'system', 'root', 'support', 'help') THEN
          RAISE EXCEPTION 'This username is reserved';
        END IF;

        IF EXISTS (SELECT 1 FROM public.users WHERE username = _username) THEN
          RAISE EXCEPTION 'Username already taken';
        END IF;

        INSERT INTO public.users (username, status, banner_color)
        VALUES (_username, 'online', COALESCE(_banner_color, '#5865F2'))
        RETURNING id INTO new_user_id;

        INSERT INTO public.user_auth (user_id, key_hash)
        VALUES (new_user_id, _key_hash);

        SELECT json_build_object(
          'id', u.id,
          'username', u.username,
          'display_name', u.display_name,
          'avatar_url', u.avatar_url,
          'banner_url', u.banner_url,
          'avatar_decoration', u.avatar_decoration,
          'profile_effect', u.profile_effect,
          'banner_color', u.banner_color,
          'profile_theme_primary', u.profile_theme_primary,
          'profile_theme_accent', u.profile_theme_accent,
    'bio', u.bio,
    'status', u.status,
    'custom_status', u.custom_status,
    'allow_nsfw', u.allow_nsfw,
    'created_at', u.created_at,
    'last_seen', u.last_seen
  ) INTO result
        FROM public.users u
        WHERE u.id = new_user_id;

        RETURN result;
      END;
      $_$;


--
-- Name: remove_channel_member(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_channel_member(_channel_id uuid, _target_user_id uuid, _removed_by uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _channel RECORD;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get channel info
  SELECT id, server_id, is_private INTO _channel
  FROM channels WHERE id = _channel_id;
  
  IF NOT FOUND OR NOT _channel.is_private THEN
    RETURN false;
  END IF;
  
  -- Check if remover has permission (admin/owner or removing self)
  IF _removed_by != _target_user_id AND NOT EXISTS (
    SELECT 1 FROM server_members 
    WHERE server_id = _channel.server_id 
    AND user_id = _removed_by 
    AND role IN ('owner', 'admin')
  ) THEN
    RETURN false;
  END IF;
  
  -- Delete member
  DELETE FROM channel_members 
  WHERE channel_id = _channel_id AND user_id = _target_user_id;
  
  RETURN true;
END;
$$;


--
-- Name: remove_dm_reaction(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_dm_reaction(_message_id uuid, _user_id uuid, _emoji text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  DELETE FROM dm_reactions WHERE message_id = _message_id AND user_id = _user_id AND emoji = _emoji;
  RETURN true;
END;
$$;


--
-- Name: remove_friend(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_friend(_friendship_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.friendships
    WHERE id = _friendship_id
      AND (requester_id = _user_id OR addressee_id = _user_id)
      AND status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'Friendship not found';
  END IF;

  DELETE FROM public.friendships
  WHERE id = _friendship_id;

  RETURN true;
END;
$$;


--
-- Name: remove_reaction(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_reaction(_message_id uuid, _user_id uuid, _emoji text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  channel_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get the channel_id from the message
  SELECT m.channel_id INTO channel_id
  FROM messages m
  WHERE m.id = _message_id;
  
  IF channel_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  
  -- Check permission using database-backed permission system
  IF NOT public.check_user_permission(_user_id, channel_id, 'add_reactions') THEN
    RAISE EXCEPTION 'You do not have permission to remove reactions in this channel';
  END IF;
  
  DELETE FROM reactions WHERE message_id = _message_id AND user_id = _user_id AND emoji = _emoji;
  RETURN true;
END;
$$;


--
-- Name: remove_role_from_member(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_role_from_member(_user_id uuid, _member_id uuid, _role_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _server_id uuid;
  _is_owner boolean;
  _has_manage_roles boolean;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT server_id INTO _server_id FROM server_members WHERE id = _member_id;
  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  SELECT (owner_id = _user_id) INTO _is_owner FROM servers WHERE id = _server_id;

  IF _is_owner THEN
    DELETE FROM server_member_roles WHERE member_id = _member_id AND role_id = _role_id;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM server_member_roles smr
    JOIN server_members sm ON sm.id = smr.member_id
    JOIN role_permissions rp ON rp.role_id = smr.role_id AND rp.server_id = _server_id
    WHERE sm.user_id = _user_id AND sm.server_id = _server_id
      AND rp.permission = 'manage_roles' AND rp.allowed = true
  ) INTO _has_manage_roles;

  IF NOT _has_manage_roles THEN
    RAISE EXCEPTION 'Only admins and owners can remove roles';
  END IF;

  DELETE FROM server_member_roles WHERE member_id = _member_id AND role_id = _role_id;
END;
$$;


--
-- Name: rename_server_emoji(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rename_server_emoji(_emoji_id uuid, _user_id uuid, _new_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
DECLARE
  _server_id UUID;
  _role TEXT;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get the server this emoji belongs to
  SELECT server_id INTO _server_id
  FROM server_emojis
  WHERE id = _emoji_id;

  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Emoji not found';
  END IF;

  -- Check user's role in the server
  SELECT role INTO _role
  FROM server_members
  WHERE server_id = _server_id AND user_id = _user_id;

  IF _role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;

  IF _role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Validate name format
  IF _new_name !~ '^[a-z0-9_]{2,12}$' THEN
    RAISE EXCEPTION 'Invalid emoji name format';
  END IF;

  -- Update the emoji name
  UPDATE server_emojis
  SET name = _new_name
  WHERE id = _emoji_id AND server_id = _server_id;
END;
$_$;


--
-- Name: reorder_categories(uuid, uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reorder_categories(_server_id uuid, _user_id uuid, _category_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  i INTEGER;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Verify user is admin/owner of the server
  IF NOT EXISTS (
    SELECT 1 FROM server_members
    WHERE server_id = _server_id AND user_id = _user_id
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Update positions
  FOR i IN 1..array_length(_category_ids, 1) LOOP
    UPDATE channel_categories
    SET position = i - 1
    WHERE id = _category_ids[i] AND server_id = _server_id;
  END LOOP;
END;
$$;


--
-- Name: reorder_channels(uuid, uuid, uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reorder_channels(_server_id uuid, _user_id uuid, _channel_id uuid, _new_category_id uuid, _new_position integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _old_category_id uuid;
  _old_position integer;
  _rec record;
  _pos integer;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT category_id, position INTO _old_category_id, _old_position
  FROM public.channels
  WHERE id = _channel_id
    AND server_id = _server_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  _pos := 0;
  FOR _rec IN
    SELECT id
    FROM public.channels
    WHERE server_id = _server_id
      AND category_id IS NOT DISTINCT FROM _old_category_id
    ORDER BY position, created_at
  LOOP
    UPDATE public.channels SET position = _pos WHERE id = _rec.id;
    _pos := _pos + 1;
  END LOOP;

  IF NOT (_old_category_id IS NOT DISTINCT FROM _new_category_id) THEN
    _pos := 0;
    FOR _rec IN
      SELECT id
      FROM public.channels
      WHERE server_id = _server_id
        AND category_id IS NOT DISTINCT FROM _new_category_id
      ORDER BY position, created_at
    LOOP
      UPDATE public.channels SET position = _pos WHERE id = _rec.id;
      _pos := _pos + 1;
    END LOOP;
  END IF;

  SELECT position INTO _old_position
  FROM public.channels
  WHERE id = _channel_id
    AND server_id = _server_id;

  IF (_old_category_id IS NOT DISTINCT FROM _new_category_id) THEN
    IF _new_position > _old_position THEN
      UPDATE public.channels
      SET position = position - 1
      WHERE server_id = _server_id
        AND category_id IS NOT DISTINCT FROM _new_category_id
        AND position > _old_position
        AND position <= _new_position
        AND id <> _channel_id;
    ELSIF _new_position < _old_position THEN
      UPDATE public.channels
      SET position = position + 1
      WHERE server_id = _server_id
        AND category_id IS NOT DISTINCT FROM _new_category_id
        AND position >= _new_position
        AND position < _old_position
        AND id <> _channel_id;
    END IF;
  ELSE
    UPDATE public.channels
    SET position = position - 1
    WHERE server_id = _server_id
      AND category_id IS NOT DISTINCT FROM _old_category_id
      AND position > _old_position;

    UPDATE public.channels
    SET position = position + 1
    WHERE server_id = _server_id
      AND category_id IS NOT DISTINCT FROM _new_category_id
      AND position >= _new_position;
  END IF;

  UPDATE public.channels
  SET category_id = _new_category_id, position = _new_position
  WHERE id = _channel_id
    AND server_id = _server_id;
END;
$$;


--
-- Name: reorder_server_roles(uuid, uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reorder_server_roles(_server_id uuid, _user_id uuid, _ordered_role_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  i INT;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Verify user has permission (correct parameter order: user_id, server_id, permission)
  IF NOT check_user_server_permission(_user_id, _server_id, 'manage_roles') THEN
    RAISE EXCEPTION 'Permission denied: cannot reorder roles';
  END IF;

  -- Update positions based on array order
  FOR i IN 1..array_length(_ordered_role_ids, 1) LOOP
    UPDATE server_roles
    SET position = i - 1
    WHERE id = _ordered_role_ids[i]
      AND server_id = _server_id;
  END LOOP;
END;
$$;


--
-- Name: reorder_user_servers(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reorder_user_servers(_user_id uuid, _server_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  FOR i IN 1..array_length(_server_ids, 1) LOOP
    UPDATE server_members 
    SET position = i
    WHERE user_id = _user_id AND server_id = _server_ids[i];
  END LOOP;
END;
$$;


--
-- Name: replenish_prekeys(uuid, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replenish_prekeys(_user_id uuid, _device_id integer, _prekeys jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
    inserted_count INTEGER;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
    WITH inserted AS (
        INSERT INTO user_prekeys (user_id, device_id, key_id, public_key)
        SELECT _user_id, _device_id,
               (item->>'key_id')::INTEGER,
               item->>'public_key'
        FROM jsonb_array_elements(_prekeys) AS item
        ON CONFLICT (user_id, device_id, key_id) DO NOTHING
        RETURNING id
    )
    SELECT COUNT(*) INTO inserted_count FROM inserted;

    RETURN inserted_count;
END;
$$;


--
-- Name: request_client_identifier(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_client_identifier() RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  headers json;
  id_text text;
  request_key_hash text;
  resolved_user_id uuid;
  forwarded_for text;
  forwarded_parts text[];
BEGIN
  BEGIN
    headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'unknown';
  END;

  request_key_hash := NULLIF(trim(headers->>'x-key-hash'), '');
  IF request_key_hash IS NOT NULL
     AND length(request_key_hash) = 64
     AND request_key_hash ~ '^[a-fA-F0-9]{64}$' THEN
    SELECT ua.user_id
      INTO resolved_user_id
    FROM public.user_auth ua
    WHERE ua.key_hash = request_key_hash
    LIMIT 1;

    IF resolved_user_id IS NOT NULL THEN
      RETURN left('user:' || resolved_user_id::text, 128);
    END IF;
  END IF;

  id_text := NULLIF(trim(headers->>'x-forwarded-for'), '');
  IF id_text IS NOT NULL THEN
    forwarded_for := id_text;
    forwarded_parts := regexp_split_to_array(forwarded_for, '\s*,\s*');
    IF array_length(forwarded_parts, 1) IS NOT NULL THEN
      id_text := NULLIF(trim(forwarded_parts[array_length(forwarded_parts, 1)]), '');
    END IF;
  END IF;

  IF id_text IS NULL THEN
    id_text := NULLIF(trim(headers->>'x-real-ip'), '');
  END IF;

  IF id_text IS NULL THEN
    id_text := NULLIF(trim(headers->>'cf-connecting-ip'), '');
  END IF;

  IF id_text IS NULL THEN
    RETURN 'unknown';
  END IF;

  RETURN left('ip:' || id_text, 128);
END;
$_$;


--
-- Name: requesting_user_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.requesting_user_id() RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  BEGIN
    RETURN public.get_request_user_id();
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;
END;
$$;


--
-- Name: reset_mention_count_on_read(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_mention_count_on_read() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- If the user is updating their last_read_message_id, reset pings to 0
  IF NEW.last_read_message_id IS DISTINCT FROM OLD.last_read_message_id THEN
    NEW.mention_count := 0;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: reset_user_secret_key(uuid, character); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_user_secret_key(_user_id uuid, _new_key_hash character) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_last_reset timestamptz;
  v_cooldown_hours int := 24;
  v_time_remaining interval;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF _new_key_hash IS NULL OR _new_key_hash !~ '^[a-fA-F0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid key hash format';
  END IF;

  SELECT last_key_reset_at INTO v_last_reset
  FROM public.users
  WHERE id = _user_id;

  IF v_last_reset IS NOT NULL
     AND v_last_reset > (now() - (v_cooldown_hours || ' hours')::interval) THEN
    v_time_remaining := v_last_reset + (v_cooldown_hours || ' hours')::interval - now();
    RETURN json_build_object(
      'success', false,
      'error', 'cooldown',
      'cooldown_ends_at', v_last_reset + (v_cooldown_hours || ' hours')::interval,
      'hours_remaining', extract(epoch from v_time_remaining) / 3600
    );
  END IF;

  UPDATE public.users
  SET key_hash = _new_key_hash,
      last_key_reset_at = now()
  WHERE id = _user_id;

  RETURN json_build_object('success', true, 'last_key_reset_at', now());
END;
$_$;


--
-- Name: revoke_server_invite(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_server_invite(_invite_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  target_server_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT si.server_id INTO target_server_id
  FROM public.server_invites si
  WHERE si.id = _invite_id;

  IF target_server_id IS NULL THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, target_server_id, 'manage_invites') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.server_invites
  SET revoked_at = now(),
      revoked_by = _user_id
  WHERE id = _invite_id
    AND revoked_at IS NULL;

  RETURN true;
END;
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: save_user_server_folders(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_user_server_folders(_user_id uuid, _folder_data jsonb) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  INSERT INTO public.user_server_folders (user_id, folder_data, updated_at)
  VALUES (_user_id, _folder_data, now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    folder_data = EXCLUDED.folder_data,
    updated_at = now();

  RETURN true;
END;
$$;


--
-- Name: save_user_server_tabs(uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_user_server_tabs(_user_id uuid, _tab_data text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  INSERT INTO user_server_tabs (user_id, tab_order, updated_at)
  VALUES (_user_id, _tab_data, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET tab_order = _tab_data, updated_at = now();
END;
$$;


--
-- Name: search_messages(text, uuid, uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_messages(search_query text, server_filter uuid DEFAULT NULL::uuid, channel_filter uuid DEFAULT NULL::uuid, user_filter uuid DEFAULT NULL::uuid, result_limit integer DEFAULT 50) RETURNS TABLE(message_id uuid, channel_id uuid, user_id uuid, content text, created_at timestamp with time zone, rank real)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _current_user_id uuid;
BEGIN
  _current_user_id := public.requesting_user_id();

  IF _current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify user is member of the server if filtering by server
  IF server_filter IS NOT NULL THEN
    IF NOT public.is_server_member(server_filter, _current_user_id) THEN
      RAISE EXCEPTION 'Access denied: not a member of this server';
    END IF;
  END IF;

  -- Only return messages from servers the user is a member of
  RETURN QUERY
  SELECT
    m.id AS message_id,
    m.channel_id,
    m.user_id,
    m.content,
    m.created_at,
    ts_rank(to_tsvector('english', m.content), plainto_tsquery('english', search_query)) AS rank
  FROM public.messages m
  JOIN public.channels c ON m.channel_id = c.id
  WHERE
    to_tsvector('english', m.content) @@ plainto_tsquery('english', search_query)
    AND (server_filter IS NULL OR c.server_id = server_filter)
    AND (channel_filter IS NULL OR m.channel_id = channel_filter)
    AND (user_filter IS NULL OR m.user_id = user_filter)
    AND public.is_server_member(c.server_id, _current_user_id)
  ORDER BY rank DESC, m.created_at DESC
  LIMIT result_limit;
END;
$$;


--
-- Name: send_dm(uuid, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_dm(_conversation_id uuid, _sender_id uuid, _content text, _reply_to_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  new_message_id uuid;
  other_user_id uuid;
  result json;
  recent_count_1m integer;
  recent_count_10s integer;
  convo_count_10s integer;
  sender_created_at timestamptz;
BEGIN
  IF NOT public.verify_request_identity(_sender_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF _content IS NULL OR trim(_content) = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  IF char_length(_content) > 2000 THEN
    RAISE EXCEPTION 'Message must be 2000 characters or less';
  END IF;

  SELECT u.created_at INTO sender_created_at
  FROM public.users u
  WHERE u.id = _sender_id;

  IF sender_created_at IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF sender_created_at > now() - interval '2 minutes' THEN
    RAISE EXCEPTION 'DMs are temporarily restricted for new accounts';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.dm_participants
    WHERE conversation_id = _conversation_id
      AND user_id = _sender_id
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;

  SELECT count(*) INTO recent_count_1m
  FROM public.direct_messages
  WHERE sender_id = _sender_id
    AND created_at > now() - interval '1 minute';

  IF recent_count_1m >= 20 THEN
    RAISE EXCEPTION 'Rate limited: too many DM messages';
  END IF;

  SELECT count(*) INTO recent_count_10s
  FROM public.direct_messages
  WHERE sender_id = _sender_id
    AND created_at > now() - interval '10 seconds';

  IF recent_count_10s >= 6 THEN
    RAISE EXCEPTION 'Rate limited: sending DMs too quickly';
  END IF;

  SELECT count(*) INTO convo_count_10s
  FROM public.direct_messages
  WHERE sender_id = _sender_id
    AND conversation_id = _conversation_id
    AND created_at > now() - interval '10 seconds';

  IF convo_count_10s >= 4 THEN
    RAISE EXCEPTION 'Rate limited: too many messages in this DM';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.direct_messages dm
    WHERE dm.sender_id = _sender_id
      AND dm.conversation_id = _conversation_id
      AND dm.content = _content
      AND dm.created_at > now() - interval '30 seconds'
  ) THEN
    RAISE EXCEPTION 'Duplicate DM blocked';
  END IF;

  SELECT dp.user_id INTO other_user_id
  FROM public.dm_participants dp
  WHERE dp.conversation_id = _conversation_id
    AND dp.user_id <> _sender_id
  LIMIT 1;

  IF other_user_id IS NULL THEN
    RAISE EXCEPTION 'Conversation has no recipient';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status = 'blocked'
      AND (
        (f.requester_id = _sender_id AND f.addressee_id = other_user_id)
        OR (f.requester_id = other_user_id AND f.addressee_id = _sender_id)
      )
  ) THEN
    RAISE EXCEPTION 'Cannot send DM to this user';
  END IF;

  INSERT INTO public.direct_messages (conversation_id, sender_id, content, reply_to_id)
  VALUES (_conversation_id, _sender_id, _content, _reply_to_id)
  RETURNING id INTO new_message_id;

  SELECT json_build_object(
    'id', dm.id,
    'conversation_id', dm.conversation_id,
    'sender_id', dm.sender_id,
    'content', dm.content,
    'reply_to_id', dm.reply_to_id,
    'created_at', dm.created_at,
    'edited_at', dm.edited_at
  )
  INTO result
  FROM public.direct_messages dm
  WHERE dm.id = new_message_id;

  RETURN result;
END;
$$;


--
-- Name: send_friend_request(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_friend_request(_requester_id uuid, _addressee_username text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _caller_id uuid;
  _addressee_id uuid;
  _existing_friendship record;
  _declined_request record;
  _new_friendship record;
  _cooldown_minutes int := 5;
  _time_since_decline interval;
  _remaining_minutes int;
  _pending_outgoing_count int;
  _requester_created_at timestamptz;
  _target_bucket text;
BEGIN
  _caller_id := public.get_request_user_id();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _requester_id IS DISTINCT FROM _caller_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.verify_request_identity(_requester_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  -- Account-age gate to reduce fresh-account spray.
  SELECT u.created_at
    INTO _requester_created_at
  FROM public.users u
  WHERE u.id = _requester_id;

  IF _requester_created_at IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF _requester_created_at > now() - interval '15 minutes' THEN
    RAISE EXCEPTION 'Your account is too new to send friend requests. Please wait a few minutes.';
  END IF;

  -- Requester-side abuse controls.
  IF NOT public.check_rate_limit(_requester_id::text, 'friend_request_burst', 5, 60) THEN
    RAISE EXCEPTION 'Rate limited: too many friend requests. Please wait a minute.';
  END IF;

  IF NOT public.check_rate_limit(_requester_id::text, 'friend_request_hourly', 25, 3600) THEN
    RAISE EXCEPTION 'Rate limited: friend request quota reached. Try again later.';
  END IF;

  IF NOT public.check_rate_limit(_requester_id::text, 'friend_request_daily', 80, 86400) THEN
    RAISE EXCEPTION 'Rate limited: daily friend request quota reached.';
  END IF;

  -- Resolve target.
  SELECT u.id
    INTO _addressee_id
  FROM public.users u
  WHERE lower(u.username) = lower(_addressee_username);

  IF _addressee_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF _addressee_id = _requester_id THEN
    RAISE EXCEPTION 'Cannot send friend request to yourself';
  END IF;

  -- Recipient-side anti-spray controls (cross-account protection).
  _target_bucket := 'friend_target:' || _addressee_id::text;

  IF NOT public.check_rate_limit(_target_bucket, 'incoming_friend_request_burst', 8, 60) THEN
    RAISE EXCEPTION 'This user is receiving too many requests right now. Try later.';
  END IF;

  IF NOT public.check_rate_limit(_target_bucket, 'incoming_friend_request_hourly', 60, 3600) THEN
    RAISE EXCEPTION 'This user is receiving too many requests right now. Try later.';
  END IF;

  -- Require shared context to reduce unsolicited global spray.
  IF NOT public.shares_server_with(_requester_id, _addressee_id)
     AND NOT public.shares_dm_with(_requester_id, _addressee_id) THEN
    RAISE EXCEPTION 'Cannot send friend request to this user';
  END IF;

  -- Cap outstanding pending requests per requester.
  SELECT count(*)::int
    INTO _pending_outgoing_count
  FROM public.friendships
  WHERE requester_id = _requester_id
    AND status = 'pending';

  IF _pending_outgoing_count >= 50 THEN
    RAISE EXCEPTION 'Too many pending friend requests. Cancel some and try again.';
  END IF;

  -- Existing relationship checks.
  SELECT *
    INTO _existing_friendship
  FROM public.friendships
  WHERE (requester_id = _requester_id AND addressee_id = _addressee_id)
     OR (requester_id = _addressee_id AND addressee_id = _requester_id);

  IF _existing_friendship IS NOT NULL THEN
    IF _existing_friendship.status = 'accepted' THEN
      RAISE EXCEPTION 'Already friends with this user';
    END IF;

    IF _existing_friendship.status = 'blocked' THEN
      RAISE EXCEPTION 'Cannot send friend request';
    END IF;

    IF _existing_friendship.status = 'pending' THEN
      IF _existing_friendship.requester_id = _requester_id THEN
        RAISE EXCEPTION 'Friend request already pending';
      ELSE
        UPDATE public.friendships
        SET status = 'accepted'
        WHERE id = _existing_friendship.id
        RETURNING * INTO _existing_friendship;

        RETURN json_build_object('id', _existing_friendship.id, 'status', 'accepted');
      END IF;
    END IF;
  END IF;

  -- Decline cooldown.
  SELECT *
    INTO _declined_request
  FROM public.declined_friend_requests
  WHERE requester_id = _requester_id
    AND addressee_id = _addressee_id;

  IF _declined_request IS NOT NULL THEN
    _time_since_decline := now() - _declined_request.declined_at;

    IF _time_since_decline < (_cooldown_minutes || ' minutes')::interval THEN
      _remaining_minutes := ceil(
        extract(
          epoch from ((_cooldown_minutes || ' minutes')::interval - _time_since_decline)
        ) / 60
      );
      RAISE EXCEPTION 'You can send another request in % minute(s)', _remaining_minutes;
    END IF;

    DELETE FROM public.declined_friend_requests
    WHERE requester_id = _requester_id
      AND addressee_id = _addressee_id;
  END IF;

  -- Create request + notification.
  INSERT INTO public.friendships (requester_id, addressee_id, status, created_at)
  VALUES (_requester_id, _addressee_id, 'pending', now())
  RETURNING * INTO _new_friendship;

  PERFORM public.create_notification(
    _user_id := _addressee_id,
    _type := 'friend_request',
    _title := 'New Friend Request',
    _body := (SELECT username FROM public.users WHERE id = _requester_id) || ' sent you a friend request',
    _link := '/app'
  );

  RETURN json_build_object('id', _new_friendship.id, 'status', 'pending');
END;
$$;


--
-- Name: send_message(uuid, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_message(_user_id uuid, _channel_id uuid, _content text, _reply_to_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  channel_server_id uuid;
  channel_is_read_only boolean;
  is_muted boolean;
  user_role server_role;
  new_message_id uuid;
  result json;
  sender_created_at timestamptz;
  recent_count_10s integer;
  recent_count_1m integer;
  normalized_content text;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  normalized_content := trim(_content);

  IF normalized_content IS NULL OR length(normalized_content) = 0 THEN
    RAISE EXCEPTION 'Message content cannot be empty.';
  END IF;

  IF length(normalized_content) > 2000 THEN
    RAISE EXCEPTION 'Message content cannot exceed 2000 characters.';
  END IF;

  SELECT u.created_at INTO sender_created_at
  FROM public.users u
  WHERE u.id = _user_id;

  IF sender_created_at IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF sender_created_at > now() - interval '2 minutes' THEN
    RAISE EXCEPTION 'Messaging is temporarily restricted for new accounts';
  END IF;

  -- Existing global burst limiter.
  IF NOT public.check_rate_limit(_user_id::text, 'send_message', 10, 5) THEN
    RAISE EXCEPTION 'You are sending messages too fast. Please slow down.';
  END IF;

  -- Additional anti-flood guards.
  SELECT count(*) INTO recent_count_10s
  FROM public.messages m
  WHERE m.user_id = _user_id
    AND m.channel_id = _channel_id
    AND m.created_at > now() - interval '10 seconds';

  IF recent_count_10s >= 6 THEN
    RAISE EXCEPTION 'Rate limited: too many messages in this channel';
  END IF;

  SELECT count(*) INTO recent_count_1m
  FROM public.messages m
  WHERE m.user_id = _user_id
    AND m.created_at > now() - interval '1 minute';

  IF recent_count_1m >= 30 THEN
    RAISE EXCEPTION 'Rate limited: minute message quota reached';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE m.user_id = _user_id
      AND m.channel_id = _channel_id
      AND m.content = normalized_content
      AND m.created_at > now() - interval '15 seconds'
  ) THEN
    RAISE EXCEPTION 'Duplicate message blocked';
  END IF;

  SELECT server_id, is_read_only INTO channel_server_id, channel_is_read_only
  FROM public.channels WHERE id = _channel_id;

  IF channel_server_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  SELECT sm.is_muted, sm.role INTO is_muted, user_role
  FROM public.server_members sm
  WHERE sm.server_id = channel_server_id
    AND sm.user_id = _user_id
    AND sm.is_banned = false;

  IF is_muted IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;

  IF is_muted THEN
    RAISE EXCEPTION 'You are muted in this server';
  END IF;

  IF NOT public.check_user_permission(_user_id, _channel_id, 'send_messages') THEN
    RAISE EXCEPTION 'You do not have permission to send messages in this channel';
  END IF;

  IF channel_is_read_only = true THEN
    IF NOT public.check_user_permission(_user_id, _channel_id, 'manage_messages') THEN
      RAISE EXCEPTION 'This channel is read-only';
    END IF;
  END IF;

  IF _reply_to_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.messages
      WHERE id = _reply_to_id
        AND channel_id = _channel_id
    ) THEN
      RAISE EXCEPTION 'Invalid reply reference.';
    END IF;
  END IF;

  INSERT INTO public.messages (channel_id, user_id, content, reply_to_id)
  VALUES (_channel_id, _user_id, normalized_content, _reply_to_id)
  RETURNING id INTO new_message_id;

  SELECT json_build_object(
    'id', m.id,
    'channel_id', m.channel_id,
    'user_id', m.user_id,
    'content', m.content,
    'reply_to_id', m.reply_to_id,
    'is_pinned', m.is_pinned,
    'edited_at', m.edited_at,
    'created_at', m.created_at
  ) INTO result
  FROM public.messages m
  WHERE m.id = new_message_id;

  RETURN result;
END;
$$;


--
-- Name: send_poll(uuid, uuid, text, text[], boolean, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_poll(_channel_id uuid, _user_id uuid, _question text, _options text[], _allow_multiple boolean DEFAULT false, _duration_seconds integer DEFAULT 1800, _reply_to_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  channel_server_id uuid;
  is_muted boolean;
  new_message_id uuid;
  new_poll_id uuid;
  _ends_at timestamptz;
  _n integer;
  _results_init jsonb;
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  IF _question IS NULL OR length(trim(_question)) = 0 THEN
    RAISE EXCEPTION 'Poll question is required';
  END IF;

  _n := COALESCE(array_length(_options, 1), 0);
  IF _n < 2 OR _n > 4 THEN
    RAISE EXCEPTION 'Poll must have 2-4 options';
  END IF;

  IF _duration_seconds IS NULL OR _duration_seconds < 60 THEN
    RAISE EXCEPTION 'Poll duration must be at least 60 seconds';
  END IF;

  -- Permissions/membership checks (mirror send_message behaviour)
  SELECT server_id INTO channel_server_id FROM public.channels WHERE id = _channel_id;
  IF channel_server_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  SELECT sm.is_muted INTO is_muted FROM public.server_members sm
  WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;

  IF is_muted IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;

  IF is_muted THEN
    RAISE EXCEPTION 'You are muted in this server';
  END IF;

  IF NOT public.check_user_permission(_user_id, _channel_id, 'send_messages') THEN
    RAISE EXCEPTION 'You do not have permission to send messages in this channel';
  END IF;

  IF (SELECT is_read_only FROM public.channels WHERE id = _channel_id) = true THEN
    IF NOT public.check_user_permission(_user_id, _channel_id, 'manage_messages') THEN
      RAISE EXCEPTION 'This channel is read-only';
    END IF;
  END IF;

  _ends_at := now() + make_interval(secs => _duration_seconds);

  new_poll_id := gen_random_uuid();

  -- Create message with final poll marker content (avoids realtime INSERT then UPDATE flicker)
  INSERT INTO public.messages (channel_id, user_id, content, reply_to_id)
  VALUES (_channel_id, _user_id, '__kloak_poll__:' || new_poll_id::text, _reply_to_id)
  RETURNING id INTO new_message_id;

  SELECT jsonb_agg(0) INTO _results_init FROM generate_series(1, _n);

  INSERT INTO public.polls (
    id,
    message_id,
    channel_id,
    created_by,
    question,
    options,
    allow_multiple,
    ends_at,
    is_closed,
    results,
    total_votes
  ) VALUES (
    new_poll_id,
    new_message_id,
    _channel_id,
    _user_id,
    trim(_question),
    _options,
    COALESCE(_allow_multiple, false),
    _ends_at,
    false,
    COALESCE(_results_init, '[]'::jsonb),
    0
  );

  SELECT json_build_object(
    'id', m.id,
    'channel_id', m.channel_id,
    'user_id', m.user_id,
    'content', m.content,
    'reply_to_id', m.reply_to_id,
    'is_pinned', m.is_pinned,
    'edited_at', m.edited_at,
    'created_at', m.created_at
  ) INTO result
  FROM public.messages m WHERE m.id = new_message_id;

  RETURN result;
END;
$$;


--
-- Name: send_thread_message(uuid, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_thread_message(_thread_id uuid, _user_id uuid, _content text, _reply_to_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  thread_channel_id uuid;
  channel_server_id uuid;
  is_muted boolean;
  new_message_id uuid;
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get thread's channel
  SELECT channel_id INTO thread_channel_id
  FROM threads
  WHERE id = _thread_id;

  IF thread_channel_id IS NULL THEN
    RAISE EXCEPTION 'Thread not found';
  END IF;

  -- Get channel's server
  SELECT server_id INTO channel_server_id
  FROM channels
  WHERE id = thread_channel_id;

  -- Check membership and muted status
  SELECT sm.is_muted INTO is_muted
  FROM server_members sm
  WHERE sm.server_id = channel_server_id
    AND sm.user_id = _user_id
    AND sm.is_banned = false;

  IF is_muted IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;

  IF is_muted THEN
    RAISE EXCEPTION 'You are muted in this server';
  END IF;

  -- Insert thread message
  INSERT INTO thread_messages (thread_id, user_id, content, reply_to_id)
  VALUES (_thread_id, _user_id, _content, _reply_to_id)
  RETURNING id INTO new_message_id;

  -- Return the message
  SELECT json_build_object(
    'id', tm.id,
    'thread_id', tm.thread_id,
    'user_id', tm.user_id,
    'content', tm.content,
    'reply_to_id', tm.reply_to_id,
    'edited_at', tm.edited_at,
    'created_at', tm.created_at
  ) INTO result
  FROM thread_messages tm
  WHERE tm.id = new_message_id;

  RETURN result;
END;
$$;


--
-- Name: set_category_permission(uuid, uuid, text, boolean, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_category_permission(_category_id uuid, _user_id uuid, _permission text, _allowed boolean, _role_id uuid DEFAULT NULL::uuid, _role_name text DEFAULT NULL::text, _target_user_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _server_id uuid;
BEGIN
  IF _user_id IS NULL OR NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT server_id INTO _server_id
  FROM public.channel_categories
  WHERE id = _category_id;

  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'You do not have permission to manage category permissions';
  END IF;

  IF _target_user_id IS NOT NULL THEN
    INSERT INTO public.category_permissions (category_id, user_id, permission, allowed)
    VALUES (_category_id, _target_user_id, _permission, _allowed)
    ON CONFLICT (category_id, role_id, role_name, user_id, permission)
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSIF _role_id IS NOT NULL THEN
    INSERT INTO public.category_permissions (category_id, role_id, permission, allowed)
    VALUES (_category_id, _role_id, _permission, _allowed)
    ON CONFLICT (category_id, role_id, role_name, user_id, permission)
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSIF _role_name IS NOT NULL THEN
    INSERT INTO public.category_permissions (category_id, role_name, permission, allowed)
    VALUES (_category_id, _role_name, _permission, _allowed)
    ON CONFLICT (category_id, role_id, role_name, user_id, permission)
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSE
    RAISE EXCEPTION 'One of role_id, role_name, or target_user_id must be provided';
  END IF;
END;
$$;


--
-- Name: set_channel_permission(uuid, uuid, public.permission_type, boolean, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_channel_permission(_channel_id uuid, _user_id uuid, _permission public.permission_type, _allowed boolean, _role_id uuid DEFAULT NULL::uuid, _role_name text DEFAULT NULL::text, _target_user_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _server_id uuid;
BEGIN
  IF _user_id IS NULL OR NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT server_id INTO _server_id
  FROM public.channels
  WHERE id = _channel_id;

  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'You do not have permission to manage channel permissions';
  END IF;

  IF _target_user_id IS NOT NULL THEN
    INSERT INTO public.channel_permissions (channel_id, user_id, permission, allowed)
    VALUES (_channel_id, _target_user_id, _permission, _allowed)
    ON CONFLICT (channel_id, user_id, permission) WHERE user_id IS NOT NULL
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSIF _role_id IS NOT NULL THEN
    INSERT INTO public.channel_permissions (channel_id, role_id, permission, allowed)
    VALUES (_channel_id, _role_id, _permission, _allowed)
    ON CONFLICT (channel_id, role_id, permission) WHERE role_id IS NOT NULL AND user_id IS NULL
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSIF _role_name IS NOT NULL THEN
    INSERT INTO public.channel_permissions (channel_id, role_name, permission, allowed)
    VALUES (_channel_id, _role_name::public.server_role, _permission, _allowed)
    ON CONFLICT (channel_id, role_name, permission) WHERE role_name IS NOT NULL AND role_id IS NULL AND user_id IS NULL
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSE
    RAISE EXCEPTION 'One of role_id, role_name, or target_user_id must be provided';
  END IF;
END;
$$;


--
-- Name: set_dm_privacy_preference(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_dm_privacy_preference(_user_id uuid, _dm_privacy text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF _dm_privacy IS NULL OR _dm_privacy NOT IN ('everyone', 'shared_servers', 'friends', 'no_one') THEN
    RAISE EXCEPTION 'Invalid dm_privacy value';
  END IF;

  INSERT INTO public.user_preferences (user_id, dm_privacy)
  VALUES (_user_id, _dm_privacy)
  ON CONFLICT (user_id) DO UPDATE
  SET dm_privacy = EXCLUDED.dm_privacy,
      updated_at = now();
END;
$$;


--
-- Name: set_message_embed_hidden(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_message_embed_hidden(_message_id uuid, _user_id uuid, _hidden boolean) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_message_user_id UUID;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get the message owner
  SELECT user_id INTO v_message_user_id
  FROM messages
  WHERE id = _message_id;
  
  -- Only allow the message author to change embed visibility
  IF v_message_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  IF v_message_user_id != _user_id THEN
    RETURN false;
  END IF;
  
  -- Update the embed_hidden flag
  UPDATE messages
  SET embed_hidden = _hidden
  WHERE id = _message_id;
  
  RETURN true;
END;
$$;


--
-- Name: set_reaction_channel_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_reaction_channel_id() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Derive channel_id from messages table
  IF NEW.message_id IS NOT NULL THEN
    SELECT m.channel_id INTO NEW.channel_id FROM public.messages m WHERE m.id = NEW.message_id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_role_permission(uuid, uuid, public.permission_type, uuid, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_role_permission(_server_id uuid, _user_id uuid, _permission public.permission_type, _role_id uuid DEFAULT NULL::uuid, _role_name text DEFAULT NULL::text, _allowed boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_roles') THEN
    RAISE EXCEPTION 'Only admins and owners can manage role permissions';
  END IF;

  IF _role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (server_id, role_id, permission, allowed)
    VALUES (_server_id, _role_id, _permission, _allowed)
    ON CONFLICT (server_id, role_id, permission) WHERE role_id IS NOT NULL
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSIF _role_name IS NOT NULL THEN
    INSERT INTO public.role_permissions (server_id, role_name, permission, allowed)
    VALUES (_server_id, _role_name, _permission, _allowed)
    ON CONFLICT (server_id, role_name, permission) WHERE role_name IS NOT NULL AND role_id IS NULL
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSE
    RAISE EXCEPTION 'Either role_id or role_name must be provided';
  END IF;
END;
$$;


--
-- Name: shares_dm_with(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shares_dm_with(_user_id uuid, _other_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    _user_id IS NOT NULL
    AND _other_user_id IS NOT NULL
    AND public.verify_request_identity(_user_id)
    AND EXISTS (
      SELECT 1
      FROM public.dm_participants dp1
      JOIN public.dm_participants dp2
        ON dp1.conversation_id = dp2.conversation_id
      WHERE dp1.user_id = _user_id
        AND dp2.user_id = _other_user_id
    )
$$;


--
-- Name: shares_server_with(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shares_server_with(_user_id uuid, _other_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    _user_id IS NOT NULL
    AND _other_user_id IS NOT NULL
    AND public.verify_request_identity(_user_id)
    AND EXISTS (
      SELECT 1
      FROM public.server_members sm1
      JOIN public.server_members sm2
        ON sm1.server_id = sm2.server_id
      WHERE sm1.user_id = _user_id
        AND sm2.user_id = _other_user_id
        AND sm1.is_banned = false
        AND sm2.is_banned = false
    )
$$;


--
-- Name: sync_category_permissions_to_channels(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_category_permissions_to_channels(_category_id uuid, _user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _server_id uuid;
  _channel record;
  _perm record;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get category's server
  SELECT server_id INTO _server_id FROM channel_categories WHERE id = _category_id;
  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  -- Permission check
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT check_user_server_permission(_user_id, _server_id, 'manage_channels'::permission_type) THEN
      RAISE EXCEPTION 'You do not have permission to sync category permissions';
    END IF;
  END IF;

  -- For each channel in this category, sync permissions
  FOR _channel IN SELECT id FROM channels WHERE category_id = _category_id LOOP
    -- Delete existing channel permissions that came from category sync
    DELETE FROM channel_permissions WHERE channel_id = _channel.id;

    -- Copy category permissions to channel
    FOR _perm IN SELECT * FROM category_permissions WHERE category_id = _category_id LOOP
      INSERT INTO channel_permissions (channel_id, role_id, role_name, user_id, permission, allowed)
      VALUES (_channel.id, _perm.role_id, _perm.role_name::server_role, _perm.user_id, _perm.permission::permission_type, _perm.allowed)
      ON CONFLICT (channel_id, role_id, permission) WHERE role_id IS NOT NULL AND user_id IS NULL
      DO UPDATE SET allowed = EXCLUDED.allowed;
    END LOOP;
  END LOOP;
END;
$$;


--
-- Name: test_channel_permission(uuid, uuid, public.permission_type); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.test_channel_permission(_channel_id uuid, _user_id uuid, _permission public.permission_type) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  channel_server_id uuid;
  user_base_role server_role;
  user_custom_role_ids uuid[];
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get channel's server
  SELECT server_id INTO channel_server_id
  FROM channels WHERE id = _channel_id;
  
  -- Get user's base role
  SELECT sm.role INTO user_base_role
  FROM server_members sm
  WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;
  
  -- Get user's custom role IDs
  SELECT COALESCE(ARRAY_AGG(DISTINCT smr.role_id) FILTER (WHERE smr.role_id IS NOT NULL), ARRAY[]::uuid[]) 
  INTO user_custom_role_ids
  FROM server_member_roles smr
  JOIN server_members sm ON sm.id = smr.member_id
  WHERE sm.user_id = _user_id AND sm.server_id = channel_server_id;
  
  -- Get matching channel permissions
  RETURN json_build_object(
    'channel_id', _channel_id,
    'user_id', _user_id,
    'permission', _permission,
    'base_role', user_base_role,
    'custom_role_ids', user_custom_role_ids,
    'has_permission', public.check_user_permission(_user_id, _channel_id, _permission),
    'base_role_overrides', (
      SELECT json_agg(
        json_build_object(
          'id', cp.id,
          'role_name', cp.role_name,
          'permission', cp.permission,
          'allowed', cp.allowed
        )
      )
      FROM channel_permissions cp
      WHERE cp.channel_id = _channel_id
        AND cp.permission = _permission
        AND cp.role_name = user_base_role
        AND cp.role_id IS NULL
    ),
    'custom_role_overrides', (
      SELECT json_agg(
        json_build_object(
          'id', cp.id,
          'role_id', cp.role_id,
          'permission', cp.permission,
          'allowed', cp.allowed
        )
      )
      FROM channel_permissions cp
      WHERE cp.channel_id = _channel_id
        AND cp.permission = _permission
        AND cp.role_id = ANY(COALESCE(user_custom_role_ids, ARRAY[]::uuid[]))
        AND cp.role_name IS NULL
    ),
    'all_channel_permissions', (
      SELECT json_agg(
        json_build_object(
          'id', cp.id,
          'role_id', cp.role_id,
          'role_name', cp.role_name,
          'permission', cp.permission,
          'allowed', cp.allowed
        )
      )
      FROM channel_permissions cp
      WHERE cp.channel_id = _channel_id
        AND cp.permission = _permission
    )
  );
END;
$$;


--
-- Name: toggle_announcement_comment_reaction(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_announcement_comment_reaction(_comment_id uuid, _user_id uuid, _emoji text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  msg_channel_id uuid;
  existing_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT m.channel_id INTO msg_channel_id
  FROM announcement_comments ac
  JOIN messages m ON m.id = ac.message_id
  WHERE ac.id = _comment_id;
  IF msg_channel_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;
  IF NOT check_user_permission(_user_id, msg_channel_id, 'add_reactions') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to add reactions';
  END IF;
  SELECT id INTO existing_id FROM announcement_comment_reactions 
  WHERE comment_id = _comment_id AND user_id = _user_id AND emoji = _emoji;
  IF existing_id IS NOT NULL THEN
    DELETE FROM announcement_comment_reactions WHERE id = existing_id;
  ELSE
    INSERT INTO announcement_comment_reactions (comment_id, user_id, emoji) VALUES (_comment_id, _user_id, _emoji);
  END IF;
  RETURN true;
END;
$$;


--
-- Name: toggle_media_comment_reaction(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_media_comment_reaction(_comment_id uuid, _user_id uuid, _emoji text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  media_channel_id uuid;
  existing_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT mi.channel_id INTO media_channel_id
  FROM media_comments mc
  JOIN media_items mi ON mi.id = mc.media_id
  WHERE mc.id = _comment_id;
  IF media_channel_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;
  IF NOT check_user_permission(_user_id, media_channel_id, 'add_reactions') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to add reactions';
  END IF;
  SELECT id INTO existing_id FROM media_comment_reactions 
  WHERE comment_id = _comment_id AND user_id = _user_id AND emoji = _emoji;
  IF existing_id IS NOT NULL THEN
    DELETE FROM media_comment_reactions WHERE id = existing_id;
  ELSE
    INSERT INTO media_comment_reactions (comment_id, user_id, emoji) VALUES (_comment_id, _user_id, _emoji);
  END IF;
  RETURN true;
END;
$$;


--
-- Name: toggle_mute_member(uuid, uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_mute_member(_server_id uuid, _user_id uuid, _target_user_id uuid, _muted boolean) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  user_role text;
  target_role text;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT role INTO user_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;
  
  SELECT role INTO target_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _target_user_id AND is_banned = false;
  
  IF user_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;
  
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not a member of this server';
  END IF;
  
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'mute_members') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Cannot mute owner
  IF target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot mute the server owner';
  END IF;
  
  -- Check role hierarchy
  IF user_role = 'moderator' AND target_role IN ('admin', 'moderator', 'owner') THEN
    RAISE EXCEPTION 'Cannot mute users with equal or higher role';
  END IF;
  
  IF user_role = 'admin' AND target_role IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Cannot mute users with equal or higher role';
  END IF;
  
  UPDATE server_members SET is_muted = _muted WHERE server_id = _server_id AND user_id = _target_user_id;
  RETURN true;
END;
$$;


--
-- Name: toggle_pin_message(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_pin_message(_message_id uuid, _user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  channel_id uuid;
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get the channel_id from the message
  SELECT m.channel_id INTO channel_id
  FROM messages m
  WHERE m.id = _message_id;
  
  IF channel_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  
  -- Check permission using database-backed permission system
  IF NOT public.check_user_permission(_user_id, channel_id, 'pin_messages') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Toggle pin status
  UPDATE messages SET is_pinned = NOT is_pinned WHERE id = _message_id;
  
  -- Return updated message
  SELECT json_build_object(
    'id', m.id,
    'channel_id', m.channel_id,
    'user_id', m.user_id,
    'content', m.content,
    'is_pinned', m.is_pinned,
    'edited_at', m.edited_at,
    'created_at', m.created_at
  ) INTO result
  FROM messages m
  WHERE m.id = _message_id;
  
  RETURN result;
END;
$$;


--
-- Name: transfer_ownership(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.transfer_ownership(_server_id uuid, _new_owner_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  current_owner_id uuid;
  current_owner_member_id uuid;
  new_owner_member_id uuid;
  caller_user_id uuid;
BEGIN
  caller_user_id := public.requesting_user_id();
  IF caller_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden';
  END IF;

  SELECT owner_id INTO current_owner_id
  FROM public.servers
  WHERE id = _server_id;

  IF current_owner_id IS NULL OR current_owner_id <> caller_user_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden';
  END IF;

  SELECT id INTO current_owner_member_id
  FROM public.server_members
  WHERE server_id = _server_id
    AND user_id = caller_user_id
    AND COALESCE(is_banned, false) = false;

  SELECT id INTO new_owner_member_id
  FROM public.server_members
  WHERE server_id = _server_id
    AND user_id = _new_owner_id
    AND COALESCE(is_banned, false) = false;

  IF current_owner_member_id IS NULL OR new_owner_member_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden';
  END IF;

  UPDATE public.server_members SET role = 'owner' WHERE id = new_owner_member_id;
  UPDATE public.server_members SET role = 'admin' WHERE id = current_owner_member_id;
  UPDATE public.servers SET owner_id = _new_owner_id WHERE id = _server_id;

  RETURN true;
END;
$$;


--
-- Name: trigger_dm_notification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_dm_notification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  sender_username text;
  recipient_id uuid;
BEGIN
  -- Get sender username
  SELECT username INTO sender_username FROM users WHERE id = NEW.sender_id;
  
  -- Get recipient (the other participant in the conversation)
  SELECT user_id INTO recipient_id 
  FROM dm_participants 
  WHERE conversation_id = NEW.conversation_id AND user_id != NEW.sender_id
  LIMIT 1;
  
  -- Create notification for recipient with conversation_id in link
  IF recipient_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
      recipient_id,
      'dm',
      'New message from ' || sender_username,
      LEFT(NEW.content, 100),
      '/app?conversation=' || NEW.conversation_id::text
    );
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: trigger_mention_notification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_mention_notification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  channel_server_id uuid;
  channel_name text;
  channel_id uuid;
  sender_username text;
  message_id uuid;
BEGIN
  -- Get message_id
  message_id := NEW.message_id;
  
  -- Get channel info
  SELECT c.server_id, c.name, c.id INTO channel_server_id, channel_name, channel_id
  FROM channels c
  JOIN messages m ON m.channel_id = c.id
  WHERE m.id = NEW.message_id;
  
  -- Get sender username
  SELECT u.username INTO sender_username
  FROM messages m
  JOIN users u ON u.id = m.user_id
  WHERE m.id = NEW.message_id;
  
  -- Create notification for the mentioned user with full link including message_id
  PERFORM public.create_notification(
    NEW.user_id,
    'mention'::notification_type,
    'You were mentioned',
    sender_username || ' mentioned you in #' || COALESCE(channel_name, 'channel'),
    '/app?server=' || channel_server_id || '&channel=' || channel_id || '&message=' || message_id
  );
  
  RETURN NEW;
END;
$$;


--
-- Name: trigger_task_assignment_notification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_task_assignment_notification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  task_title text;
  task_channel_id uuid;
  assigner_username text;
BEGIN
  -- Get task info
  SELECT t.title, t.channel_id, u.username
  INTO task_title, task_channel_id, assigner_username
  FROM tasks t
  JOIN users u ON u.id = NEW.assigned_by
  WHERE t.id = NEW.task_id;
  
  -- Create notification for assigned user
  IF task_title IS NOT NULL AND assigner_username IS NOT NULL THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'mention'::notification_type, -- Reuse mention type for task notifications
      'Task Assigned',
      assigner_username || ' assigned you to task: ' || task_title,
      '/app' -- Link will be updated by frontend to include channel/task
    );
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: trigger_task_comment_notification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_task_comment_notification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  task_title text;
  task_created_by uuid;
  commenter_username text;
  assignee_id uuid;
  commenter_id uuid;
BEGIN
  -- Get task info
  SELECT t.title, t.created_by INTO task_title, task_created_by
  FROM tasks t
  WHERE t.id = NEW.task_id;
  
  -- Get commenter username
  SELECT username INTO commenter_username
  FROM users
  WHERE id = NEW.user_id;
  
  commenter_id := NEW.user_id;
  
  -- Notify task creator (if not the commenter)
  IF task_created_by IS NOT NULL AND task_created_by != commenter_id THEN
    PERFORM public.create_notification(
      task_created_by,
      'mention'::notification_type,
      'New Task Comment',
      commenter_username || ' commented on task: ' || task_title,
      '/app'
    );
  END IF;
  
  -- Notify all assignees (except commenter)
  FOR assignee_id IN
    SELECT user_id FROM task_assignees
    WHERE task_id = NEW.task_id AND user_id != commenter_id
  LOOP
    PERFORM public.create_notification(
      assignee_id,
      'mention'::notification_type,
      'New Task Comment',
      commenter_username || ' commented on task: ' || task_title,
      '/app'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;


--
-- Name: trigger_task_status_notification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_task_status_notification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  assignee_id uuid;
  updater_username text;
BEGIN
  -- Only notify if status actually changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Get updater username (we'll need to pass user_id somehow, for now use system)
  SELECT username INTO updater_username
  FROM users
  WHERE id = NEW.created_by; -- Fallback to creator, ideally should be passed
  
  -- Notify all assignees
  FOR assignee_id IN
    SELECT user_id FROM task_assignees WHERE task_id = NEW.id
  LOOP
    PERFORM public.create_notification(
      assignee_id,
      'mention'::notification_type,
      'Task Status Changed',
      'Task "' || NEW.title || '" status changed to ' || NEW.status,
      '/app'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;


--
-- Name: unassign_task_users(uuid, uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unassign_task_users(_task_id uuid, _user_id uuid, _assignee_ids uuid[]) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  task_channel_id uuid;
  assignee_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get task channel
  SELECT channel_id INTO task_channel_id
  FROM tasks
  WHERE id = _task_id;
  
  IF task_channel_id IS NULL THEN
    RETURN json_build_object('error', 'Task not found');
  END IF;
  
  -- Check permission: assign_tasks (same permission for unassign)
  IF NOT check_user_permission(_user_id, task_channel_id, 'assign_tasks'::permission_type) THEN
    RETURN json_build_object('error', 'Permission denied: assign_tasks');
  END IF;
  
  -- Remove assignees
  DELETE FROM task_assignees
  WHERE task_id = _task_id
    AND user_id = ANY(_assignee_ids);
  
  RETURN json_build_object('success', true);
END;
$$;


--
-- Name: unban_member(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unban_member(_server_id uuid, _user_id uuid, _target_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'ban_members') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  DELETE FROM server_members WHERE server_id = _server_id AND user_id = _target_user_id AND is_banned = true;
  RETURN true;
END;
$$;


--
-- Name: unblock_user(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unblock_user(_user_id uuid, _blocked_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  DELETE FROM public.friendships
  WHERE requester_id = _user_id
    AND addressee_id = _blocked_user_id
    AND status = 'blocked';

  RETURN true;
END;
$$;


--
-- Name: unmute_member(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unmute_member(_server_id uuid, _user_id uuid, _target_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'mute_members') THEN
    RAISE EXCEPTION 'You do not have permission to unmute members';
  END IF;

  UPDATE public.server_members
  SET is_muted = false
  WHERE server_id = _server_id
    AND user_id = _target_user_id;
END;
$$;


--
-- Name: update_category(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_category(_category_id uuid, _user_id uuid, _updates text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _server_id uuid;
  _parsed jsonb;
  _result jsonb;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT server_id INTO _server_id
  FROM public.channel_categories
  WHERE id = _category_id;

  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  _parsed := _updates::jsonb;

  UPDATE public.channel_categories
  SET name = COALESCE(_parsed->>'name', name)
  WHERE id = _category_id;

  SELECT jsonb_build_object(
    'id', cc.id, 'server_id', cc.server_id,
    'name', cc.name, 'position', cc.position, 'created_at', cc.created_at
  ) INTO _result
  FROM public.channel_categories cc
  WHERE cc.id = _category_id;

  RETURN _result;
END;
$$;


--
-- Name: update_channel(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_channel(_channel_id uuid, _user_id uuid, _updates text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _server_id uuid;
  _parsed jsonb;
  _result jsonb;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT server_id INTO _server_id
  FROM public.channels
  WHERE id = _channel_id;

  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  _parsed := _updates::jsonb;

  UPDATE public.channels
  SET
    name = COALESCE(_parsed->>'name', name),
    topic = CASE WHEN _parsed ? 'topic' THEN (_parsed->>'topic') ELSE topic END,
    is_nsfw = COALESCE((_parsed->>'is_nsfw')::boolean, is_nsfw),
    slowmode_seconds = COALESCE((_parsed->>'slowmode_seconds')::int, slowmode_seconds),
    is_read_only = COALESCE((_parsed->>'is_read_only')::boolean, is_read_only),
    is_private = COALESCE((_parsed->>'is_private')::boolean, is_private),
    block_links = COALESCE((_parsed->>'block_links')::boolean, block_links),
    allowed_link_domains = CASE
      WHEN _parsed ? 'allowed_link_domains' THEN ARRAY(SELECT jsonb_array_elements_text(_parsed->'allowed_link_domains'))
      ELSE allowed_link_domains
    END,
    ghost_mode = CASE
      WHEN (_parsed->>'ghost_mode')::boolean = true THEN true
      ELSE ghost_mode
    END,
    icon = CASE WHEN _parsed ? 'icon' THEN (_parsed->>'icon') ELSE icon END
  WHERE id = _channel_id;

  SELECT jsonb_build_object(
    'id', c.id, 'server_id', c.server_id, 'category_id', c.category_id,
    'name', c.name, 'topic', c.topic, 'type', c.type, 'position', c.position,
    'is_nsfw', c.is_nsfw, 'slowmode_seconds', c.slowmode_seconds,
    'is_read_only', c.is_read_only, 'is_private', c.is_private,
    'block_links', c.block_links, 'allowed_link_domains', c.allowed_link_domains,
    'ghost_mode', c.ghost_mode, 'icon', c.icon, 'created_at', c.created_at
  ) INTO _result
  FROM public.channels c
  WHERE c.id = _channel_id;

  RETURN _result;
END;
$$;


--
-- Name: update_group_dm_name(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_group_dm_name(_conversation_id uuid, _user_id uuid, _new_name text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_is_group boolean;
  v_is_participant boolean;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Check if conversation exists and is a group
  SELECT is_group INTO v_is_group
  FROM dm_conversations
  WHERE id = _conversation_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;
  
  IF NOT COALESCE(v_is_group, false) THEN
    RAISE EXCEPTION 'Cannot rename a 1:1 conversation';
  END IF;
  
  -- Check if user is a participant
  SELECT EXISTS (
    SELECT 1 FROM dm_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  ) INTO v_is_participant;
  
  IF NOT v_is_participant THEN
    RAISE EXCEPTION 'User is not a participant';
  END IF;
  
  -- Update the name (NULL or empty string removes the name)
  UPDATE dm_conversations
  SET name = NULLIF(TRIM(_new_name), '')
  WHERE id = _conversation_id;
  
  RETURN json_build_object(
    'success', true,
    'name', NULLIF(TRIM(_new_name), '')
  );
END;
$$;


--
-- Name: update_member_nickname(uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_member_nickname(_server_id uuid, _user_id uuid, _target_user_id uuid, _nickname text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  user_role text;
  target_role text;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Users can always change their own nickname
  IF _user_id = _target_user_id THEN
    UPDATE server_members SET nickname = _nickname WHERE server_id = _server_id AND user_id = _user_id;
    RETURN true;
  END IF;
  
  SELECT role INTO user_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;
  
  SELECT role INTO target_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _target_user_id AND is_banned = false;
  
  IF user_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;
  
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not a member of this server';
  END IF;
  
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_nicknames') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Cannot change owner's nickname unless you are the owner
  IF target_role = 'owner' AND user_role != 'owner' THEN
    RAISE EXCEPTION 'Cannot change the server owner nickname';
  END IF;
  
  UPDATE server_members SET nickname = _nickname WHERE server_id = _server_id AND user_id = _target_user_id;
  RETURN true;
END;
$$;


--
-- Name: update_modified_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_modified_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: update_own_profile(character varying, text, text, public.user_status, character varying, character, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_own_profile(_display_name character varying DEFAULT NULL::character varying, _avatar_url text DEFAULT NULL::text, _bio text DEFAULT NULL::text, _status public.user_status DEFAULT NULL::public.user_status, _custom_status character varying DEFAULT NULL::character varying, _banner_color character DEFAULT NULL::bpchar, _pronouns character varying DEFAULT NULL::character varying) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE users SET
    display_name = COALESCE(_display_name, display_name),
    avatar_url = COALESCE(_avatar_url, avatar_url),
    bio = COALESCE(_bio, bio),
    status = COALESCE(_status, status),
    custom_status = COALESCE(_custom_status, custom_status),
    banner_color = COALESCE(_banner_color, banner_color),
    pronouns = COALESCE(_pronouns, pronouns)
  WHERE id = auth.uid();
END;
$$;


--
-- Name: update_server(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_server(_server_id uuid, _user_id uuid, _updates jsonb) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _user_role server_role;
  _updated_server servers%ROWTYPE;
BEGIN
  -- Verify the caller is who they claim to be (custom auth: x-key-hash)
  IF NOT public.verify_request_identity(_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Check user's role in server
  SELECT role INTO _user_role
  FROM server_members
  WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;

  IF _user_role IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not a member of this server');
  END IF;

  -- Only owner and admin can update server settings
  IF _user_role NOT IN ('owner', 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  -- TEMPORARY: Reject attempts to publish (set is_published to true) while rebuilding Explore page
  IF (_updates ? 'is_published') AND ((_updates->>'is_published')::boolean = true) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'We''re rebuilding the Explore page. Publishing will be available soon.'
    );
  END IF;

  -- Update server with provided fields
  UPDATE servers
  SET
    name = COALESCE(_updates->>'name', name),
    icon_url = CASE 
      WHEN _updates ? 'icon_url' THEN _updates->>'icon_url'
      ELSE icon_url
    END,
    banner_url = CASE 
      WHEN _updates ? 'banner_url' THEN _updates->>'banner_url'
      ELSE banner_url
    END,
    about = CASE
      WHEN _updates ? 'about' THEN NULLIF(_updates->>'about', '')
      WHEN _updates ? 'about' THEN about
      ELSE about
    END,
    is_published = CASE
      WHEN _updates ? 'is_published' THEN (_updates->>'is_published')::boolean
      ELSE is_published
    END,
    system_channel_join_id = CASE
      WHEN _updates ? 'system_channel_join_id' THEN 
        CASE 
          WHEN _updates->'system_channel_join_id' IS NULL 
            OR _updates->>'system_channel_join_id' = 'null' 
            OR _updates->>'system_channel_join_id' = '' 
            OR _updates->>'system_channel_join_id' = 'none' THEN NULL
          ELSE (_updates->>'system_channel_join_id')::uuid
        END
      ELSE system_channel_join_id
    END,
    system_channel_leave_id = CASE
      WHEN _updates ? 'system_channel_leave_id' THEN 
        CASE 
          WHEN _updates->'system_channel_leave_id' IS NULL 
            OR _updates->>'system_channel_leave_id' = 'null' 
            OR _updates->>'system_channel_leave_id' = '' 
            OR _updates->>'system_channel_leave_id' = 'none' THEN NULL
          ELSE (_updates->>'system_channel_leave_id')::uuid
        END
      ELSE system_channel_leave_id
    END,
    enable_join_messages = CASE
      WHEN _updates ? 'enable_join_messages' THEN (_updates->>'enable_join_messages')::boolean
      ELSE enable_join_messages
    END,
    enable_leave_messages = CASE
      WHEN _updates ? 'enable_leave_messages' THEN (_updates->>'enable_leave_messages')::boolean
      ELSE enable_leave_messages
    END
  WHERE id = _server_id
  RETURNING * INTO _updated_server;

  IF _updated_server.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Server not found');
  END IF;

  RETURN json_build_object(
    'success', true,
    'server', json_build_object(
      'id', _updated_server.id,
      'name', _updated_server.name,
      'icon_url', _updated_server.icon_url,
      'banner_url', _updated_server.banner_url,
      'about', _updated_server.about,
      'is_published', _updated_server.is_published,
      'owner_id', _updated_server.owner_id,
      'invite_code', _updated_server.invite_code,
      'created_at', _updated_server.created_at,
      'system_channel_join_id', _updated_server.system_channel_join_id,
      'system_channel_leave_id', _updated_server.system_channel_leave_id,
      'enable_join_messages', _updated_server.enable_join_messages,
      'enable_leave_messages', _updated_server.enable_leave_messages
    )
  );
END;
$$;


--
-- Name: update_server_role(uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_server_role(_role_id uuid, _user_id uuid, _name text DEFAULT NULL::text, _color text DEFAULT NULL::text, _icon text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  _server_id uuid;
  result json;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT server_id INTO _server_id
  FROM public.server_roles
  WHERE id = _role_id;

  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Role not found';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_roles') THEN
    RAISE EXCEPTION 'Only users with manage_roles permission can update roles';
  END IF;

  UPDATE public.server_roles
  SET
    name = COALESCE(_name, name),
    color = COALESCE(_color, color),
    icon = _icon
  WHERE id = _role_id;

  SELECT row_to_json(r) INTO result
  FROM public.server_roles r
  WHERE r.id = _role_id;

  RETURN result;
END;
$$;


--
-- Name: update_task(uuid, uuid, text, text, text, text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_task(_task_id uuid, _user_id uuid, _title text DEFAULT NULL::text, _description text DEFAULT NULL::text, _priority text DEFAULT NULL::text, _status text DEFAULT NULL::text, _due_date timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  UPDATE public.tasks
  SET
    title = COALESCE(_title, title),
    description = COALESCE(_description, description),
    priority = COALESCE(_priority::task_priority, priority),
    status = COALESCE(_status::task_status, status),
    due_date = COALESCE(_due_date, due_date),
    completed_by = CASE 
      WHEN _status = 'completed' AND status != 'completed' THEN _user_id
      WHEN _status = 'open' THEN NULL
      ELSE completed_by
    END,
    completed_at = CASE 
      WHEN _status = 'completed' AND status != 'completed' THEN NOW()
      WHEN _status = 'open' THEN NULL
      ELSE completed_at
    END,
    updated_at = NOW()
  WHERE id = _task_id;
END;
$$;


--
-- Name: update_task_comment(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_task_comment(_comment_id uuid, _user_id uuid, _content text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  comment_user_id uuid;
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get comment owner
  SELECT user_id INTO comment_user_id
  FROM task_comments
  WHERE id = _comment_id;
  
  IF comment_user_id IS NULL THEN
    RETURN json_build_object('error', 'Comment not found');
  END IF;
  
  -- Only the comment owner can edit
  IF comment_user_id != _user_id THEN
    RETURN json_build_object('error', 'Permission denied: can only edit own comments');
  END IF;
  
  -- Update comment
  UPDATE task_comments
  SET content = _content, edited_at = now()
  WHERE id = _comment_id;
  
  -- Return updated comment
  SELECT json_build_object(
    'id', tc.id,
    'task_id', tc.task_id,
    'user_id', tc.user_id,
    'content', tc.content,
    'created_at', tc.created_at,
    'edited_at', tc.edited_at
  ) INTO result
  FROM task_comments tc
  WHERE tc.id = _comment_id;
  
  RETURN result;
END;
$$;


--
-- Name: update_task_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_task_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_user_last_seen(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_last_seen(_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- GUARD: Maintenance Mode
  IF is_maintenance_active() THEN
    RAISE EXCEPTION 'MAINTENANCE_MODE_ACTIVE';
  END IF;

  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  UPDATE users SET last_seen = now() WHERE id = _user_id;
  RETURN true;
END;
$$;


--
-- Name: update_user_preferences_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_preferences_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_user_presence(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_presence(_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  UPDATE public.users
  SET last_seen = now()
  WHERE id = _user_id
  AND status NOT IN ('offline', 'invisible');
END;
$$;


--
-- Name: update_user_profile(uuid, json); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_profile(_user_id uuid, _updates json) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  result json;
  _u jsonb;
  _field text;

  _v_display_name text;
  _v_bio text;
  _v_avatar_url text;
  _v_banner_url text;
  _v_avatar_decoration text;
  _v_profile_effect text;
  _v_banner_color text;
  _v_profile_theme_primary text;
  _v_profile_theme_accent text;
  _v_custom_status text;
BEGIN
  IF _updates IS NULL OR json_typeof(_updates) <> 'object' THEN
    RAISE EXCEPTION 'Invalid profile updates payload';
  END IF;

  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  _u := _updates::jsonb;

  -- Explicit allowlist to prevent quiet acceptance of unsupported fields.
  FOR _field IN SELECT jsonb_object_keys(_u)
  LOOP
    IF _field NOT IN (
      'display_name',
      'bio',
      'avatar_url',
      'banner_url',
      'avatar_decoration',
      'profile_effect',
      'banner_color',
      'profile_theme_primary',
      'profile_theme_accent',
      'custom_status'
    ) THEN
      RAISE EXCEPTION 'Unsupported profile field: %', _field;
    END IF;
  END LOOP;

  _v_display_name := NULLIF(trim(_updates->>'display_name'), '');
  _v_bio := NULLIF(trim(_updates->>'bio'), '');
  _v_avatar_url := NULLIF(trim(_updates->>'avatar_url'), '');
  _v_banner_url := NULLIF(trim(_updates->>'banner_url'), '');
  _v_avatar_decoration := NULLIF(trim(_updates->>'avatar_decoration'), '');
  _v_profile_effect := NULLIF(trim(_updates->>'profile_effect'), '');
  _v_banner_color := NULLIF(trim(_updates->>'banner_color'), '');
  _v_profile_theme_primary := NULLIF(trim(_updates->>'profile_theme_primary'), '');
  _v_profile_theme_accent := NULLIF(trim(_updates->>'profile_theme_accent'), '');
  _v_custom_status := NULLIF(trim(_updates->>'custom_status'), '');

  IF (_u ? 'display_name') AND _v_display_name IS NOT NULL AND char_length(_v_display_name) > 32 THEN
    RAISE EXCEPTION 'Display name must be 32 characters or fewer';
  END IF;

  IF (_u ? 'bio') AND _v_bio IS NOT NULL AND char_length(_v_bio) > 400 THEN
    RAISE EXCEPTION 'Bio must be 400 characters or fewer';
  END IF;

  IF (_u ? 'custom_status') AND _v_custom_status IS NOT NULL AND char_length(_v_custom_status) > 128 THEN
    RAISE EXCEPTION 'Custom status must be 128 characters or fewer';
  END IF;

  IF (_u ? 'avatar_url') AND _v_avatar_url IS NOT NULL THEN
    IF char_length(_v_avatar_url) > 2048 THEN
      RAISE EXCEPTION 'Avatar URL must be 2048 characters or fewer';
    END IF;
    IF _v_avatar_url !~* '^https?://[^[:space:]]+$' THEN
      RAISE EXCEPTION 'Avatar URL must be a valid http(s) URL';
    END IF;
    IF _v_avatar_url !~ '^[ -~]+$' THEN
      RAISE EXCEPTION 'Avatar URL must use ASCII characters only';
    END IF;
  END IF;

  IF (_u ? 'banner_url') AND _v_banner_url IS NOT NULL THEN
    IF char_length(_v_banner_url) > 2048 THEN
      RAISE EXCEPTION 'Banner URL must be 2048 characters or fewer';
    END IF;
    IF _v_banner_url !~* '^https?://[^[:space:]]+$' THEN
      RAISE EXCEPTION 'Banner URL must be a valid http(s) URL';
    END IF;
    IF _v_banner_url !~ '^[ -~]+$' THEN
      RAISE EXCEPTION 'Banner URL must use ASCII characters only';
    END IF;
  END IF;

  IF (_u ? 'banner_color') AND _v_banner_color IS NOT NULL AND _v_banner_color !~ '^#[0-9A-Fa-f]{6}$' THEN
    RAISE EXCEPTION 'Banner color must be a hex color like #RRGGBB';
  END IF;

  IF (_u ? 'profile_theme_primary') AND _v_profile_theme_primary IS NOT NULL
     AND _v_profile_theme_primary !~ '^#[0-9A-Fa-f]{6}$' THEN
    RAISE EXCEPTION 'Profile theme primary must be a hex color like #RRGGBB';
  END IF;

  IF (_u ? 'profile_theme_accent') AND _v_profile_theme_accent IS NOT NULL
     AND _v_profile_theme_accent !~ '^#[0-9A-Fa-f]{6}$' THEN
    RAISE EXCEPTION 'Profile theme accent must be a hex color like #RRGGBB';
  END IF;

  IF (_u ? 'avatar_decoration') AND _v_avatar_decoration IS NOT NULL THEN
    IF char_length(_v_avatar_decoration) > 128 THEN
      RAISE EXCEPTION 'Avatar decoration key is too long';
    END IF;
    IF _v_avatar_decoration ~* '^https?://' OR _v_avatar_decoration !~ '^[A-Za-z0-9._-]+$' THEN
      RAISE EXCEPTION 'Avatar decoration must be a valid decoration key';
    END IF;
  END IF;

  IF (_u ? 'profile_effect') AND _v_profile_effect IS NOT NULL THEN
    IF char_length(_v_profile_effect) > 128 THEN
      RAISE EXCEPTION 'Profile effect key is too long';
    END IF;
    IF _v_profile_effect ~* '^https?://' OR _v_profile_effect !~ '^[A-Za-z0-9._-]+$' THEN
      RAISE EXCEPTION 'Profile effect must be a valid effect key';
    END IF;
  END IF;

  UPDATE public.users
  SET
    display_name = CASE WHEN (_u ? 'display_name') THEN _v_display_name ELSE display_name END,
    bio = CASE WHEN (_u ? 'bio') THEN _v_bio ELSE bio END,
    avatar_url = CASE WHEN (_u ? 'avatar_url') THEN _v_avatar_url ELSE avatar_url END,
    banner_url = CASE WHEN (_u ? 'banner_url') THEN _v_banner_url ELSE banner_url END,
    avatar_decoration = CASE WHEN (_u ? 'avatar_decoration') THEN _v_avatar_decoration ELSE avatar_decoration END,
    profile_effect = CASE WHEN (_u ? 'profile_effect') THEN _v_profile_effect ELSE profile_effect END,
    banner_color = CASE WHEN (_u ? 'banner_color') THEN COALESCE(_v_banner_color, banner_color) ELSE banner_color END,
    profile_theme_primary = CASE WHEN (_u ? 'profile_theme_primary') THEN _v_profile_theme_primary ELSE profile_theme_primary END,
    profile_theme_accent = CASE WHEN (_u ? 'profile_theme_accent') THEN _v_profile_theme_accent ELSE profile_theme_accent END,
    custom_status = CASE WHEN (_u ? 'custom_status') THEN _v_custom_status ELSE custom_status END
  WHERE id = _user_id;

  SELECT json_build_object(
    'id', u.id,
    'username', u.username,
    'display_name', u.display_name,
    'avatar_url', u.avatar_url,
    'banner_url', u.banner_url,
    'avatar_decoration', u.avatar_decoration,
    'profile_effect', u.profile_effect,
    'banner_color', u.banner_color,
    'profile_theme_primary', u.profile_theme_primary,
    'profile_theme_accent', u.profile_theme_accent,
    'bio', u.bio,
    'status', u.status,
    'custom_status', u.custom_status,
    'created_at', u.created_at,
    'last_seen', u.last_seen
  )
  INTO result
  FROM public.users u
  WHERE u.id = _user_id;

  RETURN result;
END;
$_$;


--
-- Name: update_user_status(uuid, public.user_status); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_status(_user_id uuid, _status public.user_status) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- GUARD: Maintenance Mode
  IF is_maintenance_active() THEN
    RAISE EXCEPTION 'MAINTENANCE_MODE_ACTIVE';
  END IF;

  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF _status = 'offline' THEN
    UPDATE users SET status = _status, last_seen = now() - interval '10 minutes' WHERE id = _user_id;
  ELSE
    UPDATE users SET status = _status, last_seen = now() WHERE id = _user_id;
  END IF;
  RETURN true;
END;
$$;


--
-- Name: update_voice_settings_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_voice_settings_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: upload_server_emoji(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upload_server_emoji(_server_id uuid, _user_id uuid, _name text, _file_path text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  new_emoji server_emojis%ROWTYPE;
  emoji_count integer;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  IF NOT check_user_server_permission(_user_id, _server_id, 'manage_emojis') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to manage emojis';
  END IF;

  -- Validate name format (2-12 chars: a-z, 0-9, underscore)
  IF _name !~ '^[a-z0-9_]{2,12}$' THEN
    RAISE EXCEPTION 'Invalid emoji name format';
  END IF;

  -- Enforce 1000 emoji slot limit per server
  SELECT count(*) INTO emoji_count FROM server_emojis WHERE server_id = _server_id;
  IF emoji_count >= 1000 THEN
    RAISE EXCEPTION 'Server emoji limit reached (1000)';
  END IF;

  INSERT INTO server_emojis (server_id, name, file_path, created_by)
  VALUES (_server_id, _name, _file_path, _user_id)
  RETURNING * INTO new_emoji;
  RETURN row_to_json(new_emoji);
END;
$$;


--
-- Name: upsert_channel_read(uuid, uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_channel_read(_user_id uuid, _channel_id uuid, _last_read_at timestamp with time zone) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Authentication failed';
  END IF;

  INSERT INTO channel_reads (user_id, channel_id, last_read_at)
  VALUES (_user_id, _channel_id, _last_read_at)
  ON CONFLICT (user_id, channel_id)
  DO UPDATE SET last_read_at = _last_read_at;
END;
$$;


--
-- Name: upsert_user_preferences(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_user_preferences(_user_id uuid, _prefs jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  INSERT INTO user_preferences (
    user_id, theme, link_previews_enabled,
    desktop_notifications_enabled, browser_notifications_enabled,
    notification_sound_enabled, notification_sound_server_mentions,
    notification_sound_user_mentions, notification_sound_replies,
    notification_volume, show_message_preview,
    show_preview_server_mentions, show_preview_user_mentions,
    show_preview_replies, compact_mode, show_timestamps, animate_emojis,
    updated_at
  ) VALUES (
    _user_id,
    COALESCE(_prefs->>'theme', 'default'),
    COALESCE((_prefs->>'link_previews_enabled')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'desktop_notifications_enabled')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'browser_notifications_enabled')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'notification_sound_enabled')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'notification_sound_server_mentions')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'notification_sound_user_mentions')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'notification_sound_replies')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'notification_volume')::NUMERIC, 0.5),
    COALESCE((_prefs->>'show_message_preview')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'show_preview_server_mentions')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'show_preview_user_mentions')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'show_preview_replies')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'compact_mode')::BOOLEAN, FALSE),
    COALESCE((_prefs->>'show_timestamps')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'animate_emojis')::BOOLEAN, TRUE),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    theme = COALESCE(_prefs->>'theme', user_preferences.theme),
    link_previews_enabled = COALESCE((_prefs->>'link_previews_enabled')::BOOLEAN, user_preferences.link_previews_enabled),
    desktop_notifications_enabled = COALESCE((_prefs->>'desktop_notifications_enabled')::BOOLEAN, user_preferences.desktop_notifications_enabled),
    browser_notifications_enabled = COALESCE((_prefs->>'browser_notifications_enabled')::BOOLEAN, user_preferences.browser_notifications_enabled),
    notification_sound_enabled = COALESCE((_prefs->>'notification_sound_enabled')::BOOLEAN, user_preferences.notification_sound_enabled),
    notification_sound_server_mentions = COALESCE((_prefs->>'notification_sound_server_mentions')::BOOLEAN, user_preferences.notification_sound_server_mentions),
    notification_sound_user_mentions = COALESCE((_prefs->>'notification_sound_user_mentions')::BOOLEAN, user_preferences.notification_sound_user_mentions),
    notification_sound_replies = COALESCE((_prefs->>'notification_sound_replies')::BOOLEAN, user_preferences.notification_sound_replies),
    notification_volume = COALESCE((_prefs->>'notification_volume')::NUMERIC, user_preferences.notification_volume),
    show_message_preview = COALESCE((_prefs->>'show_message_preview')::BOOLEAN, user_preferences.show_message_preview),
    show_preview_server_mentions = COALESCE((_prefs->>'show_preview_server_mentions')::BOOLEAN, user_preferences.show_preview_server_mentions),
    show_preview_user_mentions = COALESCE((_prefs->>'show_preview_user_mentions')::BOOLEAN, user_preferences.show_preview_user_mentions),
    show_preview_replies = COALESCE((_prefs->>'show_preview_replies')::BOOLEAN, user_preferences.show_preview_replies),
    compact_mode = COALESCE((_prefs->>'compact_mode')::BOOLEAN, user_preferences.compact_mode),
    show_timestamps = COALESCE((_prefs->>'show_timestamps')::BOOLEAN, user_preferences.show_timestamps),
    animate_emojis = COALESCE((_prefs->>'animate_emojis')::BOOLEAN, user_preferences.animate_emojis),
    updated_at = NOW();
END;
$$;


--
-- Name: upsert_user_voice_settings(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_user_voice_settings(p_user_id uuid, p_settings jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  result JSONB;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  INSERT INTO user_voice_settings (user_id, settings)
  VALUES (p_user_id, p_settings)
  ON CONFLICT (user_id)
  DO UPDATE SET settings = p_settings
  RETURNING settings INTO result;
  
  RETURN result;
END;
$$;


--
-- Name: validate_username_on_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_username_on_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
BEGIN
  -- Check if username is blocked
  IF public.is_username_blocked(NEW.username) THEN
    RAISE EXCEPTION 'Username is reserved or contains restricted words';
  END IF;

  -- Check length (3-32 characters)
  IF length(NEW.username) < 3 OR length(NEW.username) > 32 THEN
    RAISE EXCEPTION 'Username must be between 3 and 32 characters';
  END IF;

  -- Check allowed characters (alphanumeric, underscores, hyphens)
  IF NEW.username !~ '^[a-zA-Z0-9_-]+$' THEN
    RAISE EXCEPTION 'Username can only contain letters, numbers, underscores, and hyphens';
  END IF;

  -- Cannot start or end with underscore or hyphen
  IF NEW.username ~ '^[-_]' OR NEW.username ~ '[-_]$' THEN
    RAISE EXCEPTION 'Username cannot start or end with an underscore or hyphen';
  END IF;

  -- No consecutive special characters
  IF NEW.username ~ '[-_]{2,}' THEN
    RAISE EXCEPTION 'Username cannot contain consecutive special characters';
  END IF;

  -- Cannot be only numbers
  IF NEW.username ~ '^\d+$' THEN
    RAISE EXCEPTION 'Username cannot be only numbers';
  END IF;

  RETURN NEW;
END;
$_$;


--
-- Name: verify_request_identity(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_request_identity(_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  header_hash text;
  stored_hash text;
BEGIN
  BEGIN
    header_hash := (current_setting('request.headers', true)::json->>'x-key-hash');
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  IF header_hash IS NULL OR header_hash = '' THEN
    RETURN false;
  END IF;

  SELECT ua.key_hash INTO stored_hash FROM user_auth ua WHERE ua.user_id = _user_id;

  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;

  RETURN header_hash = stored_hash;
END;
$$;


--
-- Name: vote_poll(uuid, uuid, integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.vote_poll(_poll_id uuid, _user_id uuid, _option_indexes integer[]) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  p record;
  channel_server_id uuid;
  is_muted boolean;
  _n integer;
  _distinct_indexes integer[];
  _min_idx integer;
  _max_idx integer;
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT * INTO p FROM public.polls WHERE id = _poll_id;
  IF p IS NULL THEN
    RAISE EXCEPTION 'Poll not found';
  END IF;

  IF p.is_closed = true OR p.ends_at <= now() THEN
    -- Close and recompute just in case, then return closed poll state
    UPDATE public.polls SET is_closed = true WHERE id = _poll_id AND is_closed = false;
    PERFORM public.recompute_poll_results(_poll_id);
    SELECT json_build_object(
      'id', p.id,
      'channel_id', p.channel_id,
      'message_id', p.message_id,
      'question', p.question,
      'options', p.options,
      'allow_multiple', p.allow_multiple,
      'ends_at', p.ends_at,
      'is_closed', true,
      'results', (SELECT results FROM public.polls WHERE id = _poll_id),
      'total_votes', (SELECT total_votes FROM public.polls WHERE id = _poll_id)
    ) INTO result;
    RETURN result;
  END IF;

  _n := COALESCE(array_length(p.options, 1), 0);
  IF _n = 0 THEN
    RAISE EXCEPTION 'Poll has no options';
  END IF;

  IF _option_indexes IS NULL OR COALESCE(array_length(_option_indexes, 1), 0) = 0 THEN
    RAISE EXCEPTION 'At least one option must be selected';
  END IF;

  -- normalize to distinct selection
  SELECT array_agg(DISTINCT x ORDER BY x) INTO _distinct_indexes
  FROM unnest(_option_indexes) AS x;

  IF p.allow_multiple = false AND COALESCE(array_length(_distinct_indexes, 1), 0) > 1 THEN
    RAISE EXCEPTION 'This poll only allows one vote';
  END IF;

  SELECT min(x), max(x) INTO _min_idx, _max_idx FROM unnest(_distinct_indexes) AS x;
  IF _min_idx < 0 OR _max_idx > (_n - 1) THEN
    RAISE EXCEPTION 'Invalid poll option';
  END IF;

  -- Membership/permission checks (mirror send_message)
  SELECT server_id INTO channel_server_id FROM public.channels WHERE id = p.channel_id;

  SELECT sm.is_muted INTO is_muted FROM public.server_members sm
  WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;

  IF is_muted IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;

  IF is_muted THEN
    RAISE EXCEPTION 'You are muted in this server';
  END IF;

  IF NOT public.check_user_permission(_user_id, p.channel_id, 'send_messages') THEN
    RAISE EXCEPTION 'You do not have permission to vote in this channel';
  END IF;

  -- Replace existing votes for this user
  DELETE FROM public.poll_votes WHERE poll_id = _poll_id AND user_id = _user_id;

  INSERT INTO public.poll_votes (poll_id, user_id, option_index)
  SELECT _poll_id, _user_id, x
  FROM unnest(_distinct_indexes) AS x
  ON CONFLICT (poll_id, user_id, option_index) DO NOTHING;

  PERFORM public.recompute_poll_results(_poll_id);

  SELECT json_build_object(
    'id', p.id,
    'channel_id', p.channel_id,
    'message_id', p.message_id,
    'question', p.question,
    'options', p.options,
    'allow_multiple', p.allow_multiple,
    'ends_at', p.ends_at,
    'is_closed', (SELECT is_closed FROM public.polls WHERE id = _poll_id),
    'results', (SELECT results FROM public.polls WHERE id = _poll_id),
    'total_votes', (SELECT total_votes FROM public.polls WHERE id = _poll_id)
  ) INTO result;

  RETURN result;
END;
$$;


--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

-- I, U, D, T: insert, update ...
action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

-- Is row level security enabled for the table
is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_
        -- Filter by action early - only get subscriptions interested in this action
        -- action_filter column can be: '*' (all), 'INSERT', 'UPDATE', or 'DELETE'
        and (subs.action_filter = '*' or subs.action_filter = action::text);

-- Subscription vars
roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

-- structured info for wal's columns
columns realtime.wal_column[];
-- previous identity values for update/delete
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

-- Primary jsonb output for record
output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    declare
      res jsonb;
    begin
      execute format('select to_jsonb(%L::'|| type_::text || ')', val)  into res;
      return res;
    end
    $$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS SETOF realtime.wal_rls
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
      with pub as (
        select
          concat_ws(
            ',',
            case when bool_or(pubinsert) then 'insert' else null end,
            case when bool_or(pubupdate) then 'update' else null end,
            case when bool_or(pubdelete) then 'delete' else null end
          ) as w2j_actions,
          coalesce(
            string_agg(
              realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
              ','
            ) filter (where ppt.tablename is not null and ppt.tablename not like '% %'),
            ''
          ) w2j_add_tables
        from
          pg_publication pp
          left join pg_publication_tables ppt
            on pp.pubname = ppt.pubname
        where
          pp.pubname = publication
        group by
          pp.pubname
        limit 1
      ),
      w2j as (
        select
          x.*, pub.w2j_add_tables
        from
          pub,
          pg_logical_slot_get_changes(
            slot_name, null, max_changes,
            'include-pk', 'true',
            'include-transaction', 'false',
            'include-timestamp', 'true',
            'include-type-oids', 'true',
            'format-version', '2',
            'actions', pub.w2j_actions,
            'add-tables', pub.w2j_add_tables
          ) x
      )
      select
        xyz.wal,
        xyz.is_rls_enabled,
        xyz.subscription_ids,
        xyz.errors
      from
        w2j,
        realtime.apply_rls(
          wal := w2j.data::jsonb,
          max_record_bytes := max_record_bytes
        ) xyz(wal, is_rls_enabled, subscription_ids, errors)
      where
        w2j.w2j_add_tables <> ''
        and xyz.subscription_ids[1] is not null
    $$;


--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    -- Generate a new UUID for the id
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    -- Attempt to insert the message
    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
_filename text;
BEGIN
	select string_to_array(name, '/') into _parts;
	select _parts[array_length(_parts,1)] into _filename;
	-- @todo return the last part instead of 2
	return reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[1:array_length(_parts,1)-1];
END
$$;


--
-- Name: get_common_prefix(text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::int) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: search_by_timestamp(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


--
-- Name: http_request(); Type: FUNCTION; Schema: supabase_functions; Owner: -
--

CREATE FUNCTION supabase_functions.http_request() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'supabase_functions'
    AS $$
    DECLARE
      request_id bigint;
      payload jsonb;
      url text := TG_ARGV[0]::text;
      method text := TG_ARGV[1]::text;
      headers jsonb DEFAULT '{}'::jsonb;
      params jsonb DEFAULT '{}'::jsonb;
      timeout_ms integer DEFAULT 1000;
    BEGIN
      IF url IS NULL OR url = 'null' THEN
        RAISE EXCEPTION 'url argument is missing';
      END IF;

      IF method IS NULL OR method = 'null' THEN
        RAISE EXCEPTION 'method argument is missing';
      END IF;

      IF TG_ARGV[2] IS NULL OR TG_ARGV[2] = 'null' THEN
        headers = '{"Content-Type": "application/json"}'::jsonb;
      ELSE
        headers = TG_ARGV[2]::jsonb;
      END IF;

      IF TG_ARGV[3] IS NULL OR TG_ARGV[3] = 'null' THEN
        params = '{}'::jsonb;
      ELSE
        params = TG_ARGV[3]::jsonb;
      END IF;

      IF TG_ARGV[4] IS NULL OR TG_ARGV[4] = 'null' THEN
        timeout_ms = 1000;
      ELSE
        timeout_ms = TG_ARGV[4]::integer;
      END IF;

      CASE
        WHEN method = 'GET' THEN
          SELECT http_get INTO request_id FROM net.http_get(
            url,
            params,
            headers,
            timeout_ms
          );
        WHEN method = 'POST' THEN
          payload = jsonb_build_object(
            'old_record', OLD,
            'record', NEW,
            'type', TG_OP,
            'table', TG_TABLE_NAME,
            'schema', TG_TABLE_SCHEMA
          );

          SELECT http_post INTO request_id FROM net.http_post(
            url,
            payload,
            params,
            headers,
            timeout_ms
          );
        ELSE
          RAISE EXCEPTION 'method argument % is invalid', method;
      END CASE;

      INSERT INTO supabase_functions.hooks
        (hook_table_id, hook_name, request_id)
      VALUES
        (TG_RELID, TG_NAME, request_id);

      RETURN NEW;
    END
  $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: extensions; Type: TABLE; Schema: _realtime; Owner: -
--

CREATE TABLE _realtime.extensions (
    id uuid NOT NULL,
    type text,
    settings jsonb,
    tenant_external_id text,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: _realtime; Owner: -
--

CREATE TABLE _realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: tenants; Type: TABLE; Schema: _realtime; Owner: -
--

CREATE TABLE _realtime.tenants (
    id uuid NOT NULL,
    name text,
    external_id text,
    jwt_secret text,
    max_concurrent_users integer DEFAULT 200 NOT NULL,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL,
    max_events_per_second integer DEFAULT 100 NOT NULL,
    postgres_cdc_default text DEFAULT 'postgres_cdc_rls'::text,
    max_bytes_per_second integer DEFAULT 100000 NOT NULL,
    max_channels_per_client integer DEFAULT 100 NOT NULL,
    max_joins_per_second integer DEFAULT 500 NOT NULL,
    suspend boolean DEFAULT false,
    jwt_jwks jsonb,
    notify_private_alpha boolean DEFAULT false,
    private_only boolean DEFAULT false NOT NULL,
    migrations_ran integer DEFAULT 0,
    broadcast_adapter character varying(255) DEFAULT 'gen_rpc'::character varying,
    max_presence_events_per_second integer DEFAULT 1000,
    max_payload_size_in_kb integer DEFAULT 3000,
    max_client_presence_events_per_window integer,
    client_presence_window_ms integer,
    CONSTRAINT jwt_secret_or_jwt_jwks_required CHECK (((jwt_secret IS NOT NULL) OR (jwt_jwks IS NOT NULL)))
);


--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: announcement_comment_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement_comment_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    emoji character varying(32) NOT NULL
);

ALTER TABLE ONLY public.announcement_comment_reactions REPLICA IDENTITY FULL;


--
-- Name: announcement_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    reply_to_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    edited_at timestamp with time zone
);

ALTER TABLE ONLY public.announcement_comments REPLICA IDENTITY FULL;


--
-- Name: app_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_config (
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: auth_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_rate_limits (
    ip_hash text NOT NULL,
    action text NOT NULL,
    attempts integer DEFAULT 1,
    window_start timestamp with time zone DEFAULT now()
);


--
-- Name: badges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.badges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    icon_url text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: category_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    role_id uuid,
    role_name text,
    user_id uuid,
    permission text NOT NULL,
    allowed boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT category_permissions_role_name_check CHECK ((role_name = ANY (ARRAY['owner'::text, 'admin'::text, 'moderator'::text, 'member'::text]))),
    CONSTRAINT category_permissions_target_check CHECK (((role_id IS NOT NULL) OR (role_name IS NOT NULL) OR (user_id IS NOT NULL)))
);

ALTER TABLE ONLY public.category_permissions REPLICA IDENTITY FULL;


--
-- Name: channel_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    server_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    "position" integer DEFAULT 0,
    is_collapsed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.channel_categories REPLICA IDENTITY FULL;


--
-- Name: channel_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel_id uuid NOT NULL,
    user_id uuid NOT NULL,
    added_by uuid,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.channel_members REPLICA IDENTITY FULL;


--
-- Name: channel_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel_id uuid NOT NULL,
    role_id uuid,
    role_name public.server_role,
    permission public.permission_type NOT NULL,
    allowed boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    user_id uuid,
    CONSTRAINT channel_permissions_target_check CHECK ((((role_id IS NOT NULL) AND (role_name IS NULL) AND (user_id IS NULL)) OR ((role_id IS NULL) AND (role_name IS NOT NULL) AND (user_id IS NULL)) OR ((role_id IS NULL) AND (role_name IS NULL) AND (user_id IS NOT NULL))))
);


--
-- Name: channel_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_reads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel_id uuid NOT NULL,
    user_id uuid NOT NULL,
    last_read_message_id uuid,
    last_read_at timestamp with time zone,
    mention_count integer DEFAULT 0
);


--
-- Name: channel_user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_user_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel_id uuid NOT NULL,
    user_id uuid NOT NULL,
    is_muted boolean DEFAULT false,
    is_hidden boolean DEFAULT false,
    is_pinned boolean DEFAULT false,
    notification_level text DEFAULT 'all'::text,
    mute_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT channel_user_settings_notification_level_check CHECK ((notification_level = ANY (ARRAY['all'::text, 'mentions'::text, 'nothing'::text])))
);

ALTER TABLE ONLY public.channel_user_settings REPLICA IDENTITY FULL;


--
-- Name: channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    server_id uuid NOT NULL,
    category_id uuid,
    name character varying(100) NOT NULL,
    topic text,
    type public.channel_type DEFAULT 'text'::public.channel_type,
    "position" integer DEFAULT 0,
    is_nsfw boolean DEFAULT false,
    slowmode_seconds integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    icon text,
    is_read_only boolean DEFAULT false,
    is_private boolean DEFAULT false NOT NULL,
    block_links boolean DEFAULT false NOT NULL,
    allowed_link_domains text[] DEFAULT '{}'::text[],
    ghost_mode boolean DEFAULT false NOT NULL
);

ALTER TABLE ONLY public.channels REPLICA IDENTITY FULL;


--
-- Name: COLUMN channels.icon; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.channels.icon IS 'Noto Emoji character used as channel icon';


--
-- Name: COLUMN channels.block_links; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.channels.block_links IS 'When true, only admins/owners can post links';


--
-- Name: COLUMN channels.allowed_link_domains; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.channels.allowed_link_domains IS 'Whitelisted domains when block_links is true (e.g. github.com)';


--
-- Name: COLUMN channels.ghost_mode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.channels.ghost_mode IS 'When true, hides user avatars and usernames (except for admins/owners)';


--
-- Name: declined_friend_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.declined_friend_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requester_id uuid NOT NULL,
    addressee_id uuid NOT NULL,
    declined_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: direct_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.direct_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    reply_to_id uuid,
    content text NOT NULL,
    edited_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.direct_messages FORCE ROW LEVEL SECURITY;


--
-- Name: dm_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dm_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    file_name text NOT NULL,
    file_url text NOT NULL,
    file_type text,
    file_size integer,
    width integer,
    height integer
);


--
-- Name: dm_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dm_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    is_group boolean DEFAULT false,
    name text,
    created_by uuid
);

ALTER TABLE ONLY public.dm_conversations REPLICA IDENTITY FULL;

ALTER TABLE ONLY public.dm_conversations FORCE ROW LEVEL SECURITY;


--
-- Name: dm_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dm_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    last_read_at timestamp with time zone
);

ALTER TABLE ONLY public.dm_participants REPLICA IDENTITY FULL;

ALTER TABLE ONLY public.dm_participants FORCE ROW LEVEL SECURITY;


--
-- Name: dm_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dm_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    emoji character varying(64) NOT NULL
);

ALTER TABLE ONLY public.dm_reactions REPLICA IDENTITY FULL;


--
-- Name: friendships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.friendships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requester_id uuid NOT NULL,
    addressee_id uuid NOT NULL,
    status public.friendship_status DEFAULT 'pending'::public.friendship_status,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.friendships REPLICA IDENTITY FULL;


--
-- Name: media_comment_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_comment_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    emoji text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.media_comment_reactions REPLICA IDENTITY FULL;


--
-- Name: media_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    media_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    reply_to_id uuid,
    edited_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.media_comments REPLICA IDENTITY FULL;


--
-- Name: media_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel_id uuid NOT NULL,
    user_id uuid NOT NULL,
    title text,
    description text,
    media_url text NOT NULL,
    media_type text NOT NULL,
    thumbnail_url text,
    width integer,
    height integer,
    file_size integer,
    created_at timestamp with time zone DEFAULT now(),
    youtube_video_id text,
    CONSTRAINT media_items_media_type_check CHECK ((media_type = ANY (ARRAY['image'::text, 'video'::text, 'gif'::text, 'youtube'::text])))
);

ALTER TABLE ONLY public.media_items REPLICA IDENTITY FULL;


--
-- Name: mentions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mentions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    mention_type public.mention_type DEFAULT 'user'::public.mention_type
);


--
-- Name: message_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    file_name text NOT NULL,
    file_url text NOT NULL,
    file_type text,
    file_size integer,
    width integer,
    height integer
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel_id uuid NOT NULL,
    user_id uuid NOT NULL,
    reply_to_id uuid,
    content text NOT NULL,
    is_pinned boolean DEFAULT false,
    edited_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    is_system_message boolean DEFAULT false,
    embed_hidden boolean DEFAULT false NOT NULL
);

ALTER TABLE ONLY public.messages REPLICA IDENTITY FULL;

ALTER TABLE ONLY public.messages FORCE ROW LEVEL SECURITY;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type public.notification_type NOT NULL,
    title text NOT NULL,
    body text,
    link text,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.notifications REPLICA IDENTITY FULL;


--
-- Name: poll_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.poll_votes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    poll_id uuid NOT NULL,
    user_id uuid NOT NULL,
    option_index integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: polls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.polls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    channel_id uuid NOT NULL,
    created_by uuid NOT NULL,
    question text NOT NULL,
    options text[] NOT NULL,
    allow_multiple boolean DEFAULT false NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    is_closed boolean DEFAULT false NOT NULL,
    results jsonb DEFAULT '[]'::jsonb NOT NULL,
    total_votes integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pow_challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pow_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nonce text NOT NULL,
    difficulty integer DEFAULT 4 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:10:00'::interval) NOT NULL,
    used boolean DEFAULT false
);


--
-- Name: reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    emoji character varying(64) NOT NULL,
    channel_id uuid NOT NULL
);

ALTER TABLE ONLY public.reactions REPLICA IDENTITY FULL;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    server_id uuid NOT NULL,
    role_id uuid,
    role_name public.server_role,
    permission public.permission_type NOT NULL,
    allowed boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT role_permissions_role_check CHECK ((((role_id IS NOT NULL) AND (role_name IS NULL)) OR ((role_id IS NULL) AND (role_name IS NOT NULL))))
);


--
-- Name: server_emojis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.server_emojis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    server_id uuid NOT NULL,
    name text NOT NULL,
    file_path text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: server_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.server_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    server_id uuid NOT NULL,
    code character(8) NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    expires_at timestamp with time zone,
    max_uses integer,
    uses_count integer DEFAULT 0 NOT NULL
);


--
-- Name: server_member_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.server_member_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid NOT NULL,
    role_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: server_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.server_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    server_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.server_role DEFAULT 'member'::public.server_role,
    nickname character varying(32),
    is_banned boolean DEFAULT false NOT NULL,
    is_muted boolean DEFAULT false,
    joined_at timestamp with time zone DEFAULT now(),
    join_source text,
    join_invite_code text,
    "position" integer
);

ALTER TABLE ONLY public.server_members REPLICA IDENTITY FULL;


--
-- Name: COLUMN server_members.join_source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.server_members.join_source IS 'How the member joined: discover, invite_link, or invite (custom server_invites code)';


--
-- Name: COLUMN server_members.join_invite_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.server_members.join_invite_code IS 'When join_source = invite, the invite code that was used';


--
-- Name: server_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.server_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    server_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    color character varying(255) DEFAULT '#5865F2'::character varying NOT NULL,
    "position" integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    icon text
);


--
-- Name: COLUMN server_roles.color; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.server_roles.color IS 'Role color - can be a hex color (#5865F2) or a CSS gradient (linear-gradient(135deg, #667eea, #764ba2))';


--
-- Name: servers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    icon_url text,
    banner_url text,
    owner_id uuid NOT NULL,
    invite_code character(8) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    is_published boolean DEFAULT false NOT NULL,
    about text,
    system_channel_join_id uuid,
    system_channel_leave_id uuid,
    enable_join_messages boolean DEFAULT true,
    enable_leave_messages boolean DEFAULT true
);

ALTER TABLE ONLY public.servers REPLICA IDENTITY FULL;

ALTER TABLE ONLY public.servers FORCE ROW LEVEL SECURITY;


--
-- Name: thread_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.thread_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    file_name text NOT NULL,
    file_url text NOT NULL,
    file_type text,
    file_size integer,
    width integer,
    height integer
);


--
-- Name: thread_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.thread_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    reply_to_id uuid,
    edited_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.thread_messages REPLICA IDENTITY FULL;


--
-- Name: thread_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.thread_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    emoji character varying(64) NOT NULL
);

ALTER TABLE ONLY public.thread_reactions REPLICA IDENTITY FULL;


--
-- Name: threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel_id uuid NOT NULL,
    message_id uuid NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.threads REPLICA IDENTITY FULL;


--
-- Name: user_auth; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_auth (
    user_id uuid NOT NULL,
    key_hash text NOT NULL,
    last_key_reset_at timestamp with time zone
);

ALTER TABLE ONLY public.user_auth FORCE ROW LEVEL SECURITY;


--
-- Name: user_badges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_badges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    badge_id uuid NOT NULL,
    awarded_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    device_id integer NOT NULL,
    device_name character varying(100),
    identity_public_key text NOT NULL,
    last_active timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.user_devices FORCE ROW LEVEL SECURITY;


--
-- Name: user_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    theme text DEFAULT 'default'::text NOT NULL,
    link_previews_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    desktop_notifications_enabled boolean DEFAULT true NOT NULL,
    notification_sound_enabled boolean DEFAULT true NOT NULL,
    show_message_preview boolean DEFAULT true NOT NULL,
    compact_mode boolean DEFAULT false NOT NULL,
    show_timestamps boolean DEFAULT true NOT NULL,
    animate_emojis boolean DEFAULT true NOT NULL,
    browser_notifications_enabled boolean DEFAULT true,
    notification_sound_server_mentions boolean DEFAULT true,
    notification_sound_user_mentions boolean DEFAULT true,
    notification_sound_replies boolean DEFAULT true,
    notification_volume integer DEFAULT 50,
    show_preview_server_mentions boolean DEFAULT true,
    show_preview_user_mentions boolean DEFAULT true,
    show_preview_replies boolean DEFAULT true,
    dm_privacy text DEFAULT 'shared_servers'::text NOT NULL,
    CONSTRAINT notification_volume_range CHECK (((notification_volume >= 0) AND (notification_volume <= 100))),
    CONSTRAINT user_preferences_dm_privacy_check CHECK ((dm_privacy = ANY (ARRAY['everyone'::text, 'shared_servers'::text, 'friends'::text, 'no_one'::text])))
);


--
-- Name: user_server_folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_server_folders (
    user_id uuid NOT NULL,
    folder_data jsonb DEFAULT '{"folders": [], "serverToFolder": {}}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE user_server_folders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_server_folders IS 'Stores each user''s server folder organization (synced across devices)';


--
-- Name: user_server_tabs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_server_tabs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tab_order text[] DEFAULT '{}'::text[] NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_voice_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_voice_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT check_settings_shape CHECK (((jsonb_typeof(settings) = 'object'::text) AND (((settings ->> 'inputGain'::text) IS NULL) OR ((((settings ->> 'inputGain'::text))::integer >= 0) AND (((settings ->> 'inputGain'::text))::integer <= 200))) AND (((settings ->> 'outputVolume'::text) IS NULL) OR ((((settings ->> 'outputVolume'::text))::integer >= 0) AND (((settings ->> 'outputVolume'::text))::integer <= 200))) AND (((settings ->> 'voiceMode'::text) IS NULL) OR ((settings ->> 'voiceMode'::text) = ANY (ARRAY['voice_activity'::text, 'push_to_talk'::text]))) AND (((settings ->> 'voiceActivityThreshold'::text) IS NULL) OR ((((settings ->> 'voiceActivityThreshold'::text))::integer >= 0) AND (((settings ->> 'voiceActivityThreshold'::text))::integer <= 100))) AND (((settings ->> 'autoDisconnectMinutes'::text) IS NULL) OR ((((settings ->> 'autoDisconnectMinutes'::text))::integer >= 0) AND (((settings ->> 'autoDisconnectMinutes'::text))::integer <= 60)))))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username character varying(20) NOT NULL,
    display_name character varying(32),
    avatar_url text,
    banner_color character(7) DEFAULT '#5865F2'::bpchar,
    bio text,
    status public.user_status DEFAULT 'online'::public.user_status,
    custom_status character varying(128),
    created_at timestamp with time zone DEFAULT now(),
    last_seen timestamp with time zone DEFAULT now(),
    avatar_decoration text,
    profile_theme_primary character(7),
    profile_theme_accent character(7),
    banner_url text,
    profile_effect text,
    pronouns character varying(25) DEFAULT NULL::character varying,
    CONSTRAINT check_avatar_decoration_is_key CHECK ((avatar_decoration !~~ 'http%'::text)),
    CONSTRAINT check_profile_effect_is_key CHECK ((profile_effect !~~ 'http%'::text))
);

ALTER TABLE ONLY public.users REPLICA IDENTITY FULL;

ALTER TABLE ONLY public.users FORCE ROW LEVEL SECURITY;


--
-- Name: COLUMN users.avatar_decoration; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.avatar_decoration IS 'Stores asset key only (e.g. sparkle), frontend maps to URL.';


--
-- Name: COLUMN users.profile_effect; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.profile_effect IS 'Stores asset key only (e.g. fire_border), frontend maps to URL.';


--
-- Name: users_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.users_public WITH (security_invoker='true') AS
 SELECT users.id,
    users.username,
    users.display_name,
    users.avatar_url,
    users.banner_color,
    users.bio,
    users.status,
    users.custom_status,
    users.created_at,
    users.avatar_decoration,
    users.profile_theme_primary,
    users.profile_theme_accent,
    users.banner_url,
    users.profile_effect,
    users.pronouns,
        CASE
            WHEN (users.id = ( SELECT public.requesting_user_id() AS requesting_user_id)) THEN users.last_seen
            ELSE NULL::timestamp with time zone
        END AS last_seen
   FROM public.users;


--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);


--
-- Name: messages_2026_02_21; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_02_21 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_02_22; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_02_22 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_02_23; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_02_23 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_02_24; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_02_24 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_02_25; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_02_25 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_02_26; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_02_26 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_02_27; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_02_27 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    action_filter text DEFAULT '*'::text,
    CONSTRAINT subscription_action_filter_check CHECK ((action_filter = ANY (ARRAY['*'::text, 'INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: iceberg_namespaces; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.iceberg_namespaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_name text NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    catalog_id uuid NOT NULL
);


--
-- Name: iceberg_tables; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.iceberg_tables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    namespace_id uuid NOT NULL,
    bucket_name text NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    location text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    remote_table_id text,
    shard_key text,
    shard_id text,
    catalog_id uuid NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hooks; Type: TABLE; Schema: supabase_functions; Owner: -
--

CREATE TABLE supabase_functions.hooks (
    id bigint NOT NULL,
    hook_table_id integer NOT NULL,
    hook_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id bigint
);


--
-- Name: TABLE hooks; Type: COMMENT; Schema: supabase_functions; Owner: -
--

COMMENT ON TABLE supabase_functions.hooks IS 'Supabase Functions Hooks: Audit trail for triggered hooks.';


--
-- Name: hooks_id_seq; Type: SEQUENCE; Schema: supabase_functions; Owner: -
--

CREATE SEQUENCE supabase_functions.hooks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hooks_id_seq; Type: SEQUENCE OWNED BY; Schema: supabase_functions; Owner: -
--

ALTER SEQUENCE supabase_functions.hooks_id_seq OWNED BY supabase_functions.hooks.id;


--
-- Name: migrations; Type: TABLE; Schema: supabase_functions; Owner: -
--

CREATE TABLE supabase_functions.migrations (
    version text NOT NULL,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: messages_2026_02_21; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_02_21 FOR VALUES FROM ('2026-02-21 00:00:00') TO ('2026-02-22 00:00:00');


--
-- Name: messages_2026_02_22; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_02_22 FOR VALUES FROM ('2026-02-22 00:00:00') TO ('2026-02-23 00:00:00');


--
-- Name: messages_2026_02_23; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_02_23 FOR VALUES FROM ('2026-02-23 00:00:00') TO ('2026-02-24 00:00:00');


--
-- Name: messages_2026_02_24; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_02_24 FOR VALUES FROM ('2026-02-24 00:00:00') TO ('2026-02-25 00:00:00');


--
-- Name: messages_2026_02_25; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_02_25 FOR VALUES FROM ('2026-02-25 00:00:00') TO ('2026-02-26 00:00:00');


--
-- Name: messages_2026_02_26; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_02_26 FOR VALUES FROM ('2026-02-26 00:00:00') TO ('2026-02-27 00:00:00');


--
-- Name: messages_2026_02_27; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_02_27 FOR VALUES FROM ('2026-02-27 00:00:00') TO ('2026-02-28 00:00:00');


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: hooks id; Type: DEFAULT; Schema: supabase_functions; Owner: -
--

ALTER TABLE ONLY supabase_functions.hooks ALTER COLUMN id SET DEFAULT nextval('supabase_functions.hooks_id_seq'::regclass);


--
-- Name: extensions extensions_pkey; Type: CONSTRAINT; Schema: _realtime; Owner: -
--

ALTER TABLE ONLY _realtime.extensions
    ADD CONSTRAINT extensions_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: _realtime; Owner: -
--

ALTER TABLE ONLY _realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: _realtime; Owner: -
--

ALTER TABLE ONLY _realtime.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: announcement_comment_reactions announcement_comment_reactions_comment_id_user_id_emoji_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_comment_reactions
    ADD CONSTRAINT announcement_comment_reactions_comment_id_user_id_emoji_key UNIQUE (comment_id, user_id, emoji);


--
-- Name: announcement_comment_reactions announcement_comment_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_comment_reactions
    ADD CONSTRAINT announcement_comment_reactions_pkey PRIMARY KEY (id);


--
-- Name: announcement_comments announcement_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_comments
    ADD CONSTRAINT announcement_comments_pkey PRIMARY KEY (id);


--
-- Name: app_config app_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_config
    ADD CONSTRAINT app_config_pkey PRIMARY KEY (key);


--
-- Name: auth_rate_limits auth_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_rate_limits
    ADD CONSTRAINT auth_rate_limits_pkey PRIMARY KEY (ip_hash, action);


--
-- Name: badges badges_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT badges_name_key UNIQUE (name);


--
-- Name: badges badges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT badges_pkey PRIMARY KEY (id);


--
-- Name: category_permissions category_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_permissions
    ADD CONSTRAINT category_permissions_pkey PRIMARY KEY (id);


--
-- Name: category_permissions category_permissions_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_permissions
    ADD CONSTRAINT category_permissions_unique UNIQUE (category_id, role_id, role_name, user_id, permission);


--
-- Name: channel_categories channel_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_categories
    ADD CONSTRAINT channel_categories_pkey PRIMARY KEY (id);


--
-- Name: channel_members channel_members_channel_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_members
    ADD CONSTRAINT channel_members_channel_id_user_id_key UNIQUE (channel_id, user_id);


--
-- Name: channel_members channel_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_members
    ADD CONSTRAINT channel_members_pkey PRIMARY KEY (id);


--
-- Name: channel_permissions channel_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_permissions
    ADD CONSTRAINT channel_permissions_pkey PRIMARY KEY (id);


--
-- Name: channel_reads channel_reads_channel_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_reads
    ADD CONSTRAINT channel_reads_channel_id_user_id_key UNIQUE (channel_id, user_id);


--
-- Name: channel_reads channel_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_reads
    ADD CONSTRAINT channel_reads_pkey PRIMARY KEY (id);


--
-- Name: channel_reads channel_reads_user_channel_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_reads
    ADD CONSTRAINT channel_reads_user_channel_unique UNIQUE (user_id, channel_id);


--
-- Name: channel_user_settings channel_user_settings_channel_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_user_settings
    ADD CONSTRAINT channel_user_settings_channel_id_user_id_key UNIQUE (channel_id, user_id);


--
-- Name: channel_user_settings channel_user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_user_settings
    ADD CONSTRAINT channel_user_settings_pkey PRIMARY KEY (id);


--
-- Name: channels channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_pkey PRIMARY KEY (id);


--
-- Name: declined_friend_requests declined_friend_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.declined_friend_requests
    ADD CONSTRAINT declined_friend_requests_pkey PRIMARY KEY (id);


--
-- Name: declined_friend_requests declined_friend_requests_requester_id_addressee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.declined_friend_requests
    ADD CONSTRAINT declined_friend_requests_requester_id_addressee_id_key UNIQUE (requester_id, addressee_id);


--
-- Name: direct_messages direct_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_pkey PRIMARY KEY (id);


--
-- Name: dm_attachments dm_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_attachments
    ADD CONSTRAINT dm_attachments_pkey PRIMARY KEY (id);


--
-- Name: dm_conversations dm_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_conversations
    ADD CONSTRAINT dm_conversations_pkey PRIMARY KEY (id);


--
-- Name: dm_participants dm_participants_conversation_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_participants
    ADD CONSTRAINT dm_participants_conversation_id_user_id_key UNIQUE (conversation_id, user_id);


--
-- Name: dm_participants dm_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_participants
    ADD CONSTRAINT dm_participants_pkey PRIMARY KEY (id);


--
-- Name: dm_reactions dm_reactions_message_id_user_id_emoji_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_reactions
    ADD CONSTRAINT dm_reactions_message_id_user_id_emoji_key UNIQUE (message_id, user_id, emoji);


--
-- Name: dm_reactions dm_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_reactions
    ADD CONSTRAINT dm_reactions_pkey PRIMARY KEY (id);


--
-- Name: friendships friendships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_pkey PRIMARY KEY (id);


--
-- Name: friendships friendships_requester_id_addressee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_requester_id_addressee_id_key UNIQUE (requester_id, addressee_id);


--
-- Name: media_comment_reactions media_comment_reactions_comment_id_user_id_emoji_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_comment_reactions
    ADD CONSTRAINT media_comment_reactions_comment_id_user_id_emoji_key UNIQUE (comment_id, user_id, emoji);


--
-- Name: media_comment_reactions media_comment_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_comment_reactions
    ADD CONSTRAINT media_comment_reactions_pkey PRIMARY KEY (id);


--
-- Name: media_comments media_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_comments
    ADD CONSTRAINT media_comments_pkey PRIMARY KEY (id);


--
-- Name: media_items media_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_items
    ADD CONSTRAINT media_items_pkey PRIMARY KEY (id);


--
-- Name: mentions mentions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentions
    ADD CONSTRAINT mentions_pkey PRIMARY KEY (id);


--
-- Name: message_attachments message_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT message_attachments_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: poll_votes poll_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_votes
    ADD CONSTRAINT poll_votes_pkey PRIMARY KEY (id);


--
-- Name: poll_votes poll_votes_poll_id_user_id_option_index_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_votes
    ADD CONSTRAINT poll_votes_poll_id_user_id_option_index_key UNIQUE (poll_id, user_id, option_index);


--
-- Name: polls polls_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polls
    ADD CONSTRAINT polls_message_id_key UNIQUE (message_id);


--
-- Name: polls polls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polls
    ADD CONSTRAINT polls_pkey PRIMARY KEY (id);


--
-- Name: pow_challenges pow_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pow_challenges
    ADD CONSTRAINT pow_challenges_pkey PRIMARY KEY (id);


--
-- Name: reactions reactions_message_id_user_id_emoji_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_message_id_user_id_emoji_key UNIQUE (message_id, user_id, emoji);


--
-- Name: reactions reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: server_emojis server_emojis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_emojis
    ADD CONSTRAINT server_emojis_pkey PRIMARY KEY (id);


--
-- Name: server_emojis server_emojis_server_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_emojis
    ADD CONSTRAINT server_emojis_server_id_name_key UNIQUE (server_id, name);


--
-- Name: server_invites server_invites_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_invites
    ADD CONSTRAINT server_invites_code_key UNIQUE (code);


--
-- Name: server_invites server_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_invites
    ADD CONSTRAINT server_invites_pkey PRIMARY KEY (id);


--
-- Name: server_member_roles server_member_roles_member_id_role_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_member_roles
    ADD CONSTRAINT server_member_roles_member_id_role_id_key UNIQUE (member_id, role_id);


--
-- Name: server_member_roles server_member_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_member_roles
    ADD CONSTRAINT server_member_roles_pkey PRIMARY KEY (id);


--
-- Name: server_members server_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_members
    ADD CONSTRAINT server_members_pkey PRIMARY KEY (id);


--
-- Name: server_members server_members_server_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_members
    ADD CONSTRAINT server_members_server_id_user_id_key UNIQUE (server_id, user_id);


--
-- Name: server_roles server_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_roles
    ADD CONSTRAINT server_roles_pkey PRIMARY KEY (id);


--
-- Name: server_roles server_roles_server_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_roles
    ADD CONSTRAINT server_roles_server_id_name_key UNIQUE (server_id, name);


--
-- Name: servers servers_invite_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_invite_code_key UNIQUE (invite_code);


--
-- Name: servers servers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_pkey PRIMARY KEY (id);


--
-- Name: thread_attachments thread_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_attachments
    ADD CONSTRAINT thread_attachments_pkey PRIMARY KEY (id);


--
-- Name: thread_messages thread_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_messages
    ADD CONSTRAINT thread_messages_pkey PRIMARY KEY (id);


--
-- Name: thread_reactions thread_reactions_message_id_user_id_emoji_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_reactions
    ADD CONSTRAINT thread_reactions_message_id_user_id_emoji_key UNIQUE (message_id, user_id, emoji);


--
-- Name: thread_reactions thread_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_reactions
    ADD CONSTRAINT thread_reactions_pkey PRIMARY KEY (id);


--
-- Name: threads threads_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_message_id_key UNIQUE (message_id);


--
-- Name: threads threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_pkey PRIMARY KEY (id);


--
-- Name: user_auth user_auth_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_auth
    ADD CONSTRAINT user_auth_pkey PRIMARY KEY (user_id);


--
-- Name: user_badges user_badges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_pkey PRIMARY KEY (id);


--
-- Name: user_badges user_badges_user_id_badge_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_user_id_badge_id_key UNIQUE (user_id, badge_id);


--
-- Name: user_devices user_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_pkey PRIMARY KEY (id);


--
-- Name: user_devices user_devices_user_id_device_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_user_id_device_id_key UNIQUE (user_id, device_id);


--
-- Name: user_preferences user_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_preferences user_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_key UNIQUE (user_id);


--
-- Name: user_server_folders user_server_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_server_folders
    ADD CONSTRAINT user_server_folders_pkey PRIMARY KEY (user_id);


--
-- Name: user_server_tabs user_server_tabs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_server_tabs
    ADD CONSTRAINT user_server_tabs_pkey PRIMARY KEY (id);


--
-- Name: user_server_tabs user_server_tabs_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_server_tabs
    ADD CONSTRAINT user_server_tabs_user_id_key UNIQUE (user_id);


--
-- Name: user_voice_settings user_voice_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_voice_settings
    ADD CONSTRAINT user_voice_settings_pkey PRIMARY KEY (id);


--
-- Name: user_voice_settings user_voice_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_voice_settings
    ADD CONSTRAINT user_voice_settings_user_id_key UNIQUE (user_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_02_21 messages_2026_02_21_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_02_21
    ADD CONSTRAINT messages_2026_02_21_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_02_22 messages_2026_02_22_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_02_22
    ADD CONSTRAINT messages_2026_02_22_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_02_23 messages_2026_02_23_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_02_23
    ADD CONSTRAINT messages_2026_02_23_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_02_24 messages_2026_02_24_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_02_24
    ADD CONSTRAINT messages_2026_02_24_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_02_25 messages_2026_02_25_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_02_25
    ADD CONSTRAINT messages_2026_02_25_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_02_26 messages_2026_02_26_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_02_26
    ADD CONSTRAINT messages_2026_02_26_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_02_27 messages_2026_02_27_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_02_27
    ADD CONSTRAINT messages_2026_02_27_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: iceberg_namespaces iceberg_namespaces_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.iceberg_namespaces
    ADD CONSTRAINT iceberg_namespaces_pkey PRIMARY KEY (id);


--
-- Name: iceberg_tables iceberg_tables_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.iceberg_tables
    ADD CONSTRAINT iceberg_tables_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: hooks hooks_pkey; Type: CONSTRAINT; Schema: supabase_functions; Owner: -
--

ALTER TABLE ONLY supabase_functions.hooks
    ADD CONSTRAINT hooks_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: supabase_functions; Owner: -
--

ALTER TABLE ONLY supabase_functions.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (version);


--
-- Name: extensions_tenant_external_id_index; Type: INDEX; Schema: _realtime; Owner: -
--

CREATE INDEX extensions_tenant_external_id_index ON _realtime.extensions USING btree (tenant_external_id);


--
-- Name: extensions_tenant_external_id_type_index; Type: INDEX; Schema: _realtime; Owner: -
--

CREATE UNIQUE INDEX extensions_tenant_external_id_type_index ON _realtime.extensions USING btree (tenant_external_id, type);


--
-- Name: tenants_external_id_index; Type: INDEX; Schema: _realtime; Owner: -
--

CREATE UNIQUE INDEX tenants_external_id_index ON _realtime.tenants USING btree (external_id);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: channel_permissions_role_perm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX channel_permissions_role_perm_idx ON public.channel_permissions USING btree (channel_id, role_id, permission) WHERE ((role_id IS NOT NULL) AND (user_id IS NULL));


--
-- Name: channel_permissions_rolename_perm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX channel_permissions_rolename_perm_idx ON public.channel_permissions USING btree (channel_id, role_name, permission) WHERE ((role_name IS NOT NULL) AND (role_id IS NULL) AND (user_id IS NULL));


--
-- Name: channel_permissions_user_perm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX channel_permissions_user_perm_idx ON public.channel_permissions USING btree (channel_id, user_id, permission) WHERE (user_id IS NOT NULL);


--
-- Name: cp_base_role_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cp_base_role_unique ON public.channel_permissions USING btree (channel_id, role_name, permission) WHERE (role_name IS NOT NULL);


--
-- Name: cp_custom_role_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cp_custom_role_unique ON public.channel_permissions USING btree (channel_id, role_id, permission) WHERE (role_id IS NOT NULL);


--
-- Name: idx_announcement_comment_reactions_comment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_comment_reactions_comment ON public.announcement_comment_reactions USING btree (comment_id);


--
-- Name: idx_announcement_comment_reactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_comment_reactions_user_id ON public.announcement_comment_reactions USING btree (user_id);


--
-- Name: idx_announcement_comments_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_comments_message ON public.announcement_comments USING btree (message_id);


--
-- Name: idx_announcement_comments_reply_to_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_comments_reply_to_id ON public.announcement_comments USING btree (reply_to_id) WHERE (reply_to_id IS NOT NULL);


--
-- Name: idx_announcement_comments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_comments_user ON public.announcement_comments USING btree (user_id);


--
-- Name: idx_category_permissions_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_category_permissions_category_id ON public.category_permissions USING btree (category_id);


--
-- Name: idx_category_permissions_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_category_permissions_role_id ON public.category_permissions USING btree (role_id);


--
-- Name: idx_category_permissions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_category_permissions_user_id ON public.category_permissions USING btree (user_id);


--
-- Name: idx_channel_categories_server_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_categories_server_id ON public.channel_categories USING btree (server_id);


--
-- Name: idx_channel_members_added_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_members_added_by ON public.channel_members USING btree (added_by) WHERE (added_by IS NOT NULL);


--
-- Name: idx_channel_members_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_members_channel_id ON public.channel_members USING btree (channel_id);


--
-- Name: idx_channel_members_channel_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_members_channel_user ON public.channel_members USING btree (channel_id, user_id);


--
-- Name: idx_channel_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_members_user_id ON public.channel_members USING btree (user_id);


--
-- Name: idx_channel_permissions_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_permissions_channel ON public.channel_permissions USING btree (channel_id);


--
-- Name: idx_channel_permissions_channel_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_permissions_channel_user ON public.channel_permissions USING btree (channel_id, user_id);


--
-- Name: idx_channel_permissions_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_permissions_role_id ON public.channel_permissions USING btree (role_id);


--
-- Name: idx_channel_permissions_role_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_permissions_role_name ON public.channel_permissions USING btree (channel_id, role_name);


--
-- Name: idx_channel_permissions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_permissions_user_id ON public.channel_permissions USING btree (user_id);


--
-- Name: idx_channel_reads_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_reads_channel ON public.channel_reads USING btree (channel_id);


--
-- Name: idx_channel_reads_last_read_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_reads_last_read_message_id ON public.channel_reads USING btree (last_read_message_id) WHERE (last_read_message_id IS NOT NULL);


--
-- Name: idx_channel_reads_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_reads_user ON public.channel_reads USING btree (user_id);


--
-- Name: idx_channel_user_settings_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_user_settings_channel ON public.channel_user_settings USING btree (channel_id);


--
-- Name: idx_channel_user_settings_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_user_settings_user ON public.channel_user_settings USING btree (user_id);


--
-- Name: idx_channels_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_category ON public.channels USING btree (category_id);


--
-- Name: idx_channels_server_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_server_id ON public.channels USING btree (server_id);


--
-- Name: idx_declined_friend_requests_addressee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_declined_friend_requests_addressee_id ON public.declined_friend_requests USING btree (addressee_id);


--
-- Name: idx_devices_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_devices_user ON public.user_devices USING btree (user_id);


--
-- Name: idx_direct_messages_content_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_direct_messages_content_search ON public.direct_messages USING gin (to_tsvector('english'::regconfig, content));


--
-- Name: idx_direct_messages_conv_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_direct_messages_conv_created ON public.direct_messages USING btree (conversation_id, created_at DESC);


--
-- Name: idx_direct_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_direct_messages_conversation ON public.direct_messages USING btree (conversation_id);


--
-- Name: idx_direct_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_direct_messages_created_at ON public.direct_messages USING btree (created_at DESC);


--
-- Name: idx_direct_messages_reply_to_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_direct_messages_reply_to_id ON public.direct_messages USING btree (reply_to_id) WHERE (reply_to_id IS NOT NULL);


--
-- Name: idx_direct_messages_sender_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_direct_messages_sender_id ON public.direct_messages USING btree (sender_id);


--
-- Name: idx_dm_attachments_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dm_attachments_message_id ON public.dm_attachments USING btree (message_id);


--
-- Name: idx_dm_conversations_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dm_conversations_created_by ON public.dm_conversations USING btree (created_by) WHERE (created_by IS NOT NULL);


--
-- Name: idx_dm_conversations_created_by_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dm_conversations_created_by_created_at ON public.dm_conversations USING btree (created_by, created_at DESC) WHERE (created_by IS NOT NULL);


--
-- Name: idx_dm_participants_conv_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dm_participants_conv_user ON public.dm_participants USING btree (conversation_id, user_id);


--
-- Name: idx_dm_participants_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dm_participants_conversation ON public.dm_participants USING btree (conversation_id);


--
-- Name: idx_dm_participants_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dm_participants_user ON public.dm_participants USING btree (user_id);


--
-- Name: idx_dm_participants_user_conv; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dm_participants_user_conv ON public.dm_participants USING btree (user_id, conversation_id);


--
-- Name: idx_dm_reactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dm_reactions_user_id ON public.dm_reactions USING btree (user_id);


--
-- Name: idx_friendships_addressee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friendships_addressee ON public.friendships USING btree (addressee_id);


--
-- Name: idx_friendships_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friendships_requester ON public.friendships USING btree (requester_id);


--
-- Name: idx_media_comment_reactions_comment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_comment_reactions_comment_id ON public.media_comment_reactions USING btree (comment_id);


--
-- Name: idx_media_comment_reactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_comment_reactions_user_id ON public.media_comment_reactions USING btree (user_id);


--
-- Name: idx_media_comments_media_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_comments_media_id ON public.media_comments USING btree (media_id);


--
-- Name: idx_media_comments_reply_to_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_comments_reply_to_id ON public.media_comments USING btree (reply_to_id) WHERE (reply_to_id IS NOT NULL);


--
-- Name: idx_media_comments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_comments_user_id ON public.media_comments USING btree (user_id);


--
-- Name: idx_media_items_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_items_channel_id ON public.media_items USING btree (channel_id);


--
-- Name: idx_media_items_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_items_created_at ON public.media_items USING btree (created_at DESC);


--
-- Name: idx_media_items_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_items_user_id ON public.media_items USING btree (user_id);


--
-- Name: idx_mentions_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mentions_message ON public.mentions USING btree (message_id);


--
-- Name: idx_mentions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mentions_user ON public.mentions USING btree (user_id);


--
-- Name: idx_message_attachments_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_attachments_message_id ON public.message_attachments USING btree (message_id);


--
-- Name: idx_messages_channel_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_channel_created ON public.messages USING btree (channel_id, created_at DESC);


--
-- Name: idx_messages_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_channel_id ON public.messages USING btree (channel_id);


--
-- Name: idx_messages_content_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_content_search ON public.messages USING gin (to_tsvector('english'::regconfig, content));


--
-- Name: idx_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_created_at ON public.messages USING btree (created_at DESC);


--
-- Name: idx_messages_is_system_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_is_system_message ON public.messages USING btree (is_system_message) WHERE (is_system_message = true);


--
-- Name: idx_messages_reply_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_reply_to ON public.messages USING btree (reply_to_id) WHERE (reply_to_id IS NOT NULL);


--
-- Name: idx_messages_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_user ON public.messages USING btree (user_id);


--
-- Name: idx_messages_user_channel_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_user_channel_created_at ON public.messages USING btree (user_id, channel_id, created_at DESC);


--
-- Name: idx_notifications_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_unread ON public.notifications USING btree (user_id) WHERE (is_read = false);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);


--
-- Name: idx_poll_votes_poll_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_poll_votes_poll_id ON public.poll_votes USING btree (poll_id);


--
-- Name: idx_poll_votes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_poll_votes_user_id ON public.poll_votes USING btree (user_id);


--
-- Name: idx_polls_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_polls_channel_id ON public.polls USING btree (channel_id);


--
-- Name: idx_polls_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_polls_created_by ON public.polls USING btree (created_by);


--
-- Name: idx_polls_ends_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_polls_ends_at ON public.polls USING btree (ends_at);


--
-- Name: idx_polls_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_polls_message_id ON public.polls USING btree (message_id);


--
-- Name: idx_pow_challenges_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pow_challenges_expires_at ON public.pow_challenges USING btree (expires_at);


--
-- Name: idx_reactions_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reactions_channel_id ON public.reactions USING btree (channel_id);


--
-- Name: idx_reactions_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reactions_message_id ON public.reactions USING btree (message_id);


--
-- Name: idx_reactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reactions_user_id ON public.reactions USING btree (user_id);


--
-- Name: idx_role_permissions_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permissions_role_id ON public.role_permissions USING btree (role_id);


--
-- Name: idx_role_permissions_role_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permissions_role_name ON public.role_permissions USING btree (server_id, role_name);


--
-- Name: idx_role_permissions_server_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permissions_server_id ON public.role_permissions USING btree (server_id);


--
-- Name: idx_server_emojis_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_emojis_created_by ON public.server_emojis USING btree (created_by) WHERE (created_by IS NOT NULL);


--
-- Name: idx_server_invites_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_invites_code ON public.server_invites USING btree (code);


--
-- Name: idx_server_invites_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_invites_created_by ON public.server_invites USING btree (created_by) WHERE (created_by IS NOT NULL);


--
-- Name: idx_server_invites_revoked_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_invites_revoked_by ON public.server_invites USING btree (revoked_by) WHERE (revoked_by IS NOT NULL);


--
-- Name: idx_server_invites_server_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_invites_server_id ON public.server_invites USING btree (server_id);


--
-- Name: idx_server_member_roles_member; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_member_roles_member ON public.server_member_roles USING btree (member_id);


--
-- Name: idx_server_member_roles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_member_roles_role ON public.server_member_roles USING btree (role_id);


--
-- Name: idx_server_members_server; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_members_server ON public.server_members USING btree (server_id);


--
-- Name: idx_server_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_members_user ON public.server_members USING btree (user_id);


--
-- Name: idx_server_members_user_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_members_user_position ON public.server_members USING btree (user_id, "position");


--
-- Name: idx_server_members_user_server; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_members_user_server ON public.server_members USING btree (user_id, server_id);


--
-- Name: idx_server_roles_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_roles_position ON public.server_roles USING btree (server_id, "position");


--
-- Name: idx_server_roles_server_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_roles_server_id ON public.server_roles USING btree (server_id);


--
-- Name: idx_servers_invite_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servers_invite_code ON public.servers USING btree (invite_code);


--
-- Name: idx_servers_is_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servers_is_published ON public.servers USING btree (is_published) WHERE (is_published = true);


--
-- Name: idx_servers_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servers_owner_id ON public.servers USING btree (owner_id);


--
-- Name: idx_servers_published_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servers_published_created ON public.servers USING btree (created_at DESC) WHERE (is_published = true);


--
-- Name: idx_servers_system_channel_join_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servers_system_channel_join_id ON public.servers USING btree (system_channel_join_id) WHERE (system_channel_join_id IS NOT NULL);


--
-- Name: idx_servers_system_channel_leave_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servers_system_channel_leave_id ON public.servers USING btree (system_channel_leave_id) WHERE (system_channel_leave_id IS NOT NULL);


--
-- Name: idx_thread_attachments_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_attachments_message_id ON public.thread_attachments USING btree (message_id);


--
-- Name: idx_thread_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_messages_created_at ON public.thread_messages USING btree (created_at);


--
-- Name: idx_thread_messages_reply_to_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_messages_reply_to_id ON public.thread_messages USING btree (reply_to_id) WHERE (reply_to_id IS NOT NULL);


--
-- Name: idx_thread_messages_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_messages_thread_id ON public.thread_messages USING btree (thread_id);


--
-- Name: idx_thread_messages_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_messages_user_id ON public.thread_messages USING btree (user_id);


--
-- Name: idx_thread_reactions_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_reactions_message_id ON public.thread_reactions USING btree (message_id);


--
-- Name: idx_thread_reactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_reactions_user_id ON public.thread_reactions USING btree (user_id);


--
-- Name: idx_threads_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_channel_id ON public.threads USING btree (channel_id);


--
-- Name: idx_threads_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_created_by ON public.threads USING btree (created_by);


--
-- Name: idx_threads_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_message_id ON public.threads USING btree (message_id);


--
-- Name: idx_user_badges_badge_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_badges_badge_id ON public.user_badges USING btree (badge_id);


--
-- Name: idx_user_server_folders_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_server_folders_user_id ON public.user_server_folders USING btree (user_id);


--
-- Name: idx_user_voice_settings_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_voice_settings_user_id ON public.user_voice_settings USING btree (user_id);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: role_permissions_server_role_perm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX role_permissions_server_role_perm_idx ON public.role_permissions USING btree (server_id, role_id, permission) WHERE (role_id IS NOT NULL);


--
-- Name: role_permissions_server_rolename_perm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX role_permissions_server_rolename_perm_idx ON public.role_permissions USING btree (server_id, role_name, permission) WHERE ((role_name IS NOT NULL) AND (role_id IS NULL));


--
-- Name: rp_base_role_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX rp_base_role_unique ON public.role_permissions USING btree (server_id, role_name, permission) WHERE (role_name IS NOT NULL);


--
-- Name: server_emojis_server_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX server_emojis_server_id_idx ON public.server_emojis USING btree (server_id);


--
-- Name: servers_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX servers_created_at_idx ON public.servers USING btree (created_at);


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_02_21_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_02_21_inserted_at_topic_idx ON realtime.messages_2026_02_21 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_02_22_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_02_22_inserted_at_topic_idx ON realtime.messages_2026_02_22 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_02_23_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_02_23_inserted_at_topic_idx ON realtime.messages_2026_02_23 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_02_24_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_02_24_inserted_at_topic_idx ON realtime.messages_2026_02_24 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_02_25_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_02_25_inserted_at_topic_idx ON realtime.messages_2026_02_25 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_02_26_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_02_26_inserted_at_topic_idx ON realtime.messages_2026_02_26 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_02_27_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_02_27_inserted_at_topic_idx ON realtime.messages_2026_02_27 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_action_filter_key; Type: INDEX; Schema: realtime; Owner: -
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_action_filter_key ON realtime.subscription USING btree (subscription_id, entity, filters, action_filter);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_iceberg_namespaces_bucket_id; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_iceberg_namespaces_bucket_id ON storage.iceberg_namespaces USING btree (catalog_id, name);


--
-- Name: idx_iceberg_tables_location; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_iceberg_tables_location ON storage.iceberg_tables USING btree (location);


--
-- Name: idx_iceberg_tables_namespace_id; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_iceberg_tables_namespace_id ON storage.iceberg_tables USING btree (catalog_id, namespace_id, name);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_bucket_id_name_lower; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: supabase_functions_hooks_h_table_id_h_name_idx; Type: INDEX; Schema: supabase_functions; Owner: -
--

CREATE INDEX supabase_functions_hooks_h_table_id_h_name_idx ON supabase_functions.hooks USING btree (hook_table_id, hook_name);


--
-- Name: supabase_functions_hooks_request_id_idx; Type: INDEX; Schema: supabase_functions; Owner: -
--

CREATE INDEX supabase_functions_hooks_request_id_idx ON supabase_functions.hooks USING btree (request_id);


--
-- Name: messages_2026_02_21_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_02_21_inserted_at_topic_idx;


--
-- Name: messages_2026_02_21_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_02_21_pkey;


--
-- Name: messages_2026_02_22_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_02_22_inserted_at_topic_idx;


--
-- Name: messages_2026_02_22_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_02_22_pkey;


--
-- Name: messages_2026_02_23_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_02_23_inserted_at_topic_idx;


--
-- Name: messages_2026_02_23_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_02_23_pkey;


--
-- Name: messages_2026_02_24_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_02_24_inserted_at_topic_idx;


--
-- Name: messages_2026_02_24_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_02_24_pkey;


--
-- Name: messages_2026_02_25_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_02_25_inserted_at_topic_idx;


--
-- Name: messages_2026_02_25_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_02_25_pkey;


--
-- Name: messages_2026_02_26_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_02_26_inserted_at_topic_idx;


--
-- Name: messages_2026_02_26_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_02_26_pkey;


--
-- Name: messages_2026_02_27_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_02_27_inserted_at_topic_idx;


--
-- Name: messages_2026_02_27_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_02_27_pkey;


--
-- Name: direct_messages dm_notification_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dm_notification_trigger AFTER INSERT ON public.direct_messages FOR EACH ROW EXECUTE FUNCTION public.trigger_dm_notification();


--
-- Name: channels enforce_channel_creation_rate_limit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_channel_creation_rate_limit BEFORE INSERT ON public.channels FOR EACH ROW EXECUTE FUNCTION public.rate_limit_channel_creation();


--
-- Name: channel_members enforce_channel_member_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_channel_member_immutable BEFORE UPDATE ON public.channel_members FOR EACH ROW EXECUTE FUNCTION public.prevent_channel_member_identity_change();


--
-- Name: user_devices enforce_device_key_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_device_key_immutable BEFORE UPDATE ON public.user_devices FOR EACH ROW EXECUTE FUNCTION public.prevent_device_key_change();


--
-- Name: friendships enforce_friendship_identity_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_friendship_identity_immutable BEFORE UPDATE ON public.friendships FOR EACH ROW EXECUTE FUNCTION public.prevent_friendship_identity_change();


--
-- Name: friendships enforce_friendship_pending_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_friendship_pending_insert BEFORE INSERT ON public.friendships FOR EACH ROW EXECUTE FUNCTION public.enforce_friendship_pending_on_insert();


--
-- Name: server_members enforce_server_member_immutable_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_server_member_immutable_fields BEFORE UPDATE ON public.server_members FOR EACH ROW EXECUTE FUNCTION public.prevent_server_member_privilege_change();


--
-- Name: mentions mention_notification_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mention_notification_trigger AFTER INSERT ON public.mentions FOR EACH ROW EXECUTE FUNCTION public.trigger_mention_notification();


--
-- Name: server_emojis trg_enforce_server_emoji_limit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_server_emoji_limit BEFORE INSERT ON public.server_emojis FOR EACH ROW EXECUTE FUNCTION public.enforce_server_emoji_limit();


--
-- Name: dm_participants trg_prevent_dm_participant_identity_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_dm_participant_identity_change BEFORE UPDATE ON public.dm_participants FOR EACH ROW EXECUTE FUNCTION public.prevent_dm_participant_identity_change();


--
-- Name: messages trg_prevent_message_identity_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_message_identity_change BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.prevent_message_identity_change();


--
-- Name: users trg_prevent_username_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_username_change BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.prevent_username_change();


--
-- Name: reactions trg_set_reaction_channel_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_reaction_channel_id BEFORE INSERT OR UPDATE OF message_id ON public.reactions FOR EACH ROW EXECUTE FUNCTION public.set_reaction_channel_id();


--
-- Name: user_voice_settings trg_update_voice_settings_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_voice_settings_timestamp BEFORE UPDATE ON public.user_voice_settings FOR EACH ROW EXECUTE FUNCTION public.update_voice_settings_timestamp();


--
-- Name: friendships trigger_cleanup_declined; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_cleanup_declined AFTER UPDATE ON public.friendships FOR EACH STATEMENT EXECUTE FUNCTION public.delete_old_declined_requests();


--
-- Name: mentions trigger_increment_mention_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_increment_mention_count AFTER INSERT ON public.mentions FOR EACH ROW EXECUTE FUNCTION public.increment_mention_count();


--
-- Name: app_config update_app_config_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_app_config_timestamp BEFORE UPDATE ON public.app_config FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: user_preferences update_user_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.update_user_preferences_updated_at();


--
-- Name: users validate_username_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_username_trigger BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.validate_username_on_insert();


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: -
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: extensions extensions_tenant_external_id_fkey; Type: FK CONSTRAINT; Schema: _realtime; Owner: -
--

ALTER TABLE ONLY _realtime.extensions
    ADD CONSTRAINT extensions_tenant_external_id_fkey FOREIGN KEY (tenant_external_id) REFERENCES _realtime.tenants(external_id) ON DELETE CASCADE;


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: announcement_comment_reactions announcement_comment_reactions_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_comment_reactions
    ADD CONSTRAINT announcement_comment_reactions_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.announcement_comments(id) ON DELETE CASCADE;


--
-- Name: announcement_comment_reactions announcement_comment_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_comment_reactions
    ADD CONSTRAINT announcement_comment_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: announcement_comments announcement_comments_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_comments
    ADD CONSTRAINT announcement_comments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: announcement_comments announcement_comments_reply_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_comments
    ADD CONSTRAINT announcement_comments_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.announcement_comments(id) ON DELETE CASCADE;


--
-- Name: announcement_comments announcement_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_comments
    ADD CONSTRAINT announcement_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: category_permissions category_permissions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_permissions
    ADD CONSTRAINT category_permissions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.channel_categories(id) ON DELETE CASCADE;


--
-- Name: category_permissions category_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_permissions
    ADD CONSTRAINT category_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.server_roles(id) ON DELETE CASCADE;


--
-- Name: category_permissions category_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_permissions
    ADD CONSTRAINT category_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: channel_categories channel_categories_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_categories
    ADD CONSTRAINT channel_categories_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE;


--
-- Name: channel_members channel_members_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_members
    ADD CONSTRAINT channel_members_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: channel_members channel_members_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_members
    ADD CONSTRAINT channel_members_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: channel_members channel_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_members
    ADD CONSTRAINT channel_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: channel_permissions channel_permissions_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_permissions
    ADD CONSTRAINT channel_permissions_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: channel_permissions channel_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_permissions
    ADD CONSTRAINT channel_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.server_roles(id) ON DELETE CASCADE;


--
-- Name: channel_permissions channel_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_permissions
    ADD CONSTRAINT channel_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: channel_reads channel_reads_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_reads
    ADD CONSTRAINT channel_reads_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: channel_reads channel_reads_last_read_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_reads
    ADD CONSTRAINT channel_reads_last_read_message_id_fkey FOREIGN KEY (last_read_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: channel_reads channel_reads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_reads
    ADD CONSTRAINT channel_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: channel_user_settings channel_user_settings_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_user_settings
    ADD CONSTRAINT channel_user_settings_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: channel_user_settings channel_user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_user_settings
    ADD CONSTRAINT channel_user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: channels channels_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.channel_categories(id) ON DELETE SET NULL;


--
-- Name: channels channels_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE;


--
-- Name: declined_friend_requests declined_friend_requests_addressee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.declined_friend_requests
    ADD CONSTRAINT declined_friend_requests_addressee_id_fkey FOREIGN KEY (addressee_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: declined_friend_requests declined_friend_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.declined_friend_requests
    ADD CONSTRAINT declined_friend_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: direct_messages direct_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.dm_conversations(id) ON DELETE CASCADE;


--
-- Name: direct_messages direct_messages_reply_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.direct_messages(id) ON DELETE SET NULL;


--
-- Name: direct_messages direct_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: dm_attachments dm_attachments_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_attachments
    ADD CONSTRAINT dm_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.direct_messages(id) ON DELETE CASCADE;


--
-- Name: dm_conversations dm_conversations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_conversations
    ADD CONSTRAINT dm_conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: dm_participants dm_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_participants
    ADD CONSTRAINT dm_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.dm_conversations(id) ON DELETE CASCADE;


--
-- Name: dm_participants dm_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_participants
    ADD CONSTRAINT dm_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: dm_reactions dm_reactions_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_reactions
    ADD CONSTRAINT dm_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.direct_messages(id) ON DELETE CASCADE;


--
-- Name: dm_reactions dm_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_reactions
    ADD CONSTRAINT dm_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: friendships friendships_addressee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_addressee_id_fkey FOREIGN KEY (addressee_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: friendships friendships_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: media_comment_reactions media_comment_reactions_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_comment_reactions
    ADD CONSTRAINT media_comment_reactions_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.media_comments(id) ON DELETE CASCADE;


--
-- Name: media_comment_reactions media_comment_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_comment_reactions
    ADD CONSTRAINT media_comment_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: media_comments media_comments_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_comments
    ADD CONSTRAINT media_comments_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.media_items(id) ON DELETE CASCADE;


--
-- Name: media_comments media_comments_reply_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_comments
    ADD CONSTRAINT media_comments_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.media_comments(id) ON DELETE SET NULL;


--
-- Name: media_comments media_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_comments
    ADD CONSTRAINT media_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: media_items media_items_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_items
    ADD CONSTRAINT media_items_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: media_items media_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_items
    ADD CONSTRAINT media_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: mentions mentions_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentions
    ADD CONSTRAINT mentions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: mentions mentions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentions
    ADD CONSTRAINT mentions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: message_attachments message_attachments_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT message_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: messages messages_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: messages messages_reply_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: messages messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: poll_votes poll_votes_poll_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_votes
    ADD CONSTRAINT poll_votes_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES public.polls(id) ON DELETE CASCADE;


--
-- Name: poll_votes poll_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_votes
    ADD CONSTRAINT poll_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: polls polls_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polls
    ADD CONSTRAINT polls_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: polls polls_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polls
    ADD CONSTRAINT polls_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: polls polls_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polls
    ADD CONSTRAINT polls_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: reactions reactions_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: reactions reactions_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: reactions reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.server_roles(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE;


--
-- Name: server_emojis server_emojis_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_emojis
    ADD CONSTRAINT server_emojis_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: server_emojis server_emojis_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_emojis
    ADD CONSTRAINT server_emojis_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE;


--
-- Name: server_invites server_invites_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_invites
    ADD CONSTRAINT server_invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: server_invites server_invites_revoked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_invites
    ADD CONSTRAINT server_invites_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: server_invites server_invites_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_invites
    ADD CONSTRAINT server_invites_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE;


--
-- Name: server_member_roles server_member_roles_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_member_roles
    ADD CONSTRAINT server_member_roles_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.server_members(id) ON DELETE CASCADE;


--
-- Name: server_member_roles server_member_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_member_roles
    ADD CONSTRAINT server_member_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.server_roles(id) ON DELETE CASCADE;


--
-- Name: server_members server_members_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_members
    ADD CONSTRAINT server_members_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE;


--
-- Name: server_members server_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_members
    ADD CONSTRAINT server_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: server_roles server_roles_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_roles
    ADD CONSTRAINT server_roles_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE;


--
-- Name: servers servers_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: servers servers_system_channel_join_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_system_channel_join_id_fkey FOREIGN KEY (system_channel_join_id) REFERENCES public.channels(id) ON DELETE SET NULL;


--
-- Name: servers servers_system_channel_leave_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_system_channel_leave_id_fkey FOREIGN KEY (system_channel_leave_id) REFERENCES public.channels(id) ON DELETE SET NULL;


--
-- Name: thread_attachments thread_attachments_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_attachments
    ADD CONSTRAINT thread_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.thread_messages(id) ON DELETE CASCADE;


--
-- Name: thread_messages thread_messages_reply_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_messages
    ADD CONSTRAINT thread_messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.thread_messages(id) ON DELETE SET NULL;


--
-- Name: thread_messages thread_messages_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_messages
    ADD CONSTRAINT thread_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: thread_messages thread_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_messages
    ADD CONSTRAINT thread_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: thread_reactions thread_reactions_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_reactions
    ADD CONSTRAINT thread_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.thread_messages(id) ON DELETE CASCADE;


--
-- Name: thread_reactions thread_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_reactions
    ADD CONSTRAINT thread_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: threads threads_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: threads threads_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: threads threads_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: user_auth user_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_auth
    ADD CONSTRAINT user_auth_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_badges user_badges_badge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES public.badges(id) ON DELETE CASCADE;


--
-- Name: user_badges user_badges_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_devices user_devices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_preferences user_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_server_folders user_server_folders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_server_folders
    ADD CONSTRAINT user_server_folders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_server_tabs user_server_tabs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_server_tabs
    ADD CONSTRAINT user_server_tabs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_voice_settings user_voice_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_voice_settings
    ADD CONSTRAINT user_voice_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: iceberg_namespaces iceberg_namespaces_catalog_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.iceberg_namespaces
    ADD CONSTRAINT iceberg_namespaces_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES storage.buckets_analytics(id) ON DELETE CASCADE;


--
-- Name: iceberg_tables iceberg_tables_catalog_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.iceberg_tables
    ADD CONSTRAINT iceberg_tables_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES storage.buckets_analytics(id) ON DELETE CASCADE;


--
-- Name: iceberg_tables iceberg_tables_namespace_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.iceberg_tables
    ADD CONSTRAINT iceberg_tables_namespace_id_fkey FOREIGN KEY (namespace_id) REFERENCES storage.iceberg_namespaces(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: declined_friend_requests Addressee can decline; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Addressee can decline" ON public.declined_friend_requests FOR INSERT WITH CHECK ((addressee_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: announcement_comment_reactions Announcement comment reactions viewable by channel members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Announcement comment reactions viewable by channel members" ON public.announcement_comment_reactions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.announcement_comments ac
  WHERE ((ac.id = announcement_comment_reactions.comment_id) AND public.is_message_channel_member(ac.message_id, ( SELECT public.requesting_user_id() AS requesting_user_id))))));


--
-- Name: announcement_comments Announcement comments viewable by channel members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Announcement comments viewable by channel members" ON public.announcement_comments FOR SELECT USING (public.is_message_channel_member(message_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: message_attachments Attachments can be deleted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Attachments can be deleted" ON public.message_attachments FOR DELETE USING ((message_id IN ( SELECT messages.id
   FROM public.messages
  WHERE (messages.user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)))));


--
-- Name: message_attachments Attachments insert by message sender; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Attachments insert by message sender" ON public.message_attachments FOR INSERT WITH CHECK (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.messages m
  WHERE ((m.id = message_attachments.message_id) AND (m.user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)))))));


--
-- Name: badges Badges are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Badges are publicly readable" ON public.badges FOR SELECT USING (true);


--
-- Name: category_permissions Category permissions viewable by members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Category permissions viewable by members" ON public.category_permissions FOR SELECT USING (public.is_category_server_member(category_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: channel_permissions Channel permissions viewable by members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Channel permissions viewable by members" ON public.channel_permissions FOR SELECT USING (public.is_channel_server_member(channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: channels Channels viewable by server members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Channels viewable by server members" ON public.channels FOR SELECT USING ((public.is_server_member(server_id, ( SELECT public.requesting_user_id() AS requesting_user_id)) AND ((is_private = false) OR public.has_private_channel_access(id, ( SELECT public.requesting_user_id() AS requesting_user_id)))));


--
-- Name: dm_conversations DM conversations via RPC only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "DM conversations via RPC only" ON public.dm_conversations FOR INSERT WITH CHECK (false);


--
-- Name: direct_messages DM participants can read messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "DM participants can read messages" ON public.direct_messages FOR SELECT USING (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.dm_participants dp
  WHERE ((dp.conversation_id = direct_messages.conversation_id) AND (dp.user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)))))));


--
-- Name: direct_messages DM participants can send as self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "DM participants can send as self" ON public.direct_messages FOR INSERT WITH CHECK (((sender_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (content IS NOT NULL) AND (length(TRIM(BOTH FROM content)) > 0) AND (length(content) <= 4000) AND (EXISTS ( SELECT 1
   FROM public.dm_participants dp
  WHERE ((dp.conversation_id = direct_messages.conversation_id) AND (dp.user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)))))));


--
-- Name: dm_participants DM participants via RPC only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "DM participants via RPC only" ON public.dm_participants FOR INSERT WITH CHECK (false);


--
-- Name: direct_messages DM senders can delete own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "DM senders can delete own messages" ON public.direct_messages FOR DELETE USING (((sender_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (EXISTS ( SELECT 1
   FROM public.dm_participants dp
  WHERE ((dp.conversation_id = direct_messages.conversation_id) AND (dp.user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)))))));


--
-- Name: direct_messages DM senders can edit own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "DM senders can edit own messages" ON public.direct_messages FOR UPDATE USING (((sender_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.dm_participants dp
  WHERE ((dp.conversation_id = direct_messages.conversation_id) AND (dp.user_id = ( SELECT public.requesting_user_id() AS requesting_user_id))))))) WITH CHECK (((sender_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (content IS NOT NULL) AND (length(TRIM(BOTH FROM content)) > 0) AND (length(content) <= 4000) AND (EXISTS ( SELECT 1
   FROM public.dm_participants dp
  WHERE ((dp.conversation_id = direct_messages.conversation_id) AND (dp.user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)))))));


--
-- Name: declined_friend_requests Involved users can delete declined requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Involved users can delete declined requests" ON public.declined_friend_requests FOR DELETE USING (((requester_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) OR (addressee_id = ( SELECT public.requesting_user_id() AS requesting_user_id))));


--
-- Name: friendships Involved users can delete friendship; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Involved users can delete friendship" ON public.friendships FOR DELETE USING (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND ((requester_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) OR (addressee_id = ( SELECT public.requesting_user_id() AS requesting_user_id)))));


--
-- Name: friendships Involved users can update friendship; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Involved users can update friendship" ON public.friendships FOR UPDATE USING (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND ((requester_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) OR (addressee_id = ( SELECT public.requesting_user_id() AS requesting_user_id))))) WITH CHECK ((((addressee_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (status = ANY (ARRAY['accepted'::public.friendship_status, 'declined'::public.friendship_status, 'blocked'::public.friendship_status]))) OR ((requester_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (status = 'blocked'::public.friendship_status))));


--
-- Name: declined_friend_requests Involved users see declined requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Involved users see declined requests" ON public.declined_friend_requests FOR SELECT USING (((requester_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) OR (addressee_id = ( SELECT public.requesting_user_id() AS requesting_user_id))));


--
-- Name: media_comment_reactions Media comment reactions viewable by channel members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Media comment reactions viewable by channel members" ON public.media_comment_reactions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.media_comments mc
  WHERE ((mc.id = media_comment_reactions.comment_id) AND public.is_media_channel_member(mc.media_id, ( SELECT public.requesting_user_id() AS requesting_user_id))))));


--
-- Name: media_comments Media comments viewable by channel members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Media comments viewable by channel members" ON public.media_comments FOR SELECT USING (public.is_media_channel_member(media_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: media_items Media viewable by members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Media viewable by members" ON public.media_items FOR SELECT USING (public.is_channel_server_member(channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: server_member_roles Member roles viewable by server members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member roles viewable by server members" ON public.server_member_roles FOR SELECT USING (public.is_member_in_same_server(member_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: channel_categories Members view categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members view categories" ON public.channel_categories FOR SELECT USING (public.is_server_member(server_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: server_members Members viewable by fellow members only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members viewable by fellow members only" ON public.server_members FOR SELECT USING (((CURRENT_USER = 'realtime'::name) OR ((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND public.is_server_member(server_id, ( SELECT public.requesting_user_id() AS requesting_user_id)))));


--
-- Name: mentions Mentions insert via trigger only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Mentions insert via trigger only" ON public.mentions FOR INSERT WITH CHECK (false);


--
-- Name: mentions Mentions viewable by channel members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Mentions viewable by channel members" ON public.mentions FOR SELECT USING (public.is_message_channel_member(message_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: message_attachments Message attachments readable by channel access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Message attachments readable by channel access" ON public.message_attachments FOR SELECT USING (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.messages m
  WHERE ((m.id = message_attachments.message_id) AND public.can_access_channel(m.channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)))))));


--
-- Name: messages Messages readable by channel access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Messages readable by channel access" ON public.messages FOR SELECT USING (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (public.is_maintenance_active() = false) AND public.can_access_channel(channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id))));


--
-- Name: messages Moderators delete messages in their channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Moderators delete messages in their channels" ON public.messages FOR DELETE USING (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (public.is_maintenance_active() = false) AND (EXISTS ( SELECT 1
   FROM (public.server_members sm
     JOIN public.channels c ON ((c.server_id = sm.server_id)))
  WHERE ((c.id = messages.channel_id) AND (sm.user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (sm.role = ANY (ARRAY['admin'::public.server_role, 'owner'::public.server_role])) AND (sm.is_banned = false))))));


--
-- Name: notifications Notifications are private and permission-based; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Notifications are private and permission-based" ON public.notifications FOR SELECT TO authenticated USING (((user_id = public.requesting_user_id()) AND ((link !~~ '/channels/%'::text) OR (EXISTS ( SELECT 1
   FROM public.channels c
  WHERE ((notifications.link ~~ (('/channels/'::text || c.id) || '%'::text)) AND ((c.is_private = false) OR (EXISTS ( SELECT 1
           FROM public.channel_members cm
          WHERE ((cm.channel_id = c.id) AND (cm.user_id = public.requesting_user_id())))))))))));


--
-- Name: dm_attachments Participants add DM attachments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants add DM attachments" ON public.dm_attachments FOR INSERT WITH CHECK (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND public.is_dm_message_participant(message_id, ( SELECT public.requesting_user_id() AS requesting_user_id))));


--
-- Name: dm_conversations Participants can view conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can view conversations" ON public.dm_conversations FOR SELECT USING (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND public.is_dm_participant(id, ( SELECT public.requesting_user_id() AS requesting_user_id))));


--
-- Name: dm_attachments Participants view DM attachments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants view DM attachments" ON public.dm_attachments FOR SELECT USING (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND public.is_dm_participant(public.get_dm_conversation_id(message_id), ( SELECT public.requesting_user_id() AS requesting_user_id))));


--
-- Name: dm_reactions Participants view DM reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants view DM reactions" ON public.dm_reactions FOR SELECT USING (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND public.is_dm_participant(public.get_dm_conversation_id(message_id), ( SELECT public.requesting_user_id() AS requesting_user_id))));


--
-- Name: dm_participants Participants view conversation members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants view conversation members" ON public.dm_participants FOR SELECT USING (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND public.is_dm_participant(conversation_id, ( SELECT public.requesting_user_id() AS requesting_user_id))));


--
-- Name: poll_votes Poll votes viewable by channel members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Poll votes viewable by channel members" ON public.poll_votes FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.polls p
  WHERE ((p.id = poll_votes.poll_id) AND public.is_channel_server_member(p.channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id))))));


--
-- Name: polls Polls viewable by channel members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Polls viewable by channel members" ON public.polls FOR SELECT USING (public.is_channel_server_member(channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: reactions Reactions are viewable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Reactions are viewable" ON public.reactions FOR SELECT USING (((CURRENT_USER = 'realtime'::name) OR ((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND public.can_access_channel(channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)))));


--
-- Name: role_permissions Role permissions viewable by members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Role permissions viewable by members" ON public.role_permissions FOR SELECT USING (public.is_server_member(server_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: server_emojis Server emojis are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Server emojis are viewable by everyone" ON public.server_emojis FOR SELECT USING (true);


--
-- Name: server_invites Server invites readable by managers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Server invites readable by managers" ON public.server_invites FOR SELECT USING (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND public.check_user_server_permission(( SELECT public.requesting_user_id() AS requesting_user_id), server_id, 'manage_invites'::public.permission_type)));


--
-- Name: channel_members Server members can be added to channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Server members can be added to channels" ON public.channel_members FOR INSERT WITH CHECK (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND public.is_channel_server_member(channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (EXISTS ( SELECT 1
   FROM (public.channels c
     JOIN public.server_members sm ON (((sm.server_id = c.server_id) AND (sm.user_id = channel_members.user_id))))
  WHERE ((c.id = channel_members.channel_id) AND (COALESCE(sm.is_banned, false) = false)))) AND (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (EXISTS ( SELECT 1
   FROM public.channels c
  WHERE ((c.id = channel_members.channel_id) AND (COALESCE(c.is_private, false) = false))))) OR public.check_user_server_permission(( SELECT public.requesting_user_id() AS requesting_user_id), ( SELECT c.server_id
   FROM public.channels c
  WHERE (c.id = channel_members.channel_id)), 'manage_channels'::public.permission_type))));


--
-- Name: channel_members Server members view channel members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Server members view channel members" ON public.channel_members FOR SELECT USING (public.is_channel_server_member(channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: server_roles Server roles viewable by members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Server roles viewable by members" ON public.server_roles FOR SELECT USING (public.is_server_member(server_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: servers Servers are viewable by members or published; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Servers are viewable by members or published" ON public.servers FOR SELECT USING (((COALESCE(is_published, false) = true) OR (owner_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) OR (EXISTS ( SELECT 1
   FROM public.server_members sm
  WHERE ((sm.server_id = servers.id) AND (sm.user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (COALESCE(sm.is_banned, false) = false))))));


--
-- Name: servers Servers can be deleted by owner only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Servers can be deleted by owner only" ON public.servers FOR DELETE USING ((owner_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: servers Servers can be inserted by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Servers can be inserted by owner" ON public.servers FOR INSERT WITH CHECK (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (owner_id = ( SELECT public.requesting_user_id() AS requesting_user_id))));


--
-- Name: servers Servers can be updated by owner only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Servers can be updated by owner only" ON public.servers FOR UPDATE USING ((owner_id = ( SELECT public.requesting_user_id() AS requesting_user_id))) WITH CHECK ((owner_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: thread_attachments Thread attachments can be deleted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Thread attachments can be deleted" ON public.thread_attachments FOR DELETE USING ((message_id IN ( SELECT thread_messages.id
   FROM public.thread_messages
  WHERE (thread_messages.user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)))));


--
-- Name: thread_attachments Thread attachments insert by message author; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Thread attachments insert by message author" ON public.thread_attachments FOR INSERT WITH CHECK (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.thread_messages tm
  WHERE ((tm.id = thread_attachments.message_id) AND (tm.user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)))))));


--
-- Name: thread_attachments Thread attachments viewable by channel members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Thread attachments viewable by channel members" ON public.thread_attachments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.thread_messages tm
  WHERE ((tm.id = thread_attachments.message_id) AND public.is_thread_channel_member(tm.thread_id, ( SELECT public.requesting_user_id() AS requesting_user_id))))));


--
-- Name: thread_messages Thread messages can be deleted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Thread messages can be deleted" ON public.thread_messages FOR DELETE USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: thread_messages Thread messages can be inserted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Thread messages can be inserted" ON public.thread_messages FOR INSERT WITH CHECK (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.threads t
  WHERE ((t.id = thread_messages.thread_id) AND public.can_access_channel(t.channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)))))));


--
-- Name: thread_messages Thread messages can be updated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Thread messages can be updated" ON public.thread_messages FOR UPDATE USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id))) WITH CHECK (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (thread_id = ( SELECT tm.thread_id
   FROM public.thread_messages tm
  WHERE (tm.id = thread_messages.id)))));


--
-- Name: thread_messages Thread messages viewable by channel members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Thread messages viewable by channel members" ON public.thread_messages FOR SELECT USING (public.is_thread_channel_member(thread_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: thread_reactions Thread reactions can be deleted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Thread reactions can be deleted" ON public.thread_reactions FOR DELETE USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: thread_reactions Thread reactions can be inserted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Thread reactions can be inserted" ON public.thread_reactions FOR INSERT WITH CHECK (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (public.thread_messages tm
     JOIN public.threads t ON ((t.id = tm.thread_id)))
  WHERE ((tm.id = thread_reactions.message_id) AND public.can_access_channel(t.channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)) AND public.check_user_permission(( SELECT public.requesting_user_id() AS requesting_user_id), t.channel_id, 'add_reactions'::public.permission_type))))));


--
-- Name: thread_reactions Thread reactions viewable by channel members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Thread reactions viewable by channel members" ON public.thread_reactions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.thread_messages tm
  WHERE ((tm.id = thread_reactions.message_id) AND public.is_thread_channel_member(tm.thread_id, ( SELECT public.requesting_user_id() AS requesting_user_id))))));


--
-- Name: threads Threads are viewable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Threads are viewable" ON public.threads FOR SELECT USING (public.is_channel_server_member(channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: threads Threads can be deleted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Threads can be deleted" ON public.threads FOR DELETE USING ((created_by = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: threads Threads can be inserted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Threads can be inserted" ON public.threads FOR INSERT WITH CHECK (((created_by = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND public.can_access_channel(channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (EXISTS ( SELECT 1
   FROM public.messages m
  WHERE ((m.id = threads.message_id) AND (m.channel_id = threads.channel_id) AND public.can_access_channel(m.channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)))))));


--
-- Name: threads Threads can be updated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Threads can be updated" ON public.threads FOR UPDATE USING ((created_by = ( SELECT public.requesting_user_id() AS requesting_user_id))) WITH CHECK (((created_by = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (channel_id = ( SELECT t.channel_id
   FROM public.threads t
  WHERE (t.id = threads.id))) AND (message_id = ( SELECT t.message_id
   FROM public.threads t
  WHERE (t.id = threads.id)))));


--
-- Name: user_badges User badges are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "User badges are publicly readable" ON public.user_badges FOR SELECT USING (true);


--
-- Name: dm_reactions Users add own DM reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users add own DM reactions" ON public.dm_reactions FOR INSERT WITH CHECK (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND public.is_dm_participant(public.get_dm_conversation_id(message_id), ( SELECT public.requesting_user_id() AS requesting_user_id))));


--
-- Name: reactions Users add own reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users add own reactions" ON public.reactions FOR INSERT WITH CHECK (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.messages m
  WHERE ((m.id = reactions.message_id) AND (m.channel_id = reactions.channel_id) AND public.can_access_channel(m.channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id))))) AND public.check_user_permission(( SELECT public.requesting_user_id() AS requesting_user_id), channel_id, 'add_reactions'::public.permission_type)));


--
-- Name: user_devices Users can delete own devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own devices" ON public.user_devices FOR DELETE USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: users Users can delete own record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own record" ON public.users FOR DELETE USING ((id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: user_devices Users can insert own devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own devices" ON public.user_devices FOR INSERT WITH CHECK (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (identity_public_key IS NOT NULL) AND (length(TRIM(BOTH FROM identity_public_key)) > 0)));


--
-- Name: server_members Users can leave servers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can leave servers" ON public.server_members FOR DELETE USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: dm_participants Users can remove themselves from DM; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can remove themselves from DM" ON public.dm_participants FOR DELETE USING (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL)));


--
-- Name: channel_members Users can remove themselves from channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can remove themselves from channels" ON public.channel_members FOR DELETE USING (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL)));


--
-- Name: user_devices Users can update own devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own devices" ON public.user_devices FOR UPDATE USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id))) WITH CHECK ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: users Users can update own record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own record" ON public.users FOR UPDATE USING ((id = ( SELECT public.requesting_user_id() AS requesting_user_id))) WITH CHECK ((id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: user_devices Users can view own devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own devices" ON public.user_devices FOR SELECT USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: users Users can view related users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view related users" ON public.users FOR SELECT USING (public.can_view_user(id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: dm_attachments Users delete own DM attachments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own DM attachments" ON public.dm_attachments FOR DELETE USING (public.is_dm_message_participant(message_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: messages Users delete their own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete their own messages" ON public.messages FOR DELETE USING (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (public.is_maintenance_active() = false)));


--
-- Name: messages Users edit their own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users edit their own messages" ON public.messages FOR UPDATE USING (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (public.is_maintenance_active() = false) AND public.can_access_channel(channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)))) WITH CHECK (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (public.is_maintenance_active() = false) AND public.can_access_channel(channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id))));


--
-- Name: server_members Users join as member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users join as member" ON public.server_members FOR INSERT WITH CHECK (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (role = 'member'::public.server_role) AND (COALESCE(is_banned, false) = false) AND ((EXISTS ( SELECT 1
   FROM public.servers s
  WHERE ((s.id = server_members.server_id) AND (COALESCE(s.is_published, false) = true)))) OR (EXISTS ( SELECT 1
   FROM public.servers s
  WHERE ((s.id = server_members.server_id) AND (s.owner_id = ( SELECT public.requesting_user_id() AS requesting_user_id))))))));


--
-- Name: channel_user_settings Users manage own channel settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own channel settings" ON public.channel_user_settings USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id))) WITH CHECK ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: user_server_folders Users manage own folders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own folders" ON public.user_server_folders USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id))) WITH CHECK ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: media_comment_reactions Users manage own media comment reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own media comment reactions" ON public.media_comment_reactions USING ((( SELECT public.requesting_user_id() AS requesting_user_id) = user_id)) WITH CHECK ((( SELECT public.requesting_user_id() AS requesting_user_id) = user_id));


--
-- Name: media_comments Users manage own media comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own media comments" ON public.media_comments USING ((( SELECT public.requesting_user_id() AS requesting_user_id) = user_id)) WITH CHECK ((( SELECT public.requesting_user_id() AS requesting_user_id) = user_id));


--
-- Name: notifications Users manage own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own notifications" ON public.notifications USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id))) WITH CHECK ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: user_preferences Users manage own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own preferences" ON public.user_preferences USING (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL))) WITH CHECK (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL)));


--
-- Name: channel_reads Users manage own read state; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own read state" ON public.channel_reads USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id))) WITH CHECK ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: user_server_tabs Users manage own tabs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own tabs" ON public.user_server_tabs USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id))) WITH CHECK ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: user_voice_settings Users manage own voice settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own voice settings" ON public.user_voice_settings USING (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL))) WITH CHECK (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL)));


--
-- Name: dm_reactions Users remove own DM reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users remove own DM reactions" ON public.dm_reactions FOR DELETE USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: reactions Users remove own reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users remove own reactions" ON public.reactions FOR DELETE USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: friendships Users see own friendships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users see own friendships" ON public.friendships FOR SELECT USING (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND ((requester_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) OR (addressee_id = ( SELECT public.requesting_user_id() AS requesting_user_id)))));


--
-- Name: messages Users send messages as themselves only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users send messages as themselves only" ON public.messages FOR INSERT WITH CHECK (((user_id = public.requesting_user_id()) AND (public.requesting_user_id() IS NOT NULL) AND (public.is_maintenance_active() = false) AND public.can_access_channel(channel_id, public.requesting_user_id()) AND public.check_user_permission(public.requesting_user_id(), channel_id, 'send_messages'::public.permission_type) AND ((COALESCE(( SELECT c.is_read_only
   FROM public.channels c
  WHERE (c.id = messages.channel_id)), false) = false) OR public.check_user_permission(public.requesting_user_id(), channel_id, 'manage_messages'::public.permission_type))));


--
-- Name: friendships Users send own friend requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users send own friend requests" ON public.friendships FOR INSERT WITH CHECK (((requester_id = public.requesting_user_id()) AND (public.requesting_user_id() IS NOT NULL) AND (requester_id <> addressee_id) AND (status = 'pending'::public.friendship_status)));


--
-- Name: server_members Users update own non-role data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own non-role data" ON public.server_members FOR UPDATE USING (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL))) WITH CHECK ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: dm_participants Users update own participant record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own participant record" ON public.dm_participants FOR UPDATE USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id))) WITH CHECK ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: announcement_comment_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcement_comment_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: announcement_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcement_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: app_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

--
-- Name: app_config app_config_service_role_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY app_config_service_role_only ON public.app_config USING ((CURRENT_USER = 'service_role'::name)) WITH CHECK ((CURRENT_USER = 'service_role'::name));


--
-- Name: auth_rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: badges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

--
-- Name: category_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.category_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: channel_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.channel_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: channel_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;

--
-- Name: channel_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.channel_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: channel_reads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.channel_reads ENABLE ROW LEVEL SECURITY;

--
-- Name: channel_user_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.channel_user_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: channels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

--
-- Name: declined_friend_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.declined_friend_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: direct_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: dm_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dm_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: dm_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dm_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: dm_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dm_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: dm_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dm_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: friendships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

--
-- Name: media_comment_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.media_comment_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: media_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.media_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: media_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;

--
-- Name: mentions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

--
-- Name: message_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages_account_age_min_2m; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_account_age_min_2m ON public.messages AS RESTRICTIVE FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.id = public.requesting_user_id()) AND (u.created_at <= (now() - '00:02:00'::interval))))));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: poll_votes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

--
-- Name: polls; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

--
-- Name: pow_challenges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pow_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: pow_challenges pow_deny_all_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pow_deny_all_delete ON public.pow_challenges FOR DELETE USING (false);


--
-- Name: pow_challenges pow_deny_all_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pow_deny_all_insert ON public.pow_challenges FOR INSERT WITH CHECK (false);


--
-- Name: pow_challenges pow_deny_all_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pow_deny_all_select ON public.pow_challenges FOR SELECT USING (false);


--
-- Name: pow_challenges pow_deny_all_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pow_deny_all_update ON public.pow_challenges FOR UPDATE USING (false) WITH CHECK (false);


--
-- Name: reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: server_emojis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.server_emojis ENABLE ROW LEVEL SECURITY;

--
-- Name: server_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.server_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: server_member_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.server_member_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: server_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;

--
-- Name: auth_rate_limits server_only_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY server_only_access ON public.auth_rate_limits USING (false) WITH CHECK (false);


--
-- Name: server_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.server_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: servers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;

--
-- Name: thread_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.thread_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: thread_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.thread_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: thread_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.thread_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: threads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;

--
-- Name: user_auth ua_deny_all_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ua_deny_all_delete ON public.user_auth FOR DELETE USING (false);


--
-- Name: user_auth ua_deny_all_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ua_deny_all_insert ON public.user_auth FOR INSERT WITH CHECK (false);


--
-- Name: user_auth ua_deny_all_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ua_deny_all_select ON public.user_auth FOR SELECT USING (false);


--
-- Name: user_auth ua_deny_all_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ua_deny_all_update ON public.user_auth FOR UPDATE USING (false) WITH CHECK (false);


--
-- Name: user_auth; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_auth ENABLE ROW LEVEL SECURITY;

--
-- Name: user_badges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

--
-- Name: user_devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

--
-- Name: user_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: user_server_folders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_server_folders ENABLE ROW LEVEL SECURITY;

--
-- Name: user_server_tabs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_server_tabs ENABLE ROW LEVEL SECURITY;

--
-- Name: user_voice_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_voice_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: iceberg_namespaces; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.iceberg_namespaces ENABLE ROW LEVEL SECURITY;

--
-- Name: iceberg_tables; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.iceberg_tables ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime_messages_publication; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime_messages_publication WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime channel_reads; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.channel_reads;


--
-- Name: supabase_realtime direct_messages; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.direct_messages (id, conversation_id, sender_id, created_at);


--
-- Name: supabase_realtime messages; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.messages;


--
-- Name: supabase_realtime reactions; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.reactions;


--
-- Name: supabase_realtime users; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.users;


--
-- Name: supabase_realtime_messages_publication messages; Type: PUBLICATION TABLE; Schema: realtime; Owner: -
--

ALTER PUBLICATION supabase_realtime_messages_publication ADD TABLE ONLY realtime.messages;


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


--
-- PostgreSQL database dump complete
--

 THEN\r\n    RAISE EXCEPTION 'Invalid emoji name format';\r\n  END IF;\r\n\r\n  -- Enforce 1000 emoji slot limit per server\r\n  SELECT count(*) INTO emoji_count FROM server_emojis WHERE server_id = _server_id;
  IF emoji_count >= 1000 THEN
    RAISE EXCEPTION 'Server emoji limit reached (1000)';
  END IF;

  INSERT INTO server_emojis (server_id, name, file_path, created_by)
  VALUES (_server_id, _name, _file_path, _user_id)
  RETURNING * INTO new_emoji;
  RETURN row_to_json(new_emoji);
END;
$$;


--
-- Name: upsert_channel_read(uuid, uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_channel_read(_user_id uuid, _channel_id uuid, _last_read_at timestamp with time zone) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Authentication failed';
  END IF;

  INSERT INTO channel_reads (user_id, channel_id, last_read_at)
  VALUES (_user_id, _channel_id, _last_read_at)
  ON CONFLICT (user_id, channel_id)
  DO UPDATE SET last_read_at = _last_read_at;
END;
$$;


--
-- Name: upsert_user_preferences(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_user_preferences(_user_id uuid, _prefs jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  INSERT INTO user_preferences (
    user_id, theme, link_previews_enabled,
    desktop_notifications_enabled, browser_notifications_enabled,
    notification_sound_enabled, notification_sound_server_mentions,
    notification_sound_user_mentions, notification_sound_replies,
    notification_volume, show_message_preview,
    show_preview_server_mentions, show_preview_user_mentions,
    show_preview_replies, compact_mode, show_timestamps, animate_emojis,
    updated_at
  ) VALUES (
    _user_id,
    COALESCE(_prefs->>'theme', 'default'),
    COALESCE((_prefs->>'link_previews_enabled')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'desktop_notifications_enabled')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'browser_notifications_enabled')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'notification_sound_enabled')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'notification_sound_server_mentions')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'notification_sound_user_mentions')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'notification_sound_replies')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'notification_volume')::NUMERIC, 0.5),
    COALESCE((_prefs->>'show_message_preview')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'show_preview_server_mentions')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'show_preview_user_mentions')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'show_preview_replies')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'compact_mode')::BOOLEAN, FALSE),
    COALESCE((_prefs->>'show_timestamps')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'animate_emojis')::BOOLEAN, TRUE),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    theme = COALESCE(_prefs->>'theme', user_preferences.theme),
    link_previews_enabled = COALESCE((_prefs->>'link_previews_enabled')::BOOLEAN, user_preferences.link_previews_enabled),
    desktop_notifications_enabled = COALESCE((_prefs->>'desktop_notifications_enabled')::BOOLEAN, user_preferences.desktop_notifications_enabled),
    browser_notifications_enabled = COALESCE((_prefs->>'browser_notifications_enabled')::BOOLEAN, user_preferences.browser_notifications_enabled),
    notification_sound_enabled = COALESCE((_prefs->>'notification_sound_enabled')::BOOLEAN, user_preferences.notification_sound_enabled),
    notification_sound_server_mentions = COALESCE((_prefs->>'notification_sound_server_mentions')::BOOLEAN, user_preferences.notification_sound_server_mentions),
    notification_sound_user_mentions = COALESCE((_prefs->>'notification_sound_user_mentions')::BOOLEAN, user_preferences.notification_sound_user_mentions),
    notification_sound_replies = COALESCE((_prefs->>'notification_sound_replies')::BOOLEAN, user_preferences.notification_sound_replies),
    notification_volume = COALESCE((_prefs->>'notification_volume')::NUMERIC, user_preferences.notification_volume),
    show_message_preview = COALESCE((_prefs->>'show_message_preview')::BOOLEAN, user_preferences.show_message_preview),
    show_preview_server_mentions = COALESCE((_prefs->>'show_preview_server_mentions')::BOOLEAN, user_preferences.show_preview_server_mentions),
    show_preview_user_mentions = COALESCE((_prefs->>'show_preview_user_mentions')::BOOLEAN, user_preferences.show_preview_user_mentions),
    show_preview_replies = COALESCE((_prefs->>'show_preview_replies')::BOOLEAN, user_preferences.show_preview_replies),
    compact_mode = COALESCE((_prefs->>'compact_mode')::BOOLEAN, user_preferences.compact_mode),
    show_timestamps = COALESCE((_prefs->>'show_timestamps')::BOOLEAN, user_preferences.show_timestamps),
    animate_emojis = COALESCE((_prefs->>'animate_emojis')::BOOLEAN, user_preferences.animate_emojis),
    updated_at = NOW();
END;
$$;


--
-- Name: upsert_user_voice_settings(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_user_voice_settings(p_user_id uuid, p_settings jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  result JSONB;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  INSERT INTO user_voice_settings (user_id, settings)
  VALUES (p_user_id, p_settings)
  ON CONFLICT (user_id)
  DO UPDATE SET settings = p_settings
  RETURNING settings INTO result;
  
  RETURN result;
END;
$$;


--
-- Name: validate_username_on_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_username_on_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
BEGIN
  -- Check if username is blocked
  IF public.is_username_blocked(NEW.username) THEN
    RAISE EXCEPTION 'Username is reserved or contains restricted words';
  END IF;

  -- Check length (3-32 characters)
  IF length(NEW.username) < 3 OR length(NEW.username) > 32 THEN
    RAISE EXCEPTION 'Username must be between 3 and 32 characters';
  END IF;

  -- Check allowed characters (alphanumeric, underscores, hyphens)
  IF NEW.username !~ '^[a-zA-Z0-9_-]+$' THEN
    RAISE EXCEPTION 'Username can only contain letters, numbers, underscores, and hyphens';
  END IF;

  -- Cannot start or end with underscore or hyphen
  IF NEW.username ~ '^[-_]' OR NEW.username ~ '[-_]$' THEN
    RAISE EXCEPTION 'Username cannot start or end with an underscore or hyphen';
  END IF;

  -- No consecutive special characters
  IF NEW.username ~ '[-_]{2,}' THEN
    RAISE EXCEPTION 'Username cannot contain consecutive special characters';
  END IF;

  -- Cannot be only numbers
  IF NEW.username ~ '^\d+$' THEN
    RAISE EXCEPTION 'Username cannot be only numbers';
  END IF;

  RETURN NEW;
END;
$_$;


--
-- Name: verify_request_identity(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_request_identity(_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  header_hash text;
  stored_hash text;
BEGIN
  BEGIN
    header_hash := (current_setting('request.headers', true)::json->>'x-key-hash');
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  IF header_hash IS NULL OR header_hash = '' THEN
    RETURN false;
  END IF;

  SELECT ua.key_hash INTO stored_hash FROM user_auth ua WHERE ua.user_id = _user_id;

  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;

  RETURN header_hash = stored_hash;
END;
$$;


--
-- Name: vote_poll(uuid, uuid, integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.vote_poll(_poll_id uuid, _user_id uuid, _option_indexes integer[]) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  p record;
  channel_server_id uuid;
  is_muted boolean;
  _n integer;
  _distinct_indexes integer[];
  _min_idx integer;
  _max_idx integer;
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT * INTO p FROM public.polls WHERE id = _poll_id;
  IF p IS NULL THEN
    RAISE EXCEPTION 'Poll not found';
  END IF;

  IF p.is_closed = true OR p.ends_at <= now() THEN
    -- Close and recompute just in case, then return closed poll state
    UPDATE public.polls SET is_closed = true WHERE id = _poll_id AND is_closed = false;
    PERFORM public.recompute_poll_results(_poll_id);
    SELECT json_build_object(
      'id', p.id,
      'channel_id', p.channel_id,
      'message_id', p.message_id,
      'question', p.question,
      'options', p.options,
      'allow_multiple', p.allow_multiple,
      'ends_at', p.ends_at,
      'is_closed', true,
      'results', (SELECT results FROM public.polls WHERE id = _poll_id),
      'total_votes', (SELECT total_votes FROM public.polls WHERE id = _poll_id)
    ) INTO result;
    RETURN result;
  END IF;

  _n := COALESCE(array_length(p.options, 1), 0);
  IF _n = 0 THEN
    RAISE EXCEPTION 'Poll has no options';
  END IF;

  IF _option_indexes IS NULL OR COALESCE(array_length(_option_indexes, 1), 0) = 0 THEN
    RAISE EXCEPTION 'At least one option must be selected';
  END IF;

  -- normalize to distinct selection
  SELECT array_agg(DISTINCT x ORDER BY x) INTO _distinct_indexes
  FROM unnest(_option_indexes) AS x;

  IF p.allow_multiple = false AND COALESCE(array_length(_distinct_indexes, 1), 0) > 1 THEN
    RAISE EXCEPTION 'This poll only allows one vote';
  END IF;

  SELECT min(x), max(x) INTO _min_idx, _max_idx FROM unnest(_distinct_indexes) AS x;
  IF _min_idx < 0 OR _max_idx > (_n - 1) THEN
    RAISE EXCEPTION 'Invalid poll option';
  END IF;

  -- Membership/permission checks (mirror send_message)
  SELECT server_id INTO channel_server_id FROM public.channels WHERE id = p.channel_id;

  SELECT sm.is_muted INTO is_muted FROM public.server_members sm
  WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;

  IF is_muted IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;

  IF is_muted THEN
    RAISE EXCEPTION 'You are muted in this server';
  END IF;

  IF NOT public.check_user_permission(_user_id, p.channel_id, 'send_messages') THEN
    RAISE EXCEPTION 'You do not have permission to vote in this channel';
  END IF;

  -- Replace existing votes for this user
  DELETE FROM public.poll_votes WHERE poll_id = _poll_id AND user_id = _user_id;

  INSERT INTO public.poll_votes (poll_id, user_id, option_index)
  SELECT _poll_id, _user_id, x
  FROM unnest(_distinct_indexes) AS x
  ON CONFLICT (poll_id, user_id, option_index) DO NOTHING;

  PERFORM public.recompute_poll_results(_poll_id);

  SELECT json_build_object(
    'id', p.id,
    'channel_id', p.channel_id,
    'message_id', p.message_id,
    'question', p.question,
    'options', p.options,
    'allow_multiple', p.allow_multiple,
    'ends_at', p.ends_at,
    'is_closed', (SELECT is_closed FROM public.polls WHERE id = _poll_id),
    'results', (SELECT results FROM public.polls WHERE id = _poll_id),
    'total_votes', (SELECT total_votes FROM public.polls WHERE id = _poll_id)
  ) INTO result;

  RETURN result;
END;
$$;


--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

-- I, U, D, T: insert, update ...
action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

-- Is row level security enabled for the table
is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_
        -- Filter by action early - only get subscriptions interested in this action
        -- action_filter column can be: '*' (all), 'INSERT', 'UPDATE', or 'DELETE'
        and (subs.action_filter = '*' or subs.action_filter = action::text);

-- Subscription vars
roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

-- structured info for wal's columns
columns realtime.wal_column[];
-- previous identity values for update/delete
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

-- Primary jsonb output for record
output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    declare
      res jsonb;
    begin
      execute format('select to_jsonb(%L::'|| type_::text || ')', val)  into res;
      return res;
    end
    $$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS SETOF realtime.wal_rls
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
      with pub as (
        select
          concat_ws(
            ',',
            case when bool_or(pubinsert) then 'insert' else null end,
            case when bool_or(pubupdate) then 'update' else null end,
            case when bool_or(pubdelete) then 'delete' else null end
          ) as w2j_actions,
          coalesce(
            string_agg(
              realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
              ','
            ) filter (where ppt.tablename is not null and ppt.tablename not like '% %'),
            ''
          ) w2j_add_tables
        from
          pg_publication pp
          left join pg_publication_tables ppt
            on pp.pubname = ppt.pubname
        where
          pp.pubname = publication
        group by
          pp.pubname
        limit 1
      ),
      w2j as (
        select
          x.*, pub.w2j_add_tables
        from
          pub,
          pg_logical_slot_get_changes(
            slot_name, null, max_changes,
            'include-pk', 'true',
            'include-transaction', 'false',
            'include-timestamp', 'true',
            'include-type-oids', 'true',
            'format-version', '2',
            'actions', pub.w2j_actions,
            'add-tables', pub.w2j_add_tables
          ) x
      )
      select
        xyz.wal,
        xyz.is_rls_enabled,
        xyz.subscription_ids,
        xyz.errors
      from
        w2j,
        realtime.apply_rls(
          wal := w2j.data::jsonb,
          max_record_bytes := max_record_bytes
        ) xyz(wal, is_rls_enabled, subscription_ids, errors)
      where
        w2j.w2j_add_tables <> ''
        and xyz.subscription_ids[1] is not null
    $$;


--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    -- Generate a new UUID for the id
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    -- Attempt to insert the message
    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
_filename text;
BEGIN
	select string_to_array(name, '/') into _parts;
	select _parts[array_length(_parts,1)] into _filename;
	-- @todo return the last part instead of 2
	return reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[1:array_length(_parts,1)-1];
END
$$;


--
-- Name: get_common_prefix(text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::int) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: search_by_timestamp(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


--
-- Name: http_request(); Type: FUNCTION; Schema: supabase_functions; Owner: -
--

CREATE FUNCTION supabase_functions.http_request() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'supabase_functions'
    AS $$
    DECLARE
      request_id bigint;
      payload jsonb;
      url text := TG_ARGV[0]::text;
      method text := TG_ARGV[1]::text;
      headers jsonb DEFAULT '{}'::jsonb;
      params jsonb DEFAULT '{}'::jsonb;
      timeout_ms integer DEFAULT 1000;
    BEGIN
      IF url IS NULL OR url = 'null' THEN
        RAISE EXCEPTION 'url argument is missing';
      END IF;

      IF method IS NULL OR method = 'null' THEN
        RAISE EXCEPTION 'method argument is missing';
      END IF;

      IF TG_ARGV[2] IS NULL OR TG_ARGV[2] = 'null' THEN
        headers = '{"Content-Type": "application/json"}'::jsonb;
      ELSE
        headers = TG_ARGV[2]::jsonb;
      END IF;

      IF TG_ARGV[3] IS NULL OR TG_ARGV[3] = 'null' THEN
        params = '{}'::jsonb;
      ELSE
        params = TG_ARGV[3]::jsonb;
      END IF;

      IF TG_ARGV[4] IS NULL OR TG_ARGV[4] = 'null' THEN
        timeout_ms = 1000;
      ELSE
        timeout_ms = TG_ARGV[4]::integer;
      END IF;

      CASE
        WHEN method = 'GET' THEN
          SELECT http_get INTO request_id FROM net.http_get(
            url,
            params,
            headers,
            timeout_ms
          );
        WHEN method = 'POST' THEN
          payload = jsonb_build_object(
            'old_record', OLD,
            'record', NEW,
            'type', TG_OP,
            'table', TG_TABLE_NAME,
            'schema', TG_TABLE_SCHEMA
          );

          SELECT http_post INTO request_id FROM net.http_post(
            url,
            payload,
            params,
            headers,
            timeout_ms
          );
        ELSE
          RAISE EXCEPTION 'method argument % is invalid', method;
      END CASE;

      INSERT INTO supabase_functions.hooks
        (hook_table_id, hook_name, request_id)
      VALUES
        (TG_RELID, TG_NAME, request_id);

      RETURN NEW;
    END
  $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: extensions; Type: TABLE; Schema: _realtime; Owner: -
--

CREATE TABLE _realtime.extensions (
    id uuid NOT NULL,
    type text,
    settings jsonb,
    tenant_external_id text,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: _realtime; Owner: -
--

CREATE TABLE _realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: tenants; Type: TABLE; Schema: _realtime; Owner: -
--

CREATE TABLE _realtime.tenants (
    id uuid NOT NULL,
    name text,
    external_id text,
    jwt_secret text,
    max_concurrent_users integer DEFAULT 200 NOT NULL,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL,
    max_events_per_second integer DEFAULT 100 NOT NULL,
    postgres_cdc_default text DEFAULT 'postgres_cdc_rls'::text,
    max_bytes_per_second integer DEFAULT 100000 NOT NULL,
    max_channels_per_client integer DEFAULT 100 NOT NULL,
    max_joins_per_second integer DEFAULT 500 NOT NULL,
    suspend boolean DEFAULT false,
    jwt_jwks jsonb,
    notify_private_alpha boolean DEFAULT false,
    private_only boolean DEFAULT false NOT NULL,
    migrations_ran integer DEFAULT 0,
    broadcast_adapter character varying(255) DEFAULT 'gen_rpc'::character varying,
    max_presence_events_per_second integer DEFAULT 1000,
    max_payload_size_in_kb integer DEFAULT 3000,
    max_client_presence_events_per_window integer,
    client_presence_window_ms integer,
    CONSTRAINT jwt_secret_or_jwt_jwks_required CHECK (((jwt_secret IS NOT NULL) OR (jwt_jwks IS NOT NULL)))
);


--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: announcement_comment_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement_comment_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    emoji character varying(32) NOT NULL
);

ALTER TABLE ONLY public.announcement_comment_reactions REPLICA IDENTITY FULL;


--
-- Name: announcement_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    reply_to_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    edited_at timestamp with time zone
);

ALTER TABLE ONLY public.announcement_comments REPLICA IDENTITY FULL;


--
-- Name: app_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_config (
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: auth_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_rate_limits (
    ip_hash text NOT NULL,
    action text NOT NULL,
    attempts integer DEFAULT 1,
    window_start timestamp with time zone DEFAULT now()
);


--
-- Name: badges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.badges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    icon_url text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: category_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    role_id uuid,
    role_name text,
    user_id uuid,
    permission text NOT NULL,
    allowed boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT category_permissions_role_name_check CHECK ((role_name = ANY (ARRAY['owner'::text, 'admin'::text, 'moderator'::text, 'member'::text]))),
    CONSTRAINT category_permissions_target_check CHECK (((role_id IS NOT NULL) OR (role_name IS NOT NULL) OR (user_id IS NOT NULL)))
);

ALTER TABLE ONLY public.category_permissions REPLICA IDENTITY FULL;


--
-- Name: channel_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    server_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    "position" integer DEFAULT 0,
    is_collapsed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.channel_categories REPLICA IDENTITY FULL;


--
-- Name: channel_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel_id uuid NOT NULL,
    user_id uuid NOT NULL,
    added_by uuid,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.channel_members REPLICA IDENTITY FULL;


--
-- Name: channel_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel_id uuid NOT NULL,
    role_id uuid,
    role_name public.server_role,
    permission public.permission_type NOT NULL,
    allowed boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    user_id uuid,
    CONSTRAINT channel_permissions_target_check CHECK ((((role_id IS NOT NULL) AND (role_name IS NULL) AND (user_id IS NULL)) OR ((role_id IS NULL) AND (role_name IS NOT NULL) AND (user_id IS NULL)) OR ((role_id IS NULL) AND (role_name IS NULL) AND (user_id IS NOT NULL))))
);


--
-- Name: channel_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_reads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel_id uuid NOT NULL,
    user_id uuid NOT NULL,
    last_read_message_id uuid,
    last_read_at timestamp with time zone,
    mention_count integer DEFAULT 0
);


--
-- Name: channel_user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_user_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel_id uuid NOT NULL,
    user_id uuid NOT NULL,
    is_muted boolean DEFAULT false,
    is_hidden boolean DEFAULT false,
    is_pinned boolean DEFAULT false,
    notification_level text DEFAULT 'all'::text,
    mute_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT channel_user_settings_notification_level_check CHECK ((notification_level = ANY (ARRAY['all'::text, 'mentions'::text, 'nothing'::text])))
);

ALTER TABLE ONLY public.channel_user_settings REPLICA IDENTITY FULL;


--
-- Name: channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    server_id uuid NOT NULL,
    category_id uuid,
    name character varying(100) NOT NULL,
    topic text,
    type public.channel_type DEFAULT 'text'::public.channel_type,
    "position" integer DEFAULT 0,
    is_nsfw boolean DEFAULT false,
    slowmode_seconds integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    icon text,
    is_read_only boolean DEFAULT false,
    is_private boolean DEFAULT false NOT NULL,
    block_links boolean DEFAULT false NOT NULL,
    allowed_link_domains text[] DEFAULT '{}'::text[],
    ghost_mode boolean DEFAULT false NOT NULL
);

ALTER TABLE ONLY public.channels REPLICA IDENTITY FULL;


--
-- Name: COLUMN channels.icon; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.channels.icon IS 'Noto Emoji character used as channel icon';


--
-- Name: COLUMN channels.block_links; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.channels.block_links IS 'When true, only admins/owners can post links';


--
-- Name: COLUMN channels.allowed_link_domains; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.channels.allowed_link_domains IS 'Whitelisted domains when block_links is true (e.g. github.com)';


--
-- Name: COLUMN channels.ghost_mode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.channels.ghost_mode IS 'When true, hides user avatars and usernames (except for admins/owners)';


--
-- Name: declined_friend_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.declined_friend_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requester_id uuid NOT NULL,
    addressee_id uuid NOT NULL,
    declined_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: direct_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.direct_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    reply_to_id uuid,
    content text NOT NULL,
    edited_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.direct_messages FORCE ROW LEVEL SECURITY;


--
-- Name: dm_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dm_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    file_name text NOT NULL,
    file_url text NOT NULL,
    file_type text,
    file_size integer,
    width integer,
    height integer
);


--
-- Name: dm_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dm_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    is_group boolean DEFAULT false,
    name text,
    created_by uuid
);

ALTER TABLE ONLY public.dm_conversations REPLICA IDENTITY FULL;

ALTER TABLE ONLY public.dm_conversations FORCE ROW LEVEL SECURITY;


--
-- Name: dm_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dm_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    last_read_at timestamp with time zone
);

ALTER TABLE ONLY public.dm_participants REPLICA IDENTITY FULL;

ALTER TABLE ONLY public.dm_participants FORCE ROW LEVEL SECURITY;


--
-- Name: dm_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dm_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    emoji character varying(64) NOT NULL
);

ALTER TABLE ONLY public.dm_reactions REPLICA IDENTITY FULL;


--
-- Name: friendships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.friendships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requester_id uuid NOT NULL,
    addressee_id uuid NOT NULL,
    status public.friendship_status DEFAULT 'pending'::public.friendship_status,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.friendships REPLICA IDENTITY FULL;


--
-- Name: media_comment_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_comment_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    emoji text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.media_comment_reactions REPLICA IDENTITY FULL;


--
-- Name: media_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    media_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    reply_to_id uuid,
    edited_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.media_comments REPLICA IDENTITY FULL;


--
-- Name: media_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel_id uuid NOT NULL,
    user_id uuid NOT NULL,
    title text,
    description text,
    media_url text NOT NULL,
    media_type text NOT NULL,
    thumbnail_url text,
    width integer,
    height integer,
    file_size integer,
    created_at timestamp with time zone DEFAULT now(),
    youtube_video_id text,
    CONSTRAINT media_items_media_type_check CHECK ((media_type = ANY (ARRAY['image'::text, 'video'::text, 'gif'::text, 'youtube'::text])))
);

ALTER TABLE ONLY public.media_items REPLICA IDENTITY FULL;


--
-- Name: mentions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mentions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    mention_type public.mention_type DEFAULT 'user'::public.mention_type
);


--
-- Name: message_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    file_name text NOT NULL,
    file_url text NOT NULL,
    file_type text,
    file_size integer,
    width integer,
    height integer
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel_id uuid NOT NULL,
    user_id uuid NOT NULL,
    reply_to_id uuid,
    content text NOT NULL,
    is_pinned boolean DEFAULT false,
    edited_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    is_system_message boolean DEFAULT false,
    embed_hidden boolean DEFAULT false NOT NULL
);

ALTER TABLE ONLY public.messages REPLICA IDENTITY FULL;

ALTER TABLE ONLY public.messages FORCE ROW LEVEL SECURITY;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type public.notification_type NOT NULL,
    title text NOT NULL,
    body text,
    link text,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.notifications REPLICA IDENTITY FULL;


--
-- Name: poll_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.poll_votes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    poll_id uuid NOT NULL,
    user_id uuid NOT NULL,
    option_index integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: polls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.polls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    channel_id uuid NOT NULL,
    created_by uuid NOT NULL,
    question text NOT NULL,
    options text[] NOT NULL,
    allow_multiple boolean DEFAULT false NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    is_closed boolean DEFAULT false NOT NULL,
    results jsonb DEFAULT '[]'::jsonb NOT NULL,
    total_votes integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pow_challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pow_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nonce text NOT NULL,
    difficulty integer DEFAULT 4 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:10:00'::interval) NOT NULL,
    used boolean DEFAULT false
);


--
-- Name: reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    emoji character varying(64) NOT NULL,
    channel_id uuid NOT NULL
);

ALTER TABLE ONLY public.reactions REPLICA IDENTITY FULL;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    server_id uuid NOT NULL,
    role_id uuid,
    role_name public.server_role,
    permission public.permission_type NOT NULL,
    allowed boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT role_permissions_role_check CHECK ((((role_id IS NOT NULL) AND (role_name IS NULL)) OR ((role_id IS NULL) AND (role_name IS NOT NULL))))
);


--
-- Name: server_emojis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.server_emojis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    server_id uuid NOT NULL,
    name text NOT NULL,
    file_path text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: server_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.server_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    server_id uuid NOT NULL,
    code character(8) NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    expires_at timestamp with time zone,
    max_uses integer,
    uses_count integer DEFAULT 0 NOT NULL
);


--
-- Name: server_member_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.server_member_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid NOT NULL,
    role_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: server_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.server_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    server_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.server_role DEFAULT 'member'::public.server_role,
    nickname character varying(32),
    is_banned boolean DEFAULT false NOT NULL,
    is_muted boolean DEFAULT false,
    joined_at timestamp with time zone DEFAULT now(),
    join_source text,
    join_invite_code text,
    "position" integer
);

ALTER TABLE ONLY public.server_members REPLICA IDENTITY FULL;


--
-- Name: COLUMN server_members.join_source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.server_members.join_source IS 'How the member joined: discover, invite_link, or invite (custom server_invites code)';


--
-- Name: COLUMN server_members.join_invite_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.server_members.join_invite_code IS 'When join_source = invite, the invite code that was used';


--
-- Name: server_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.server_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    server_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    color character varying(255) DEFAULT '#5865F2'::character varying NOT NULL,
    "position" integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    icon text
);


--
-- Name: COLUMN server_roles.color; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.server_roles.color IS 'Role color - can be a hex color (#5865F2) or a CSS gradient (linear-gradient(135deg, #667eea, #764ba2))';


--
-- Name: servers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    icon_url text,
    banner_url text,
    owner_id uuid NOT NULL,
    invite_code character(8) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    is_published boolean DEFAULT false NOT NULL,
    about text,
    system_channel_join_id uuid,
    system_channel_leave_id uuid,
    enable_join_messages boolean DEFAULT true,
    enable_leave_messages boolean DEFAULT true
);

ALTER TABLE ONLY public.servers REPLICA IDENTITY FULL;

ALTER TABLE ONLY public.servers FORCE ROW LEVEL SECURITY;


--
-- Name: thread_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.thread_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    file_name text NOT NULL,
    file_url text NOT NULL,
    file_type text,
    file_size integer,
    width integer,
    height integer
);


--
-- Name: thread_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.thread_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    reply_to_id uuid,
    edited_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.thread_messages REPLICA IDENTITY FULL;


--
-- Name: thread_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.thread_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    emoji character varying(64) NOT NULL
);

ALTER TABLE ONLY public.thread_reactions REPLICA IDENTITY FULL;


--
-- Name: threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel_id uuid NOT NULL,
    message_id uuid NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.threads REPLICA IDENTITY FULL;


--
-- Name: user_auth; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_auth (
    user_id uuid NOT NULL,
    key_hash text NOT NULL,
    last_key_reset_at timestamp with time zone
);

ALTER TABLE ONLY public.user_auth FORCE ROW LEVEL SECURITY;


--
-- Name: user_badges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_badges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    badge_id uuid NOT NULL,
    awarded_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    device_id integer NOT NULL,
    device_name character varying(100),
    identity_public_key text NOT NULL,
    last_active timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.user_devices FORCE ROW LEVEL SECURITY;


--
-- Name: user_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    theme text DEFAULT 'default'::text NOT NULL,
    link_previews_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    desktop_notifications_enabled boolean DEFAULT true NOT NULL,
    notification_sound_enabled boolean DEFAULT true NOT NULL,
    show_message_preview boolean DEFAULT true NOT NULL,
    compact_mode boolean DEFAULT false NOT NULL,
    show_timestamps boolean DEFAULT true NOT NULL,
    animate_emojis boolean DEFAULT true NOT NULL,
    browser_notifications_enabled boolean DEFAULT true,
    notification_sound_server_mentions boolean DEFAULT true,
    notification_sound_user_mentions boolean DEFAULT true,
    notification_sound_replies boolean DEFAULT true,
    notification_volume integer DEFAULT 50,
    show_preview_server_mentions boolean DEFAULT true,
    show_preview_user_mentions boolean DEFAULT true,
    show_preview_replies boolean DEFAULT true,
    dm_privacy text DEFAULT 'shared_servers'::text NOT NULL,
    CONSTRAINT notification_volume_range CHECK (((notification_volume >= 0) AND (notification_volume <= 100))),
    CONSTRAINT user_preferences_dm_privacy_check CHECK ((dm_privacy = ANY (ARRAY['everyone'::text, 'shared_servers'::text, 'friends'::text, 'no_one'::text])))
);


--
-- Name: user_server_folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_server_folders (
    user_id uuid NOT NULL,
    folder_data jsonb DEFAULT '{"folders": [], "serverToFolder": {}}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE user_server_folders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_server_folders IS 'Stores each user''s server folder organization (synced across devices)';


--
-- Name: user_server_tabs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_server_tabs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tab_order text[] DEFAULT '{}'::text[] NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_voice_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_voice_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT check_settings_shape CHECK (((jsonb_typeof(settings) = 'object'::text) AND (((settings ->> 'inputGain'::text) IS NULL) OR ((((settings ->> 'inputGain'::text))::integer >= 0) AND (((settings ->> 'inputGain'::text))::integer <= 200))) AND (((settings ->> 'outputVolume'::text) IS NULL) OR ((((settings ->> 'outputVolume'::text))::integer >= 0) AND (((settings ->> 'outputVolume'::text))::integer <= 200))) AND (((settings ->> 'voiceMode'::text) IS NULL) OR ((settings ->> 'voiceMode'::text) = ANY (ARRAY['voice_activity'::text, 'push_to_talk'::text]))) AND (((settings ->> 'voiceActivityThreshold'::text) IS NULL) OR ((((settings ->> 'voiceActivityThreshold'::text))::integer >= 0) AND (((settings ->> 'voiceActivityThreshold'::text))::integer <= 100))) AND (((settings ->> 'autoDisconnectMinutes'::text) IS NULL) OR ((((settings ->> 'autoDisconnectMinutes'::text))::integer >= 0) AND (((settings ->> 'autoDisconnectMinutes'::text))::integer <= 60)))))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username character varying(20) NOT NULL,
    display_name character varying(32),
    avatar_url text,
    banner_color character(7) DEFAULT '#5865F2'::bpchar,
    bio text,
    status public.user_status DEFAULT 'online'::public.user_status,
    custom_status character varying(128),
    created_at timestamp with time zone DEFAULT now(),
    last_seen timestamp with time zone DEFAULT now(),
    avatar_decoration text,
    profile_theme_primary character(7),
    profile_theme_accent character(7),
    banner_url text,
    profile_effect text,
    pronouns character varying(25) DEFAULT NULL::character varying,
    CONSTRAINT check_avatar_decoration_is_key CHECK ((avatar_decoration !~~ 'http%'::text)),
    CONSTRAINT check_profile_effect_is_key CHECK ((profile_effect !~~ 'http%'::text))
);

ALTER TABLE ONLY public.users REPLICA IDENTITY FULL;

ALTER TABLE ONLY public.users FORCE ROW LEVEL SECURITY;


--
-- Name: COLUMN users.avatar_decoration; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.avatar_decoration IS 'Stores asset key only (e.g. sparkle), frontend maps to URL.';


--
-- Name: COLUMN users.profile_effect; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.profile_effect IS 'Stores asset key only (e.g. fire_border), frontend maps to URL.';


--
-- Name: users_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.users_public WITH (security_invoker='true') AS
 SELECT users.id,
    users.username,
    users.display_name,
    users.avatar_url,
    users.banner_color,
    users.bio,
    users.status,
    users.custom_status,
    users.created_at,
    users.avatar_decoration,
    users.profile_theme_primary,
    users.profile_theme_accent,
    users.banner_url,
    users.profile_effect,
    users.pronouns,
        CASE
            WHEN (users.id = ( SELECT public.requesting_user_id() AS requesting_user_id)) THEN users.last_seen
            ELSE NULL::timestamp with time zone
        END AS last_seen
   FROM public.users;


--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);


--
-- Name: messages_2026_02_21; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_02_21 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_02_22; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_02_22 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_02_23; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_02_23 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_02_24; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_02_24 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_02_25; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_02_25 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_02_26; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_02_26 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_02_27; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_02_27 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    action_filter text DEFAULT '*'::text,
    CONSTRAINT subscription_action_filter_check CHECK ((action_filter = ANY (ARRAY['*'::text, 'INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: iceberg_namespaces; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.iceberg_namespaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_name text NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    catalog_id uuid NOT NULL
);


--
-- Name: iceberg_tables; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.iceberg_tables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    namespace_id uuid NOT NULL,
    bucket_name text NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    location text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    remote_table_id text,
    shard_key text,
    shard_id text,
    catalog_id uuid NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hooks; Type: TABLE; Schema: supabase_functions; Owner: -
--

CREATE TABLE supabase_functions.hooks (
    id bigint NOT NULL,
    hook_table_id integer NOT NULL,
    hook_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id bigint
);


--
-- Name: TABLE hooks; Type: COMMENT; Schema: supabase_functions; Owner: -
--

COMMENT ON TABLE supabase_functions.hooks IS 'Supabase Functions Hooks: Audit trail for triggered hooks.';


--
-- Name: hooks_id_seq; Type: SEQUENCE; Schema: supabase_functions; Owner: -
--

CREATE SEQUENCE supabase_functions.hooks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hooks_id_seq; Type: SEQUENCE OWNED BY; Schema: supabase_functions; Owner: -
--

ALTER SEQUENCE supabase_functions.hooks_id_seq OWNED BY supabase_functions.hooks.id;


--
-- Name: migrations; Type: TABLE; Schema: supabase_functions; Owner: -
--

CREATE TABLE supabase_functions.migrations (
    version text NOT NULL,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: messages_2026_02_21; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_02_21 FOR VALUES FROM ('2026-02-21 00:00:00') TO ('2026-02-22 00:00:00');


--
-- Name: messages_2026_02_22; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_02_22 FOR VALUES FROM ('2026-02-22 00:00:00') TO ('2026-02-23 00:00:00');


--
-- Name: messages_2026_02_23; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_02_23 FOR VALUES FROM ('2026-02-23 00:00:00') TO ('2026-02-24 00:00:00');


--
-- Name: messages_2026_02_24; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_02_24 FOR VALUES FROM ('2026-02-24 00:00:00') TO ('2026-02-25 00:00:00');


--
-- Name: messages_2026_02_25; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_02_25 FOR VALUES FROM ('2026-02-25 00:00:00') TO ('2026-02-26 00:00:00');


--
-- Name: messages_2026_02_26; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_02_26 FOR VALUES FROM ('2026-02-26 00:00:00') TO ('2026-02-27 00:00:00');


--
-- Name: messages_2026_02_27; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_02_27 FOR VALUES FROM ('2026-02-27 00:00:00') TO ('2026-02-28 00:00:00');


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: hooks id; Type: DEFAULT; Schema: supabase_functions; Owner: -
--

ALTER TABLE ONLY supabase_functions.hooks ALTER COLUMN id SET DEFAULT nextval('supabase_functions.hooks_id_seq'::regclass);


--
-- Name: extensions extensions_pkey; Type: CONSTRAINT; Schema: _realtime; Owner: -
--

ALTER TABLE ONLY _realtime.extensions
    ADD CONSTRAINT extensions_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: _realtime; Owner: -
--

ALTER TABLE ONLY _realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: _realtime; Owner: -
--

ALTER TABLE ONLY _realtime.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: announcement_comment_reactions announcement_comment_reactions_comment_id_user_id_emoji_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_comment_reactions
    ADD CONSTRAINT announcement_comment_reactions_comment_id_user_id_emoji_key UNIQUE (comment_id, user_id, emoji);


--
-- Name: announcement_comment_reactions announcement_comment_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_comment_reactions
    ADD CONSTRAINT announcement_comment_reactions_pkey PRIMARY KEY (id);


--
-- Name: announcement_comments announcement_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_comments
    ADD CONSTRAINT announcement_comments_pkey PRIMARY KEY (id);


--
-- Name: app_config app_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_config
    ADD CONSTRAINT app_config_pkey PRIMARY KEY (key);


--
-- Name: auth_rate_limits auth_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_rate_limits
    ADD CONSTRAINT auth_rate_limits_pkey PRIMARY KEY (ip_hash, action);


--
-- Name: badges badges_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT badges_name_key UNIQUE (name);


--
-- Name: badges badges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT badges_pkey PRIMARY KEY (id);


--
-- Name: category_permissions category_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_permissions
    ADD CONSTRAINT category_permissions_pkey PRIMARY KEY (id);


--
-- Name: category_permissions category_permissions_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_permissions
    ADD CONSTRAINT category_permissions_unique UNIQUE (category_id, role_id, role_name, user_id, permission);


--
-- Name: channel_categories channel_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_categories
    ADD CONSTRAINT channel_categories_pkey PRIMARY KEY (id);


--
-- Name: channel_members channel_members_channel_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_members
    ADD CONSTRAINT channel_members_channel_id_user_id_key UNIQUE (channel_id, user_id);


--
-- Name: channel_members channel_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_members
    ADD CONSTRAINT channel_members_pkey PRIMARY KEY (id);


--
-- Name: channel_permissions channel_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_permissions
    ADD CONSTRAINT channel_permissions_pkey PRIMARY KEY (id);


--
-- Name: channel_reads channel_reads_channel_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_reads
    ADD CONSTRAINT channel_reads_channel_id_user_id_key UNIQUE (channel_id, user_id);


--
-- Name: channel_reads channel_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_reads
    ADD CONSTRAINT channel_reads_pkey PRIMARY KEY (id);


--
-- Name: channel_reads channel_reads_user_channel_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_reads
    ADD CONSTRAINT channel_reads_user_channel_unique UNIQUE (user_id, channel_id);


--
-- Name: channel_user_settings channel_user_settings_channel_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_user_settings
    ADD CONSTRAINT channel_user_settings_channel_id_user_id_key UNIQUE (channel_id, user_id);


--
-- Name: channel_user_settings channel_user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_user_settings
    ADD CONSTRAINT channel_user_settings_pkey PRIMARY KEY (id);


--
-- Name: channels channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_pkey PRIMARY KEY (id);


--
-- Name: declined_friend_requests declined_friend_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.declined_friend_requests
    ADD CONSTRAINT declined_friend_requests_pkey PRIMARY KEY (id);


--
-- Name: declined_friend_requests declined_friend_requests_requester_id_addressee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.declined_friend_requests
    ADD CONSTRAINT declined_friend_requests_requester_id_addressee_id_key UNIQUE (requester_id, addressee_id);


--
-- Name: direct_messages direct_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_pkey PRIMARY KEY (id);


--
-- Name: dm_attachments dm_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_attachments
    ADD CONSTRAINT dm_attachments_pkey PRIMARY KEY (id);


--
-- Name: dm_conversations dm_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_conversations
    ADD CONSTRAINT dm_conversations_pkey PRIMARY KEY (id);


--
-- Name: dm_participants dm_participants_conversation_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_participants
    ADD CONSTRAINT dm_participants_conversation_id_user_id_key UNIQUE (conversation_id, user_id);


--
-- Name: dm_participants dm_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_participants
    ADD CONSTRAINT dm_participants_pkey PRIMARY KEY (id);


--
-- Name: dm_reactions dm_reactions_message_id_user_id_emoji_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_reactions
    ADD CONSTRAINT dm_reactions_message_id_user_id_emoji_key UNIQUE (message_id, user_id, emoji);


--
-- Name: dm_reactions dm_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_reactions
    ADD CONSTRAINT dm_reactions_pkey PRIMARY KEY (id);


--
-- Name: friendships friendships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_pkey PRIMARY KEY (id);


--
-- Name: friendships friendships_requester_id_addressee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_requester_id_addressee_id_key UNIQUE (requester_id, addressee_id);


--
-- Name: media_comment_reactions media_comment_reactions_comment_id_user_id_emoji_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_comment_reactions
    ADD CONSTRAINT media_comment_reactions_comment_id_user_id_emoji_key UNIQUE (comment_id, user_id, emoji);


--
-- Name: media_comment_reactions media_comment_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_comment_reactions
    ADD CONSTRAINT media_comment_reactions_pkey PRIMARY KEY (id);


--
-- Name: media_comments media_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_comments
    ADD CONSTRAINT media_comments_pkey PRIMARY KEY (id);


--
-- Name: media_items media_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_items
    ADD CONSTRAINT media_items_pkey PRIMARY KEY (id);


--
-- Name: mentions mentions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentions
    ADD CONSTRAINT mentions_pkey PRIMARY KEY (id);


--
-- Name: message_attachments message_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT message_attachments_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: poll_votes poll_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_votes
    ADD CONSTRAINT poll_votes_pkey PRIMARY KEY (id);


--
-- Name: poll_votes poll_votes_poll_id_user_id_option_index_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_votes
    ADD CONSTRAINT poll_votes_poll_id_user_id_option_index_key UNIQUE (poll_id, user_id, option_index);


--
-- Name: polls polls_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polls
    ADD CONSTRAINT polls_message_id_key UNIQUE (message_id);


--
-- Name: polls polls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polls
    ADD CONSTRAINT polls_pkey PRIMARY KEY (id);


--
-- Name: pow_challenges pow_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pow_challenges
    ADD CONSTRAINT pow_challenges_pkey PRIMARY KEY (id);


--
-- Name: reactions reactions_message_id_user_id_emoji_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_message_id_user_id_emoji_key UNIQUE (message_id, user_id, emoji);


--
-- Name: reactions reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: server_emojis server_emojis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_emojis
    ADD CONSTRAINT server_emojis_pkey PRIMARY KEY (id);


--
-- Name: server_emojis server_emojis_server_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_emojis
    ADD CONSTRAINT server_emojis_server_id_name_key UNIQUE (server_id, name);


--
-- Name: server_invites server_invites_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_invites
    ADD CONSTRAINT server_invites_code_key UNIQUE (code);


--
-- Name: server_invites server_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_invites
    ADD CONSTRAINT server_invites_pkey PRIMARY KEY (id);


--
-- Name: server_member_roles server_member_roles_member_id_role_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_member_roles
    ADD CONSTRAINT server_member_roles_member_id_role_id_key UNIQUE (member_id, role_id);


--
-- Name: server_member_roles server_member_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_member_roles
    ADD CONSTRAINT server_member_roles_pkey PRIMARY KEY (id);


--
-- Name: server_members server_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_members
    ADD CONSTRAINT server_members_pkey PRIMARY KEY (id);


--
-- Name: server_members server_members_server_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_members
    ADD CONSTRAINT server_members_server_id_user_id_key UNIQUE (server_id, user_id);


--
-- Name: server_roles server_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_roles
    ADD CONSTRAINT server_roles_pkey PRIMARY KEY (id);


--
-- Name: server_roles server_roles_server_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_roles
    ADD CONSTRAINT server_roles_server_id_name_key UNIQUE (server_id, name);


--
-- Name: servers servers_invite_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_invite_code_key UNIQUE (invite_code);


--
-- Name: servers servers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_pkey PRIMARY KEY (id);


--
-- Name: thread_attachments thread_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_attachments
    ADD CONSTRAINT thread_attachments_pkey PRIMARY KEY (id);


--
-- Name: thread_messages thread_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_messages
    ADD CONSTRAINT thread_messages_pkey PRIMARY KEY (id);


--
-- Name: thread_reactions thread_reactions_message_id_user_id_emoji_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_reactions
    ADD CONSTRAINT thread_reactions_message_id_user_id_emoji_key UNIQUE (message_id, user_id, emoji);


--
-- Name: thread_reactions thread_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_reactions
    ADD CONSTRAINT thread_reactions_pkey PRIMARY KEY (id);


--
-- Name: threads threads_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_message_id_key UNIQUE (message_id);


--
-- Name: threads threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_pkey PRIMARY KEY (id);


--
-- Name: user_auth user_auth_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_auth
    ADD CONSTRAINT user_auth_pkey PRIMARY KEY (user_id);


--
-- Name: user_badges user_badges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_pkey PRIMARY KEY (id);


--
-- Name: user_badges user_badges_user_id_badge_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_user_id_badge_id_key UNIQUE (user_id, badge_id);


--
-- Name: user_devices user_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_pkey PRIMARY KEY (id);


--
-- Name: user_devices user_devices_user_id_device_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_user_id_device_id_key UNIQUE (user_id, device_id);


--
-- Name: user_preferences user_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_preferences user_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_key UNIQUE (user_id);


--
-- Name: user_server_folders user_server_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_server_folders
    ADD CONSTRAINT user_server_folders_pkey PRIMARY KEY (user_id);


--
-- Name: user_server_tabs user_server_tabs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_server_tabs
    ADD CONSTRAINT user_server_tabs_pkey PRIMARY KEY (id);


--
-- Name: user_server_tabs user_server_tabs_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_server_tabs
    ADD CONSTRAINT user_server_tabs_user_id_key UNIQUE (user_id);


--
-- Name: user_voice_settings user_voice_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_voice_settings
    ADD CONSTRAINT user_voice_settings_pkey PRIMARY KEY (id);


--
-- Name: user_voice_settings user_voice_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_voice_settings
    ADD CONSTRAINT user_voice_settings_user_id_key UNIQUE (user_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_02_21 messages_2026_02_21_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_02_21
    ADD CONSTRAINT messages_2026_02_21_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_02_22 messages_2026_02_22_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_02_22
    ADD CONSTRAINT messages_2026_02_22_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_02_23 messages_2026_02_23_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_02_23
    ADD CONSTRAINT messages_2026_02_23_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_02_24 messages_2026_02_24_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_02_24
    ADD CONSTRAINT messages_2026_02_24_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_02_25 messages_2026_02_25_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_02_25
    ADD CONSTRAINT messages_2026_02_25_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_02_26 messages_2026_02_26_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_02_26
    ADD CONSTRAINT messages_2026_02_26_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_02_27 messages_2026_02_27_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_02_27
    ADD CONSTRAINT messages_2026_02_27_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: iceberg_namespaces iceberg_namespaces_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.iceberg_namespaces
    ADD CONSTRAINT iceberg_namespaces_pkey PRIMARY KEY (id);


--
-- Name: iceberg_tables iceberg_tables_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.iceberg_tables
    ADD CONSTRAINT iceberg_tables_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: hooks hooks_pkey; Type: CONSTRAINT; Schema: supabase_functions; Owner: -
--

ALTER TABLE ONLY supabase_functions.hooks
    ADD CONSTRAINT hooks_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: supabase_functions; Owner: -
--

ALTER TABLE ONLY supabase_functions.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (version);


--
-- Name: extensions_tenant_external_id_index; Type: INDEX; Schema: _realtime; Owner: -
--

CREATE INDEX extensions_tenant_external_id_index ON _realtime.extensions USING btree (tenant_external_id);


--
-- Name: extensions_tenant_external_id_type_index; Type: INDEX; Schema: _realtime; Owner: -
--

CREATE UNIQUE INDEX extensions_tenant_external_id_type_index ON _realtime.extensions USING btree (tenant_external_id, type);


--
-- Name: tenants_external_id_index; Type: INDEX; Schema: _realtime; Owner: -
--

CREATE UNIQUE INDEX tenants_external_id_index ON _realtime.tenants USING btree (external_id);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: channel_permissions_role_perm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX channel_permissions_role_perm_idx ON public.channel_permissions USING btree (channel_id, role_id, permission) WHERE ((role_id IS NOT NULL) AND (user_id IS NULL));


--
-- Name: channel_permissions_rolename_perm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX channel_permissions_rolename_perm_idx ON public.channel_permissions USING btree (channel_id, role_name, permission) WHERE ((role_name IS NOT NULL) AND (role_id IS NULL) AND (user_id IS NULL));


--
-- Name: channel_permissions_user_perm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX channel_permissions_user_perm_idx ON public.channel_permissions USING btree (channel_id, user_id, permission) WHERE (user_id IS NOT NULL);


--
-- Name: cp_base_role_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cp_base_role_unique ON public.channel_permissions USING btree (channel_id, role_name, permission) WHERE (role_name IS NOT NULL);


--
-- Name: cp_custom_role_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cp_custom_role_unique ON public.channel_permissions USING btree (channel_id, role_id, permission) WHERE (role_id IS NOT NULL);


--
-- Name: idx_announcement_comment_reactions_comment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_comment_reactions_comment ON public.announcement_comment_reactions USING btree (comment_id);


--
-- Name: idx_announcement_comment_reactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_comment_reactions_user_id ON public.announcement_comment_reactions USING btree (user_id);


--
-- Name: idx_announcement_comments_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_comments_message ON public.announcement_comments USING btree (message_id);


--
-- Name: idx_announcement_comments_reply_to_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_comments_reply_to_id ON public.announcement_comments USING btree (reply_to_id) WHERE (reply_to_id IS NOT NULL);


--
-- Name: idx_announcement_comments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_comments_user ON public.announcement_comments USING btree (user_id);


--
-- Name: idx_category_permissions_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_category_permissions_category_id ON public.category_permissions USING btree (category_id);


--
-- Name: idx_category_permissions_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_category_permissions_role_id ON public.category_permissions USING btree (role_id);


--
-- Name: idx_category_permissions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_category_permissions_user_id ON public.category_permissions USING btree (user_id);


--
-- Name: idx_channel_categories_server_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_categories_server_id ON public.channel_categories USING btree (server_id);


--
-- Name: idx_channel_members_added_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_members_added_by ON public.channel_members USING btree (added_by) WHERE (added_by IS NOT NULL);


--
-- Name: idx_channel_members_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_members_channel_id ON public.channel_members USING btree (channel_id);


--
-- Name: idx_channel_members_channel_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_members_channel_user ON public.channel_members USING btree (channel_id, user_id);


--
-- Name: idx_channel_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_members_user_id ON public.channel_members USING btree (user_id);


--
-- Name: idx_channel_permissions_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_permissions_channel ON public.channel_permissions USING btree (channel_id);


--
-- Name: idx_channel_permissions_channel_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_permissions_channel_user ON public.channel_permissions USING btree (channel_id, user_id);


--
-- Name: idx_channel_permissions_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_permissions_role_id ON public.channel_permissions USING btree (role_id);


--
-- Name: idx_channel_permissions_role_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_permissions_role_name ON public.channel_permissions USING btree (channel_id, role_name);


--
-- Name: idx_channel_permissions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_permissions_user_id ON public.channel_permissions USING btree (user_id);


--
-- Name: idx_channel_reads_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_reads_channel ON public.channel_reads USING btree (channel_id);


--
-- Name: idx_channel_reads_last_read_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_reads_last_read_message_id ON public.channel_reads USING btree (last_read_message_id) WHERE (last_read_message_id IS NOT NULL);


--
-- Name: idx_channel_reads_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_reads_user ON public.channel_reads USING btree (user_id);


--
-- Name: idx_channel_user_settings_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_user_settings_channel ON public.channel_user_settings USING btree (channel_id);


--
-- Name: idx_channel_user_settings_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_user_settings_user ON public.channel_user_settings USING btree (user_id);


--
-- Name: idx_channels_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_category ON public.channels USING btree (category_id);


--
-- Name: idx_channels_server_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_server_id ON public.channels USING btree (server_id);


--
-- Name: idx_declined_friend_requests_addressee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_declined_friend_requests_addressee_id ON public.declined_friend_requests USING btree (addressee_id);


--
-- Name: idx_devices_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_devices_user ON public.user_devices USING btree (user_id);


--
-- Name: idx_direct_messages_content_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_direct_messages_content_search ON public.direct_messages USING gin (to_tsvector('english'::regconfig, content));


--
-- Name: idx_direct_messages_conv_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_direct_messages_conv_created ON public.direct_messages USING btree (conversation_id, created_at DESC);


--
-- Name: idx_direct_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_direct_messages_conversation ON public.direct_messages USING btree (conversation_id);


--
-- Name: idx_direct_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_direct_messages_created_at ON public.direct_messages USING btree (created_at DESC);


--
-- Name: idx_direct_messages_reply_to_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_direct_messages_reply_to_id ON public.direct_messages USING btree (reply_to_id) WHERE (reply_to_id IS NOT NULL);


--
-- Name: idx_direct_messages_sender_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_direct_messages_sender_id ON public.direct_messages USING btree (sender_id);


--
-- Name: idx_dm_attachments_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dm_attachments_message_id ON public.dm_attachments USING btree (message_id);


--
-- Name: idx_dm_conversations_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dm_conversations_created_by ON public.dm_conversations USING btree (created_by) WHERE (created_by IS NOT NULL);


--
-- Name: idx_dm_conversations_created_by_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dm_conversations_created_by_created_at ON public.dm_conversations USING btree (created_by, created_at DESC) WHERE (created_by IS NOT NULL);


--
-- Name: idx_dm_participants_conv_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dm_participants_conv_user ON public.dm_participants USING btree (conversation_id, user_id);


--
-- Name: idx_dm_participants_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dm_participants_conversation ON public.dm_participants USING btree (conversation_id);


--
-- Name: idx_dm_participants_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dm_participants_user ON public.dm_participants USING btree (user_id);


--
-- Name: idx_dm_participants_user_conv; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dm_participants_user_conv ON public.dm_participants USING btree (user_id, conversation_id);


--
-- Name: idx_dm_reactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dm_reactions_user_id ON public.dm_reactions USING btree (user_id);


--
-- Name: idx_friendships_addressee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friendships_addressee ON public.friendships USING btree (addressee_id);


--
-- Name: idx_friendships_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friendships_requester ON public.friendships USING btree (requester_id);


--
-- Name: idx_media_comment_reactions_comment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_comment_reactions_comment_id ON public.media_comment_reactions USING btree (comment_id);


--
-- Name: idx_media_comment_reactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_comment_reactions_user_id ON public.media_comment_reactions USING btree (user_id);


--
-- Name: idx_media_comments_media_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_comments_media_id ON public.media_comments USING btree (media_id);


--
-- Name: idx_media_comments_reply_to_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_comments_reply_to_id ON public.media_comments USING btree (reply_to_id) WHERE (reply_to_id IS NOT NULL);


--
-- Name: idx_media_comments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_comments_user_id ON public.media_comments USING btree (user_id);


--
-- Name: idx_media_items_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_items_channel_id ON public.media_items USING btree (channel_id);


--
-- Name: idx_media_items_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_items_created_at ON public.media_items USING btree (created_at DESC);


--
-- Name: idx_media_items_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_items_user_id ON public.media_items USING btree (user_id);


--
-- Name: idx_mentions_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mentions_message ON public.mentions USING btree (message_id);


--
-- Name: idx_mentions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mentions_user ON public.mentions USING btree (user_id);


--
-- Name: idx_message_attachments_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_attachments_message_id ON public.message_attachments USING btree (message_id);


--
-- Name: idx_messages_channel_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_channel_created ON public.messages USING btree (channel_id, created_at DESC);


--
-- Name: idx_messages_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_channel_id ON public.messages USING btree (channel_id);


--
-- Name: idx_messages_content_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_content_search ON public.messages USING gin (to_tsvector('english'::regconfig, content));


--
-- Name: idx_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_created_at ON public.messages USING btree (created_at DESC);


--
-- Name: idx_messages_is_system_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_is_system_message ON public.messages USING btree (is_system_message) WHERE (is_system_message = true);


--
-- Name: idx_messages_reply_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_reply_to ON public.messages USING btree (reply_to_id) WHERE (reply_to_id IS NOT NULL);


--
-- Name: idx_messages_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_user ON public.messages USING btree (user_id);


--
-- Name: idx_messages_user_channel_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_user_channel_created_at ON public.messages USING btree (user_id, channel_id, created_at DESC);


--
-- Name: idx_notifications_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_unread ON public.notifications USING btree (user_id) WHERE (is_read = false);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);


--
-- Name: idx_poll_votes_poll_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_poll_votes_poll_id ON public.poll_votes USING btree (poll_id);


--
-- Name: idx_poll_votes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_poll_votes_user_id ON public.poll_votes USING btree (user_id);


--
-- Name: idx_polls_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_polls_channel_id ON public.polls USING btree (channel_id);


--
-- Name: idx_polls_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_polls_created_by ON public.polls USING btree (created_by);


--
-- Name: idx_polls_ends_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_polls_ends_at ON public.polls USING btree (ends_at);


--
-- Name: idx_polls_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_polls_message_id ON public.polls USING btree (message_id);


--
-- Name: idx_pow_challenges_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pow_challenges_expires_at ON public.pow_challenges USING btree (expires_at);


--
-- Name: idx_reactions_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reactions_channel_id ON public.reactions USING btree (channel_id);


--
-- Name: idx_reactions_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reactions_message_id ON public.reactions USING btree (message_id);


--
-- Name: idx_reactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reactions_user_id ON public.reactions USING btree (user_id);


--
-- Name: idx_role_permissions_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permissions_role_id ON public.role_permissions USING btree (role_id);


--
-- Name: idx_role_permissions_role_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permissions_role_name ON public.role_permissions USING btree (server_id, role_name);


--
-- Name: idx_role_permissions_server_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permissions_server_id ON public.role_permissions USING btree (server_id);


--
-- Name: idx_server_emojis_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_emojis_created_by ON public.server_emojis USING btree (created_by) WHERE (created_by IS NOT NULL);


--
-- Name: idx_server_invites_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_invites_code ON public.server_invites USING btree (code);


--
-- Name: idx_server_invites_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_invites_created_by ON public.server_invites USING btree (created_by) WHERE (created_by IS NOT NULL);


--
-- Name: idx_server_invites_revoked_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_invites_revoked_by ON public.server_invites USING btree (revoked_by) WHERE (revoked_by IS NOT NULL);


--
-- Name: idx_server_invites_server_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_invites_server_id ON public.server_invites USING btree (server_id);


--
-- Name: idx_server_member_roles_member; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_member_roles_member ON public.server_member_roles USING btree (member_id);


--
-- Name: idx_server_member_roles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_member_roles_role ON public.server_member_roles USING btree (role_id);


--
-- Name: idx_server_members_server; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_members_server ON public.server_members USING btree (server_id);


--
-- Name: idx_server_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_members_user ON public.server_members USING btree (user_id);


--
-- Name: idx_server_members_user_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_members_user_position ON public.server_members USING btree (user_id, "position");


--
-- Name: idx_server_members_user_server; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_members_user_server ON public.server_members USING btree (user_id, server_id);


--
-- Name: idx_server_roles_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_roles_position ON public.server_roles USING btree (server_id, "position");


--
-- Name: idx_server_roles_server_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_roles_server_id ON public.server_roles USING btree (server_id);


--
-- Name: idx_servers_invite_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servers_invite_code ON public.servers USING btree (invite_code);


--
-- Name: idx_servers_is_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servers_is_published ON public.servers USING btree (is_published) WHERE (is_published = true);


--
-- Name: idx_servers_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servers_owner_id ON public.servers USING btree (owner_id);


--
-- Name: idx_servers_published_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servers_published_created ON public.servers USING btree (created_at DESC) WHERE (is_published = true);


--
-- Name: idx_servers_system_channel_join_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servers_system_channel_join_id ON public.servers USING btree (system_channel_join_id) WHERE (system_channel_join_id IS NOT NULL);


--
-- Name: idx_servers_system_channel_leave_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servers_system_channel_leave_id ON public.servers USING btree (system_channel_leave_id) WHERE (system_channel_leave_id IS NOT NULL);


--
-- Name: idx_thread_attachments_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_attachments_message_id ON public.thread_attachments USING btree (message_id);


--
-- Name: idx_thread_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_messages_created_at ON public.thread_messages USING btree (created_at);


--
-- Name: idx_thread_messages_reply_to_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_messages_reply_to_id ON public.thread_messages USING btree (reply_to_id) WHERE (reply_to_id IS NOT NULL);


--
-- Name: idx_thread_messages_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_messages_thread_id ON public.thread_messages USING btree (thread_id);


--
-- Name: idx_thread_messages_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_messages_user_id ON public.thread_messages USING btree (user_id);


--
-- Name: idx_thread_reactions_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_reactions_message_id ON public.thread_reactions USING btree (message_id);


--
-- Name: idx_thread_reactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_reactions_user_id ON public.thread_reactions USING btree (user_id);


--
-- Name: idx_threads_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_channel_id ON public.threads USING btree (channel_id);


--
-- Name: idx_threads_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_created_by ON public.threads USING btree (created_by);


--
-- Name: idx_threads_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_message_id ON public.threads USING btree (message_id);


--
-- Name: idx_user_badges_badge_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_badges_badge_id ON public.user_badges USING btree (badge_id);


--
-- Name: idx_user_server_folders_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_server_folders_user_id ON public.user_server_folders USING btree (user_id);


--
-- Name: idx_user_voice_settings_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_voice_settings_user_id ON public.user_voice_settings USING btree (user_id);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: role_permissions_server_role_perm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX role_permissions_server_role_perm_idx ON public.role_permissions USING btree (server_id, role_id, permission) WHERE (role_id IS NOT NULL);


--
-- Name: role_permissions_server_rolename_perm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX role_permissions_server_rolename_perm_idx ON public.role_permissions USING btree (server_id, role_name, permission) WHERE ((role_name IS NOT NULL) AND (role_id IS NULL));


--
-- Name: rp_base_role_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX rp_base_role_unique ON public.role_permissions USING btree (server_id, role_name, permission) WHERE (role_name IS NOT NULL);


--
-- Name: server_emojis_server_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX server_emojis_server_id_idx ON public.server_emojis USING btree (server_id);


--
-- Name: servers_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX servers_created_at_idx ON public.servers USING btree (created_at);


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_02_21_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_02_21_inserted_at_topic_idx ON realtime.messages_2026_02_21 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_02_22_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_02_22_inserted_at_topic_idx ON realtime.messages_2026_02_22 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_02_23_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_02_23_inserted_at_topic_idx ON realtime.messages_2026_02_23 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_02_24_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_02_24_inserted_at_topic_idx ON realtime.messages_2026_02_24 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_02_25_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_02_25_inserted_at_topic_idx ON realtime.messages_2026_02_25 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_02_26_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_02_26_inserted_at_topic_idx ON realtime.messages_2026_02_26 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_02_27_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_02_27_inserted_at_topic_idx ON realtime.messages_2026_02_27 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_action_filter_key; Type: INDEX; Schema: realtime; Owner: -
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_action_filter_key ON realtime.subscription USING btree (subscription_id, entity, filters, action_filter);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_iceberg_namespaces_bucket_id; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_iceberg_namespaces_bucket_id ON storage.iceberg_namespaces USING btree (catalog_id, name);


--
-- Name: idx_iceberg_tables_location; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_iceberg_tables_location ON storage.iceberg_tables USING btree (location);


--
-- Name: idx_iceberg_tables_namespace_id; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_iceberg_tables_namespace_id ON storage.iceberg_tables USING btree (catalog_id, namespace_id, name);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_bucket_id_name_lower; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: supabase_functions_hooks_h_table_id_h_name_idx; Type: INDEX; Schema: supabase_functions; Owner: -
--

CREATE INDEX supabase_functions_hooks_h_table_id_h_name_idx ON supabase_functions.hooks USING btree (hook_table_id, hook_name);


--
-- Name: supabase_functions_hooks_request_id_idx; Type: INDEX; Schema: supabase_functions; Owner: -
--

CREATE INDEX supabase_functions_hooks_request_id_idx ON supabase_functions.hooks USING btree (request_id);


--
-- Name: messages_2026_02_21_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_02_21_inserted_at_topic_idx;


--
-- Name: messages_2026_02_21_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_02_21_pkey;


--
-- Name: messages_2026_02_22_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_02_22_inserted_at_topic_idx;


--
-- Name: messages_2026_02_22_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_02_22_pkey;


--
-- Name: messages_2026_02_23_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_02_23_inserted_at_topic_idx;


--
-- Name: messages_2026_02_23_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_02_23_pkey;


--
-- Name: messages_2026_02_24_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_02_24_inserted_at_topic_idx;


--
-- Name: messages_2026_02_24_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_02_24_pkey;


--
-- Name: messages_2026_02_25_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_02_25_inserted_at_topic_idx;


--
-- Name: messages_2026_02_25_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_02_25_pkey;


--
-- Name: messages_2026_02_26_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_02_26_inserted_at_topic_idx;


--
-- Name: messages_2026_02_26_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_02_26_pkey;


--
-- Name: messages_2026_02_27_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_02_27_inserted_at_topic_idx;


--
-- Name: messages_2026_02_27_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_02_27_pkey;


--
-- Name: direct_messages dm_notification_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dm_notification_trigger AFTER INSERT ON public.direct_messages FOR EACH ROW EXECUTE FUNCTION public.trigger_dm_notification();


--
-- Name: channels enforce_channel_creation_rate_limit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_channel_creation_rate_limit BEFORE INSERT ON public.channels FOR EACH ROW EXECUTE FUNCTION public.rate_limit_channel_creation();


--
-- Name: channel_members enforce_channel_member_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_channel_member_immutable BEFORE UPDATE ON public.channel_members FOR EACH ROW EXECUTE FUNCTION public.prevent_channel_member_identity_change();


--
-- Name: user_devices enforce_device_key_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_device_key_immutable BEFORE UPDATE ON public.user_devices FOR EACH ROW EXECUTE FUNCTION public.prevent_device_key_change();


--
-- Name: friendships enforce_friendship_identity_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_friendship_identity_immutable BEFORE UPDATE ON public.friendships FOR EACH ROW EXECUTE FUNCTION public.prevent_friendship_identity_change();


--
-- Name: friendships enforce_friendship_pending_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_friendship_pending_insert BEFORE INSERT ON public.friendships FOR EACH ROW EXECUTE FUNCTION public.enforce_friendship_pending_on_insert();


--
-- Name: server_members enforce_server_member_immutable_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_server_member_immutable_fields BEFORE UPDATE ON public.server_members FOR EACH ROW EXECUTE FUNCTION public.prevent_server_member_privilege_change();


--
-- Name: mentions mention_notification_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mention_notification_trigger AFTER INSERT ON public.mentions FOR EACH ROW EXECUTE FUNCTION public.trigger_mention_notification();


--
-- Name: server_emojis trg_enforce_server_emoji_limit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_server_emoji_limit BEFORE INSERT ON public.server_emojis FOR EACH ROW EXECUTE FUNCTION public.enforce_server_emoji_limit();


--
-- Name: dm_participants trg_prevent_dm_participant_identity_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_dm_participant_identity_change BEFORE UPDATE ON public.dm_participants FOR EACH ROW EXECUTE FUNCTION public.prevent_dm_participant_identity_change();


--
-- Name: messages trg_prevent_message_identity_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_message_identity_change BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.prevent_message_identity_change();


--
-- Name: users trg_prevent_username_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_username_change BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.prevent_username_change();


--
-- Name: reactions trg_set_reaction_channel_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_reaction_channel_id BEFORE INSERT OR UPDATE OF message_id ON public.reactions FOR EACH ROW EXECUTE FUNCTION public.set_reaction_channel_id();


--
-- Name: user_voice_settings trg_update_voice_settings_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_voice_settings_timestamp BEFORE UPDATE ON public.user_voice_settings FOR EACH ROW EXECUTE FUNCTION public.update_voice_settings_timestamp();


--
-- Name: friendships trigger_cleanup_declined; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_cleanup_declined AFTER UPDATE ON public.friendships FOR EACH STATEMENT EXECUTE FUNCTION public.delete_old_declined_requests();


--
-- Name: mentions trigger_increment_mention_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_increment_mention_count AFTER INSERT ON public.mentions FOR EACH ROW EXECUTE FUNCTION public.increment_mention_count();


--
-- Name: app_config update_app_config_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_app_config_timestamp BEFORE UPDATE ON public.app_config FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: user_preferences update_user_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.update_user_preferences_updated_at();


--
-- Name: users validate_username_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_username_trigger BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.validate_username_on_insert();


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: -
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: extensions extensions_tenant_external_id_fkey; Type: FK CONSTRAINT; Schema: _realtime; Owner: -
--

ALTER TABLE ONLY _realtime.extensions
    ADD CONSTRAINT extensions_tenant_external_id_fkey FOREIGN KEY (tenant_external_id) REFERENCES _realtime.tenants(external_id) ON DELETE CASCADE;


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: announcement_comment_reactions announcement_comment_reactions_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_comment_reactions
    ADD CONSTRAINT announcement_comment_reactions_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.announcement_comments(id) ON DELETE CASCADE;


--
-- Name: announcement_comment_reactions announcement_comment_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_comment_reactions
    ADD CONSTRAINT announcement_comment_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: announcement_comments announcement_comments_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_comments
    ADD CONSTRAINT announcement_comments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: announcement_comments announcement_comments_reply_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_comments
    ADD CONSTRAINT announcement_comments_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.announcement_comments(id) ON DELETE CASCADE;


--
-- Name: announcement_comments announcement_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_comments
    ADD CONSTRAINT announcement_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: category_permissions category_permissions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_permissions
    ADD CONSTRAINT category_permissions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.channel_categories(id) ON DELETE CASCADE;


--
-- Name: category_permissions category_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_permissions
    ADD CONSTRAINT category_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.server_roles(id) ON DELETE CASCADE;


--
-- Name: category_permissions category_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_permissions
    ADD CONSTRAINT category_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: channel_categories channel_categories_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_categories
    ADD CONSTRAINT channel_categories_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE;


--
-- Name: channel_members channel_members_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_members
    ADD CONSTRAINT channel_members_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: channel_members channel_members_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_members
    ADD CONSTRAINT channel_members_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: channel_members channel_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_members
    ADD CONSTRAINT channel_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: channel_permissions channel_permissions_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_permissions
    ADD CONSTRAINT channel_permissions_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: channel_permissions channel_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_permissions
    ADD CONSTRAINT channel_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.server_roles(id) ON DELETE CASCADE;


--
-- Name: channel_permissions channel_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_permissions
    ADD CONSTRAINT channel_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: channel_reads channel_reads_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_reads
    ADD CONSTRAINT channel_reads_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: channel_reads channel_reads_last_read_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_reads
    ADD CONSTRAINT channel_reads_last_read_message_id_fkey FOREIGN KEY (last_read_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: channel_reads channel_reads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_reads
    ADD CONSTRAINT channel_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: channel_user_settings channel_user_settings_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_user_settings
    ADD CONSTRAINT channel_user_settings_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: channel_user_settings channel_user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_user_settings
    ADD CONSTRAINT channel_user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: channels channels_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.channel_categories(id) ON DELETE SET NULL;


--
-- Name: channels channels_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE;


--
-- Name: declined_friend_requests declined_friend_requests_addressee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.declined_friend_requests
    ADD CONSTRAINT declined_friend_requests_addressee_id_fkey FOREIGN KEY (addressee_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: declined_friend_requests declined_friend_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.declined_friend_requests
    ADD CONSTRAINT declined_friend_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: direct_messages direct_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.dm_conversations(id) ON DELETE CASCADE;


--
-- Name: direct_messages direct_messages_reply_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.direct_messages(id) ON DELETE SET NULL;


--
-- Name: direct_messages direct_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: dm_attachments dm_attachments_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_attachments
    ADD CONSTRAINT dm_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.direct_messages(id) ON DELETE CASCADE;


--
-- Name: dm_conversations dm_conversations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_conversations
    ADD CONSTRAINT dm_conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: dm_participants dm_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_participants
    ADD CONSTRAINT dm_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.dm_conversations(id) ON DELETE CASCADE;


--
-- Name: dm_participants dm_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_participants
    ADD CONSTRAINT dm_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: dm_reactions dm_reactions_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_reactions
    ADD CONSTRAINT dm_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.direct_messages(id) ON DELETE CASCADE;


--
-- Name: dm_reactions dm_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_reactions
    ADD CONSTRAINT dm_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: friendships friendships_addressee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_addressee_id_fkey FOREIGN KEY (addressee_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: friendships friendships_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: media_comment_reactions media_comment_reactions_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_comment_reactions
    ADD CONSTRAINT media_comment_reactions_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.media_comments(id) ON DELETE CASCADE;


--
-- Name: media_comment_reactions media_comment_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_comment_reactions
    ADD CONSTRAINT media_comment_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: media_comments media_comments_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_comments
    ADD CONSTRAINT media_comments_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.media_items(id) ON DELETE CASCADE;


--
-- Name: media_comments media_comments_reply_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_comments
    ADD CONSTRAINT media_comments_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.media_comments(id) ON DELETE SET NULL;


--
-- Name: media_comments media_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_comments
    ADD CONSTRAINT media_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: media_items media_items_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_items
    ADD CONSTRAINT media_items_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: media_items media_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_items
    ADD CONSTRAINT media_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: mentions mentions_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentions
    ADD CONSTRAINT mentions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: mentions mentions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentions
    ADD CONSTRAINT mentions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: message_attachments message_attachments_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT message_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: messages messages_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: messages messages_reply_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: messages messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: poll_votes poll_votes_poll_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_votes
    ADD CONSTRAINT poll_votes_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES public.polls(id) ON DELETE CASCADE;


--
-- Name: poll_votes poll_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_votes
    ADD CONSTRAINT poll_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: polls polls_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polls
    ADD CONSTRAINT polls_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: polls polls_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polls
    ADD CONSTRAINT polls_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: polls polls_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polls
    ADD CONSTRAINT polls_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: reactions reactions_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: reactions reactions_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: reactions reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.server_roles(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE;


--
-- Name: server_emojis server_emojis_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_emojis
    ADD CONSTRAINT server_emojis_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: server_emojis server_emojis_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_emojis
    ADD CONSTRAINT server_emojis_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE;


--
-- Name: server_invites server_invites_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_invites
    ADD CONSTRAINT server_invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: server_invites server_invites_revoked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_invites
    ADD CONSTRAINT server_invites_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: server_invites server_invites_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_invites
    ADD CONSTRAINT server_invites_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE;


--
-- Name: server_member_roles server_member_roles_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_member_roles
    ADD CONSTRAINT server_member_roles_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.server_members(id) ON DELETE CASCADE;


--
-- Name: server_member_roles server_member_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_member_roles
    ADD CONSTRAINT server_member_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.server_roles(id) ON DELETE CASCADE;


--
-- Name: server_members server_members_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_members
    ADD CONSTRAINT server_members_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE;


--
-- Name: server_members server_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_members
    ADD CONSTRAINT server_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: server_roles server_roles_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_roles
    ADD CONSTRAINT server_roles_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE;


--
-- Name: servers servers_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: servers servers_system_channel_join_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_system_channel_join_id_fkey FOREIGN KEY (system_channel_join_id) REFERENCES public.channels(id) ON DELETE SET NULL;


--
-- Name: servers servers_system_channel_leave_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_system_channel_leave_id_fkey FOREIGN KEY (system_channel_leave_id) REFERENCES public.channels(id) ON DELETE SET NULL;


--
-- Name: thread_attachments thread_attachments_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_attachments
    ADD CONSTRAINT thread_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.thread_messages(id) ON DELETE CASCADE;


--
-- Name: thread_messages thread_messages_reply_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_messages
    ADD CONSTRAINT thread_messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.thread_messages(id) ON DELETE SET NULL;


--
-- Name: thread_messages thread_messages_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_messages
    ADD CONSTRAINT thread_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: thread_messages thread_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_messages
    ADD CONSTRAINT thread_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: thread_reactions thread_reactions_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_reactions
    ADD CONSTRAINT thread_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.thread_messages(id) ON DELETE CASCADE;


--
-- Name: thread_reactions thread_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_reactions
    ADD CONSTRAINT thread_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: threads threads_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: threads threads_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: threads threads_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: user_auth user_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_auth
    ADD CONSTRAINT user_auth_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_badges user_badges_badge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES public.badges(id) ON DELETE CASCADE;


--
-- Name: user_badges user_badges_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_devices user_devices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_preferences user_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_server_folders user_server_folders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_server_folders
    ADD CONSTRAINT user_server_folders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_server_tabs user_server_tabs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_server_tabs
    ADD CONSTRAINT user_server_tabs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_voice_settings user_voice_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_voice_settings
    ADD CONSTRAINT user_voice_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: iceberg_namespaces iceberg_namespaces_catalog_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.iceberg_namespaces
    ADD CONSTRAINT iceberg_namespaces_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES storage.buckets_analytics(id) ON DELETE CASCADE;


--
-- Name: iceberg_tables iceberg_tables_catalog_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.iceberg_tables
    ADD CONSTRAINT iceberg_tables_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES storage.buckets_analytics(id) ON DELETE CASCADE;


--
-- Name: iceberg_tables iceberg_tables_namespace_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.iceberg_tables
    ADD CONSTRAINT iceberg_tables_namespace_id_fkey FOREIGN KEY (namespace_id) REFERENCES storage.iceberg_namespaces(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: declined_friend_requests Addressee can decline; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Addressee can decline" ON public.declined_friend_requests FOR INSERT WITH CHECK ((addressee_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: announcement_comment_reactions Announcement comment reactions viewable by channel members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Announcement comment reactions viewable by channel members" ON public.announcement_comment_reactions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.announcement_comments ac
  WHERE ((ac.id = announcement_comment_reactions.comment_id) AND public.is_message_channel_member(ac.message_id, ( SELECT public.requesting_user_id() AS requesting_user_id))))));


--
-- Name: announcement_comments Announcement comments viewable by channel members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Announcement comments viewable by channel members" ON public.announcement_comments FOR SELECT USING (public.is_message_channel_member(message_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: message_attachments Attachments can be deleted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Attachments can be deleted" ON public.message_attachments FOR DELETE USING ((message_id IN ( SELECT messages.id
   FROM public.messages
  WHERE (messages.user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)))));


--
-- Name: message_attachments Attachments insert by message sender; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Attachments insert by message sender" ON public.message_attachments FOR INSERT WITH CHECK (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.messages m
  WHERE ((m.id = message_attachments.message_id) AND (m.user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)))))));


--
-- Name: badges Badges are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Badges are publicly readable" ON public.badges FOR SELECT USING (true);


--
-- Name: category_permissions Category permissions viewable by members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Category permissions viewable by members" ON public.category_permissions FOR SELECT USING (public.is_category_server_member(category_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: channel_permissions Channel permissions viewable by members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Channel permissions viewable by members" ON public.channel_permissions FOR SELECT USING (public.is_channel_server_member(channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: channels Channels viewable by server members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Channels viewable by server members" ON public.channels FOR SELECT USING ((public.is_server_member(server_id, ( SELECT public.requesting_user_id() AS requesting_user_id)) AND ((is_private = false) OR public.has_private_channel_access(id, ( SELECT public.requesting_user_id() AS requesting_user_id)))));


--
-- Name: dm_conversations DM conversations via RPC only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "DM conversations via RPC only" ON public.dm_conversations FOR INSERT WITH CHECK (false);


--
-- Name: direct_messages DM participants can read messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "DM participants can read messages" ON public.direct_messages FOR SELECT USING (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.dm_participants dp
  WHERE ((dp.conversation_id = direct_messages.conversation_id) AND (dp.user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)))))));


--
-- Name: direct_messages DM participants can send as self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "DM participants can send as self" ON public.direct_messages FOR INSERT WITH CHECK (((sender_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (content IS NOT NULL) AND (length(TRIM(BOTH FROM content)) > 0) AND (length(content) <= 4000) AND (EXISTS ( SELECT 1
   FROM public.dm_participants dp
  WHERE ((dp.conversation_id = direct_messages.conversation_id) AND (dp.user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)))))));


--
-- Name: dm_participants DM participants via RPC only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "DM participants via RPC only" ON public.dm_participants FOR INSERT WITH CHECK (false);


--
-- Name: direct_messages DM senders can delete own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "DM senders can delete own messages" ON public.direct_messages FOR DELETE USING (((sender_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (EXISTS ( SELECT 1
   FROM public.dm_participants dp
  WHERE ((dp.conversation_id = direct_messages.conversation_id) AND (dp.user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)))))));


--
-- Name: direct_messages DM senders can edit own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "DM senders can edit own messages" ON public.direct_messages FOR UPDATE USING (((sender_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.dm_participants dp
  WHERE ((dp.conversation_id = direct_messages.conversation_id) AND (dp.user_id = ( SELECT public.requesting_user_id() AS requesting_user_id))))))) WITH CHECK (((sender_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (content IS NOT NULL) AND (length(TRIM(BOTH FROM content)) > 0) AND (length(content) <= 4000) AND (EXISTS ( SELECT 1
   FROM public.dm_participants dp
  WHERE ((dp.conversation_id = direct_messages.conversation_id) AND (dp.user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)))))));


--
-- Name: declined_friend_requests Involved users can delete declined requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Involved users can delete declined requests" ON public.declined_friend_requests FOR DELETE USING (((requester_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) OR (addressee_id = ( SELECT public.requesting_user_id() AS requesting_user_id))));


--
-- Name: friendships Involved users can delete friendship; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Involved users can delete friendship" ON public.friendships FOR DELETE USING (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND ((requester_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) OR (addressee_id = ( SELECT public.requesting_user_id() AS requesting_user_id)))));


--
-- Name: friendships Involved users can update friendship; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Involved users can update friendship" ON public.friendships FOR UPDATE USING (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND ((requester_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) OR (addressee_id = ( SELECT public.requesting_user_id() AS requesting_user_id))))) WITH CHECK ((((addressee_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (status = ANY (ARRAY['accepted'::public.friendship_status, 'declined'::public.friendship_status, 'blocked'::public.friendship_status]))) OR ((requester_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (status = 'blocked'::public.friendship_status))));


--
-- Name: declined_friend_requests Involved users see declined requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Involved users see declined requests" ON public.declined_friend_requests FOR SELECT USING (((requester_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) OR (addressee_id = ( SELECT public.requesting_user_id() AS requesting_user_id))));


--
-- Name: media_comment_reactions Media comment reactions viewable by channel members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Media comment reactions viewable by channel members" ON public.media_comment_reactions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.media_comments mc
  WHERE ((mc.id = media_comment_reactions.comment_id) AND public.is_media_channel_member(mc.media_id, ( SELECT public.requesting_user_id() AS requesting_user_id))))));


--
-- Name: media_comments Media comments viewable by channel members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Media comments viewable by channel members" ON public.media_comments FOR SELECT USING (public.is_media_channel_member(media_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: media_items Media viewable by members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Media viewable by members" ON public.media_items FOR SELECT USING (public.is_channel_server_member(channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: server_member_roles Member roles viewable by server members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member roles viewable by server members" ON public.server_member_roles FOR SELECT USING (public.is_member_in_same_server(member_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: channel_categories Members view categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members view categories" ON public.channel_categories FOR SELECT USING (public.is_server_member(server_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: server_members Members viewable by fellow members only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members viewable by fellow members only" ON public.server_members FOR SELECT USING (((CURRENT_USER = 'realtime'::name) OR ((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND public.is_server_member(server_id, ( SELECT public.requesting_user_id() AS requesting_user_id)))));


--
-- Name: mentions Mentions insert via trigger only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Mentions insert via trigger only" ON public.mentions FOR INSERT WITH CHECK (false);


--
-- Name: mentions Mentions viewable by channel members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Mentions viewable by channel members" ON public.mentions FOR SELECT USING (public.is_message_channel_member(message_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: message_attachments Message attachments readable by channel access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Message attachments readable by channel access" ON public.message_attachments FOR SELECT USING (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.messages m
  WHERE ((m.id = message_attachments.message_id) AND public.can_access_channel(m.channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)))))));


--
-- Name: messages Messages readable by channel access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Messages readable by channel access" ON public.messages FOR SELECT USING (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (public.is_maintenance_active() = false) AND public.can_access_channel(channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id))));


--
-- Name: messages Moderators delete messages in their channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Moderators delete messages in their channels" ON public.messages FOR DELETE USING (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (public.is_maintenance_active() = false) AND (EXISTS ( SELECT 1
   FROM (public.server_members sm
     JOIN public.channels c ON ((c.server_id = sm.server_id)))
  WHERE ((c.id = messages.channel_id) AND (sm.user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (sm.role = ANY (ARRAY['admin'::public.server_role, 'owner'::public.server_role])) AND (sm.is_banned = false))))));


--
-- Name: notifications Notifications are private and permission-based; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Notifications are private and permission-based" ON public.notifications FOR SELECT TO authenticated USING (((user_id = public.requesting_user_id()) AND ((link !~~ '/channels/%'::text) OR (EXISTS ( SELECT 1
   FROM public.channels c
  WHERE ((notifications.link ~~ (('/channels/'::text || c.id) || '%'::text)) AND ((c.is_private = false) OR (EXISTS ( SELECT 1
           FROM public.channel_members cm
          WHERE ((cm.channel_id = c.id) AND (cm.user_id = public.requesting_user_id())))))))))));


--
-- Name: dm_attachments Participants add DM attachments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants add DM attachments" ON public.dm_attachments FOR INSERT WITH CHECK (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND public.is_dm_message_participant(message_id, ( SELECT public.requesting_user_id() AS requesting_user_id))));


--
-- Name: dm_conversations Participants can view conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can view conversations" ON public.dm_conversations FOR SELECT USING (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND public.is_dm_participant(id, ( SELECT public.requesting_user_id() AS requesting_user_id))));


--
-- Name: dm_attachments Participants view DM attachments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants view DM attachments" ON public.dm_attachments FOR SELECT USING (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND public.is_dm_participant(public.get_dm_conversation_id(message_id), ( SELECT public.requesting_user_id() AS requesting_user_id))));


--
-- Name: dm_reactions Participants view DM reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants view DM reactions" ON public.dm_reactions FOR SELECT USING (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND public.is_dm_participant(public.get_dm_conversation_id(message_id), ( SELECT public.requesting_user_id() AS requesting_user_id))));


--
-- Name: dm_participants Participants view conversation members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants view conversation members" ON public.dm_participants FOR SELECT USING (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND public.is_dm_participant(conversation_id, ( SELECT public.requesting_user_id() AS requesting_user_id))));


--
-- Name: poll_votes Poll votes viewable by channel members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Poll votes viewable by channel members" ON public.poll_votes FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.polls p
  WHERE ((p.id = poll_votes.poll_id) AND public.is_channel_server_member(p.channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id))))));


--
-- Name: polls Polls viewable by channel members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Polls viewable by channel members" ON public.polls FOR SELECT USING (public.is_channel_server_member(channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: reactions Reactions are viewable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Reactions are viewable" ON public.reactions FOR SELECT USING (((CURRENT_USER = 'realtime'::name) OR ((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND public.can_access_channel(channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)))));


--
-- Name: role_permissions Role permissions viewable by members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Role permissions viewable by members" ON public.role_permissions FOR SELECT USING (public.is_server_member(server_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: server_emojis Server emojis are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Server emojis are viewable by everyone" ON public.server_emojis FOR SELECT USING (true);


--
-- Name: server_invites Server invites readable by managers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Server invites readable by managers" ON public.server_invites FOR SELECT USING (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND public.check_user_server_permission(( SELECT public.requesting_user_id() AS requesting_user_id), server_id, 'manage_invites'::public.permission_type)));


--
-- Name: channel_members Server members can be added to channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Server members can be added to channels" ON public.channel_members FOR INSERT WITH CHECK (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND public.is_channel_server_member(channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (EXISTS ( SELECT 1
   FROM (public.channels c
     JOIN public.server_members sm ON (((sm.server_id = c.server_id) AND (sm.user_id = channel_members.user_id))))
  WHERE ((c.id = channel_members.channel_id) AND (COALESCE(sm.is_banned, false) = false)))) AND (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (EXISTS ( SELECT 1
   FROM public.channels c
  WHERE ((c.id = channel_members.channel_id) AND (COALESCE(c.is_private, false) = false))))) OR public.check_user_server_permission(( SELECT public.requesting_user_id() AS requesting_user_id), ( SELECT c.server_id
   FROM public.channels c
  WHERE (c.id = channel_members.channel_id)), 'manage_channels'::public.permission_type))));


--
-- Name: channel_members Server members view channel members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Server members view channel members" ON public.channel_members FOR SELECT USING (public.is_channel_server_member(channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: server_roles Server roles viewable by members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Server roles viewable by members" ON public.server_roles FOR SELECT USING (public.is_server_member(server_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: servers Servers are viewable by members or published; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Servers are viewable by members or published" ON public.servers FOR SELECT USING (((COALESCE(is_published, false) = true) OR (owner_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) OR (EXISTS ( SELECT 1
   FROM public.server_members sm
  WHERE ((sm.server_id = servers.id) AND (sm.user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (COALESCE(sm.is_banned, false) = false))))));


--
-- Name: servers Servers can be deleted by owner only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Servers can be deleted by owner only" ON public.servers FOR DELETE USING ((owner_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: servers Servers can be inserted by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Servers can be inserted by owner" ON public.servers FOR INSERT WITH CHECK (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (owner_id = ( SELECT public.requesting_user_id() AS requesting_user_id))));


--
-- Name: servers Servers can be updated by owner only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Servers can be updated by owner only" ON public.servers FOR UPDATE USING ((owner_id = ( SELECT public.requesting_user_id() AS requesting_user_id))) WITH CHECK ((owner_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: thread_attachments Thread attachments can be deleted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Thread attachments can be deleted" ON public.thread_attachments FOR DELETE USING ((message_id IN ( SELECT thread_messages.id
   FROM public.thread_messages
  WHERE (thread_messages.user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)))));


--
-- Name: thread_attachments Thread attachments insert by message author; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Thread attachments insert by message author" ON public.thread_attachments FOR INSERT WITH CHECK (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.thread_messages tm
  WHERE ((tm.id = thread_attachments.message_id) AND (tm.user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)))))));


--
-- Name: thread_attachments Thread attachments viewable by channel members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Thread attachments viewable by channel members" ON public.thread_attachments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.thread_messages tm
  WHERE ((tm.id = thread_attachments.message_id) AND public.is_thread_channel_member(tm.thread_id, ( SELECT public.requesting_user_id() AS requesting_user_id))))));


--
-- Name: thread_messages Thread messages can be deleted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Thread messages can be deleted" ON public.thread_messages FOR DELETE USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: thread_messages Thread messages can be inserted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Thread messages can be inserted" ON public.thread_messages FOR INSERT WITH CHECK (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.threads t
  WHERE ((t.id = thread_messages.thread_id) AND public.can_access_channel(t.channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)))))));


--
-- Name: thread_messages Thread messages can be updated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Thread messages can be updated" ON public.thread_messages FOR UPDATE USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id))) WITH CHECK (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (thread_id = ( SELECT tm.thread_id
   FROM public.thread_messages tm
  WHERE (tm.id = thread_messages.id)))));


--
-- Name: thread_messages Thread messages viewable by channel members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Thread messages viewable by channel members" ON public.thread_messages FOR SELECT USING (public.is_thread_channel_member(thread_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: thread_reactions Thread reactions can be deleted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Thread reactions can be deleted" ON public.thread_reactions FOR DELETE USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: thread_reactions Thread reactions can be inserted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Thread reactions can be inserted" ON public.thread_reactions FOR INSERT WITH CHECK (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (public.thread_messages tm
     JOIN public.threads t ON ((t.id = tm.thread_id)))
  WHERE ((tm.id = thread_reactions.message_id) AND public.can_access_channel(t.channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)) AND public.check_user_permission(( SELECT public.requesting_user_id() AS requesting_user_id), t.channel_id, 'add_reactions'::public.permission_type))))));


--
-- Name: thread_reactions Thread reactions viewable by channel members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Thread reactions viewable by channel members" ON public.thread_reactions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.thread_messages tm
  WHERE ((tm.id = thread_reactions.message_id) AND public.is_thread_channel_member(tm.thread_id, ( SELECT public.requesting_user_id() AS requesting_user_id))))));


--
-- Name: threads Threads are viewable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Threads are viewable" ON public.threads FOR SELECT USING (public.is_channel_server_member(channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: threads Threads can be deleted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Threads can be deleted" ON public.threads FOR DELETE USING ((created_by = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: threads Threads can be inserted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Threads can be inserted" ON public.threads FOR INSERT WITH CHECK (((created_by = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND public.can_access_channel(channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (EXISTS ( SELECT 1
   FROM public.messages m
  WHERE ((m.id = threads.message_id) AND (m.channel_id = threads.channel_id) AND public.can_access_channel(m.channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)))))));


--
-- Name: threads Threads can be updated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Threads can be updated" ON public.threads FOR UPDATE USING ((created_by = ( SELECT public.requesting_user_id() AS requesting_user_id))) WITH CHECK (((created_by = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (channel_id = ( SELECT t.channel_id
   FROM public.threads t
  WHERE (t.id = threads.id))) AND (message_id = ( SELECT t.message_id
   FROM public.threads t
  WHERE (t.id = threads.id)))));


--
-- Name: user_badges User badges are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "User badges are publicly readable" ON public.user_badges FOR SELECT USING (true);


--
-- Name: dm_reactions Users add own DM reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users add own DM reactions" ON public.dm_reactions FOR INSERT WITH CHECK (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND public.is_dm_participant(public.get_dm_conversation_id(message_id), ( SELECT public.requesting_user_id() AS requesting_user_id))));


--
-- Name: reactions Users add own reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users add own reactions" ON public.reactions FOR INSERT WITH CHECK (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.messages m
  WHERE ((m.id = reactions.message_id) AND (m.channel_id = reactions.channel_id) AND public.can_access_channel(m.channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id))))) AND public.check_user_permission(( SELECT public.requesting_user_id() AS requesting_user_id), channel_id, 'add_reactions'::public.permission_type)));


--
-- Name: user_devices Users can delete own devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own devices" ON public.user_devices FOR DELETE USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: users Users can delete own record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own record" ON public.users FOR DELETE USING ((id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: user_devices Users can insert own devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own devices" ON public.user_devices FOR INSERT WITH CHECK (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (identity_public_key IS NOT NULL) AND (length(TRIM(BOTH FROM identity_public_key)) > 0)));


--
-- Name: server_members Users can leave servers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can leave servers" ON public.server_members FOR DELETE USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: dm_participants Users can remove themselves from DM; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can remove themselves from DM" ON public.dm_participants FOR DELETE USING (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL)));


--
-- Name: channel_members Users can remove themselves from channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can remove themselves from channels" ON public.channel_members FOR DELETE USING (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL)));


--
-- Name: user_devices Users can update own devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own devices" ON public.user_devices FOR UPDATE USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id))) WITH CHECK ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: users Users can update own record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own record" ON public.users FOR UPDATE USING ((id = ( SELECT public.requesting_user_id() AS requesting_user_id))) WITH CHECK ((id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: user_devices Users can view own devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own devices" ON public.user_devices FOR SELECT USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: users Users can view related users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view related users" ON public.users FOR SELECT USING (public.can_view_user(id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: dm_attachments Users delete own DM attachments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own DM attachments" ON public.dm_attachments FOR DELETE USING (public.is_dm_message_participant(message_id, ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: messages Users delete their own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete their own messages" ON public.messages FOR DELETE USING (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (public.is_maintenance_active() = false)));


--
-- Name: messages Users edit their own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users edit their own messages" ON public.messages FOR UPDATE USING (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (public.is_maintenance_active() = false) AND public.can_access_channel(channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id)))) WITH CHECK (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND (public.is_maintenance_active() = false) AND public.can_access_channel(channel_id, ( SELECT public.requesting_user_id() AS requesting_user_id))));


--
-- Name: server_members Users join as member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users join as member" ON public.server_members FOR INSERT WITH CHECK (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (role = 'member'::public.server_role) AND (COALESCE(is_banned, false) = false) AND ((EXISTS ( SELECT 1
   FROM public.servers s
  WHERE ((s.id = server_members.server_id) AND (COALESCE(s.is_published, false) = true)))) OR (EXISTS ( SELECT 1
   FROM public.servers s
  WHERE ((s.id = server_members.server_id) AND (s.owner_id = ( SELECT public.requesting_user_id() AS requesting_user_id))))))));


--
-- Name: channel_user_settings Users manage own channel settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own channel settings" ON public.channel_user_settings USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id))) WITH CHECK ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: user_server_folders Users manage own folders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own folders" ON public.user_server_folders USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id))) WITH CHECK ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: media_comment_reactions Users manage own media comment reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own media comment reactions" ON public.media_comment_reactions USING ((( SELECT public.requesting_user_id() AS requesting_user_id) = user_id)) WITH CHECK ((( SELECT public.requesting_user_id() AS requesting_user_id) = user_id));


--
-- Name: media_comments Users manage own media comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own media comments" ON public.media_comments USING ((( SELECT public.requesting_user_id() AS requesting_user_id) = user_id)) WITH CHECK ((( SELECT public.requesting_user_id() AS requesting_user_id) = user_id));


--
-- Name: notifications Users manage own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own notifications" ON public.notifications USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id))) WITH CHECK ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: user_preferences Users manage own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own preferences" ON public.user_preferences USING (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL))) WITH CHECK (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL)));


--
-- Name: channel_reads Users manage own read state; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own read state" ON public.channel_reads USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id))) WITH CHECK ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: user_server_tabs Users manage own tabs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own tabs" ON public.user_server_tabs USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id))) WITH CHECK ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: user_voice_settings Users manage own voice settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own voice settings" ON public.user_voice_settings USING (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL))) WITH CHECK (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL)));


--
-- Name: dm_reactions Users remove own DM reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users remove own DM reactions" ON public.dm_reactions FOR DELETE USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: reactions Users remove own reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users remove own reactions" ON public.reactions FOR DELETE USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: friendships Users see own friendships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users see own friendships" ON public.friendships FOR SELECT USING (((( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL) AND ((requester_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) OR (addressee_id = ( SELECT public.requesting_user_id() AS requesting_user_id)))));


--
-- Name: messages Users send messages as themselves only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users send messages as themselves only" ON public.messages FOR INSERT WITH CHECK (((user_id = public.requesting_user_id()) AND (public.requesting_user_id() IS NOT NULL) AND (public.is_maintenance_active() = false) AND public.can_access_channel(channel_id, public.requesting_user_id()) AND public.check_user_permission(public.requesting_user_id(), channel_id, 'send_messages'::public.permission_type) AND ((COALESCE(( SELECT c.is_read_only
   FROM public.channels c
  WHERE (c.id = messages.channel_id)), false) = false) OR public.check_user_permission(public.requesting_user_id(), channel_id, 'manage_messages'::public.permission_type))));


--
-- Name: friendships Users send own friend requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users send own friend requests" ON public.friendships FOR INSERT WITH CHECK (((requester_id = public.requesting_user_id()) AND (public.requesting_user_id() IS NOT NULL) AND (requester_id <> addressee_id) AND (status = 'pending'::public.friendship_status)));


--
-- Name: server_members Users update own non-role data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own non-role data" ON public.server_members FOR UPDATE USING (((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)) AND (( SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL))) WITH CHECK ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: dm_participants Users update own participant record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own participant record" ON public.dm_participants FOR UPDATE USING ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id))) WITH CHECK ((user_id = ( SELECT public.requesting_user_id() AS requesting_user_id)));


--
-- Name: announcement_comment_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcement_comment_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: announcement_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcement_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: app_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

--
-- Name: app_config app_config_service_role_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY app_config_service_role_only ON public.app_config USING ((CURRENT_USER = 'service_role'::name)) WITH CHECK ((CURRENT_USER = 'service_role'::name));


--
-- Name: auth_rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: badges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

--
-- Name: category_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.category_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: channel_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.channel_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: channel_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;

--
-- Name: channel_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.channel_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: channel_reads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.channel_reads ENABLE ROW LEVEL SECURITY;

--
-- Name: channel_user_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.channel_user_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: channels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

--
-- Name: declined_friend_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.declined_friend_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: direct_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: dm_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dm_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: dm_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dm_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: dm_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dm_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: dm_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dm_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: friendships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

--
-- Name: media_comment_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.media_comment_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: media_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.media_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: media_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;

--
-- Name: mentions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

--
-- Name: message_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages_account_age_min_2m; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_account_age_min_2m ON public.messages AS RESTRICTIVE FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.id = public.requesting_user_id()) AND (u.created_at <= (now() - '00:02:00'::interval))))));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: poll_votes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

--
-- Name: polls; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

--
-- Name: pow_challenges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pow_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: pow_challenges pow_deny_all_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pow_deny_all_delete ON public.pow_challenges FOR DELETE USING (false);


--
-- Name: pow_challenges pow_deny_all_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pow_deny_all_insert ON public.pow_challenges FOR INSERT WITH CHECK (false);


--
-- Name: pow_challenges pow_deny_all_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pow_deny_all_select ON public.pow_challenges FOR SELECT USING (false);


--
-- Name: pow_challenges pow_deny_all_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pow_deny_all_update ON public.pow_challenges FOR UPDATE USING (false) WITH CHECK (false);


--
-- Name: reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: server_emojis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.server_emojis ENABLE ROW LEVEL SECURITY;

--
-- Name: server_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.server_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: server_member_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.server_member_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: server_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;

--
-- Name: auth_rate_limits server_only_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY server_only_access ON public.auth_rate_limits USING (false) WITH CHECK (false);


--
-- Name: server_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.server_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: servers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;

--
-- Name: thread_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.thread_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: thread_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.thread_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: thread_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.thread_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: threads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;

--
-- Name: user_auth ua_deny_all_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ua_deny_all_delete ON public.user_auth FOR DELETE USING (false);


--
-- Name: user_auth ua_deny_all_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ua_deny_all_insert ON public.user_auth FOR INSERT WITH CHECK (false);


--
-- Name: user_auth ua_deny_all_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ua_deny_all_select ON public.user_auth FOR SELECT USING (false);


--
-- Name: user_auth ua_deny_all_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ua_deny_all_update ON public.user_auth FOR UPDATE USING (false) WITH CHECK (false);


--
-- Name: user_auth; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_auth ENABLE ROW LEVEL SECURITY;

--
-- Name: user_badges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

--
-- Name: user_devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

--
-- Name: user_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: user_server_folders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_server_folders ENABLE ROW LEVEL SECURITY;

--
-- Name: user_server_tabs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_server_tabs ENABLE ROW LEVEL SECURITY;

--
-- Name: user_voice_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_voice_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: iceberg_namespaces; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.iceberg_namespaces ENABLE ROW LEVEL SECURITY;

--
-- Name: iceberg_tables; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.iceberg_tables ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime_messages_publication; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime_messages_publication WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime channel_reads; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.channel_reads;


--
-- Name: supabase_realtime direct_messages; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.direct_messages (id, conversation_id, sender_id, created_at);


--
-- Name: supabase_realtime messages; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.messages;


--
-- Name: supabase_realtime reactions; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.reactions;


--
-- Name: supabase_realtime users; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.users;


--
-- Name: supabase_realtime_messages_publication messages; Type: PUBLICATION TABLE; Schema: realtime; Owner: -
--

ALTER PUBLICATION supabase_realtime_messages_publication ADD TABLE ONLY realtime.messages;


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


--
-- PostgreSQL database dump complete
--


