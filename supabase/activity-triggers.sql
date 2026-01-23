-- =====================================================
-- ACTIVITY LOG TRIGGERS
-- Automatically logs all company activities for the feed
-- =====================================================

-- First, ensure the activity_log table exists
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type TEXT NOT NULL,
  entity_type TEXT NULL,
  entity_id UUID NULL,
  entity_name TEXT NULL,
  user_id UUID NOT NULL,
  client_id UUID NULL,
  metadata JSONB NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies and recreate
DROP POLICY IF EXISTS "Activity log readable by authenticated users" ON public.activity_log;
CREATE POLICY "Activity log readable by authenticated users"
  ON public.activity_log FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Activity log insert by authenticated users" ON public.activity_log;
CREATE POLICY "Activity log insert by authenticated users"
  ON public.activity_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_client_id ON public.activity_log(client_id);

-- =====================================================
-- 1. TICKET ACTIVITIES
-- =====================================================

-- Log when tickets are created
CREATE OR REPLACE FUNCTION log_ticket_created()
RETURNS TRIGGER AS $$
DECLARE
  v_client_name TEXT;
  v_client_id UUID;
BEGIN
  -- Get client_id through board
  IF NEW.board_id IS NOT NULL THEN
    SELECT client_id INTO v_client_id FROM public.boards WHERE id = NEW.board_id;
  END IF;
  
  -- Get client name if we have a client_id
  IF v_client_id IS NOT NULL THEN
    SELECT name INTO v_client_name FROM public.clients WHERE id = v_client_id;
  END IF;
  
  INSERT INTO public.activity_log (
    activity_type,
    entity_type,
    entity_id,
    entity_name,
    user_id,
    client_id,
    metadata
  ) VALUES (
    'ticket_created',
    'ticket',
    NEW.id,
    NEW.title,
    COALESCE(NEW.created_by, auth.uid()),
    v_client_id,
    jsonb_build_object(
      'ticket_id', NEW.ticket_id,
      'priority', NEW.priority,
      'client_name', v_client_name
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Activity log error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_ticket_created ON public.tickets;
CREATE TRIGGER trigger_log_ticket_created
  AFTER INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION log_ticket_created();

-- Log when ticket status changes
CREATE OR REPLACE FUNCTION log_ticket_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_client_id UUID;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get client_id through board
    IF NEW.board_id IS NOT NULL THEN
      SELECT client_id INTO v_client_id FROM public.boards WHERE id = NEW.board_id;
    END IF;
    
    INSERT INTO public.activity_log (
      activity_type,
      entity_type,
      entity_id,
      entity_name,
      user_id,
      client_id,
      metadata
    ) VALUES (
      'status_changed',
      'ticket',
      NEW.id,
      NEW.title,
      COALESCE(auth.uid(), NEW.assigned_to, NEW.created_by),
      v_client_id,
      jsonb_build_object(
        'ticket_id', NEW.ticket_id,
        'from_status', OLD.status,
        'to_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Activity log error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_ticket_status ON public.tickets;
CREATE TRIGGER trigger_log_ticket_status
  AFTER UPDATE OF status ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION log_ticket_status_change();

-- Log when ticket is completed (status = 'done')
CREATE OR REPLACE FUNCTION log_ticket_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_client_id UUID;
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN
    IF NEW.board_id IS NOT NULL THEN
      SELECT client_id INTO v_client_id FROM public.boards WHERE id = NEW.board_id;
    END IF;
    
    INSERT INTO public.activity_log (
      activity_type,
      entity_type,
      entity_id,
      entity_name,
      user_id,
      client_id,
      metadata
    ) VALUES (
      'ticket_completed',
      'ticket',
      NEW.id,
      NEW.title,
      COALESCE(auth.uid(), NEW.assigned_to, NEW.created_by),
      v_client_id,
      jsonb_build_object(
        'ticket_id', NEW.ticket_id
      )
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Activity log error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_ticket_completed ON public.tickets;
CREATE TRIGGER trigger_log_ticket_completed
  AFTER UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION log_ticket_completed();

-- Log when ticket is assigned
CREATE OR REPLACE FUNCTION log_ticket_assigned()
RETURNS TRIGGER AS $$
DECLARE
  v_assignee_name TEXT;
  v_client_id UUID;
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to) THEN
    SELECT full_name INTO v_assignee_name FROM public.profiles WHERE id = NEW.assigned_to;
    
    IF NEW.board_id IS NOT NULL THEN
      SELECT client_id INTO v_client_id FROM public.boards WHERE id = NEW.board_id;
    END IF;
    
    INSERT INTO public.activity_log (
      activity_type,
      entity_type,
      entity_id,
      entity_name,
      user_id,
      client_id,
      metadata
    ) VALUES (
      'assigned',
      'ticket',
      NEW.id,
      NEW.title,
      COALESCE(auth.uid(), NEW.created_by),
      v_client_id,
      jsonb_build_object(
        'ticket_id', NEW.ticket_id,
        'assigned_to', NEW.assigned_to,
        'assignee_name', v_assignee_name
      )
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Activity log error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_ticket_assigned ON public.tickets;
CREATE TRIGGER trigger_log_ticket_assigned
  AFTER UPDATE OF assigned_to ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION log_ticket_assigned();

-- =====================================================
-- 2. COMMENT ACTIVITIES
-- =====================================================

CREATE OR REPLACE FUNCTION log_comment_added()
RETURNS TRIGGER AS $$
DECLARE
  v_ticket RECORD;
  v_client_id UUID;
BEGIN
  SELECT id, title, ticket_id, board_id INTO v_ticket
  FROM public.tickets WHERE id = NEW.ticket_id;
  
  IF v_ticket.board_id IS NOT NULL THEN
    SELECT client_id INTO v_client_id FROM public.boards WHERE id = v_ticket.board_id;
  END IF;
  
  INSERT INTO public.activity_log (
    activity_type,
    entity_type,
    entity_id,
    entity_name,
    user_id,
    client_id,
    metadata
  ) VALUES (
    'comment_added',
    'ticket',
    v_ticket.id,
    v_ticket.title,
    NEW.user_id,
    v_client_id,
    jsonb_build_object(
      'ticket_id', v_ticket.ticket_id,
      'comment_preview', LEFT(NEW.content, 100)
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Activity log error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_comment_added ON public.comments;
CREATE TRIGGER trigger_log_comment_added
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION log_comment_added();

-- =====================================================
-- 3. TIME TRACKING ACTIVITIES
-- Gets client through ticket -> board relationship only
-- =====================================================

CREATE OR REPLACE FUNCTION log_time_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_ticket RECORD;
  v_client_name TEXT;
  v_client_id UUID;
  v_minutes INT;
  v_entity_name TEXT;
BEGIN
  v_minutes := COALESCE(NEW.minutes, NEW.duration_minutes, 0);
  
  -- Only log when time entry is stopped (has minutes > 0)
  IF NEW.is_running = false AND v_minutes > 0 THEN
    -- Get ticket info if available
    IF NEW.ticket_id IS NOT NULL THEN
      SELECT id, title, ticket_id, board_id INTO v_ticket FROM public.tickets WHERE id = NEW.ticket_id;
      v_entity_name := v_ticket.title;
      
      IF v_ticket.board_id IS NOT NULL THEN
        SELECT client_id INTO v_client_id FROM public.boards WHERE id = v_ticket.board_id;
      END IF;
    END IF;
    
    -- Fallback entity name
    IF v_entity_name IS NULL THEN
      v_entity_name := COALESCE(NEW.description, 'Time entry');
    END IF;
    
    -- Get client name
    IF v_client_id IS NOT NULL THEN
      SELECT name INTO v_client_name FROM public.clients WHERE id = v_client_id;
    END IF;
    
    INSERT INTO public.activity_log (
      activity_type,
      entity_type,
      entity_id,
      entity_name,
      user_id,
      client_id,
      metadata
    ) VALUES (
      'time_logged',
      'time_entry',
      NEW.id,
      v_entity_name,
      NEW.user_id,
      v_client_id,
      jsonb_build_object(
        'minutes', v_minutes,
        'ticket_id', v_ticket.ticket_id,
        'billable', COALESCE(NEW.billable, true)
      )
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Activity log error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on INSERT (for manual entries) and UPDATE (for stopping running timers)
DROP TRIGGER IF EXISTS trigger_log_time_entry_insert ON public.time_entries;
CREATE TRIGGER trigger_log_time_entry_insert
  AFTER INSERT ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION log_time_entry();

DROP TRIGGER IF EXISTS trigger_log_time_entry_update ON public.time_entries;
CREATE TRIGGER trigger_log_time_entry_update
  AFTER UPDATE ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION log_time_entry();

-- =====================================================
-- 4. CLIENT ACTIVITIES
-- =====================================================

CREATE OR REPLACE FUNCTION log_client_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.activity_log (
    activity_type,
    entity_type,
    entity_id,
    entity_name,
    user_id,
    client_id,
    metadata
  ) VALUES (
    'client_created',
    'client',
    NEW.id,
    NEW.name,
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    NEW.id,
    jsonb_build_object(
      'slug', NEW.slug,
      'monthly_hours', NEW.monthly_hours
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Activity log error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_client_created ON public.clients;
CREATE TRIGGER trigger_log_client_created
  AFTER INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION log_client_created();

-- =====================================================
-- 5. BOARD ACTIVITIES
-- =====================================================

CREATE OR REPLACE FUNCTION log_board_created()
RETURNS TRIGGER AS $$
DECLARE
  v_client_name TEXT;
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
  END IF;
  
  INSERT INTO public.activity_log (
    activity_type,
    entity_type,
    entity_id,
    entity_name,
    user_id,
    client_id,
    metadata
  ) VALUES (
    'board_created',
    'board',
    NEW.id,
    NEW.name,
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    NEW.client_id,
    jsonb_build_object(
      'client_name', v_client_name
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Activity log error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_board_created ON public.boards;
CREATE TRIGGER trigger_log_board_created
  AFTER INSERT ON public.boards
  FOR EACH ROW
  EXECUTE FUNCTION log_board_created();

-- =====================================================
-- DONE - Run this in Supabase SQL Editor
-- =====================================================
