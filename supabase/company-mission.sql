-- Company Mission & Vision Dashboard Schema
-- This stores the company's strategic plan data

-- Create company_mission table
CREATE TABLE IF NOT EXISTS public.company_mission (
  id INTEGER PRIMARY KEY DEFAULT 1,
  
  -- Long term vision
  long_term_vision TEXT,
  vision_pillars JSONB DEFAULT '[]'::jsonb,
  
  -- Rally cry/theme
  rally_cry TEXT DEFAULT 'Focused. Growth.',
  rally_year TEXT DEFAULT '2025',
  
  -- Core values
  core_values JSONB DEFAULT '[]'::jsonb,
  
  -- Vital factors & initiatives
  vital_factors JSONB DEFAULT '[]'::jsonb,
  initiatives JSONB DEFAULT '[]'::jsonb,
  
  -- Revenue targets
  revenue_target NUMERIC(15, 2) DEFAULT 5000000,
  current_revenue NUMERIC(15, 2) DEFAULT 1800000,
  target_year INTEGER DEFAULT 2030,
  start_year INTEGER DEFAULT 2026,
  
  -- Client targets
  current_clients INTEGER DEFAULT 22,
  target_clients INTEGER DEFAULT 70,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id)
);

-- Ensure only one row exists
ALTER TABLE public.company_mission ADD CONSTRAINT single_row CHECK (id = 1);

-- Enable RLS
ALTER TABLE public.company_mission ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can read
CREATE POLICY "Anyone can read mission" 
  ON public.company_mission 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Policy: Only admins can update
CREATE POLICY "Admins can update mission" 
  ON public.company_mission 
  FOR ALL 
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'admin'
    )
  );

-- Insert default data
INSERT INTO public.company_mission (
  id,
  long_term_vision,
  vision_pillars,
  rally_cry,
  rally_year,
  core_values,
  vital_factors,
  initiatives,
  revenue_target,
  current_revenue,
  target_year,
  start_year,
  current_clients,
  target_clients
) VALUES (
  1,
  'Accelerate the growth of 65 businesses through active retainers by 2030',
  '[
    {"title": "Focusing on businesses with over 10M+ in sales", "icon": "target"},
    {"title": "With contracts that include a holistic presence across all channels", "icon": "layers"},
    {"title": "With A focus on Annual Retainers", "icon": "repeat"}
  ]'::jsonb,
  'Focused. Growth.',
  '2025',
  '[
    {"title": "Ignite Potential", "description": "Unlock growth for every team member + brand"},
    {"title": "Results Focused", "description": "Measure KPI''s that matter"},
    {"title": "Lifetime Clients", "description": "Forge long-term partnerships"}
  ]'::jsonb,
  '[
    {"label": "Revenue", "value": "$3M = ARR (6 New Contracts)", "icon": "dollar"},
    {"label": "Clients", "value": "25", "icon": "users"},
    {"label": "Higher Rates", "value": "$175-$195/hr", "icon": "trending"},
    {"label": "Deals", "value": "1/mo", "icon": "target"},
    {"label": "Net Profit", "value": "10% - 20%", "icon": "chart"}
  ]'::jsonb,
  '[
    {"title": "Grow Rev", "description": "Increase Rev by 25% YOY"},
    {"title": "Efficiency", "description": "Team is working on billable items 80% of the time"},
    {"title": "Team", "description": "Instill a Growth mindset in our team leading to better client results"},
    {"title": "Cash/Margin", "description": "Positive bottom Line each month"},
    {"title": "Management", "description": "Leadership is proactive in taking ownership"}
  ]'::jsonb,
  5000000,
  1800000,
  2030,
  2026,
  22,
  70
) ON CONFLICT (id) DO NOTHING;

-- Grant access to authenticated users
GRANT SELECT ON public.company_mission TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.company_mission TO authenticated;

-- Create update trigger for updated_at
CREATE OR REPLACE FUNCTION update_company_mission_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS company_mission_updated_at ON public.company_mission;
CREATE TRIGGER company_mission_updated_at
  BEFORE UPDATE ON public.company_mission
  FOR EACH ROW
  EXECUTE FUNCTION update_company_mission_timestamp();
