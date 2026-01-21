-- Extend the color column in server_roles to support gradient strings
-- Change from CHAR(7) to VARCHAR(255) to accommodate linear-gradient() syntax

ALTER TABLE public.server_roles 
ALTER COLUMN color TYPE VARCHAR(255);

-- Update the default value to still be the standard Discord blue
ALTER TABLE public.server_roles 
ALTER COLUMN color SET DEFAULT '#5865F2';

-- Add a comment explaining the column now supports both solid colors and gradients
COMMENT ON COLUMN public.server_roles.color IS 'Role color - can be a hex color (#5865F2) or a CSS gradient (linear-gradient(135deg, #667eea, #764ba2))';
