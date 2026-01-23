-- ==============================================
-- PUBLIC CLIENT ACCESS POLICIES
-- Run this in Supabase SQL Editor to enable
-- shareable client links to work without login
-- ==============================================

-- Ensure public_enabled and public_token columns exist on clients
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'public_enabled') THEN
        ALTER TABLE clients ADD COLUMN public_enabled BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'public_token') THEN
        ALTER TABLE clients ADD COLUMN public_token TEXT;
    END IF;
END $$;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_clients_public_token ON clients(public_token) WHERE public_token IS NOT NULL;

-- ==============================================
-- RLS POLICIES FOR PUBLIC ACCESS
-- ==============================================

-- Allow anyone to read a client if they know the public_token and it's enabled
DROP POLICY IF EXISTS "Public can view enabled clients by token" ON clients;
CREATE POLICY "Public can view enabled clients by token" ON clients
    FOR SELECT
    USING (
        public_enabled = true 
        AND public_token IS NOT NULL
    );

-- Allow public read access to boards for public clients
DROP POLICY IF EXISTS "Public can view boards of public clients" ON boards;
CREATE POLICY "Public can view boards of public clients" ON boards
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM clients 
            WHERE clients.id = boards.client_id 
            AND clients.public_enabled = true 
            AND clients.public_token IS NOT NULL
        )
    );

-- Allow public read access to tickets for public clients
DROP POLICY IF EXISTS "Public can view tickets of public clients" ON tickets;
CREATE POLICY "Public can view tickets of public clients" ON tickets
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM clients 
            WHERE clients.id = tickets.client_id 
            AND clients.public_enabled = true 
            AND clients.public_token IS NOT NULL
        )
    );

-- ==============================================
-- OPTIONAL POLICIES (only run if tables exist)
-- ==============================================

-- client_projects policy (only if table has client_id)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_projects' AND column_name = 'client_id') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Public can view projects of public clients" ON client_projects';
        EXECUTE '
            CREATE POLICY "Public can view projects of public clients" ON client_projects
            FOR SELECT
            USING (
                is_visible_to_client = true 
                AND EXISTS (
                    SELECT 1 FROM clients 
                    WHERE clients.id = client_projects.client_id 
                    AND clients.public_enabled = true 
                    AND clients.public_token IS NOT NULL
                )
            )
        ';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipped client_projects policy: %', SQLERRM;
END $$;

-- activity_log policy (only if table has client_id)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_log' AND column_name = 'client_id') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Public can view activity of public clients" ON activity_log';
        EXECUTE '
            CREATE POLICY "Public can view activity of public clients" ON activity_log
            FOR SELECT
            USING (
                client_id IS NOT NULL 
                AND EXISTS (
                    SELECT 1 FROM clients 
                    WHERE clients.id = activity_log.client_id 
                    AND clients.public_enabled = true 
                    AND clients.public_token IS NOT NULL
                )
            )
        ';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipped activity_log policy: %', SQLERRM;
END $$;

-- time_entries policy (only if table has client_id)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'time_entries' AND column_name = 'client_id') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Public can view time of public clients" ON time_entries';
        EXECUTE '
            CREATE POLICY "Public can view time of public clients" ON time_entries
            FOR SELECT
            USING (
                client_id IS NOT NULL 
                AND EXISTS (
                    SELECT 1 FROM clients 
                    WHERE clients.id = time_entries.client_id 
                    AND clients.public_enabled = true 
                    AND clients.public_token IS NOT NULL
                )
            )
        ';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipped time_entries policy: %', SQLERRM;
END $$;

-- ==============================================
-- GRANT INFO
-- ==============================================
-- These policies allow READ-ONLY access to client data
-- when the client has public_enabled=true and a public_token set.
-- The frontend filters by token to only show the relevant client.
-- 
-- To enable a client's shareable link:
-- UPDATE clients SET public_enabled = true, public_token = 'some-unique-token' WHERE id = 'client-id';
-- ==============================================
