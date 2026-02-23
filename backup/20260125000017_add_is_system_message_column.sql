-- Add is_system_message column to messages table
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS is_system_message BOOLEAN DEFAULT false;

-- Create index for system messages if needed
CREATE INDEX IF NOT EXISTS idx_messages_is_system_message ON public.messages(is_system_message) WHERE is_system_message = true;
