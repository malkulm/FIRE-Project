-- Migration 009: Add last_sync_timestamp for incremental sync
-- This enables efficient incremental sync using Powens last_update parameter

-- Add last_sync_timestamp column to bank_connections table
ALTER TABLE bank_connections 
ADD COLUMN last_sync_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for efficient queries
CREATE INDEX idx_bank_connections_last_sync_timestamp 
ON bank_connections(last_sync_timestamp);

-- Add comment for documentation
COMMENT ON COLUMN bank_connections.last_sync_timestamp 
IS 'Timestamp of last successful transaction sync. Used with Powens last_update parameter for incremental sync.';

-- Add columns to track transaction state changes
ALTER TABLE transactions 
ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN powens_last_update TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add indexes for transaction state queries
CREATE INDEX idx_transactions_is_deleted ON transactions(is_deleted);
CREATE INDEX idx_transactions_is_active ON transactions(is_active);
CREATE INDEX idx_transactions_powens_last_update ON transactions(powens_last_update);

-- Add comments for documentation
COMMENT ON COLUMN transactions.is_deleted 
IS 'True if transaction has been deleted from the bank (Powens deleted field)';

COMMENT ON COLUMN transactions.is_active 
IS 'False if transaction is ignored by PFM services (Powens active field)';

COMMENT ON COLUMN transactions.powens_last_update 
IS 'Timestamp when transaction was last updated at Powens (from last_update field)';

-- Migration completed
INSERT INTO migration_log (version, description, applied_at) 
VALUES (9, 'Add last_sync_timestamp for incremental sync and transaction state tracking', NOW());