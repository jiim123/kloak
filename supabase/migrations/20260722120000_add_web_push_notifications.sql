CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  CONSTRAINT web_push_subscriptions_endpoint_length_check CHECK (char_length(endpoint) BETWEEN 20 AND 2048),
  CONSTRAINT web_push_subscriptions_endpoint_https_check CHECK (endpoint LIKE 'https://%'),
  CONSTRAINT web_push_subscriptions_key_length_check CHECK (char_length(p256dh) BETWEEN 16 AND 512 AND char_length(auth) BETWEEN 16 AND 256)
);

CREATE UNIQUE INDEX IF NOT EXISTS web_push_subscriptions_endpoint_key
ON public.web_push_subscriptions (endpoint);

CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_user_enabled
ON public.web_push_subscriptions (user_id)
WHERE enabled = true;

ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_push_subscriptions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.web_push_subscriptions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.web_push_subscriptions TO service_role;

DROP POLICY IF EXISTS "Users manage own web push subscriptions" ON public.web_push_subscriptions;
CREATE POLICY "Users manage own web push subscriptions"
ON public.web_push_subscriptions
USING (user_id = (SELECT public.requesting_user_id()))
WITH CHECK (user_id = (SELECT public.requesting_user_id()));

CREATE OR REPLACE FUNCTION public.touch_web_push_subscriptions_updated_at()
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

DROP TRIGGER IF EXISTS trg_touch_web_push_subscriptions_updated_at ON public.web_push_subscriptions;
CREATE TRIGGER trg_touch_web_push_subscriptions_updated_at
BEFORE UPDATE ON public.web_push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.touch_web_push_subscriptions_updated_at();

CREATE OR REPLACE FUNCTION public.send_web_push_for_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  worker_token text;
  worker_url text;
  request_id bigint;
  notification_body text;
BEGIN
  IF TG_OP <> 'INSERT' OR NEW.user_id IS NULL OR NEW.is_read THEN
    RETURN NEW;
  END IF;

  IF NOT public.notification_push_enabled(NEW.user_id, NEW.type) THEN
    RETURN NEW;
  END IF;

  SELECT ds.decrypted_secret
  INTO worker_token
  FROM vault.decrypted_secrets ds
  WHERE ds.name = 'WEB_PUSH_WORKER_TOKEN'
  LIMIT 1;

  IF NULLIF(worker_token, '') IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ds.decrypted_secret
  INTO worker_url
  FROM vault.decrypted_secrets ds
  WHERE ds.name = 'WEB_PUSH_WORKER_URL'
  LIMIT 1;

  worker_url := COALESCE(
    NULLIF(worker_url, ''),
    'https://foquucurnwpqcvgqukpz.supabase.co/functions/v1/send-web-push'
  );

  notification_body := public.notification_push_body(NEW.user_id, NEW.body);

  SELECT net.http_post(
    url := worker_url,
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'notification_id', NEW.id,
      'type', NEW.type,
      'title', left(COALESCE(NEW.title, 'Kloak'), 120),
      'body', notification_body,
      'link', COALESCE(NEW.link, '/app')
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-token', worker_token
    ),
    timeout_milliseconds := 2000
  )
  INTO request_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.send_web_push_for_notification() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_send_web_push_for_notification ON public.notifications;
CREATE TRIGGER trg_send_web_push_for_notification
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.send_web_push_for_notification();

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;
