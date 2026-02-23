-- Custom server emojis (upload + name)
-- Note: This project uses a custom auth system; auth.uid() is not available.

-- Storage bucket for server emojis (public URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('server-emojis', 'server-emojis', true)
ON CONFLICT (id) DO NOTHING;

-- Publicly accessible server emojis
DROP POLICY IF EXISTS "Server emojis are publicly accessible" ON storage.objects;
CREATE POLICY "Server emojis are publicly accessible" ON storage.objects
FOR SELECT USING (bucket_id = 'server-emojis');

-- Allow uploads/updates/deletes for custom auth flow (UI restricts to owners)
DROP POLICY IF EXISTS "Allow server emoji uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow server emoji updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow server emoji deletes" ON storage.objects;

CREATE POLICY "Allow server emoji uploads" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'server-emojis');

CREATE POLICY "Allow server emoji updates" ON storage.objects
FOR UPDATE USING (bucket_id = 'server-emojis');

CREATE POLICY "Allow server emoji deletes" ON storage.objects
FOR DELETE USING (bucket_id = 'server-emojis');

-- Server emojis table
CREATE TABLE IF NOT EXISTS public.server_emojis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_path text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enforce unique names per server
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'server_emojis_server_id_name_key'
  ) THEN
    ALTER TABLE public.server_emojis
      ADD CONSTRAINT server_emojis_server_id_name_key UNIQUE (server_id, name);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS server_emojis_server_id_idx ON public.server_emojis(server_id);

-- RLS: permissive policies (consistent with custom-auth patterns in this project)
ALTER TABLE public.server_emojis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Server emojis are viewable" ON public.server_emojis;
CREATE POLICY "Server emojis are viewable" ON public.server_emojis
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Server emojis can be inserted" ON public.server_emojis;
CREATE POLICY "Server emojis can be inserted" ON public.server_emojis
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Server emojis can be updated" ON public.server_emojis;
CREATE POLICY "Server emojis can be updated" ON public.server_emojis
FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Server emojis can be deleted" ON public.server_emojis;
CREATE POLICY "Server emojis can be deleted" ON public.server_emojis
FOR DELETE USING (true);

