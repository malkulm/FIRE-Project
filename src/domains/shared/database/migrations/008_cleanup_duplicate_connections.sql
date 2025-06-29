-- Migration 008: Cleanup duplicate bank connections and prevent future duplicates
-- This migration:
-- 1. Removes duplicate bank connections (keeps most recent per user/bank)
-- 2. Updates database constraints to prevent future duplicates
-- 3. Updates token expiration to 1 month instead of 1 year

-- Step 1: Remove duplicate bank connections, keeping only the most recent per user/bank
DELETE FROM bank_connections 
WHERE id NOT IN (
    SELECT DISTINCT ON (user_id, bank_name, connection_type) id
    FROM bank_connections 
    ORDER BY user_id, bank_name, connection_type, created_at DESC
);

-- Step 2: Drop the existing constraint that allows duplicates
ALTER TABLE bank_connections DROP CONSTRAINT IF EXISTS unique_user_powens_connection;
ALTER TABLE bank_connections DROP CONSTRAINT IF EXISTS bank_connections_user_id_powens_connection_id_key;

-- Step 3: Add proper constraint to prevent duplicate connections per user/bank/type
ALTER TABLE bank_connections 
ADD CONSTRAINT unique_user_bank_connection 
UNIQUE (user_id, bank_name, connection_type);

-- Step 4: Update token expiration to 1 month for all existing connections
UPDATE bank_connections 
SET token_expires_at = created_at + INTERVAL '1 month'
WHERE token_expires_at IS NULL OR token_expires_at > created_at + INTERVAL '1 month';

-- Step 5: Add index for performance on lookups
CREATE INDEX IF NOT EXISTS idx_bank_connections_user_bank 
ON bank_connections (user_id, bank_name, connection_type);

-- Step 6: Add index for token expiration queries
CREATE INDEX IF NOT EXISTS idx_bank_connections_token_expiry 
ON bank_connections (token_expires_at) 
WHERE token_expires_at IS NOT NULL;