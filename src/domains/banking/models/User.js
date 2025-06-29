const database = require('../../shared/config/database');
const { logger, logDBOperation } = require('../../shared/utils/logger');
const crypto = require('crypto');

class UserModel {
  // Create a new user
  static async create(userData) {
    try {
      const { email, password_hash, first_name, last_name, date_of_birth, phone } = userData;
      
      const result = await database.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, date_of_birth, phone)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [email, password_hash, first_name, last_name, date_of_birth, phone]);
      
      logDBOperation('create', 'users', { userId: result.rows[0].id });
      return result.rows[0];
    } catch (error) {
      logDBOperation('create', 'users', { email }, error);
      throw error;
    }
  }

  // Find user by email
  static async findByEmail(email) {
    try {
      const result = await database.query('SELECT * FROM users WHERE email = $1', [email]);
      logDBOperation('findByEmail', 'users', { found: result.rows.length > 0 });
      return result.rows[0] || null;
    } catch (error) {
      logDBOperation('findByEmail', 'users', { email }, error);
      throw error;
    }
  }

  // Find user by ID
  static async findById(id) {
    try {
      const result = await database.query('SELECT * FROM users WHERE id = $1', [id]);
      logDBOperation('findById', 'users', { found: result.rows.length > 0 });
      return result.rows[0] || null;
    } catch (error) {
      logDBOperation('findById', 'users', { id }, error);
      throw error;
    }
  }

  // Find user by Powens user ID
  static async findByPowensUserId(powensUserId) {
    try {
      const result = await database.query('SELECT * FROM users WHERE powens_user_id = $1', [powensUserId]);
      logDBOperation('findByPowensUserId', 'users', { found: result.rows.length > 0 });
      return result.rows[0] || null;
    } catch (error) {
      logDBOperation('findByPowensUserId', 'users', { powensUserId }, error);
      throw error;
    }
  }

  // Update user
  static async update(id, updateData) {
    try {
      const setClause = Object.keys(updateData).map((key, index) => `${key} = $${index + 2}`).join(', ');
      const values = [id, ...Object.values(updateData)];
      
      const result = await database.query(`
        UPDATE users SET ${setClause} WHERE id = $1 RETURNING *
      `, values);
      
      logDBOperation('update', 'users', { userId: id, fieldsUpdated: Object.keys(updateData) });
      return result.rows[0];
    } catch (error) {
      logDBOperation('update', 'users', { userId: id }, error);
      throw error;
    }
  }

  // Update last login
  static async updateLastLogin(id) {
    try {
      const result = await database.query(`
        UPDATE users SET last_login_at = NOW() WHERE id = $1 RETURNING *
      `, [id]);
      
      logDBOperation('updateLastLogin', 'users', { userId: id });
      return result.rows[0];
    } catch (error) {
      logDBOperation('updateLastLogin', 'users', { userId: id }, error);
      throw error;
    }
  }

  // Store/Update Powens permanent token for user
  static async updatePowensToken(userId, tokenData) {
    try {
      const { 
        powensUserId, 
        permanentToken, 
        tokenType = 'permanent',
        expiresAt = null 
      } = tokenData;

      const result = await database.query(`
        UPDATE users SET 
          powens_user_id = $2,
          powens_permanent_token = $3,
          powens_token_created_at = NOW(),
          powens_token_expires_at = $4,
          powens_token_type = $5
        WHERE id = $1 
        RETURNING id, powens_user_id, powens_token_type, powens_token_created_at, powens_token_expires_at
      `, [userId, powensUserId, permanentToken, expiresAt, tokenType]);
      
      logDBOperation('updatePowensToken', 'users', { 
        userId, 
        powensUserId, 
        tokenType,
        hasToken: !!permanentToken 
      });
      
      return result.rows[0];
    } catch (error) {
      logDBOperation('updatePowensToken', 'users', { userId }, error);
      throw error;
    }
  }

  // Get user's Powens token (with security considerations)
  static async getPowensToken(userId) {
    try {
      const result = await database.query(`
        SELECT id, powens_user_id, powens_permanent_token, 
               powens_token_created_at, powens_token_expires_at, powens_token_type
        FROM users 
        WHERE id = $1
      `, [userId]);
      
      const userData = result.rows[0];
      if (!userData) {
        logDBOperation('getPowensToken', 'users', { userId, found: false });
        return null;
      }

      // Check token expiration
      const isExpired = userData.powens_token_expires_at && 
                       new Date() >= new Date(userData.powens_token_expires_at);

      logDBOperation('getPowensToken', 'users', { 
        userId, 
        found: true, 
        hasToken: !!userData.powens_permanent_token,
        isExpired 
      });
      
      return {
        ...userData,
        isExpired
      };
    } catch (error) {
      logDBOperation('getPowensToken', 'users', { userId }, error);
      throw error;
    }
  }

  // Clear/Revoke Powens token
  static async revokePowensToken(userId) {
    try {
      const result = await database.query(`
        UPDATE users SET 
          powens_permanent_token = NULL,
          powens_token_expires_at = NOW()
        WHERE id = $1 
        RETURNING id
      `, [userId]);
      
      logDBOperation('revokePowensToken', 'users', { userId });
      return result.rows[0];
    } catch (error) {
      logDBOperation('revokePowensToken', 'users', { userId }, error);
      throw error;
    }
  }

  // Get user with preferences
  static async findWithPreferences(id) {
    try {
      const result = await database.query(`
        SELECT u.*, up.currency, up.language, up.theme, up.notifications_enabled,
               up.email_notifications, up.transaction_categories, up.dashboard_widgets
        FROM users u
        LEFT JOIN user_preferences up ON u.id = up.user_id
        WHERE u.id = $1
      `, [id]);
      
      logDBOperation('findWithPreferences', 'users', { found: result.rows.length > 0 });
      return result.rows[0] || null;
    } catch (error) {
      logDBOperation('findWithPreferences', 'users', { userId: id }, error);
      throw error;
    }
  }

  // Get user with Powens data (including token info but not the actual token)
  static async findWithPowensInfo(id) {
    try {
      const result = await database.query(`
        SELECT u.id, u.email, u.first_name, u.last_name,
               u.powens_user_id, u.powens_token_created_at, 
               u.powens_token_expires_at, u.powens_token_type,
               (u.powens_permanent_token IS NOT NULL) as has_powens_token,
               (u.powens_token_expires_at IS NULL OR u.powens_token_expires_at > NOW()) as token_valid
        FROM users u
        WHERE u.id = $1
      `, [id]);
      
      logDBOperation('findWithPowensInfo', 'users', { found: result.rows.length > 0 });
      return result.rows[0] || null;
    } catch (error) {
      logDBOperation('findWithPowensInfo', 'users', { userId: id }, error);
      throw error;
    }
  }
}

module.exports = UserModel;
