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
BEGIN
  -- Get client name
  SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
  
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
    NEW.client_id,
    jsonb_build_object(
      'ticket_id', NEW.ticket_id,
      'priority', NEW.priority,
      'client_name', v_client_name
    )
  );
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
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
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
      NEW.client_id,
      jsonb_build_object(
        'ticket_id', NEW.ticket_id,
        'from_status', OLD.status,
        'to_status', NEW.status
      )
    );
  END IF;
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
BEGIN
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
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
      NEW.client_id,
      jsonb_build_object(
        'ticket_id', NEW.ticket_id
      )
    );
  END IF;
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
BEGIN
  IF NEW.assigned_to IS NOT NULL AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    SELECT full_name INTO v_assignee_name FROM public.profiles WHERE id = NEW.assigned_to;
    
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
      NEW.client_id,
      jsonb_build_object(
        'ticket_id', NEW.ticket_id,
        'assigned_to', NEW.assigned_to,
        'assignee_name', v_assignee_name
      )
    );
  END IF;
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
BEGIN
  SELECT id, title, ticket_id, client_id INTO v_ticket
  FROM public.tickets WHERE id = NEW.ticket_id;
  
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
    v_ticket.client_id,
    jsonb_build_object(
      'ticket_id', v_ticket.ticket_id,
      'comment_preview', LEFT(NEW.content, 100)
    )
  );
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
-- =====================================================

CREATE OR REPLACE FUNCTION log_time_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_ticket RECORD;
  v_client_name TEXT;
BEGIN
  -- Only log when time entry is stopped (has minutes > 0)
  IF NEW.is_running = false AND COALESCE(NEW.minutes, NEW.duration_minutes, 0) > 0 THEN
    -- Get ticket info if available
    IF NEW.ticket_id IS NOT NULL THEN
      SELECT id, title, ticket_id INTO v_ticket FROM public.tickets WHERE id = NEW.ticket_id;
    END IF;
    
    -- Get client name
    SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
    
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
      COALESCE(v_ticket.title, NEW.description, v_client_name, 'Time entry'),
      NEW.user_id,
      NEW.client_id,
      jsonb_build_object(
        'minutes', COALESCE(NEW.minutes, NEW.duration_minutes, 0),
        'ticket_id', v_ticket.ticket_id,
        'billable', COALESCE(NEW.billable, true)
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on INSERT (for manual entries) and UPDATE (for stopping running timers)
DROP TRIGGER IF EXISTS trigger_log_time_entry_insert ON public.time_entries;
CREATE TRIGGER trigger_log_time_entry_insert
  AFTER INSERT ON public.time_entries
  FOR EACH ROW
  WHEN (NEW.is_running = false AND COALESCE(NEW.minutes, NEW.duration_minutes, 0) > 0)
  EXECUTE FUNCTION log_time_entry();

DROP TRIGGER IF EXISTS trigger_log_time_entry_update ON public.time_entries;
CREATE TRIGGER trigger_log_time_entry_update
  AFTER UPDATE ON public.time_entries
  FOR EACH ROW
  WHEN (OLD.is_running = true AND NEW.is_running = false)
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
    auth.uid(),
    NEW.id,
    jsonb_build_object(
      'slug', NEW.slug,
      'monthly_hours', NEW.monthly_hours
    )
  );
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
  SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
  
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
    auth.uid(),
    NEW.client_id,
    jsonb_build_object(
      'client_name', v_client_name
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_board_created ON public.boards;
CREATE TRIGGER trigger_log_board_created
  AFTER INSERT ON public.boards
  FOR EACH ROW
  EXECUTE FUNCTION log_board_created();

-- =====================================================
-- Add missing activity type to config
-- =====================================================
-- Note: Add 'board_created' to activityTypeConfig in ActivityFeed.jsx

-- =====================================================
-- DONE - Run this in Supabase SQL Editor
-- =====================================================
