-- Create task_status enum
CREATE TYPE public.task_status AS ENUM ('open', 'in_progress', 'completed', 'archived');

-- Create task_priority enum
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high');

-- Tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'open',
  priority task_priority,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Task assignees table (many-to-many)
CREATE TABLE public.task_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, user_id)
);

-- Task comments table
CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  edited_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX idx_tasks_channel_id ON public.tasks(channel_id);
CREATE INDEX idx_tasks_server_id ON public.tasks(server_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_task_assignees_task_id ON public.task_assignees(task_id);
CREATE INDEX idx_task_assignees_user_id ON public.task_assignees(user_id);
CREATE INDEX idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX idx_task_comments_user_id ON public.task_comments(user_id);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for tasks (permissive for custom auth system)
CREATE POLICY "Tasks are viewable" ON public.tasks
  FOR SELECT USING (true);

CREATE POLICY "Tasks can be inserted" ON public.tasks
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Tasks can be updated" ON public.tasks
  FOR UPDATE USING (true);

CREATE POLICY "Tasks can be deleted" ON public.tasks
  FOR DELETE USING (true);

-- RLS policies for task_assignees
CREATE POLICY "Task assignees are viewable" ON public.task_assignees
  FOR SELECT USING (true);

CREATE POLICY "Task assignees can be inserted" ON public.task_assignees
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Task assignees can be deleted" ON public.task_assignees
  FOR DELETE USING (true);

-- RLS policies for task_comments
CREATE POLICY "Task comments are viewable" ON public.task_comments
  FOR SELECT USING (true);

CREATE POLICY "Task comments can be inserted" ON public.task_comments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Task comments can be updated" ON public.task_comments
  FOR UPDATE USING (true);

CREATE POLICY "Task comments can be deleted" ON public.task_comments
  FOR DELETE USING (true);

-- Enable realtime
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.task_assignees REPLICA IDENTITY FULL;
ALTER TABLE public.task_comments REPLICA IDENTITY FULL;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_task_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at
CREATE TRIGGER update_task_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_task_updated_at();
