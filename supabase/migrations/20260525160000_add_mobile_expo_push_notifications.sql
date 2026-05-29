CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL,
  device_id text,
  app_version text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  CONSTRAINT push_tokens_platform_check CHECK (platform IN ('ios', 'android')),
  CONSTRAINT push_tokens_token_length_check CHECK (char_length(token) BETWEEN 20 AND 512),
  CONSTRAINT push_tokens_token_format_check CHECK (token LIKE 'ExponentPushToken[%' OR token LIKE 'ExpoPushToken[%')
);

CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_token_key ON public.push_tokens (token);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_enabled ON public.push_tokens (user_id) WHERE enabled = true;

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.push_tokens FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;
GRANT ALL ON public.push_tokens TO service_role;

DROP POLICY IF EXISTS "Users manage own push tokens" ON public.push_tokens;
CREATE POLICY "Users manage own push tokens"
ON public.push_tokens
USING (user_id = (SELECT public.requesting_user_id()))
WITH CHECK (user_id = (SELECT public.requesting_user_id()));

CREATE OR REPLACE FUNCTION public.touch_push_tokens_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_push_tokens_updated_at ON public.push_tokens;
CREATE TRIGGER trg_touch_push_tokens_updated_at
BEFORE UPDATE ON public.push_tokens
FOR EACH ROW
EXECUTE FUNCTION public.touch_push_tokens_updated_at();

CREATE OR REPLACE FUNCTION public.notification_push_enabled(_user_id uuid, _type public.notification_type)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    CASE _type
      WHEN 'mention'::public.notification_type THEN up.enable_mention_notifications
      WHEN 'dm'::public.notification_type THEN up.enable_dm_notifications
      WHEN 'friend_request'::public.notification_type THEN up.enable_friend_request_notifications
      WHEN 'server_invite'::public.notification_type THEN up.enable_server_invite_notifications
      ELSE true
    END,
    true
  )
  FROM public.user_preferences up
  WHERE up.user_id = _user_id
  UNION ALL
  SELECT true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.notification_push_body(_user_id uuid, _body text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN COALESCE((SELECT up.show_message_preview FROM public.user_preferences up WHERE up.user_id = _user_id), true)
      THEN NULLIF(left(COALESCE(_body, ''), 180), '')
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.send_mobile_push_for_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _token text;
  _body text;
  _payload jsonb;
BEGIN
  IF TG_OP <> 'INSERT' OR NEW.user_id IS NULL OR NEW.is_read THEN
    RETURN NEW;
  END IF;

  IF NOT public.notification_push_enabled(NEW.user_id, NEW.type) THEN
    RETURN NEW;
  END IF;

  _body := public.notification_push_body(NEW.user_id, NEW.body);

  FOR _token IN
    SELECT pt.token
    FROM public.push_tokens pt
    WHERE pt.user_id = NEW.user_id
      AND pt.enabled = true
  LOOP
    _payload := jsonb_build_object(
      'to', _token,
      'title', left(COALESCE(NEW.title, 'Kloak'), 120),
      'sound', 'default',
      'priority', 'high',
      'data', jsonb_build_object(
        'notificationId', NEW.id,
        'type', NEW.type,
        'link', COALESCE(NEW.link, '/app')
      )
    );

    IF _body IS NOT NULL THEN
      _payload := _payload || jsonb_build_object('body', _body);
    END IF;

    PERFORM net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Accept', 'application/json'
      ),
      body := _payload
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_send_mobile_push_for_notification ON public.notifications;
CREATE TRIGGER trg_send_mobile_push_for_notification
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.send_mobile_push_for_notification();

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;
