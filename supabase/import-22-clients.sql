-- ============================================
-- IMPORT ALL 22 BRANDASTIC CLIENTS
-- Run this in Supabase SQL Editor
-- Hourly Rate: $175/hr
-- Total Monthly Revenue: ~$130,434
-- ============================================

-- Insert all 22 clients
INSERT INTO public.clients (name, slug, monthly_hours, color, account_services, is_active)
VALUES
  -- $21,000/mo = 120 hours
  ('Calops', 'calops', 120, '#4F46E5', '["SEO", "PPC", "Social Media"]'::jsonb, true),
  -- $11,000/mo = 63 hours
  ('Prudental Labs', 'prudental-labs', 63, '#059669', '["SEO", "Content Marketing", "Web Development"]'::jsonb, true),
  -- $10,500/mo = 60 hours
  ('Salvin', 'salvin', 60, '#DC2626', '["PPC", "Email Marketing", "Branding"]'::jsonb, true),
  -- $10,000/mo = 57 hours
  ('Wearparts LLC', 'wearparts-llc', 57, '#EA580C', '["SEO", "PPC", "Web Development"]'::jsonb, true),
  -- $9,600/mo = 55 hours
  ('Check''n Play', 'checknplay', 55, '#7C3AED', '["Social Media", "Influencer Marketing", "Video Production"]'::jsonb, true),
  -- $9,100/mo = 52 hours
  ('Young Surgical', 'young-surgical', 52, '#0D9488', '["SEO", "PPC", "Content Marketing"]'::jsonb, true),
  -- $7,800/mo = 45 hours
  ('DESS USA', 'dess-usa', 45, '#0891B2', '["SEO", "PPC", "Web Development"]'::jsonb, true),
  -- $5,880/mo = 34 hours
  ('Adopt Hwy', 'adopt-hwy', 34, '#16A34A', '["Social Media", "Content Marketing"]'::jsonb, true),
  -- $5,250/mo = 30 hours
  ('Christian Heart School', 'christian-heart-school', 30, '#2563EB', '["SEO", "Social Media", "Email Marketing"]'::jsonb, true),
  -- $5,250/mo = 30 hours
  ('Morehouse', 'morehouse', 30, '#9333EA', '["PPC", "Branding", "Web Development"]'::jsonb, true),
  -- $5,000/mo = 29 hours
  ('MonoB', 'monob', 29, '#DB2777', '["SEO", "Social Media", "Influencer Marketing"]'::jsonb, true),
  -- $4,550/mo = 26 hours
  ('Friar Tux', 'friar-tux', 26, '#1E293B', '["SEO", "PPC", "Web Development"]'::jsonb, true),
  -- $4,500/mo = 26 hours
  ('TriStar Insurance', 'tristar-insurance', 26, '#0369A1', '["SEO", "PPC", "Content Marketing"]'::jsonb, true),
  -- $4,350/mo = 25 hours
  ('Starboard Realty', 'starboard-realty', 25, '#0F766E', '["SEO", "Social Media", "Web Development"]'::jsonb, true),
  -- $3,500/mo = 20 hours
  ('Husbey Crummack', 'husbey-crummack', 20, '#7E22CE', '["SEO", "PPC"]'::jsonb, true),
  -- $3,500/mo = 20 hours
  ('Labtech PPC', 'labtech-ppc', 20, '#BE185D', '["PPC", "Analytics"]'::jsonb, true),
  -- $2,650/mo = 15 hours
  ('Labtech SEO', 'labtech-seo', 15, '#C026D3', '["SEO", "Content Marketing"]'::jsonb, true),
  -- $2,600/mo = 15 hours
  ('Friar Tux Email', 'friar-tux-email', 15, '#334155', '["Email Marketing"]'::jsonb, true),
  -- $1,500/mo = 9 hours
  ('Roger Beltrans', 'roger-beltrans', 9, '#CA8A04', '["SEO", "Web Development"]'::jsonb, true),
  -- $1,500/mo = 9 hours
  ('Trico Realty', 'trico-realty', 9, '#65A30D', '["SEO", "Social Media"]'::jsonb, true),
  -- $1,199/mo = 7 hours
  ('IPA 1031 Group', 'ipa-1031-group', 7, '#0284C7', '["SEO", "PPC"]'::jsonb, true),
  -- $1,000/mo = 6 hours
  ('Posture Pump', 'posture-pump', 6, '#EA580C', '["SEO"]'::jsonb, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_hours = EXCLUDED.monthly_hours,
  color = EXCLUDED.color,
  account_services = EXCLUDED.account_services,
  is_active = EXCLUDED.is_active;

-- Show imported clients
SELECT 
  name,
  monthly_hours as hours,
  monthly_hours * 175 as monthly_revenue,
  account_services
FROM public.clients
ORDER BY monthly_hours DESC;
