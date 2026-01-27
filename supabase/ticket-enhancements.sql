-- ============================================
-- TICKET ENHANCEMENTS FOR 10x UX
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Add new columns to tickets table
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS ticket_type TEXT DEFAULT 'task' CHECK (ticket_type IN ('task', 'client_homework')),
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(6,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS resolution TEXT DEFAULT 'unresolved' CHECK (resolution IN ('unresolved', 'resolved')),
ADD COLUMN IF NOT EXISTS start_date DATE;

-- 2. Create categories/folders table for organization
CREATE TABLE IF NOT EXISTS public.ticket_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366F1',
  icon TEXT DEFAULT '📁',
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  board_id UUID REFERENCES public.boards(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add category_id to tickets
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.ticket_categories(id) ON DELETE SET NULL;

-- 3. Update existing statuses to new workflow
-- First, let's migrate existing data
UPDATE public.tickets SET status = 'new' WHERE status = 'todo';
UPDATE public.tickets SET status = 'in_progress' WHERE status = 'inprogress';
UPDATE public.tickets SET status = 'closed' WHERE status = 'done';

-- 4. Auto-update resolution when status changes to closed
CREATE OR REPLACE FUNCTION update_ticket_resolution()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'closed' AND OLD.status != 'closed' THEN
    NEW.resolution := 'resolved';
  END IF;
  IF NEW.status != 'closed' AND OLD.status = 'closed' THEN
    NEW.resolution := 'unresolved';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ticket_resolution_trigger ON public.tickets;
CREATE TRIGGER ticket_resolution_trigger
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_resolution();

-- 5. RLS for ticket_categories
ALTER TABLE public.ticket_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for authenticated users" ON public.ticket_categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.ticket_categories
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public.ticket_categories
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users" ON public.ticket_categories
  FOR DELETE TO authenticated USING (true);

-- 6. Create some default categories for existing clients
INSERT INTO public.ticket_categories (name, color, icon, client_id)
SELECT DISTINCT 
  'General',
  '#6366F1',
  '📁',
  client_id
FROM public.tickets
WHERE client_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 7. Add index for performance
CREATE INDEX IF NOT EXISTS idx_tickets_category_id ON public.tickets(category_id);
CREATE INDEX IF NOT EXISTS idx_tickets_resolution ON public.tickets(resolution);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_type ON public.tickets(ticket_type);
CREATE INDEX IF NOT EXISTS idx_ticket_categories_client ON public.ticket_categories(client_id);
CREATE INDEX IF NOT EXISTS idx_ticket_categories_board ON public.ticket_categories(board_id);

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Ticket enhancements applied successfully!';
  RAISE NOTICE 'New fields: ticket_type, category, estimated_hours, resolution, start_date, category_id';
  RAISE NOTICE 'New table: ticket_categories';
  RAISE NOTICE 'Auto-trigger: resolution updates when status changes to/from closed';
END $$;
