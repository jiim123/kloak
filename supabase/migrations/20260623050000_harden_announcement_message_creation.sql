-- Announcement posts use the normal messages table, but have a stricter shape:
-- a short title, a blank-line separator, and a body, with 2,000 characters total.
-- Enforce this below the client so direct RPC/table requests cannot bypass it.

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_announcement_message_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _channel_type public.channel_type;
  _normalized_content text;
  _separator_position integer;
  _title text;
  _body text;
  _request_user_id uuid;
BEGIN
  SELECT c.type
  INTO _channel_type
  FROM public.channels c
  WHERE c.id = NEW.channel_id;

  IF _channel_type IS DISTINCT FROM 'announcement'::public.channel_type THEN
    RETURN NEW;
  END IF;

  _request_user_id := public.requesting_user_id();

  -- Bind untrusted API writes to their authenticated identity. Trusted
  -- service-role jobs have no custom-auth request identity and remain usable.
  IF _request_user_id IS NOT NULL THEN
    IF _request_user_id <> NEW.user_id
       OR NOT public.check_user_permission(
         _request_user_id,
         NEW.channel_id,
         'send_messages'::public.permission_type
       )
       OR NOT public.check_user_permission(
         _request_user_id,
         NEW.channel_id,
         'manage_messages'::public.permission_type
       ) THEN
      RAISE EXCEPTION 'You do not have permission to post announcements';
    END IF;
  END IF;

  IF NEW.reply_to_id IS NOT NULL THEN
    RAISE EXCEPTION 'Announcements cannot be posted as message replies';
  END IF;

  _normalized_content := btrim(NEW.content);

  IF _normalized_content IS NULL OR char_length(_normalized_content) = 0 THEN
    RAISE EXCEPTION 'Announcement content cannot be empty';
  END IF;

  IF char_length(_normalized_content) > 2000 THEN
    RAISE EXCEPTION 'Announcement content cannot exceed 2000 characters';
  END IF;

  _separator_position := strpos(_normalized_content, E'\n\n');
  IF _separator_position <= 1 THEN
    RAISE EXCEPTION 'Announcements require a title and body';
  END IF;

  _title := btrim(substr(_normalized_content, 1, _separator_position - 1));
  _body := btrim(substr(_normalized_content, _separator_position + 2));

  IF _title = '' OR _body = '' THEN
    RAISE EXCEPTION 'Announcements require a title and body';
  END IF;

  IF _title ~ E'[\\r\\n]' THEN
    RAISE EXCEPTION 'Announcement titles must be a single line';
  END IF;

  IF char_length(_title) > 100 THEN
    RAISE EXCEPTION 'Announcement titles cannot exceed 100 characters';
  END IF;

  NEW.content := _title || E'\n\n' || _body;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_announcement_message_creation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_announcement_message_creation ON public.messages;
CREATE TRIGGER trg_enforce_announcement_message_creation
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_announcement_message_creation();

-- The application sends channel messages through the hardened RPC. Remove the
-- legacy direct-write privilege; SELECT remains available for guarded reads.
REVOKE INSERT ON TABLE public.messages FROM anon, authenticated;

-- CREATE FUNCTION grants PUBLIC execute by default. Keep only the intended API
-- roles, while verify_request_identity inside send_message binds calls to the
-- custom-auth request header.
REVOKE EXECUTE ON FUNCTION public.send_message(uuid, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_message(uuid, uuid, text, uuid)
  TO anon, authenticated, service_role;

COMMIT;
