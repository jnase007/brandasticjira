-- =====================================================
-- RECURRING TASKS SCHEMA FOR BRANDASTIC PM
-- =====================================================
-- This adds support for recurring/repeating tasks
-- =====================================================

-- 1. Add recurrence columns to tickets table
-- =====================================================
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT CHECK (recurrence_pattern IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly')),
ADD COLUMN IF NOT EXISTS recurrence_day INTEGER, -- Day of week (0-6) or day of month (1-31)
ADD COLUMN IF NOT EXISTS recurrence_end_date DATE,
ADD COLUMN IF NOT EXISTS parent_recurring_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS last_recurrence_created DATE;

-- Index for finding recurring tasks
CREATE INDEX IF NOT EXISTS idx_tickets_recurring 
ON public.tickets(is_recurring, recurrence_pattern) 
WHERE is_recurring = true;

-- Index for finding child instances
CREATE INDEX IF NOT EXISTS idx_tickets_parent_recurring 
ON public.tickets(parent_recurring_id) 
WHERE parent_recurring_id IS NOT NULL;

-- 2. Function to create next occurrence of a recurring task
-- =====================================================
CREATE OR REPLACE FUNCTION create_recurring_task_instance(p_parent_id UUID)
RETURNS UUID AS $$
DECLARE
  v_parent RECORD;
  v_next_date DATE;
  v_new_ticket_id UUID;
  v_new_ticket_number TEXT;
BEGIN
  -- Get parent task info
  SELECT * INTO v_parent
  FROM public.tickets
  WHERE id = p_parent_id AND is_recurring = true;
  
  IF v_parent IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Calculate next due date based on pattern
  v_next_date := CASE v_parent.recurrence_pattern
    WHEN 'daily' THEN COALESCE(v_parent.last_recurrence_created, v_parent.due_date::date, CURRENT_DATE) + INTERVAL '1 day'
    WHEN 'weekly' THEN COALESCE(v_parent.last_recurrence_created, v_parent.due_date::date, CURRENT_DATE) + INTERVAL '1 week'
    WHEN 'biweekly' THEN COALESCE(v_parent.last_recurrence_created, v_parent.due_date::date, CURRENT_DATE) + INTERVAL '2 weeks'
    WHEN 'monthly' THEN COALESCE(v_parent.last_recurrence_created, v_parent.due_date::date, CURRENT_DATE) + INTERVAL '1 month'
    WHEN 'quarterly' THEN COALESCE(v_parent.last_recurrence_created, v_parent.due_date::date, CURRENT_DATE) + INTERVAL '3 months'
    ELSE CURRENT_DATE + INTERVAL '1 week'
  END;
  
  -- Don't create if past end date
  IF v_parent.recurrence_end_date IS NOT NULL AND v_next_date > v_parent.recurrence_end_date THEN
    RETURN NULL;
  END IF;
  
  -- Generate new ticket number
  SELECT 'REC-' || COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(ticket_id, '[^0-9]', '', 'g'), '') AS INTEGER)), 0) + 1
  INTO v_new_ticket_number
  FROM public.tickets
  WHERE ticket_id LIKE 'REC-%';
  
  -- Create new instance
  INSERT INTO public.tickets (
    client_id,
    board_id,
    title,
    description,
    status,
    priority,
    assigned_to,
    due_date,
    ticket_id,
    parent_recurring_id,
    created_by,
    service_category,
    labels,
    estimated_hours
  )
  VALUES (
    v_parent.client_id,
    v_parent.board_id,
    v_parent.title,
    v_parent.description,
    'todo',
    v_parent.priority,
    v_parent.assigned_to,
    v_next_date,
    v_new_ticket_number,
    p_parent_id,
    v_parent.created_by,
    v_parent.service_category,
    v_parent.labels,
    v_parent.estimated_hours
  )
  RETURNING id INTO v_new_ticket_id;
  
  -- Update parent's last recurrence date
  UPDATE public.tickets
  SET last_recurrence_created = v_next_date
  WHERE id = p_parent_id;
  
  RETURN v_new_ticket_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Function to process all recurring tasks due for creation
-- This should be called daily by a cron job
-- =====================================================
CREATE OR REPLACE FUNCTION process_recurring_tasks()
RETURNS INTEGER AS $$
DECLARE
  v_task RECORD;
  v_count INTEGER := 0;
  v_new_id UUID;
BEGIN
  -- Find all recurring tasks that need a new instance
  FOR v_task IN
    SELECT id
    FROM public.tickets
    WHERE is_recurring = true
      AND recurrence_pattern IS NOT NULL
      AND (recurrence_end_date IS NULL OR recurrence_end_date >= CURRENT_DATE)
      AND (
        last_recurrence_created IS NULL 
        OR (
          recurrence_pattern = 'daily' AND last_recurrence_created < CURRENT_DATE
        )
        OR (
          recurrence_pattern = 'weekly' AND last_recurrence_created < CURRENT_DATE - INTERVAL '6 days'
        )
        OR (
          recurrence_pattern = 'biweekly' AND last_recurrence_created < CURRENT_DATE - INTERVAL '13 days'
        )
        OR (
          recurrence_pattern = 'monthly' AND last_recurrence_created < CURRENT_DATE - INTERVAL '28 days'
        )
        OR (
          recurrence_pattern = 'quarterly' AND last_recurrence_created < CURRENT_DATE - INTERVAL '89 days'
        )
      )
  LOOP
    v_new_id := create_recurring_task_instance(v_task.id);
    IF v_new_id IS NOT NULL THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create a recurring task template helper
-- =====================================================
CREATE OR REPLACE FUNCTION create_recurring_task(
  p_client_id UUID,
  p_board_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_priority TEXT,
  p_assigned_to UUID,
  p_recurrence_pattern TEXT,
  p_start_date DATE,
  p_end_date DATE DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_ticket_id UUID;
  v_ticket_number TEXT;
BEGIN
  -- Generate ticket number
  SELECT 'REC-' || COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(ticket_id, '[^0-9]', '', 'g'), '') AS INTEGER)), 0) + 1
  INTO v_ticket_number
  FROM public.tickets
  WHERE ticket_id LIKE 'REC-%';
  
  -- Create the recurring task template
  INSERT INTO public.tickets (
    client_id,
    board_id,
    title,
    description,
    status,
    priority,
    assigned_to,
    due_date,
    ticket_id,
    created_by,
    is_recurring,
    recurrence_pattern,
    recurrence_end_date
  )
  VALUES (
    p_client_id,
    p_board_id,
    p_title,
    p_description,
    'todo',
    p_priority,
    p_assigned_to,
    p_start_date,
    v_ticket_number,
    p_created_by,
    true,
    p_recurrence_pattern,
    p_end_date
  )
  RETURNING id INTO v_ticket_id;
  
  RETURN v_ticket_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Grant permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION create_recurring_task_instance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_recurring_tasks() TO authenticated;
GRANT EXECUTE ON FUNCTION create_recurring_task(UUID, UUID, TEXT, TEXT, TEXT, UUID, TEXT, DATE, DATE, UUID) TO authenticated;

-- =====================================================
-- SETUP INSTRUCTIONS:
-- =====================================================
-- 1. Run this SQL in Supabase SQL Editor
-- 
-- 2. Set up a daily cron job to process recurring tasks:
--    Using pg_cron (if available):
--    SELECT cron.schedule('process-recurring-tasks', '0 1 * * *', 'SELECT process_recurring_tasks()');
--    
--    Or call from an Edge Function scheduled daily
--
-- 3. The UI will show options to make tasks recurring when creating/editing
-- =====================================================
