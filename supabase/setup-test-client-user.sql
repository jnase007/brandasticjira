-- ============================================
-- SETUP TEST CLIENT USER
-- Run this AFTER signing up with a test email
-- ============================================

-- Step 1: First, let's see what clients exist
SELECT id, name, slug FROM clients LIMIT 10;

-- Step 2: Update the test user to be a client
-- Replace 'testclient@example.com' with the email you signed up with
-- Replace the client_id with an actual client ID from Step 1

/*
UPDATE profiles
SET 
  role = 'client',
  client_id = 'YOUR_CLIENT_UUID_HERE'  -- Get this from the clients table
WHERE email = 'testclient@example.com';
*/

-- ============================================
-- ALTERNATIVE: Create everything in one go
-- This creates a sample client and links a user
-- ============================================

-- Create a sample client if none exist
INSERT INTO clients (name, slug, color, monthly_hours, is_active)
VALUES ('Demo Client', 'demo-client', '#8B5CF6', 40, true)
ON CONFLICT (slug) DO NOTHING
RETURNING id, name;

-- Now you can link a user to this client:
-- UPDATE profiles SET role = 'client', client_id = (SELECT id FROM clients WHERE slug = 'demo-client') WHERE email = 'YOUR_TEST_EMAIL';
