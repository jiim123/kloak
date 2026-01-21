-- Polls feature: tables + RPCs

-- =========================
-- Tables
-- =========================

CREATE TABLE IF NOT EXISTS public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid UNIQUE NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  options text[] NOT NULL,
  allow_multiple boolean NOT NULL DEFAULT false,
  ends_at timestamptz NOT NULL,
  is_closed boolean NOT NULL DEFAULT false,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_votes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_polls_channel_id ON public.polls(channel_id);
CREATE INDEX IF NOT EXISTS idx_polls_message_id ON public.polls(message_id);
CREATE INDEX IF NOT EXISTS idx_polls_ends_at ON public.polls(ends_at);

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  option_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id, option_index)
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON public.poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user_id ON public.poll_votes(user_id);

-- Enable RLS (reads are permissive like the rest of the app; writes are done via RPCs)
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Polls are viewable" ON public.polls;
CREATE POLICY "Polls are viewable" ON public.polls
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Poll votes are viewable" ON public.poll_votes;
CREATE POLICY "Poll votes are viewable" ON public.poll_votes
  FOR SELECT USING (true);

-- Realtime publication (polls only; votes are aggregated into polls.results via RPC)
ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;

-- =========================
-- Helpers
-- =========================

CREATE OR REPLACE FUNCTION public.recompute_poll_results(_poll_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- =========================
-- RPCs
-- =========================

CREATE OR REPLACE FUNCTION public.send_poll(
  _channel_id uuid,
  _user_id uuid,
  _question text,
  _options text[],
  _allow_multiple boolean DEFAULT false,
  _duration_seconds integer DEFAULT 1800,
  _reply_to_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.vote_poll(
  _poll_id uuid,
  _user_id uuid,
  _option_indexes integer[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.close_poll(
  _poll_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.polls
  SET is_closed = true
  WHERE id = _poll_id
    AND is_closed = false
    AND ends_at <= now();

  PERFORM public.recompute_poll_results(_poll_id);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_expired_polls(
  _channel_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer := 0;
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.polls
    WHERE channel_id = _channel_id
      AND is_closed = false
      AND ends_at <= now()
  LOOP
    UPDATE public.polls SET is_closed = true WHERE id = r.id;
    PERFORM public.recompute_poll_results(r.id);
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

