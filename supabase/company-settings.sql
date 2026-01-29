-- Company Settings Table for Financial Projections
-- Run this in your Supabase SQL editor

-- Create the company_settings table
CREATE TABLE IF NOT EXISTS company_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  monthly_overhead DECIMAL(12,2) DEFAULT 37500,
  hourly_rate DECIMAL(8,2) DEFAULT 175,
  target_rpe DECIMAL(12,2) DEFAULT 264344,
  fica_rate DECIMAL(6,4) DEFAULT 0.0765,
  futa_rate DECIMAL(6,4) DEFAULT 0.006,
  suta_rate DECIMAL(6,4) DEFAULT 0.034,
  workers_comp_rate DECIMAL(6,4) DEFAULT 0.01,
  health_insurance_per_employee DECIMAL(8,2) DEFAULT 500,
  pto_accrual_rate DECIMAL(6,4) DEFAULT 0.0385,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Enable RLS
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can read
CREATE POLICY "Authenticated users can read company settings"
  ON company_settings FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only admins can update
CREATE POLICY "Admins can update company settings"
  ON company_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Only admins can insert (for initial setup)
CREATE POLICY "Admins can insert company settings"
  ON company_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Insert default row if not exists
INSERT INTO company_settings (id, monthly_overhead, hourly_rate, target_rpe)
VALUES (1, 37500, 175, 264344)
ON CONFLICT (id) DO NOTHING;

-- Grant permissions
GRANT SELECT ON company_settings TO authenticated;
GRANT UPDATE ON company_settings TO authenticated;
GRANT INSERT ON company_settings TO authenticated;
