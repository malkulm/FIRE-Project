const database = require('../../shared/config/database');
const { logger, logDBOperation } = require('../../shared/utils/logger');

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
        is_deleted,
        is_active,
        powens_last_update,
        powens_metadata
      } = transactionData;

      const result = await database.query(`
        INSERT INTO transactions (
          user_id, account_id, powens_transaction_id, transaction_date, processed_date,
          amount, currency, description, transaction_type, category, subcategory,
          merchant_name, merchant_category, reference_number, balance_after,
          is_pending, is_deleted, is_active, powens_last_update, powens_metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *
      `, [
        user_id, account_id, powens_transaction_id, transaction_date, processed_date,
        amount, currency || 'EUR', description, transaction_type, category, subcategory,
        merchant_name, merchant_category, reference_number, balance_after,
        is_pending || false, is_deleted || false, is_active !== false, 
        powens_last_update, JSON.stringify(powens_metadata || {})
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
        description: transactionData.description?.substring(0, 50) + '...'
      });

      // Use a database transaction to ensure atomicity
      return await database.transaction(async (client) => {
        // First try to find existing transaction
        const existing = await client.query(`
          SELECT * FROM transactions WHERE powens_transaction_id = $1 AND user_id = $2
        `, [transactionData.powens_transaction_id, transactionData.user_id]);

        if (existing.rows.length > 0) {
          logger.info('✅ FOUND EXISTING TRANSACTION', {
            powensTransactionId: transactionData.powens_transaction_id,
            existingId: existing.rows[0].id,
            existingAmount: existing.rows[0].amount,
            newAmount: transactionData.amount
          });

          // Check if update is needed using timestamp comparison for conflict resolution
          const existingTx = existing.rows[0];
          const newLastUpdate = transactionData.powens_last_update;
          const existingLastUpdate = existingTx.powens_last_update;
          
          // Only update if the new data is newer OR if we don't have a timestamp
          const shouldUpdate = !existingLastUpdate || 
                              (newLastUpdate && new Date(newLastUpdate) > new Date(existingLastUpdate)) ||
                              existingTx.is_pending !== (transactionData.is_pending || false) ||
                              existingTx.is_deleted !== (transactionData.is_deleted || false) ||
                              existingTx.is_active !== (transactionData.is_active !== false) ||
                              existingTx.balance_after !== transactionData.balance_after ||
                              existingTx.amount !== transactionData.amount ||
                              existingTx.description !== transactionData.description;

          if (shouldUpdate) {
            logger.info('🔄 UPDATING EXISTING TRANSACTION', {
              powensTransactionId: transactionData.powens_transaction_id,
              timestampComparison: {
                existing: existingLastUpdate,
                new: newLastUpdate,
                isNewer: newLastUpdate && existingLastUpdate ? new Date(newLastUpdate) > new Date(existingLastUpdate) : 'no_timestamp'
              },
              changes: {
                is_pending: { old: existingTx.is_pending, new: transactionData.is_pending || false },
                is_deleted: { old: existingTx.is_deleted, new: transactionData.is_deleted || false },
                is_active: { old: existingTx.is_active, new: transactionData.is_active !== false },
                balance_after: { old: existingTx.balance_after, new: transactionData.balance_after },
                amount: { old: existingTx.amount, new: transactionData.amount }
              }
            });

            // Update the transaction with proper handling including new state fields
            const result = await client.query(`
              UPDATE transactions SET 
                is_pending = $1,
                is_deleted = $2,
                is_active = $3,
                balance_after = $4,
                amount = $5,
                description = $6,
                transaction_date = $7,
                processed_date = $8,
                powens_last_update = $9,
                powens_metadata = $10,
                updated_at = NOW()
              WHERE id = $11
              RETURNING *
            `, [
              transactionData.is_pending || false,
              transactionData.is_deleted || false,
              transactionData.is_active !== false,
              transactionData.balance_after,
              transactionData.amount,
              transactionData.description,
              transactionData.transaction_date,
              transactionData.processed_date,
              transactionData.powens_last_update,
              JSON.stringify(transactionData.powens_metadata || {}),
              existingTx.id
            ]);

            logger.info('✅ EXISTING TRANSACTION UPDATED', {
              powensTransactionId: transactionData.powens_transaction_id,
              transactionId: result.rows[0].id,
              action: 'updated'
            });
            
            logDBOperation('findOrCreateByPowensId', 'transactions', { transactionId: result.rows[0].id, action: 'updated' });
            return result.rows[0];
          } else {
            logger.info('✅ EXISTING TRANSACTION UP TO DATE', {
              powensTransactionId: transactionData.powens_transaction_id,
              transactionId: existingTx.id,
              action: 'no_update_needed'
            });
            
            logDBOperation('findOrCreateByPowensId', 'transactions', { transactionId: existingTx.id, action: 'no_update_needed' });
            return existingTx;
          }
        } else {
          // Create new transaction
          logger.info('🆕 CREATING NEW TRANSACTION', {
            powensTransactionId: transactionData.powens_transaction_id,
            amount: transactionData.amount,
            accountId: transactionData.account_id,
            description: transactionData.description?.substring(0, 50) + '...'
          });

          const result = await client.query(`
            INSERT INTO transactions (
              user_id, account_id, powens_transaction_id, transaction_date, processed_date,
              amount, currency, description, transaction_type, category, subcategory,
              merchant_name, merchant_category, reference_number, balance_after,
              is_pending, is_deleted, is_active, powens_last_update, powens_metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
            RETURNING *
          `, [
            transactionData.user_id, 
            transactionData.account_id, 
            transactionData.powens_transaction_id, 
            transactionData.transaction_date, 
            transactionData.processed_date,
            transactionData.amount, 
            transactionData.currency || 'EUR', 
            transactionData.description, 
            transactionData.transaction_type, 
            transactionData.category, 
            transactionData.subcategory,
            transactionData.merchant_name, 
            transactionData.merchant_category, 
            transactionData.reference_number, 
            transactionData.balance_after,
            transactionData.is_pending || false,
            transactionData.is_deleted || false,
            transactionData.is_active !== false,
            transactionData.powens_last_update,
            JSON.stringify(transactionData.powens_metadata || {})
          ]);
          
          logger.info('✅ TRANSACTION CREATED SUCCESSFULLY', {
            powensTransactionId: transactionData.powens_transaction_id,
            newTransactionId: result.rows[0].id,
            amount: result.rows[0].amount
          });
          
          logDBOperation('findOrCreateByPowensId', 'transactions', { transactionId: result.rows[0].id, action: 'created' });
          return result.rows[0];
        }
      });
    } catch (error) {
      // Enhanced error logging for debugging
      logger.error('❌ FIND/CREATE TRANSACTION FAILED', {
        powensTransactionId: transactionData.powens_transaction_id,
        accountId: transactionData.account_id,
        userId: transactionData.user_id,
        error: error.message,
        errorCode: error.code,
        errorDetail: error.detail,
        constraint: error.constraint,
        severity: error.severity,
        sqlState: error.code,
        transactionAmount: transactionData.amount,
        transactionDate: transactionData.transaction_date
      });
      
      logDBOperation('findOrCreateByPowensId', 'transactions', { 
        powensTransactionId: transactionData.powens_transaction_id,
        error: error.message,
        errorCode: error.code 
      }, error);
      
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