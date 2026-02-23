-- Create table to store user's server folder organization
CREATE TABLE public.user_server_folders (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  folder_data JSONB NOT NULL DEFAULT '{"folders":[],"serverToFolder":{}}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add index for user lookups
CREATE INDEX idx_user_server_folders_user_id ON public.user_server_folders(user_id);

-- Add comment
COMMENT ON TABLE public.user_server_folders IS 'Stores each user''s server folder organization (synced across devices)';

-- RPC function to get user's folder state
CREATE OR REPLACE FUNCTION public.get_user_server_folders(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT folder_data INTO result
  FROM public.user_server_folders
  WHERE user_id = _user_id;
  
  -- Return default structure if no data found
  IF result IS NULL THEN
    RETURN '{"folders":[],"serverToFolder":{}}'::jsonb;
  END IF;
  
  RETURN result;
END;
$$;

-- RPC function to save user's folder state
CREATE OR REPLACE FUNCTION public.save_user_server_folders(_user_id UUID, _folder_data JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Upsert the folder data
  INSERT INTO public.user_server_folders (user_id, folder_data, updated_at)
  VALUES (_user_id, _folder_data, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    folder_data = EXCLUDED.folder_data,
    updated_at = now();
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.user_server_folders TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_server_folders TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_user_server_folders TO authenticated;
