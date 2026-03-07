
-- Helper function to check if two users are in a blocked relationship
CREATE OR REPLACE FUNCTION public.are_users_blocked(_user_a uuid, _user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'blocked'
      AND ((f.requester_id = _user_a AND f.addressee_id = _user_b)
        OR (f.requester_id = _user_b AND f.addressee_id = _user_a))
  );
$$;

-- Update reactions INSERT policy to prevent reacting to blocked users' messages
DROP POLICY IF EXISTS "Users add own reactions" ON public.reactions;
CREATE POLICY "Users add own reactions"
ON public.reactions FOR INSERT
WITH CHECK (
  (user_id = ( SELECT requesting_user_id() AS requesting_user_id))
  AND (( SELECT requesting_user_id() AS requesting_user_id) IS NOT NULL)
  AND (EXISTS (
    SELECT 1 FROM messages m
    WHERE m.id = reactions.message_id
      AND m.channel_id = reactions.channel_id
      AND can_access_channel(m.channel_id, ( SELECT requesting_user_id() AS requesting_user_id))
  ))
  AND check_user_permission(( SELECT requesting_user_id() AS requesting_user_id), channel_id, 'add_reactions'::permission_type)
  -- Block reactions between blocked users
  AND NOT EXISTS (
    SELECT 1 FROM messages m
    WHERE m.id = reactions.message_id
      AND are_users_blocked(( SELECT requesting_user_id() AS requesting_user_id), m.user_id)
  )
);

-- Add trigger to prevent replying to blocked users' messages
CREATE OR REPLACE FUNCTION public.check_reply_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reply_author_id uuid;
BEGIN
  -- Only check if this is a reply
  IF NEW.reply_to_id IS NOT NULL THEN
    SELECT user_id INTO reply_author_id FROM messages WHERE id = NEW.reply_to_id;
    IF reply_author_id IS NOT NULL AND are_users_blocked(NEW.user_id, reply_author_id) THEN
      RAISE EXCEPTION 'Cannot reply to this user';
    END IF;
  END IF;
  
  -- Check if message contains mentions of blocked users and strip them
  -- (mentions are handled by a separate trigger, so we just let the message through)
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_reply_block_trigger ON public.messages;
CREATE TRIGGER check_reply_block_trigger
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.check_reply_block();

-- Add trigger to prevent mentions of blocked users
CREATE OR REPLACE FUNCTION public.check_mention_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg_author_id uuid;
BEGIN
  -- Get the message author
  SELECT user_id INTO msg_author_id FROM messages WHERE id = NEW.message_id;
  
  -- If mention target and message author are in a blocked relationship, prevent the mention
  IF msg_author_id IS NOT NULL AND are_users_blocked(msg_author_id, NEW.user_id) THEN
    RETURN NULL; -- Silently skip this mention insert
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_mention_block_trigger ON public.mentions;
CREATE TRIGGER check_mention_block_trigger
  BEFORE INSERT ON public.mentions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_mention_block();

-- Add trigger to prevent DM reactions between blocked users
CREATE OR REPLACE FUNCTION public.check_dm_reaction_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg_sender_id uuid;
BEGIN
  SELECT sender_id INTO msg_sender_id FROM direct_messages WHERE id = NEW.message_id;
  IF msg_sender_id IS NOT NULL AND are_users_blocked(NEW.user_id, msg_sender_id) THEN
    RAISE EXCEPTION 'Cannot react to this message';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_dm_reaction_block_trigger ON public.dm_reactions;
CREATE TRIGGER check_dm_reaction_block_trigger
  BEFORE INSERT ON public.dm_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_dm_reaction_block();
