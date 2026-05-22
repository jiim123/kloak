ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'view_events';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'create_events';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'edit_own_events';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'edit_all_events';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'delete_events';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'rsvp_events';
