-- Wake the server bot processor immediately whenever a bot event is queued.
-- This keeps basic flows low-latency while the queue remains available for
-- worker retries and catch-up processing.

CREATE OR REPLACE FUNCTION public.kick_server_bot_event_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    PERFORM public.process_server_bot_events(1, 5);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'server bot inline processing failed: %', SQLERRM;
  END;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_server_bot_event_queue_inline_process ON public.server_bot_event_queue;
CREATE TRIGGER trg_server_bot_event_queue_inline_process
AFTER INSERT ON public.server_bot_event_queue
FOR EACH STATEMENT
EXECUTE FUNCTION public.kick_server_bot_event_processing();

REVOKE EXECUTE ON FUNCTION public.kick_server_bot_event_processing() FROM PUBLIC;

SELECT public.process_server_bot_events(50, 100);
