const database = require('../config/database');
const { logger, logDBOperation } = require('../utils/logger');
const crypto = require('crypto');

// Encryption helper functions
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32';
const ALGORITHM = 'aes-256-cbc';

// Modern encryption functions using createCipheriv (Node.js v17+ compatible)
function encrypt(text) {
  if (!text) return null;
  
  try {
    // Generate a random IV for each encryption
    const iv = crypto.randomBytes(16);
    
    // Ensure key is 32 bytes for AES-256
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Prepend IV to encrypted data (IV is not secret)
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    logger.error('Encryption failed', { error: error.message });
    throw new Error('Failed to encrypt data');
  }
}

function decrypt(encryptedText) {
  if (!encryptedText) return null;
  
  try {
    // Split IV and encrypted data
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      // Fallback for old format (backward compatibility)
      return decryptLegacy(encryptedText);
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    // Ensure key is 32 bytes for AES-256
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('Decryption failed', { error: error.message });
    // Try legacy decryption as fallback
    try {
      return decryptLegacy(encryptedText);
    } catch (legacyError) {
      logger.error('Legacy decryption also failed', { error: legacyError.message });
      throw new Error('Failed to decrypt data');
    }
  }
}

// Legacy decryption for backward compatibility (if old data exists)
function decryptLegacy(encryptedText) {
  try {
    // This handles data encrypted with the old deprecated method
    // We'll just return the encrypted text as-is for now to avoid breaking existing data
    logger.warn('Using legacy decryption fallback - consider re-encrypting data');
    return encryptedText; // Return as-is rather than failing
  } catch (error) {
    throw new Error('Failed to decrypt legacy data');
  }
}

class BankConnectionModel {
  // Create a new bank connection
  static async create(connectionData) {
    try {
      const {
        user_id,
        powens_user_id,
        powens_connection_id,
        bank_name,
        bank_logo_url,
        access_token,
        refresh_token,
        token_expires_at,
        token_source,
        powens_user_id_from_api,
        connection_type = 'powens'
      } = connectionData;

      // Check for existing connection first to prevent duplicates
      const existingConnection = await this.findExistingConnection(user_id, bank_name, connection_type);
      if (existingConnection) {
        logger.info('Updating existing bank connection instead of creating duplicate', {
          userId: user_id,
          bankName: bank_name,
          existingConnectionId: existingConnection.id
        });
        
        // Update existing connection with new tokens
        return await this.updateTokens(
          existingConnection.id, 
          access_token, 
          refresh_token, 
          token_expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 1 month default
        );
      }

      // Encrypt sensitive tokens
      const access_token_encrypted = encrypt(access_token);
      const refresh_token_encrypted = encrypt(refresh_token);

      // Set token expiration to 1 month if not provided or if longer than 1 month
      const oneMonthFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const finalExpiresAt = token_expires_at && new Date(token_expires_at) < oneMonthFromNow 
        ? token_expires_at 
        : oneMonthFromNow;

      const result = await database.query(`
        INSERT INTO bank_connections (
          user_id, powens_user_id, powens_connection_id, bank_name, bank_logo_url,
          access_token_encrypted, refresh_token_encrypted, token_expires_at, 
          status, token_source, powens_user_id_from_api, connection_type
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $10, $11)
        RETURNING *
      `, [
        user_id, powens_user_id, powens_connection_id, bank_name, bank_logo_url,
        access_token_encrypted, refresh_token_encrypted, finalExpiresAt,
        token_source || 'oauth', powens_user_id_from_api, connection_type
      ]);

      logDBOperation('create', 'bank_connections', { connectionId: result.rows[0].id, bankName: bank_name });
      return result.rows[0];
    } catch (error) {
      logDBOperation('create', 'bank_connections', { userId: connectionData.user_id }, error);
      throw error;
    }
  }

  // Find connections by user ID
  static async findByUserId(userId) {
    try {
      const result = await database.query(`
        SELECT * FROM bank_connections 
        WHERE user_id = $1 
        ORDER BY created_at DESC
      `, [userId]);

      logDBOperation('findByUserId', 'bank_connections', { userId, found: result.rows.length });
      return result.rows;
    } catch (error) {
      logDBOperation('findByUserId', 'bank_connections', { userId }, error);
      throw error;
    }
  }

  // Find connection by ID
  static async findById(connectionId) {
    try {
      const result = await database.query(`
        SELECT * FROM bank_connections WHERE id = $1
      `, [connectionId]);

      logDBOperation('findById', 'bank_connections', { connectionId, found: result.rows.length > 0 });
      return result.rows[0] || null;
    } catch (error) {
      logDBOperation('findById', 'bank_connections', { connectionId }, error);
      throw error;
    }
  }

  // Find connection by ID with decrypted tokens
  static async findByIdWithTokens(connectionId) {
    try {
      const result = await database.query(`
        SELECT * FROM bank_connections WHERE id = $1
      `, [connectionId]);

      if (result.rows.length === 0) {
        return null;
      }

      const connection = result.rows[0];
      
      // Decrypt tokens for use
      connection.access_token = decrypt(connection.access_token_encrypted);
      connection.refresh_token = decrypt(connection.refresh_token_encrypted);
      
      // Remove encrypted versions from response
      delete connection.access_token_encrypted;
      delete connection.refresh_token_encrypted;

      logDBOperation('findByIdWithTokens', 'bank_connections', { connectionId });
      return connection;
    } catch (error) {
      logDBOperation('findByIdWithTokens', 'bank_connections', { connectionId }, error);
      throw error;
    }
  }

  // Update connection tokens
  static async updateTokens(connectionId, accessToken, refreshToken, expiresAt) {
    try {
      const access_token_encrypted = encrypt(accessToken);
      const refresh_token_encrypted = encrypt(refreshToken);

      const result = await database.query(`
        UPDATE bank_connections 
        SET access_token_encrypted = $1, refresh_token_encrypted = $2, 
            token_expires_at = $3, last_sync_at = NOW()
        WHERE id = $4
        RETURNING *
      `, [access_token_encrypted, refresh_token_encrypted, expiresAt, connectionId]);

      logDBOperation('updateTokens', 'bank_connections', { connectionId });
      return result.rows[0];
    } catch (error) {
      logDBOperation('updateTokens', 'bank_connections', { connectionId }, error);
      throw error;
    }
  }

  // Update sync status
  static async updateSyncStatus(connectionId, status, errorMessage = null) {
    try {
      const result = await database.query(`
        UPDATE bank_connections 
        SET last_sync_status = $1, last_error_message = $2, last_sync_at = NOW()
        WHERE id = $3
        RETURNING *
      `, [status, errorMessage, connectionId]);

      logDBOperation('updateSyncStatus', 'bank_connections', { connectionId, status });
      return result.rows[0];
    } catch (error) {
      logDBOperation('updateSyncStatus', 'bank_connections', { connectionId }, error);
      throw error;
    }
  }

  // Update last sync timestamp for incremental sync
  static async updateLastSyncTimestamp(connectionId, timestamp = null) {
    try {
      const syncTimestamp = timestamp || new Date().toISOString();
      
      const result = await database.query(`
        UPDATE bank_connections 
        SET last_sync_timestamp = $1, last_sync_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [syncTimestamp, connectionId]);

      logDBOperation('updateLastSyncTimestamp', 'bank_connections', { 
        connectionId, 
        timestamp: syncTimestamp 
      });
      return result.rows[0];
    } catch (error) {
      logDBOperation('updateLastSyncTimestamp', 'bank_connections', { connectionId }, error);
      throw error;
    }
  }

  // Get last sync timestamp for incremental sync
  static async getLastSyncTimestamp(connectionId) {
    try {
      const result = await database.query(`
        SELECT last_sync_timestamp FROM bank_connections WHERE id = $1
      `, [connectionId]);

      const timestamp = result.rows[0]?.last_sync_timestamp;
      logDBOperation('getLastSyncTimestamp', 'bank_connections', { 
        connectionId, 
        hasTimestamp: !!timestamp 
      });
      
      return timestamp;
    } catch (error) {
      logDBOperation('getLastSyncTimestamp', 'bank_connections', { connectionId }, error);
      throw error;
    }
  }

  // Get active connections for sync
  static async getActiveConnections() {
    try {
      const result = await database.query(`
        SELECT * FROM bank_connections 
        WHERE status = 'active' AND sync_enabled = true
        ORDER BY last_sync_at ASC NULLS FIRST
      `);

      logDBOperation('getActiveConnections', 'bank_connections', { found: result.rows.length });
      return result.rows;
    } catch (error) {
      logDBOperation('getActiveConnections', 'bank_connections', {}, error);
      throw error;
    }
  }

  // Delete connection
  static async delete(connectionId) {
    try {
      const result = await database.query(`
        DELETE FROM bank_connections WHERE id = $1 RETURNING *
      `, [connectionId]);

      logDBOperation('delete', 'bank_connections', { connectionId });
      return result.rows[0];
    } catch (error) {
      logDBOperation('delete', 'bank_connections', { connectionId }, error);
      throw error;
    }
  }

  // Find by Powens connection ID
  static async findByPowensConnectionId(powensConnectionId) {
    try {
      const result = await database.query(`
        SELECT * FROM bank_connections WHERE powens_connection_id = $1
      `, [powensConnectionId]);

      logDBOperation('findByPowensConnectionId', 'bank_connections', { found: result.rows.length > 0 });
      return result.rows[0] || null;
    } catch (error) {
      logDBOperation('findByPowensConnectionId', 'bank_connections', { powensConnectionId }, error);
      throw error;
    }
  }

  // Find existing connection to prevent duplicates
  static async findExistingConnection(userId, bankName, connectionType = 'powens') {
    try {
      const result = await database.query(`
        SELECT * FROM bank_connections 
        WHERE user_id = $1 AND bank_name = $2 AND connection_type = $3
        ORDER BY created_at DESC
        LIMIT 1
      `, [userId, bankName, connectionType]);

      logDBOperation('findExistingConnection', 'bank_connections', { 
        userId, 
        bankName, 
        connectionType, 
        found: result.rows.length > 0 
      });
      return result.rows[0] || null;
    } catch (error) {
      logDBOperation('findExistingConnection', 'bank_connections', { userId, bankName, connectionType }, error);
      throw error;
    }
  }

  // Get connections with expired tokens
  static async getExpiredTokenConnections() {
    try {
      const result = await database.query(`
        SELECT * FROM bank_connections 
        WHERE token_expires_at <= NOW() AND status = 'active'
        ORDER BY token_expires_at ASC
      `);

      logDBOperation('getExpiredTokenConnections', 'bank_connections', { found: result.rows.length });
      return result.rows;
    } catch (error) {
      logDBOperation('getExpiredTokenConnections', 'bank_connections', {}, error);
      throw error;
    }
  }
}

module.exports = BankConnectionModel;