-- ============================================
-- FIX: Add missing columns to clients table
-- Run this in Supabase SQL Editor
-- ============================================

-- Add notes column
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add contact_phone column (so we don't need the workaround)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- Add contact_funder column (if used)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_funder TEXT;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clients' 
ORDER BY ordinal_position;
