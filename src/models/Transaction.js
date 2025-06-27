const database = require('../config/database');
const { logger, logDBOperation } = require('../utils/logger');

class TransactionModel {
  // Create a new transaction
  static async create(transactionData) {
    try {
      const {
        user_id,
        account_id,
        powens_transaction_id,
        transaction_date,
        processed_date,
        amount,
        currency,
        description,
        transaction_type,
        category,
        subcategory,
        merchant_name,
        merchant_category,
        reference_number,
        balance_after,
        is_pending,
        powens_metadata
      } = transactionData;

      const result = await database.query(`
        INSERT INTO transactions (
          user_id, account_id, powens_transaction_id, transaction_date, processed_date,
          amount, currency, description, transaction_type, category, subcategory,
          merchant_name, merchant_category, reference_number, balance_after,
          is_pending, powens_metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
      `, [
        user_id, account_id, powens_transaction_id, transaction_date, processed_date,
        amount, currency || 'EUR', description, transaction_type, category, subcategory,
        merchant_name, merchant_category, reference_number, balance_after,
        is_pending || false, JSON.stringify(powens_metadata || {})
      ]);

      logDBOperation('create', 'transactions', { transactionId: result.rows[0].id, amount });
      return result.rows[0];
    } catch (error) {
      logDBOperation('create', 'transactions', { userId: transactionData.user_id }, error);
      throw error;
    }
  }

  // Find transactions by user ID with pagination and filters
  static async findByUserId(userId, options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        accountId = null,
        startDate = null,
        endDate = null,
        category = null,
        transactionType = null,
        minAmount = null,
        maxAmount = null,
        searchTerm = null
      } = options;

      let whereClause = 'WHERE t.user_id = $1';
      let params = [userId];
      let paramIndex = 2;

      // Build dynamic WHERE clause
      if (accountId) {
        whereClause += ` AND t.account_id = $${paramIndex}`;
        params.push(accountId);
        paramIndex++;
      }

      if (startDate) {
        whereClause += ` AND t.transaction_date >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereClause += ` AND t.transaction_date <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      if (category) {
        whereClause += ` AND t.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      if (transactionType) {
        whereClause += ` AND t.transaction_type = $${paramIndex}`;
        params.push(transactionType);
        paramIndex++;
      }

      if (minAmount !== null) {
        whereClause += ` AND t.amount >= $${paramIndex}`;
        params.push(minAmount);
        paramIndex++;
      }

      if (maxAmount !== null) {
        whereClause += ` AND t.amount <= $${paramIndex}`;
        params.push(maxAmount);
        paramIndex++;
      }

      if (searchTerm) {
        whereClause += ` AND (t.description ILIKE $${paramIndex} OR t.merchant_name ILIKE $${paramIndex})`;
        params.push(`%${searchTerm}%`);
        paramIndex++;
      }

      // Add limit and offset
      const limitOffset = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await database.query(`
        SELECT t.*, ba.account_name, ba.account_type, ba.bank_name
        FROM transactions t
        LEFT JOIN bank_accounts ba ON t.account_id = ba.id
        ${whereClause}
        ORDER BY t.transaction_date DESC, t.created_at DESC
        ${limitOffset}
      `, params);

      logDBOperation('findByUserId', 'transactions', { userId, found: result.rows.length, filters: options });
      return result.rows;
    } catch (error) {
      logDBOperation('findByUserId', 'transactions', { userId }, error);
      throw error;
    }
  }

  // Get transaction count for user with filters
  static async getCountByUserId(userId, options = {}) {
    try {
      const {
        accountId = null,
        startDate = null,
        endDate = null,
        category = null,
        transactionType = null,
        minAmount = null,
        maxAmount = null,
        searchTerm = null
      } = options;

      let whereClause = 'WHERE user_id = $1';
      let params = [userId];
      let paramIndex = 2;

      // Build same WHERE clause as findByUserId
      if (accountId) {
        whereClause += ` AND account_id = $${paramIndex}`;
        params.push(accountId);
        paramIndex++;
      }

      if (startDate) {
        whereClause += ` AND transaction_date >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereClause += ` AND transaction_date <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      if (category) {
        whereClause += ` AND category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      if (transactionType) {
        whereClause += ` AND transaction_type = $${paramIndex}`;
        params.push(transactionType);
        paramIndex++;
      }

      if (minAmount !== null) {
        whereClause += ` AND amount >= $${paramIndex}`;
        params.push(minAmount);
        paramIndex++;
      }

      if (maxAmount !== null) {
        whereClause += ` AND amount <= $${paramIndex}`;
        params.push(maxAmount);
        paramIndex++;
      }

      if (searchTerm) {
        whereClause += ` AND (description ILIKE $${paramIndex} OR merchant_name ILIKE $${paramIndex})`;
        params.push(`%${searchTerm}%`);
        paramIndex++;
      }

      const result = await database.query(`
        SELECT COUNT(*) as total FROM transactions ${whereClause}
      `, params);

      return parseInt(result.rows[0].total);
    } catch (error) {
      logDBOperation('getCountByUserId', 'transactions', { userId }, error);
      throw error;
    }
  }

  // Count transactions by connection ID
  static async countByConnectionId(connectionId) {
    try {
      const result = await database.query(`
        SELECT COUNT(*) as count FROM transactions t
        JOIN bank_accounts ba ON t.account_id = ba.id
        WHERE ba.connection_id = $1
      `, [connectionId]);

      logDBOperation('countByConnectionId', 'transactions', { connectionId, count: result.rows[0].count });
      return parseInt(result.rows[0].count);
    } catch (error) {
      logDBOperation('countByConnectionId', 'transactions', { connectionId }, error);
      throw error;
    }
  }

  // Find transaction by ID
  static async findById(transactionId) {
    try {
      const result = await database.query(`
        SELECT t.*, ba.account_name, ba.account_type, ba.bank_name
        FROM transactions t
        LEFT JOIN bank_accounts ba ON t.account_id = ba.id
        WHERE t.id = $1
      `, [transactionId]);

      logDBOperation('findById', 'transactions', { transactionId, found: result.rows.length > 0 });
      return result.rows[0] || null;
    } catch (error) {
      logDBOperation('findById', 'transactions', { transactionId }, error);
      throw error;
    }
  }

  // Find or create transaction by Powens ID - ENHANCED WITH DETAILED LOGGING
  static async findOrCreateByPowensId(transactionData) {
    try {
      logger.info('🔍 ATTEMPTING TO FIND/CREATE TRANSACTION', {
        powensTransactionId: transactionData.powens_transaction_id,
        amount: transactionData.amount,
        accountId: transactionData.account_id,
        inputData: transactionData,
        inputFields: Object.keys(transactionData)
      });

      // First try to find existing transaction
      const existing = await database.query(`
        SELECT * FROM transactions WHERE powens_transaction_id = $1 AND user_id = $2
      `, [transactionData.powens_transaction_id, transactionData.user_id]);

      if (existing.rows.length > 0) {
        logger.info('✅ FOUND EXISTING TRANSACTION', {
          powensTransactionId: transactionData.powens_transaction_id,
          existingId: existing.rows[0].id,
          amount: existing.rows[0].amount
        });

        // Update existing transaction if needed (e.g., pending status changed)
        const updateData = {
          is_pending: transactionData.is_pending || false,
          balance_after: transactionData.balance_after,
          powens_metadata: JSON.stringify(transactionData.powens_metadata || {})
        };

        const result = await this.update(existing.rows[0].id, updateData);
        logger.info('✅ EXISTING TRANSACTION UPDATED', {
          powensTransactionId: transactionData.powens_transaction_id,
          transactionId: result.id,
          action: 'updated'
        });
        logDBOperation('findOrCreateByPowensId', 'transactions', { transactionId: result.id, action: 'updated' });
        return result;
      } else {
        // Create new transaction
        logger.info('🆕 CREATING NEW TRANSACTION', {
          powensTransactionId: transactionData.powens_transaction_id,
          amount: transactionData.amount,
          accountId: transactionData.account_id,
          transactionData: transactionData
        });

        const result = await this.create(transactionData);
        
        logger.info('✅ TRANSACTION CREATED SUCCESSFULLY', {
          powensTransactionId: transactionData.powens_transaction_id,
          newTransactionId: result.id,
          amount: result.amount
        });
        
        logDBOperation('findOrCreateByPowensId', 'transactions', { transactionId: result.id, action: 'created' });
        return result;
      }
    } catch (error) {
      logger.error('❌ FIND/CREATE TRANSACTION FAILED', {
        powensTransactionId: transactionData.powens_transaction_id,
        accountId: transactionData.account_id,
        error: error.message,
        stack: error.stack,
        errorCode: error.code,
        errorDetail: error.detail,
        constraint: error.constraint,
        inputData: transactionData
      });
      logDBOperation('findOrCreateByPowensId', 'transactions', { powensTransactionId: transactionData.powens_transaction_id }, error);
      throw error;
    }
  }

  // Update transaction
  static async update(transactionId, updateData) {
    try {
      const setClause = Object.keys(updateData).map((key, index) => `${key} = $${index + 2}`).join(', ');
      const values = [transactionId, ...Object.values(updateData)];
      
      const result = await database.query(`
        UPDATE transactions SET ${setClause} WHERE id = $1 RETURNING *
      `, values);

      logDBOperation('update', 'transactions', { transactionId, fieldsUpdated: Object.keys(updateData) });
      return result.rows[0];
    } catch (error) {
      logDBOperation('update', 'transactions', { transactionId }, error);
      throw error;
    }
  }

  // Get transaction summary for user
  static async getUserSummary(userId, startDate = null, endDate = null) {
    try {
      let dateFilter = '';
      let params = [userId];
      
      if (startDate && endDate) {
        dateFilter = 'AND transaction_date BETWEEN $2 AND $3';
        params.push(startDate, endDate);
      }

      const result = await database.query(`
        SELECT 
          COUNT(*) as total_transactions,
          SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_income,
          SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_expenses,
          SUM(amount) as net_flow,
          AVG(CASE WHEN amount > 0 THEN amount ELSE NULL END) as avg_income,
          AVG(CASE WHEN amount < 0 THEN ABS(amount) ELSE NULL END) as avg_expense,
          COUNT(CASE WHEN is_pending THEN 1 ELSE NULL END) as pending_transactions
        FROM transactions 
        WHERE user_id = $1 ${dateFilter}
      `, params);

      logDBOperation('getUserSummary', 'transactions', { userId, period: startDate ? 'filtered' : 'all' });
      return result.rows[0];
    } catch (error) {
      logDBOperation('getUserSummary', 'transactions', { userId }, error);
      throw error;
    }
  }

  // Get spending by category
  static async getCategoryBreakdown(userId, startDate = null, endDate = null) {
    try {
      let dateFilter = '';
      let params = [userId];
      
      if (startDate && endDate) {
        dateFilter = 'AND transaction_date BETWEEN $2 AND $3';
        params.push(startDate, endDate);
      }

      const result = await database.query(`
        SELECT 
          category,
          COUNT(*) as transaction_count,
          SUM(ABS(amount)) as total_amount,
          AVG(ABS(amount)) as avg_amount
        FROM transactions 
        WHERE user_id = $1 AND amount < 0 ${dateFilter}
        GROUP BY category
        ORDER BY total_amount DESC
      `, params);

      logDBOperation('getCategoryBreakdown', 'transactions', { userId, categories: result.rows.length });
      return result.rows;
    } catch (error) {
      logDBOperation('getCategoryBreakdown', 'transactions', { userId }, error);
      throw error;
    }
  }

  // Mark transaction as duplicate
  static async markAsDuplicate(transactionId) {
    try {
      const result = await database.query(`
        UPDATE transactions SET is_duplicate = true WHERE id = $1 RETURNING *
      `, [transactionId]);

      logDBOperation('markAsDuplicate', 'transactions', { transactionId });
      return result.rows[0];
    } catch (error) {
      logDBOperation('markAsDuplicate', 'transactions', { transactionId }, error);
      throw error;
    }
  }

  // Auto-categorize transaction based on description/merchant
  static async autoCategorize(transactionId, category, subcategory = null) {
    try {
      const result = await database.query(`
        UPDATE transactions SET category = $1, subcategory = $2 WHERE id = $3 RETURNING *
      `, [category, subcategory, transactionId]);

      logDBOperation('autoCategorize', 'transactions', { transactionId, category });
      return result.rows[0];
    } catch (error) {
      logDBOperation('autoCategorize', 'transactions', { transactionId }, error);
      throw error;
    }
  }
}

module.exports = TransactionModel;