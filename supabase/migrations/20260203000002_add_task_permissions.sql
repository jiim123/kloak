-- Add task-specific permissions to permission_type enum
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'view_tasks';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'create_tasks';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'edit_own_tasks';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'edit_all_tasks';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'assign_tasks';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'change_task_status';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'delete_tasks';
