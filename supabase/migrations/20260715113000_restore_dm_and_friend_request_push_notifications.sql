-- Restore mobile push coverage for notification types that do not always flow
-- through channel mention paths. The mobile push trigger listens to
-- public.notifications inserts, so DM/friend request events must reliably create
-- notification rows first.

CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id uuid,
  _type public.notification_type,
  _title text,
  _body text DEFAULT NULL::text,
  _link text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  notification_id uuid;
BEGIN
  -- Friend request RPCs and friendship triggers can both touch this path during
  -- rollout. Reuse a very recent equivalent notification instead of duplicating.
  IF _type = 'friend_request'::public.notification_type THEN
    SELECT n.id
      INTO notification_id
    FROM public.notifications n
    WHERE n.user_id = _user_id
      AND n.type = _type
      AND n.title = _title
      AND COALESCE(n.body, '') = COALESCE(_body, '')
      AND n.created_at > now() - interval '2 minutes'
    ORDER BY n.created_at DESC
    LIMIT 1;

    IF notification_id IS NOT NULL THEN
      RETURN notification_id;
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (_user_id, _type, _title, _body, _link)
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_dm_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  sender_username text;
  recipient_record record;
BEGIN
  SELECT COALESCE(u.display_name, u.username, 'Someone')
    INTO sender_username
  FROM public.users u
  WHERE u.id = NEW.sender_id;

  FOR recipient_record IN
    SELECT dp.user_id
    FROM public.dm_participants dp
    WHERE dp.conversation_id = NEW.conversation_id
      AND dp.user_id <> NEW.sender_id
  LOOP
    -- Do not notify users who blocked or are blocked by the sender.
    IF EXISTS (
      SELECT 1
      FROM public.friendships f
      WHERE f.status = 'blocked'::public.friendship_status
        AND (
          (f.requester_id = NEW.sender_id AND f.addressee_id = recipient_record.user_id)
          OR (f.requester_id = recipient_record.user_id AND f.addressee_id = NEW.sender_id)
        )
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      recipient_record.user_id,
      'dm'::public.notification_type,
      'New message from ' || COALESCE(sender_username, 'Someone'),
      left(COALESCE(NEW.content, ''), 180),
      '/app?conversation=' || NEW.conversation_id::text || '&message=' || NEW.id::text
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dm_notification_trigger ON public.direct_messages;
CREATE TRIGGER dm_notification_trigger
AFTER INSERT ON public.direct_messages
FOR EACH ROW
EXECUTE FUNCTION public.trigger_dm_notification();

CREATE OR REPLACE FUNCTION public.trigger_friend_request_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  requester_username text;
BEGIN
  IF TG_OP <> 'INSERT'
     OR NEW.status <> 'pending'::public.friendship_status
     OR NEW.requester_id IS NULL
     OR NEW.addressee_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(u.username, u.display_name, 'Someone')
    INTO requester_username
  FROM public.users u
  WHERE u.id = NEW.requester_id;

  PERFORM public.create_notification(
    NEW.addressee_id,
    'friend_request'::public.notification_type,
    'New Friend Request',
    COALESCE(requester_username, 'Someone') || ' sent you a friend request',
    '/app/friends'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS friendship_request_notification_trigger ON public.friendships;
CREATE TRIGGER friendship_request_notification_trigger
AFTER INSERT ON public.friendships
FOR EACH ROW
EXECUTE FUNCTION public.trigger_friend_request_notification();

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;
