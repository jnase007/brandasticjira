-- ============================================
-- SEED SAMPLE CLIENTS
-- Based on real Brandastic client data
-- Hourly Rate: $175/hr
-- ============================================

-- Delete existing sample clients if they exist (optional - uncomment if needed)
-- DELETE FROM public.clients WHERE slug IN ('calops', 'prudental-labs', 'salvin', 'checknplay', 'dess-usa');

-- Insert sample clients
INSERT INTO public.clients (name, slug, monthly_hours, contact_name, contact_email, color, account_services, is_active)
VALUES
  -- Calops: $21,000/month = 120 hours
  (
    'Calops',
    'calops',
    120,
    'Alex Johnson',
    'alex@calops.com',
    '#4F46E5',
    '["SEO", "PPC", "Social Media"]'::jsonb,
    true
  ),
  -- Prudental Labs: $11,000/month = 63 hours
  (
    'Prudental Labs',
    'prudental-labs',
    63,
    'Sarah Chen',
    'sarah@prudentallabs.com',
    '#059669',
    '["SEO", "Content Marketing", "Web Development"]'::jsonb,
    true
  ),
  -- Salvin: $10,500/month = 60 hours
  (
    'Salvin',
    'salvin',
    60,
    'Mike Torres',
    'mike@salvin.com',
    '#DC2626',
    '["PPC", "Email Marketing", "Branding"]'::jsonb,
    true
  ),
  -- Check'n Play: $9,600/month = 55 hours
  (
    'Check''n Play',
    'checknplay',
    55,
    'Lisa Wang',
    'lisa@checknplay.com',
    '#7C3AED',
    '["Social Media", "Influencer Marketing", "Video Production"]'::jsonb,
    true
  ),
  -- DESS USA: $7,800/month = 45 hours
  (
    'DESS USA',
    'dess-usa',
    45,
    'Robert Kim',
    'robert@dessusa.com',
    '#0891B2',
    '["SEO", "PPC", "Web Development"]'::jsonb,
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_hours = EXCLUDED.monthly_hours,
  contact_name = EXCLUDED.contact_name,
  contact_email = EXCLUDED.contact_email,
  color = EXCLUDED.color,
  account_services = EXCLUDED.account_services,
  is_active = EXCLUDED.is_active;

-- Add some sample boards for each client
INSERT INTO public.boards (name, description, client_id)
SELECT 
  'Q1 2025 Marketing Campaign',
  'Main marketing initiatives for Q1',
  id
FROM public.clients WHERE slug = 'calops'
ON CONFLICT DO NOTHING;

INSERT INTO public.boards (name, description, client_id)
SELECT 
  'Website Redesign',
  'Full website overhaul and optimization',
  id
FROM public.clients WHERE slug = 'prudental-labs'
ON CONFLICT DO NOTHING;

INSERT INTO public.boards (name, description, client_id)
SELECT 
  'Brand Refresh',
  'Logo, colors, and brand guidelines update',
  id
FROM public.clients WHERE slug = 'salvin'
ON CONFLICT DO NOTHING;

INSERT INTO public.boards (name, description, client_id)
SELECT 
  'Social Media Launch',
  'New social media presence and campaigns',
  id
FROM public.clients WHERE slug = 'checknplay'
ON CONFLICT DO NOTHING;

INSERT INTO public.boards (name, description, client_id)
SELECT 
  'SEO Optimization',
  'Technical SEO and content strategy',
  id
FROM public.clients WHERE slug = 'dess-usa'
ON CONFLICT DO NOTHING;

-- Set client hourly rates (billing rate)
INSERT INTO public.client_hourly_rates (client_id, rate_per_hour, effective_date)
SELECT id, 175.00, CURRENT_DATE
FROM public.clients 
WHERE slug IN ('calops', 'prudental-labs', 'salvin', 'checknplay', 'dess-usa')
ON CONFLICT DO NOTHING;

-- Summary
SELECT 
  name,
  monthly_hours,
  monthly_hours * 175 as monthly_revenue,
  contact_email,
  color
FROM public.clients
WHERE slug IN ('calops', 'prudental-labs', 'salvin', 'checknplay', 'dess-usa')
ORDER BY monthly_hours DESC;
