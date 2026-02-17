-- Add client_type column to classify clients as retainer, project, or personal_saas
-- Run this in Supabase SQL Editor

-- Add client_type column with default 'retainer' for existing clients
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS client_type VARCHAR(50) DEFAULT 'retainer';

-- Add check constraint to ensure valid values
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_client_type_check'
  ) THEN
    ALTER TABLE clients 
    ADD CONSTRAINT clients_client_type_check 
    CHECK (client_type IN ('retainer', 'project', 'personal_saas'));
  END IF;
END $$;

-- Create index for efficient filtering by client type
CREATE INDEX IF NOT EXISTS idx_clients_client_type ON clients(client_type);

-- Update existing clients to ensure they have a valid client_type
UPDATE clients SET client_type = 'retainer' WHERE client_type IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN clients.client_type IS 'Client classification: retainer (ongoing monthly), project (fixed scope), personal_saas (Brandastic ventures/personal SaaS)';

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'clients' AND column_name = 'client_type';
