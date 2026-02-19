-- ============================================
-- BACKFILL SHORT TICKET IDS (BC-1, BC-2 style)
-- Run this in Supabase SQL Editor after shorten-ticket-ids.sql
-- ============================================
-- Fixes tickets that have long or invalid ticket_id (e.g. 28c86aeb, BC-2joiewjro)
-- so all ticket_ids are short: PREFIX-N (2–3 letter prefix + hyphen + integer).

-- Pattern for valid short key: 2-3 letters, hyphen, digits only
-- e.g. BC-1, BRA-2, ADO-1

DO $$
DECLARE
  v_client RECORD;
  v_prefix TEXT;
  v_number INTEGER;
  v_ticket RECORD;
  v_max_used INTEGER;
BEGIN
  FOR v_client IN
    SELECT id, name,
      UPPER(LEFT(REGEXP_REPLACE(COALESCE(ticket_prefix, name, ''), '[^a-zA-Z]', '', 'g'), 3)) AS pre
    FROM public.clients
    WHERE id IN (SELECT DISTINCT client_id FROM public.tickets)
  LOOP
    v_prefix := v_client.pre;
    IF v_prefix = '' OR v_prefix IS NULL THEN v_prefix := 'TKT'; END IF;

    -- Max number already used in valid short keys (e.g. BC-1, BC-2) for this client
    SELECT COALESCE(MAX(SUBSTRING(ticket_id FROM '[0-9]+$')::INTEGER), 0) INTO v_max_used
    FROM public.tickets
    WHERE client_id = v_client.id
      AND ticket_id ~ '^[A-Z]{2,3}-[0-9]+$';

    v_number := v_max_used + 1;

    -- Reassign tickets that do NOT match short pattern to PREFIX-N (no collision)
    FOR v_ticket IN
      SELECT id
      FROM public.tickets
      WHERE client_id = v_client.id
        AND (ticket_id IS NULL OR ticket_id = '' OR ticket_id !~ '^[A-Z]{2,3}-[0-9]+$')
      ORDER BY created_at
    LOOP
      UPDATE public.tickets
      SET ticket_id = v_prefix || '-' || v_number
      WHERE id = v_ticket.id;

      v_number := v_number + 1;
    END LOOP;

    UPDATE public.clients
    SET next_ticket_number = GREATEST(COALESCE(next_ticket_number, 1), v_number)
    WHERE id = v_client.id;
  END LOOP;
END $$;

-- Sync ticket_counters if it exists (so schema path stays consistent)
DO $$
DECLARE
  v_client RECORD;
  v_prefix TEXT;
  v_max_num INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ticket_counters') THEN
    RETURN;
  END IF;

  FOR v_client IN
    SELECT c.id,
      UPPER(LEFT(REGEXP_REPLACE(COALESCE(c.ticket_prefix, c.name, ''), '[^a-zA-Z]', '', 'g'), 3)) AS pre
    FROM public.clients c
    WHERE c.id IN (SELECT DISTINCT client_id FROM public.tickets)
  LOOP
    v_prefix := COALESCE(v_client.pre, 'TKT');
    SELECT COALESCE(MAX(
      NULLIF(REGEXP_REPLACE(SUBSTRING(ticket_id FROM '[0-9]+$'), '[^0-9]', '', 'g'), '')::INTEGER
    ), 0) INTO v_max_num
    FROM public.tickets
    WHERE client_id = v_client.id AND ticket_id ~ '^[A-Z]{2,3}-[0-9]+$';

    INSERT INTO public.ticket_counters (client_id, prefix, current_number)
    VALUES (v_client.id, v_prefix, v_max_num)
    ON CONFLICT (client_id) DO UPDATE
    SET prefix = v_prefix,
        current_number = GREATEST(ticket_counters.current_number, v_max_num);
  END LOOP;
END $$;

SELECT 'Ticket IDs backfilled to short format (e.g. BC-1, BC-2).' AS status;
