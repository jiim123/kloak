-- Add clearer template aliases for server bot flows.
-- Existing payloads already carry content for message-like triggers, but the
-- renderer only exposed it indirectly through {item}.

CREATE OR REPLACE FUNCTION public.render_bot_template(_template text, _payload jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  rendered text := COALESCE(_template, '');
BEGIN
  rendered := replace(rendered, '{user}', COALESCE(_payload->>'user_mention', _payload->>'username', 'someone'));
  rendered := replace(rendered, '{username}', COALESCE(_payload->>'username', 'someone'));
  rendered := replace(rendered, '{server}', COALESCE(_payload->>'server_name', 'this server'));
  rendered := replace(rendered, '{channel}', COALESCE(_payload->>'channel_mention', _payload->>'channel_name', 'this channel'));
  rendered := replace(rendered, '{item}', COALESCE(_payload->>'item_title', _payload->>'content', 'an item'));
  rendered := replace(rendered, '{title}', COALESCE(_payload->>'item_title', _payload->>'content', 'an item'));
  rendered := replace(rendered, '{message}', COALESCE(_payload->>'content', ''));
  rendered := replace(rendered, '{content}', COALESCE(_payload->>'content', ''));
  rendered := replace(rendered, '{emoji}', COALESCE(_payload->>'emoji', 'a reaction'));
  rendered := replace(rendered, '$TriggeringUser', COALESCE(_payload->>'user_mention', _payload->>'username', 'someone'));
  RETURN left(trim(rendered), 2000);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.render_bot_template(text, jsonb) FROM PUBLIC;
