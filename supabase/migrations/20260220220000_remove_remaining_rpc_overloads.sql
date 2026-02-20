-- Remove remaining overloaded RPC signatures that trigger PGRST203 hints.
-- Keep one canonical signature per function name.

-- 1) close_expired_polls: keep only close_expired_polls(_channel_id uuid)
DROP FUNCTION IF EXISTS public.close_expired_polls();

-- 2) create_server_role: keep only create_server_role(uuid, uuid, text, text, text)
DROP FUNCTION IF EXISTS public.create_server_role(uuid, uuid, text, text);

-- 3) transfer_ownership: keep only transfer_ownership(_server_id uuid, _new_owner_id uuid)
DROP FUNCTION IF EXISTS public.transfer_ownership(uuid, uuid, uuid);
