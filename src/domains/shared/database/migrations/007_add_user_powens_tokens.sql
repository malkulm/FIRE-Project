-- Migration: Add Powens token fields to users table
-- This allows each user to have their own permanent Powens token
-- instead of using a global token from .env

-- Add Powens-specific fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS powens_user_id INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS powens_permanent_token VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS powens_token_created_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS powens_token_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS powens_token_type VARCHAR(50) DEFAULT 'temporary';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_powens_user_id ON users(powens_user_id);
CREATE INDEX IF NOT EXISTS idx_users_powens_token_expires ON users(powens_token_expires_at);

-- Update bank_connections table to better track token source
ALTER TABLE bank_connections ADD COLUMN IF NOT EXISTS token_source VARCHAR(50) DEFAULT 'oauth';
ALTER TABLE bank_connections ADD COLUMN IF NOT EXISTS powens_user_id_from_api INTEGER;

COMMENT ON COLUMN users.powens_user_id IS 'User ID from Powens API (id_user field)';
COMMENT ON COLUMN users.powens_permanent_token IS 'Permanent access token from Powens for this user';
COMMENT ON COLUMN users.powens_token_created_at IS 'When the permanent token was created';
COMMENT ON COLUMN users.powens_token_expires_at IS 'When the permanent token expires (if applicable)';
COMMENT ON COLUMN users.powens_token_type IS 'Type of token: permanent, temporary, or service';
COMMENT ON COLUMN bank_connections.token_source IS 'Source of token: oauth, permanent, or webhook';
COMMENT ON COLUMN bank_connections.powens_user_id_from_api IS 'Powens user ID from API response';
