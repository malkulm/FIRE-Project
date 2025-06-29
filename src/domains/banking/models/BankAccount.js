const database = require('../../shared/config/database');
const { logger, logDBOperation } = require('../../shared/utils/logger');

class BankAccountModel {
  // Create a new bank account
  static async create(accountData) {
    try {
      const {
        user_id,
        connection_id,
        powens_account_id,
        account_number,
        iban,
        bic,
        account_name,
        account_type,
        currency,
        balance,
        available_balance,
        credit_limit,
        interest_rate,
        bank_name,
        account_metadata
      } = accountData;

      const result = await database.query(`
        INSERT INTO bank_accounts (
          user_id, connection_id, powens_account_id, account_number, iban, bic,
          account_name, account_type, currency, balance, available_balance,
          credit_limit, interest_rate, bank_name, account_metadata, last_balance_update
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
        RETURNING *
      `, [
        user_id, connection_id, powens_account_id, account_number, iban, bic,
        account_name, account_type, currency || 'EUR', balance || 0, available_balance,
        credit_limit, interest_rate, bank_name, JSON.stringify(account_metadata || {})
      ]);

      logDBOperation('create', 'bank_accounts', { accountId: result.rows[0].id, accountName: account_name });
      return result.rows[0];
    } catch (error) {
      logDBOperation('create', 'bank_accounts', { userId: accountData.user_id }, error);
      throw error;
    }
  }

  // Find accounts by user ID
  static async findByUserId(userId) {
    try {
      const result = await database.query(`
        SELECT ba.*, bc.bank_name as connection_bank_name, bc.status as connection_status
        FROM bank_accounts ba
        LEFT JOIN bank_connections bc ON ba.connection_id = bc.id
        WHERE ba.user_id = $1 AND ba.is_active = true
        ORDER BY ba.is_primary DESC, ba.balance DESC
      `, [userId]);

      logDBOperation('findByUserId', 'bank_accounts', { userId, found: result.rows.length });
      return result.rows;
    } catch (error) {
      logDBOperation('findByUserId', 'bank_accounts', { userId }, error);
      throw error;
    }
  }

  // Find account by ID
  static async findById(accountId) {
    try {
      const result = await database.query(`
        SELECT ba.*, bc.bank_name as connection_bank_name, bc.status as connection_status
        FROM bank_accounts ba
        LEFT JOIN bank_connections bc ON ba.connection_id = bc.id
        WHERE ba.id = $1
      `, [accountId]);

      logDBOperation('findById', 'bank_accounts', { accountId, found: result.rows.length > 0 });
      return result.rows[0] || null;
    } catch (error) {
      logDBOperation('findById', 'bank_accounts', { accountId }, error);
      throw error;
    }
  }

  // Find accounts by connection ID
  static async findByConnectionId(connectionId) {
    try {
      const result = await database.query(`
        SELECT * FROM bank_accounts 
        WHERE connection_id = $1 AND is_active = true
        ORDER BY account_name
      `, [connectionId]);

      logDBOperation('findByConnectionId', 'bank_accounts', { connectionId, found: result.rows.length });
      return result.rows;
    } catch (error) {
      logDBOperation('findByConnectionId', 'bank_accounts', { connectionId }, error);
      throw error;
    }
  }

  // Count accounts by connection ID
  static async countByConnectionId(connectionId) {
    try {
      const result = await database.query(`
        SELECT COUNT(*) as count FROM bank_accounts 
        WHERE connection_id = $1 AND is_active = true
      `, [connectionId]);

      logDBOperation('countByConnectionId', 'bank_accounts', { connectionId, count: result.rows[0].count });
      return parseInt(result.rows[0].count);
    } catch (error) {
      logDBOperation('countByConnectionId', 'bank_accounts', { connectionId }, error);
      throw error;
    }
  }

  // Find account by Powens ID
  static async findByPowensId(powensAccountId) {
    try {
      logger.info('🔍 SEARCHING FOR ACCOUNT BY POWENS ID', {
        powensAccountId: powensAccountId
      });

      const result = await database.query(`
        SELECT * FROM bank_accounts WHERE powens_account_id = $1
      `, [powensAccountId]);

      logger.info('📊 ACCOUNT SEARCH RESULT', {
        powensAccountId: powensAccountId,
        found: result.rows.length > 0,
        resultCount: result.rows.length
      });

      logDBOperation('findByPowensId', 'bank_accounts', { powensAccountId, found: result.rows.length > 0 });
      return result.rows[0] || null;
    } catch (error) {
      logger.error('❌ ACCOUNT SEARCH FAILED', {
        powensAccountId: powensAccountId,
        error: error.message,
        stack: error.stack
      });
      logDBOperation('findByPowensId', 'bank_accounts', { powensAccountId }, error);
      throw error;
    }
  }

  // Update account balance
  static async updateBalance(accountId, balance, availableBalance = null) {
    try {
      const result = await database.query(`
        UPDATE bank_accounts 
        SET balance = $1, available_balance = $2, last_balance_update = NOW()
        WHERE id = $3
        RETURNING *
      `, [balance, availableBalance, accountId]);

      logDBOperation('updateBalance', 'bank_accounts', { accountId, balance });
      return result.rows[0];
    } catch (error) {
      logDBOperation('updateBalance', 'bank_accounts', { accountId }, error);
      throw error;
    }
  }

  // Update account information
  static async update(accountId, updateData) {
    try {
      const setClause = Object.keys(updateData).map((key, index) => `${key} = $${index + 2}`).join(', ');
      const values = [accountId, ...Object.values(updateData)];
      
      const result = await database.query(`
        UPDATE bank_accounts SET ${setClause} WHERE id = $1 RETURNING *
      `, values);

      logDBOperation('update', 'bank_accounts', { accountId, fieldsUpdated: Object.keys(updateData) });
      return result.rows[0];
    } catch (error) {
      logDBOperation('update', 'bank_accounts', { accountId }, error);
      throw error;
    }
  }

  // Set primary account
  static async setPrimary(userId, accountId) {
    try {
      // Use transaction to ensure only one primary account
      await database.transaction(async (client) => {
        // Remove primary flag from all user accounts
        await client.query(`
          UPDATE bank_accounts SET is_primary = false WHERE user_id = $1
        `, [userId]);

        // Set the specified account as primary
        await client.query(`
          UPDATE bank_accounts SET is_primary = true WHERE id = $1 AND user_id = $2
        `, [accountId, userId]);
      });

      logDBOperation('setPrimary', 'bank_accounts', { userId, accountId });
      return await this.findById(accountId);
    } catch (error) {
      logDBOperation('setPrimary', 'bank_accounts', { userId, accountId }, error);
      throw error;
    }
  }

  // Find or create account by Powens ID - ENHANCED WITH DETAILED LOGGING
  static async findOrCreateByPowensId(accountData) {
    try {
      logger.info('🔍 ATTEMPTING TO FIND/CREATE ACCOUNT', {
        powensAccountId: accountData.powens_account_id,
        accountName: accountData.account_name,
        inputData: accountData,
        inputFields: Object.keys(accountData)
      });

      // Try to find existing account first
      const existing = await this.findByPowensAccountId(accountData.powens_account_id);
      
      if (existing) {
        logger.info('✅ FOUND EXISTING ACCOUNT', {
          powensAccountId: accountData.powens_account_id,
          existingId: existing.id
        });
        
        // Update existing account
        const updateData = {
          account_name: accountData.account_name,
          balance: accountData.balance,
          available_balance: accountData.available_balance,
          account_metadata: JSON.stringify(accountData.account_metadata || {}),
          last_balance_update: new Date()
        };

        const result = await this.update(existing.id, updateData);
        logger.info('✅ EXISTING ACCOUNT UPDATED', {
          powensAccountId: accountData.powens_account_id,
          accountId: result.id,
          action: 'updated'
        });
        logDBOperation('findOrCreateByPowensId', 'bank_accounts', { accountId: result.id, action: 'updated' });
        return result;
      } else {
        // Create new account
        logger.info('🆕 CREATING NEW ACCOUNT', {
          powensAccountId: accountData.powens_account_id,
          accountData: accountData
        });

        const result = await this.create(accountData);
        
        logger.info('✅ ACCOUNT CREATED SUCCESSFULLY', {
          powensAccountId: accountData.powens_account_id,
          newAccountId: result.id
        });
        
        logDBOperation('findOrCreateByPowensId', 'bank_accounts', { accountId: result.id, action: 'created' });
        return result;
      }
    } catch (error) {
      logger.error('❌ FIND/CREATE ACCOUNT FAILED', {
        powensAccountId: accountData.powens_account_id,
        error: error.message,
        stack: error.stack,
        errorCode: error.code,
        errorDetail: error.detail,
        constraint: error.constraint,
        inputData: accountData
      });
      logDBOperation('findOrCreateByPowensId', 'bank_accounts', { powensAccountId: accountData.powens_account_id }, error);
      throw error;
    }
  }

  // Enhanced method name for consistency
  static async findByPowensAccountId(powensAccountId) {
    try {
      logger.info('🔍 SEARCHING FOR ACCOUNT BY POWENS ID', {
        powensAccountId: powensAccountId
      });

      const result = await database.query(`
        SELECT * FROM bank_accounts WHERE powens_account_id = $1
      `, [powensAccountId]);

      logger.info('📊 ACCOUNT SEARCH RESULT', {
        powensAccountId: powensAccountId,
        found: result.rows.length > 0,
        resultCount: result.rows.length
      });

      return result.rows[0] || null;
    } catch (error) {
      logger.error('❌ ACCOUNT SEARCH FAILED', {
        powensAccountId: powensAccountId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // Get account summary for user
  static async getUserSummary(userId) {
    try {
      const result = await database.query(`
        SELECT 
          COUNT(*) as total_accounts,
          SUM(CASE WHEN account_type = 'checking' THEN balance ELSE 0 END) as checking_balance,
          SUM(CASE WHEN account_type = 'savings' THEN balance ELSE 0 END) as savings_balance,
          SUM(CASE WHEN account_type = 'investment' THEN balance ELSE 0 END) as investment_balance,
          SUM(CASE WHEN account_type = 'credit' THEN balance ELSE 0 END) as credit_balance,
          SUM(balance) as total_balance,
          MAX(last_balance_update) as last_update
        FROM bank_accounts 
        WHERE user_id = $1 AND is_active = true
      `, [userId]);

      logDBOperation('getUserSummary', 'bank_accounts', { userId });
      return result.rows[0];
    } catch (error) {
      logDBOperation('getUserSummary', 'bank_accounts', { userId }, error);
      throw error;
    }
  }

  // Deactivate account
  static async deactivate(accountId) {
    try {
      const result = await database.query(`
        UPDATE bank_accounts SET is_active = false WHERE id = $1 RETURNING *
      `, [accountId]);

      logDBOperation('deactivate', 'bank_accounts', { accountId });
      return result.rows[0];
    } catch (error) {
      logDBOperation('deactivate', 'bank_accounts', { accountId }, error);
      throw error;
    }
  }
}

module.exports = BankAccountModel;