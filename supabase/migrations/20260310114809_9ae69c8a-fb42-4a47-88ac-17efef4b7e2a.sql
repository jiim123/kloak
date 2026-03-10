
-- =====================================================================
-- PART 1: Rate-limit helper functions for reactions, friendships, etc.
-- =====================================================================

-- Generic per-user rate limiter (reusable across tables)
CREATE OR REPLACE FUNCTION public.check_generic_rate_limit(_user_id uuid, _table_name text, _max_per_minute int)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE cnt int;
BEGIN
  EXECUTE format(
    'SELECT count(*) FROM public.%I WHERE user_id = $1 AND created_at > now() - interval ''1 minute''',
    _table_name
  ) INTO cnt USING _user_id;
  RETURN cnt < _max_per_minute;
END;
$$;

-- Reaction rate limit (20/min) — checks reactions table
CREATE OR REPLACE FUNCTION public.check_reaction_rate_limit(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ DECLARE cnt int; BEGIN
  SELECT count(*) INTO cnt FROM public.reactions WHERE user_id = _user_id AND id IN (
    SELECT id FROM public.reactions WHERE user_id = _user_id ORDER BY id DESC LIMIT 30
  );
  -- Simpler: just count recent
  SELECT count(*) INTO cnt FROM public.reactions r
    WHERE r.user_id = _user_id
    AND r.id > (SELECT COALESCE(
      (SELECT r2.id FROM public.reactions r2 WHERE r2.user_id = _user_id ORDER BY r2.id ASC LIMIT 1),
      '00000000-0000-0000-0000-000000000000'::uuid
    ));
  -- Actually just use a timestamp approach via created_at proxy
  RETURN true; -- will be replaced below
END; $$;

-- Drop and recreate properly
DROP FUNCTION IF EXISTS public.check_reaction_rate_limit(uuid);
