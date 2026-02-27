-- Block runtime API roles from publishing typing broadcasts directly to Realtime.
-- Typing events must flow through the server-validated edge function.

DROP POLICY IF EXISTS "typing_broadcast_insert_guard" ON realtime.messages;

CREATE POLICY "typing_broadcast_insert_guard"
ON realtime.messages
AS RESTRICTIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (
  topic IS NULL OR topic !~ '^typing:'
);
