-- Debug helper for server bot flows. This is intentionally restricted to users
-- who can manage bot/webhook configuration in the server.

CREATE OR REPLACE FUNCTION public.get_server_bot_debug(
  _server_id uuid,
  _user_id uuid,
  _limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  safe_limit integer := GREATEST(1, LEAST(COALESCE(_limit, 20), 100));
  result jsonb;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_webhooks'::public.permission_type) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  WITH recent_events AS (
    SELECT e.*
    FROM public.server_bot_event_queue e
    WHERE e.server_id = _server_id
    ORDER BY e.created_at DESC
    LIMIT safe_limit
  ),
  flow_candidates AS (
    SELECT
      e.id AS event_id,
      f.id AS flow_id,
      f.trigger_type,
      f.trigger_config,
      f.action_type,
      f.action_config,
      f.is_enabled AS flow_enabled,
      b.is_enabled AS bot_enabled,
      b.bot_user_id,
      l.status AS action_log_status,
      l.error AS action_log_error,
      CASE
        WHEN f.id IS NULL THEN 'no_flow_for_event_type'
        WHEN f.is_enabled IS NOT TRUE THEN 'flow_disabled'
        WHEN b.is_enabled IS NOT TRUE THEN 'bot_disabled'
        WHEN l.id IS NOT NULL THEN 'already_logged:' || COALESCE(l.status::text, 'unknown')
        WHEN f.last_triggered_at IS NOT NULL
          AND f.last_triggered_at > now() - make_interval(secs => COALESCE(f.cooldown_seconds, 0))
          THEN 'cooldown'
        WHEN NULLIF(f.trigger_config->>'channel_id', '') IS NOT NULL
          AND f.trigger_config->>'channel_id' <> e.payload->>'channel_id'
          THEN 'trigger_channel_mismatch'
        WHEN f.trigger_type = 'message_created'
          AND COALESCE(NULLIF(f.trigger_config->>'content_match_type', ''), 'any') = 'contains'
          AND (
            trim(COALESCE(f.trigger_config->>'content_match_value', '')) = ''
            OR position(lower(trim(COALESCE(f.trigger_config->>'content_match_value', ''))) in lower(trim(COALESCE(e.payload->>'content', '')))) = 0
          )
          THEN 'content_contains_mismatch'
        WHEN f.trigger_type = 'message_created'
          AND COALESCE(NULLIF(f.trigger_config->>'content_match_type', ''), 'any') = 'exact'
          AND lower(trim(COALESCE(e.payload->>'content', ''))) <> lower(trim(COALESCE(f.trigger_config->>'content_match_value', '')))
          THEN 'content_exact_mismatch'
        WHEN f.trigger_type = 'reaction_added'
          AND NULLIF(f.trigger_config->>'emoji', '') IS NOT NULL
          AND f.trigger_config->>'emoji' <> e.payload->>'emoji'
          THEN 'emoji_mismatch'
        WHEN NULLIF(f.trigger_config->>'role_id', '') IS NOT NULL
          AND (
            NULLIF(e.payload->>'user_id', '') IS NULL
            OR NOT EXISTS (
              SELECT 1
              FROM public.server_members sm
              JOIN public.server_member_roles smr ON smr.member_id = sm.id
              WHERE sm.server_id = e.server_id
                AND sm.user_id = (e.payload->>'user_id')::uuid
                AND smr.role_id = (f.trigger_config->>'role_id')::uuid
            )
          )
          THEN 'role_mismatch'
        WHEN NOT EXISTS (
          SELECT 1
          FROM public.server_members sm
          WHERE sm.server_id = e.server_id
            AND sm.user_id = b.bot_user_id
            AND COALESCE(sm.is_banned, false) = false
            AND COALESCE(sm.is_muted, false) = false
        )
          THEN 'bot_not_active_member'
        WHEN f.action_type IN ('send_channel_message', 'create_forum_topic', 'create_list_item')
          AND NOT EXISTS (
            SELECT 1
            FROM public.channels c
            WHERE c.id = NULLIF(f.action_config->>'channel_id', '')::uuid
              AND c.server_id = e.server_id
              AND (
                (f.action_type = 'send_channel_message' AND c.type IN ('text'::public.channel_type, 'announcement'::public.channel_type))
                OR (f.action_type = 'create_forum_topic' AND c.type = 'forum'::public.channel_type)
                OR (f.action_type = 'create_list_item' AND c.type = 'tasks'::public.channel_type)
              )
          )
          THEN 'action_channel_invalid'
        WHEN f.action_type IN ('send_channel_message', 'create_forum_topic', 'create_list_item')
          AND public.render_bot_template(f.action_config->>'content', e.payload) = ''
          THEN 'rendered_content_empty'
        WHEN f.action_type = 'delete_message'
          AND NULLIF(e.payload->>'message_id', '') IS NULL
          THEN 'delete_message_missing_source_message'
        WHEN f.action_type = 'delete_message'
          AND NOT EXISTS (
            SELECT 1
            FROM public.messages m
            JOIN public.channels c ON c.id = m.channel_id
            WHERE m.id = NULLIF(e.payload->>'message_id', '')::uuid
              AND c.server_id = e.server_id
          )
          THEN 'delete_message_source_not_found'
        ELSE 'eligible'
      END AS diagnosis
    FROM recent_events e
    LEFT JOIN public.server_bot_flows f
      ON f.server_id = e.server_id
     AND f.trigger_type = e.event_type
    LEFT JOIN public.server_bots b
      ON b.id = f.bot_id
    LEFT JOIN public.server_bot_action_log l
      ON l.event_id = e.id
     AND l.flow_id = f.id
  )
  SELECT jsonb_build_object(
    'events',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'event_type', e.event_type,
            'status', e.status,
            'attempts', e.attempts,
            'last_error', e.last_error,
            'payload', e.payload,
            'created_at', e.created_at,
            'updated_at', e.updated_at,
            'flows', COALESCE(
              (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'flow_id', fc.flow_id,
                    'trigger_type', fc.trigger_type,
                    'action_type', fc.action_type,
                    'flow_enabled', fc.flow_enabled,
                    'bot_enabled', fc.bot_enabled,
                    'bot_user_id', fc.bot_user_id,
                    'action_config', fc.action_config,
                    'action_log_status', fc.action_log_status,
                    'action_log_error', fc.action_log_error,
                    'diagnosis', fc.diagnosis
                  )
                  ORDER BY fc.flow_id
                )
                FROM flow_candidates fc
                WHERE fc.event_id = e.id
              ),
              '[]'::jsonb
            )
          )
          ORDER BY e.created_at DESC
        )
        FROM recent_events e
      ),
      '[]'::jsonb
    )
  )
  INTO result;

  RETURN result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_server_bot_debug(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_server_bot_debug(uuid, uuid, integer) TO anon, authenticated;
