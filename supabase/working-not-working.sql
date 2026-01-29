-- Working / Not Working Schema
-- Monthly review of team successes and opportunities

-- Create the table
CREATE TABLE IF NOT EXISTS public.working_not_working (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Item type
  type TEXT NOT NULL CHECK (type IN ('working', 'not_working')),
  
  -- Content
  description TEXT NOT NULL,
  next_steps TEXT, -- Action items for "not working" items
  responsible TEXT, -- Who is responsible
  
  -- Resolution tracking
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id),
  
  -- Month/Year for filtering
  month INTEGER NOT NULL, -- 0-11
  year INTEGER NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.working_not_working ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can read
CREATE POLICY "Authenticated users can read working_not_working" 
  ON public.working_not_working 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Policy: Anyone authenticated can insert
CREATE POLICY "Authenticated users can insert working_not_working" 
  ON public.working_not_working 
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Anyone authenticated can update
CREATE POLICY "Authenticated users can update working_not_working" 
  ON public.working_not_working 
  FOR UPDATE 
  USING (auth.role() = 'authenticated');

-- Policy: Only admins can delete
CREATE POLICY "Admins can delete working_not_working" 
  ON public.working_not_working 
  FOR DELETE 
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'admin'
    )
  );

-- Index for month/year queries
CREATE INDEX IF NOT EXISTS idx_working_not_working_month_year 
  ON public.working_not_working(year, month);

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.working_not_working TO authenticated;

-- Update trigger
CREATE OR REPLACE FUNCTION update_working_not_working_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS working_not_working_updated_at ON public.working_not_working;
CREATE TRIGGER working_not_working_updated_at
  BEFORE UPDATE ON public.working_not_working
  FOR EACH ROW
  EXECUTE FUNCTION update_working_not_working_timestamp();
