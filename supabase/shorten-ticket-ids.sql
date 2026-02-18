-- ============================================
-- SHORTEN TICKET NUMBERS (max 3-char prefix)
-- Run this in Supabase SQL Editor
-- ============================================
-- Ticket IDs will be like "ADO-1", "BRA-2" instead of long prefixes.

-- 1. Trigger-based generator (clients.ticket_prefix / next_ticket_number)
-- ============================================
CREATE OR REPLACE FUNCTION generate_ticket_id()
RETURNS TRIGGER AS $$
DECLARE
  v_prefix TEXT;
  v_number INTEGER;
  v_ticket_id TEXT;
BEGIN
  SELECT 
    COALESCE(ticket_prefix, UPPER(LEFT(REGEXP_REPLACE(name, '[^a-zA-Z]', '', 'g'), 3))),
    COALESCE(next_ticket_number, 1)
  INTO v_prefix, v_number
  FROM public.clients
  WHERE id = NEW.client_id;

  -- Cap prefix at 3 chars for short ticket numbers
  v_prefix := UPPER(LEFT(REGEXP_REPLACE(COALESCE(v_prefix, ''), '[^a-zA-Z]', '', 'g'), 3));
  IF v_prefix = '' THEN v_prefix := 'TKT'; END IF;

  v_ticket_id := v_prefix || '-' || v_number;
  NEW.ticket_id := v_ticket_id;

  UPDATE public.clients
  SET next_ticket_number = v_number + 1
  WHERE id = NEW.client_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. get_next_ticket_id() helper (same 3-char cap)
-- ============================================
CREATE OR REPLACE FUNCTION get_next_ticket_id(p_client_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_number INTEGER;
BEGIN
  SELECT 
    COALESCE(ticket_prefix, UPPER(LEFT(REGEXP_REPLACE(name, '[^a-zA-Z]', '', 'g'), 3))),
    COALESCE(next_ticket_number, 1)
  INTO v_prefix, v_number
  FROM public.clients
  WHERE id = p_client_id;

  v_prefix := UPPER(LEFT(REGEXP_REPLACE(COALESCE(v_prefix, ''), '[^a-zA-Z]', '', 'g'), 3));
  IF v_prefix = '' THEN v_prefix := 'TKT'; END IF;

  RETURN v_prefix || '-' || v_number;
END;
$$ LANGUAGE plpgsql;

-- 3. ticket_counters-based generator (schema path) – cap prefix at 3 chars
-- ============================================
CREATE OR REPLACE FUNCTION generate_ticket_id(p_client_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_number INTEGER;
  v_ticket_id TEXT;
BEGIN
  INSERT INTO public.ticket_counters (client_id, prefix, current_number)
  SELECT p_client_id, UPPER(LEFT(REGEXP_REPLACE(COALESCE(c.slug, c.name, ''), '[^a-zA-Z0-9]', '', 'g'), 3)), 0
  FROM public.clients c WHERE c.id = p_client_id
  ON CONFLICT (client_id) DO NOTHING;

  UPDATE public.ticket_counters
  SET current_number = current_number + 1
  WHERE client_id = p_client_id
  RETURNING prefix, current_number INTO v_prefix, v_number;

  IF v_prefix IS NULL THEN
    v_prefix := 'TKT';
    v_number := FLOOR(RANDOM() * 10000)::INTEGER;
  END IF;

  -- Always output max 3-char prefix
  v_ticket_id := UPPER(LEFT(REGEXP_REPLACE(v_prefix, '[^a-zA-Z]', '', 'g'), 3)) || '-' || v_number;
  IF LEFT(v_ticket_id, 1) = '-' THEN v_ticket_id := 'TKT-' || v_number; END IF;
  RETURN v_ticket_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Shorten existing client prefixes (for future ticket creation)
-- ============================================
UPDATE public.clients
SET ticket_prefix = UPPER(LEFT(REGEXP_REPLACE(COALESCE(ticket_prefix, name, ''), '[^a-zA-Z]', '', 'g'), 3))
WHERE ticket_prefix IS NULL OR LENGTH(REGEXP_REPLACE(ticket_prefix, '[^a-zA-Z]', '', 'g')) > 3;

-- 5. Shorten existing ticket_counters prefixes (for schema path)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ticket_counters') THEN
    UPDATE public.ticket_counters
    SET prefix = UPPER(LEFT(REGEXP_REPLACE(COALESCE(prefix, ''), '[^a-zA-Z]', '', 'g'), 3))
    WHERE prefix IS NULL OR LENGTH(REGEXP_REPLACE(prefix, '[^a-zA-Z]', '', 'g')) > 3;
  END IF;
END $$;

SELECT 'Ticket IDs shortened to max 3-char prefix (e.g. ADO-1, BRA-2).' AS status;
