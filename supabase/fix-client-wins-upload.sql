-- =====================================================
-- FIX: Create Client Wins Table From Scratch
-- Run this STEP BY STEP in Supabase SQL Editor
-- =====================================================

-- STEP 1: Check if clients table exists (should return a row)
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'clients';

-- If the above returns nothing, you need to create the clients table first!
