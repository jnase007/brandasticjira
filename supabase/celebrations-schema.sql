-- ============================================
-- CELEBRATIONS SCHEMA
-- Birthdays & Work Anniversaries
-- ============================================

-- Add birthday and start_date to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS birthday DATE,
ADD COLUMN IF NOT EXISTS work_start_date DATE,
ADD COLUMN IF NOT EXISTS show_birthday BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_age BOOLEAN DEFAULT false;

-- ============================================
-- CELEBRATIONS VIEW
-- Shows upcoming birthdays and anniversaries
-- ============================================
CREATE OR REPLACE VIEW public.upcoming_celebrations AS
WITH today AS (
  SELECT CURRENT_DATE as today_date
),
celebrations AS (
  SELECT 
    p.id as user_id,
    p.full_name,
    p.avatar_url,
    p.birthday,
    p.work_start_date,
    p.show_birthday,
    p.show_age,
    -- Calculate next birthday
    CASE 
      WHEN p.birthday IS NOT NULL THEN
        CASE 
          WHEN (DATE_PART('month', p.birthday) * 100 + DATE_PART('day', p.birthday)) >= 
               (DATE_PART('month', CURRENT_DATE) * 100 + DATE_PART('day', CURRENT_DATE))
          THEN DATE(DATE_PART('year', CURRENT_DATE) || '-' || 
               LPAD(DATE_PART('month', p.birthday)::text, 2, '0') || '-' || 
               LPAD(DATE_PART('day', p.birthday)::text, 2, '0'))
          ELSE DATE((DATE_PART('year', CURRENT_DATE) + 1) || '-' || 
               LPAD(DATE_PART('month', p.birthday)::text, 2, '0') || '-' || 
               LPAD(DATE_PART('day', p.birthday)::text, 2, '0'))
        END
    END as next_birthday,
    -- Calculate next work anniversary
    CASE 
      WHEN p.work_start_date IS NOT NULL THEN
        CASE 
          WHEN (DATE_PART('month', p.work_start_date) * 100 + DATE_PART('day', p.work_start_date)) >= 
               (DATE_PART('month', CURRENT_DATE) * 100 + DATE_PART('day', CURRENT_DATE))
          THEN DATE(DATE_PART('year', CURRENT_DATE) || '-' || 
               LPAD(DATE_PART('month', p.work_start_date)::text, 2, '0') || '-' || 
               LPAD(DATE_PART('day', p.work_start_date)::text, 2, '0'))
          ELSE DATE((DATE_PART('year', CURRENT_DATE) + 1) || '-' || 
               LPAD(DATE_PART('month', p.work_start_date)::text, 2, '0') || '-' || 
               LPAD(DATE_PART('day', p.work_start_date)::text, 2, '0'))
        END
    END as next_anniversary,
    -- Years at company
    CASE 
      WHEN p.work_start_date IS NOT NULL 
      THEN DATE_PART('year', AGE(CURRENT_DATE, p.work_start_date))
    END as years_at_company,
    -- Age (if allowed to show)
    CASE 
      WHEN p.birthday IS NOT NULL AND p.show_age = true
      THEN DATE_PART('year', AGE(CURRENT_DATE, p.birthday))
    END as age
  FROM public.profiles p
  WHERE p.role IN ('team', 'admin')
)
SELECT 
  *,
  -- Days until next birthday
  CASE WHEN next_birthday IS NOT NULL 
    THEN next_birthday - CURRENT_DATE 
  END as days_until_birthday,
  -- Days until next anniversary
  CASE WHEN next_anniversary IS NOT NULL 
    THEN next_anniversary - CURRENT_DATE 
  END as days_until_anniversary,
  -- Is birthday today?
  CASE WHEN next_birthday = CURRENT_DATE THEN true ELSE false END as is_birthday_today,
  -- Is anniversary today?
  CASE WHEN next_anniversary = CURRENT_DATE THEN true ELSE false END as is_anniversary_today
FROM celebrations
ORDER BY 
  LEAST(
    COALESCE(next_birthday - CURRENT_DATE, 999),
    COALESCE(next_anniversary - CURRENT_DATE, 999)
  );

-- ============================================
-- RLS for celebrations view
-- ============================================
-- Views inherit RLS from underlying tables

-- ============================================
-- DONE
-- ============================================
SELECT 'Celebrations schema created!' as status;
