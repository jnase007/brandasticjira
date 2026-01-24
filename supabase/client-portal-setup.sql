-- ============================================
-- CLIENT PORTAL SETUP
-- Run this in your Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: Add client_id column to profiles (if not exists)
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN client_id UUID REFERENCES clients(id);
    COMMENT ON COLUMN profiles.client_id IS 'Links user to their client company (for client portal access)';
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_client_id ON profiles(client_id);

-- ============================================
-- STEP 2: Create a function to easily add client users
-- ============================================
CREATE OR REPLACE FUNCTION create_client_user(
  p_email TEXT,
  p_full_name TEXT,
  p_client_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Check if user already exists
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  
  IF v_user_id IS NOT NULL THEN
    -- Update existing profile
    UPDATE profiles 
    SET 
      client_id = p_client_id,
      role = 'client',
      full_name = COALESCE(p_full_name, full_name)
    WHERE id = v_user_id;
    
    RETURN v_user_id;
  ELSE
    -- User doesn't exist yet - they'll be created when they sign up via magic link
    -- Return NULL to indicate they need to be invited
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 3: Create helper view to see client users
-- ============================================
CREATE OR REPLACE VIEW client_users AS
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.avatar_url,
  p.client_id,
  c.name AS client_name,
  c.slug AS client_slug,
  p.created_at,
  p.last_seen
FROM profiles p
LEFT JOIN clients c ON c.id = p.client_id
WHERE p.role = 'client' OR p.client_id IS NOT NULL
ORDER BY c.name, p.full_name;

-- ============================================
-- STEP 4: RLS policies for client users
-- ============================================

-- Allow clients to read their own profile
DROP POLICY IF EXISTS "Clients can view own profile" ON profiles;
CREATE POLICY "Clients can view own profile"
ON profiles FOR SELECT
USING (
  auth.uid() = id OR
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin')
  )
);

-- Allow clients to update their own profile
DROP POLICY IF EXISTS "Clients can update own profile" ON profiles;
CREATE POLICY "Clients can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ============================================
-- STEP 5: Allow clients to see their tickets
-- ============================================
DROP POLICY IF EXISTS "Clients can view their tickets" ON tickets;
CREATE POLICY "Clients can view their tickets"
ON tickets FOR SELECT
USING (
  -- Team/admin can see all
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin')
  )
  OR
  -- Clients can see their company's tickets
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.client_id = tickets.client_id
  )
);

-- Allow clients to create tickets for their company
DROP POLICY IF EXISTS "Clients can create tickets" ON tickets;
CREATE POLICY "Clients can create tickets"
ON tickets FOR INSERT
WITH CHECK (
  -- Team/admin can create any
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin')
  )
  OR
  -- Clients can create for their company
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.client_id = tickets.client_id
  )
);

-- ============================================
-- STEP 6: Allow clients to comment on their tickets
-- ============================================
DROP POLICY IF EXISTS "Clients can view comments on their tickets" ON comments;
CREATE POLICY "Clients can view comments on their tickets"
ON comments FOR SELECT
USING (
  -- Team/admin can see all
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin')
  )
  OR
  -- Clients can see comments on their tickets
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN tickets t ON t.client_id = p.client_id
    WHERE p.id = auth.uid() 
    AND t.id = comments.ticket_id
  )
);

DROP POLICY IF EXISTS "Clients can add comments to their tickets" ON comments;
CREATE POLICY "Clients can add comments to their tickets"
ON comments FOR INSERT
WITH CHECK (
  -- Team/admin can comment on any
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin')
  )
  OR
  -- Clients can comment on their tickets
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN tickets t ON t.client_id = p.client_id
    WHERE p.id = auth.uid() 
    AND t.id = comments.ticket_id
  )
);

-- ============================================
-- STEP 7: Trigger to set role='client' when client_id is set
-- ============================================
CREATE OR REPLACE FUNCTION set_client_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_id IS NOT NULL AND (OLD.client_id IS NULL OR OLD.client_id != NEW.client_id) THEN
    NEW.role := 'client';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_client_role ON profiles;
CREATE TRIGGER trigger_set_client_role
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_client_role();

-- ============================================
-- EXAMPLE: How to assign a client to a user
-- ============================================
-- 
-- Option 1: Update an existing user to be a client contact
-- UPDATE profiles 
-- SET client_id = 'your-client-uuid-here', role = 'client'
-- WHERE email = 'client@example.com';
--
-- Option 2: Use the helper function
-- SELECT create_client_user(
--   'john@clientcompany.com',
--   'John Smith',
--   'your-client-uuid-here'
-- );
--
-- ============================================

-- Show all clients for reference
SELECT id, name, slug, contact_email FROM clients ORDER BY name LIMIT 20;
