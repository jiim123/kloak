-- Public, denormalized emoji render index.
-- This avoids cross-server rendering depending on server_emojis RLS.

CREATE TABLE IF NOT EXISTS public.emoji_render_variants (
  emoji_id uuid PRIMARY KEY REFERENCES public.server_emojis(id) ON DELETE CASCADE,
  name text NOT NULL,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  server_name text NOT NULL,
  file_path text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_emoji_render_variants_name_created
  ON public.emoji_render_variants (name, created_at, emoji_id);

CREATE INDEX IF NOT EXISTS idx_emoji_render_variants_name_server_name_created
  ON public.emoji_render_variants (name, server_name, created_at, emoji_id);

CREATE INDEX IF NOT EXISTS idx_emoji_render_variants_server_id
  ON public.emoji_render_variants (server_id);

ALTER TABLE public.emoji_render_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "emoji_render_variants_public_read" ON public.emoji_render_variants;
CREATE POLICY "emoji_render_variants_public_read"
ON public.emoji_render_variants
FOR SELECT
TO anon, authenticated
USING (true);

REVOKE ALL ON public.emoji_render_variants FROM PUBLIC;
GRANT SELECT ON public.emoji_render_variants TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_emoji_render_variant(_emoji_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  DELETE FROM public.emoji_render_variants
  WHERE emoji_id = _emoji_id;

  INSERT INTO public.emoji_render_variants (
    emoji_id,
    name,
    server_id,
    server_name,
    file_path,
    created_at
  )
  SELECT
    se.id,
    se.name,
    se.server_id,
    s.name,
    se.file_path,
    se.created_at
  FROM public.server_emojis se
  JOIN public.servers s ON s.id = se.server_id
  WHERE se.id = _emoji_id
  ON CONFLICT (emoji_id) DO UPDATE
  SET
    name = EXCLUDED.name,
    server_id = EXCLUDED.server_id,
    server_name = EXCLUDED.server_name,
    file_path = EXCLUDED.file_path,
    created_at = EXCLUDED.created_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_emoji_render_variants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.emoji_render_variants
    WHERE emoji_id = OLD.id;
    RETURN OLD;
  END IF;

  PERFORM public.refresh_emoji_render_variant(NEW.id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_emoji_render_variants ON public.server_emojis;
CREATE TRIGGER trg_sync_emoji_render_variants
AFTER INSERT OR UPDATE OF name, server_id, file_path ON public.server_emojis
FOR EACH ROW
EXECUTE FUNCTION public.sync_emoji_render_variants();

CREATE OR REPLACE FUNCTION public.sync_emoji_render_variants_for_server_rename()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.emoji_render_variants
  SET server_name = NEW.name
  WHERE server_id = NEW.id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_emoji_render_variants_server_rename ON public.servers;
CREATE TRIGGER trg_sync_emoji_render_variants_server_rename
AFTER UPDATE OF name ON public.servers
FOR EACH ROW
WHEN (OLD.name IS DISTINCT FROM NEW.name)
EXECUTE FUNCTION public.sync_emoji_render_variants_for_server_rename();

INSERT INTO public.emoji_render_variants (
  emoji_id,
  name,
  server_id,
  server_name,
  file_path,
  created_at
)
SELECT
  se.id,
  se.name,
  se.server_id,
  s.name,
  se.file_path,
  se.created_at
FROM public.server_emojis se
JOIN public.servers s ON s.id = se.server_id
ON CONFLICT (emoji_id) DO UPDATE
SET
  name = EXCLUDED.name,
  server_id = EXCLUDED.server_id,
  server_name = EXCLUDED.server_name,
  file_path = EXCLUDED.file_path,
  created_at = EXCLUDED.created_at;
