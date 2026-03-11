-- Move user/server scoped realtime paths off Postgres Changes and onto Broadcast topics.

CREATE OR REPLACE FUNCTION public.broadcast_user_notification_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _user_id uuid;
  _payload jsonb;
BEGIN
  _user_id := COALESCE(NEW.user_id, OLD.user_id);
  IF _user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    _payload := jsonb_build_object(
      'op', TG_OP,
      'old', jsonb_build_object(
        'id', OLD.id,
        'user_id', OLD.user_id
      )
    );
  ELSE
    _payload := jsonb_build_object(
      'op', TG_OP,
      'new', jsonb_build_object(
        'id', NEW.id,
        'user_id', NEW.user_id,
        'type', NEW.type,
        'title', NEW.title,
        'body', NEW.body,
        'link', NEW.link,
        'is_read', NEW.is_read,
        'created_at', NEW.created_at
      )
    );
  END IF;

  PERFORM realtime.send(_payload, 'notifications', 'user:' || _user_id::text, false);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_user_preferences_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _user_id uuid;
  _payload jsonb;
BEGIN
  _user_id := COALESCE(NEW.user_id, OLD.user_id);
  IF _user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  _payload := jsonb_build_object(
    'op', TG_OP,
    'new', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    'old', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END
  );

  PERFORM realtime.send(_payload, 'preferences', 'user:' || _user_id::text, false);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_user_voice_settings_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _user_id uuid;
  _payload jsonb;
BEGIN
  _user_id := COALESCE(NEW.user_id, OLD.user_id);
  IF _user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  _payload := jsonb_build_object(
    'op', TG_OP,
    'new', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    'old', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END
  );

  PERFORM realtime.send(_payload, 'voice_settings', 'user:' || _user_id::text, false);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_friendship_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _requester_id uuid;
  _addressee_id uuid;
  _payload jsonb;
BEGIN
  _requester_id := COALESCE(NEW.requester_id, OLD.requester_id);
  _addressee_id := COALESCE(NEW.addressee_id, OLD.addressee_id);

  _payload := jsonb_build_object(
    'op', TG_OP,
    'new', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE jsonb_build_object(
      'id', NEW.id,
      'requester_id', NEW.requester_id,
      'addressee_id', NEW.addressee_id,
      'status', NEW.status,
      'created_at', NEW.created_at
    ) END,
    'old', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE jsonb_build_object(
      'id', OLD.id,
      'requester_id', OLD.requester_id,
      'addressee_id', OLD.addressee_id,
      'status', OLD.status,
      'created_at', OLD.created_at
    ) END
  );

  IF _requester_id IS NOT NULL THEN
    PERFORM realtime.send(_payload, 'friendships', 'user:' || _requester_id::text, false);
  END IF;

  IF _addressee_id IS NOT NULL AND _addressee_id IS DISTINCT FROM _requester_id THEN
    PERFORM realtime.send(_payload, 'friendships', 'user:' || _addressee_id::text, false);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_server_emoji_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _server_id uuid;
  _payload jsonb;
BEGIN
  _server_id := COALESCE(NEW.server_id, OLD.server_id);
  IF _server_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  _payload := jsonb_build_object(
    'op', TG_OP,
    'new', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE jsonb_build_object(
      'id', NEW.id,
      'server_id', NEW.server_id,
      'name', NEW.name,
      'file_path', NEW.file_path
    ) END,
    'old', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE jsonb_build_object(
      'id', OLD.id,
      'server_id', OLD.server_id,
      'name', OLD.name,
      'file_path', OLD.file_path
    ) END
  );

  PERFORM realtime.send(_payload, 'server_emojis', 'server:' || _server_id::text, false);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_user_server_membership_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _user_id uuid;
  _payload jsonb;
BEGIN
  _user_id := COALESCE(NEW.user_id, OLD.user_id);
  IF _user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  _payload := jsonb_build_object(
    'op', TG_OP,
    'new', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE jsonb_build_object(
      'id', NEW.id,
      'server_id', NEW.server_id,
      'user_id', NEW.user_id,
      'is_banned', NEW.is_banned
    ) END,
    'old', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE jsonb_build_object(
      'id', OLD.id,
      'server_id', OLD.server_id,
      'user_id', OLD.user_id,
      'is_banned', OLD.is_banned
    ) END
  );

  PERFORM realtime.send(_payload, 'server_membership', 'user:' || _user_id::text, false);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_user_notification_change ON public.notifications;
CREATE TRIGGER trg_broadcast_user_notification_change
AFTER INSERT OR UPDATE OR DELETE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_user_notification_change();

DROP TRIGGER IF EXISTS trg_broadcast_user_preferences_change ON public.user_preferences;
CREATE TRIGGER trg_broadcast_user_preferences_change
AFTER INSERT OR UPDATE OR DELETE ON public.user_preferences
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_user_preferences_change();

DROP TRIGGER IF EXISTS trg_broadcast_user_voice_settings_change ON public.user_voice_settings;
CREATE TRIGGER trg_broadcast_user_voice_settings_change
AFTER INSERT OR UPDATE OR DELETE ON public.user_voice_settings
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_user_voice_settings_change();

DROP TRIGGER IF EXISTS trg_broadcast_friendship_change ON public.friendships;
CREATE TRIGGER trg_broadcast_friendship_change
AFTER INSERT OR UPDATE OR DELETE ON public.friendships
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_friendship_change();

DROP TRIGGER IF EXISTS trg_broadcast_server_emoji_change ON public.server_emojis;
CREATE TRIGGER trg_broadcast_server_emoji_change
AFTER INSERT OR UPDATE OR DELETE ON public.server_emojis
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_server_emoji_change();

DROP TRIGGER IF EXISTS trg_broadcast_user_server_membership_change ON public.server_members;
CREATE TRIGGER trg_broadcast_user_server_membership_change
AFTER INSERT OR UPDATE OR DELETE ON public.server_members
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_user_server_membership_change();

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;
