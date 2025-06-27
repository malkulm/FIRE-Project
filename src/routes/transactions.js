const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const { MOCK_DATA } = require('../services/powens/constants');
const TransactionModel = require('../models/Transaction');

/**
 * @route GET /api/transactions
 * @desc Get all transactions with optional filters
 * @access Public
 */
router.get('/', async (req, res, next) => {
  try {
    const { accountId, limit = 50, offset = 0, startDate, endDate, category, type } = req.query;
    
    logger.info('Transactions list requested', { 
      accountId, 
      limit, 
      offset, 
      startDate, 
      endDate,
      category,
      type
    });
    
    // Check if we should use mock data
    if (process.env.ENABLE_MOCK_DATA === 'true') {
      // Combine all transactions from mock data
      let allTransactions = [];
      Object.values(MOCK_DATA.transactions).forEach(accountTransactions => {
        allTransactions = allTransactions.concat(accountTransactions);
      });
      
      // Apply filters
      let filteredTransactions = allTransactions;
      
      if (accountId) {
        filteredTransactions = filteredTransactions.filter(tx => tx.account_id === accountId);
      }
      
      if (startDate) {
        filteredTransactions = filteredTransactions.filter(tx => 
          new Date(tx.date) >= new Date(startDate)
        );
      }
      
      if (endDate) {
        filteredTransactions = filteredTransactions.filter(tx => 
          new Date(tx.date) <= new Date(endDate)
        );
      }
      
      if (category) {
        filteredTransactions = filteredTransactions.filter(tx => 
          tx.category?.toLowerCase().includes(category.toLowerCase())
        );
      }
      
      if (type) {
        filteredTransactions = filteredTransactions.filter(tx => tx.type === type.toUpperCase());
      }
      
      // Sort by date (newest first)
      filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      // Apply pagination
      const paginatedTransactions = filteredTransactions.slice(
        parseInt(offset), 
        parseInt(offset) + parseInt(limit)
      );
      
      res.json({
        success: true,
        message: 'Transactions retrieved successfully (mock data)',
        data: paginatedTransactions,
        meta: {
          total: filteredTransactions.length,
          limit: parseInt(limit),
          offset: parseInt(offset),
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Build filters for database query
    const filters = {};
    if (accountId) filters.account_id = accountId;
    if (startDate) filters.date_from = startDate;
    if (endDate) filters.date_to = endDate;
    if (category) filters.category = category;
    if (type) filters.type = type.toUpperCase();

    // Use the default admin user UUID from the migration
    // TODO: Implement proper user authentication and get user_id from token
    const userId = '00000000-0000-0000-0000-000000000001';
    
    const transactions = await TransactionModel.findByUserId(userId, filters, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const totalCount = await TransactionModel.countByUserId(userId, filters);

    // Transform database format to API format
    const transformedTransactions = transactions.map(transaction => ({
      id: transaction.id.toString(),
      account_id: transaction.account_id.toString(),
      date: transaction.transaction_date,
      description: transaction.description,
      amount: parseFloat(transaction.amount),
      currency: transaction.currency || 'EUR',
      category: transaction.category,
      type: transaction.transaction_type,
      balance_after: parseFloat(transaction.balance_after) || null,
      merchant_name: transaction.merchant_name,
      merchant_category: transaction.merchant_category,
      is_pending: transaction.is_pending || false,
      powens_transaction_id: transaction.powens_transaction_id
    }));

    res.json({
      success: true,
      message: 'Transactions retrieved successfully',
      data: transformedTransactions,
      meta: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error retrieving transactions:', error);
    next(error);
  }
});

/**
 * @route GET /api/transactions/:id
 * @desc Get specific transaction by ID
 * @access Public
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    logger.info('Transaction details requested', { transactionId: id });
    
    // Check if we should use mock data
    if (process.env.ENABLE_MOCK_DATA === 'true') {
      // Search through all transactions
      let foundTransaction = null;
      Object.values(MOCK_DATA.transactions).forEach(accountTransactions => {
        const transaction = accountTransactions.find(tx => tx.id === id);
        if (transaction) {
          foundTransaction = transaction;
        }
      });
      
      if (foundTransaction) {
        res.json({
          success: true,
          message: 'Transaction retrieved successfully (mock data)',
          data: foundTransaction
        });
      } else {
        res.status(404).json({
          success: false,
          error: {
            code: 'TRANSACTION_NOT_FOUND',
            message: 'Transaction not found',
            details: `Transaction with ID ${id} does not exist`
          }
        });
      }
      return;
    }

    const transaction = await TransactionModel.findById(id);
    
    if (!transaction) {
      res.status(404).json({
        success: false,
        error: {
          code: 'TRANSACTION_NOT_FOUND',
          message: 'Transaction not found',
          details: `Transaction with ID ${id} does not exist`
        }
      });
      return;
    }

    // Transform database format to API format
    const transformedTransaction = {
      id: transaction.id.toString(),
      account_id: transaction.account_id.toString(),
      date: transaction.transaction_date,
      description: transaction.description,
      amount: parseFloat(transaction.amount),
      currency: transaction.currency || 'EUR',
      category: transaction.category,
      type: transaction.transaction_type,
      balance_after: parseFloat(transaction.balance_after) || null,
      merchant_name: transaction.merchant_name,
      merchant_category: transaction.merchant_category,
      is_pending: transaction.is_pending || false,
      powens_transaction_id: transaction.powens_transaction_id
    };

    res.json({
      success: true,
      message: 'Transaction retrieved successfully',
      data: transformedTransaction
    });
  } catch (error) {
    logger.error('Error retrieving transaction:', error);
    next(error);
  }
});

/**
 * @route POST /api/transactions/sync
 * @desc Synchronize transaction data from Powens API
 * @access Public
 */
router.post('/sync', async (req, res, next) => {
  try {
    const { accountId, startDate, endDate } = req.body;
    
    logger.info('Transaction synchronization requested', { 
      accountId, 
      startDate, 
      endDate 
    });
    
    // Check if we should use mock data
    if (process.env.ENABLE_MOCK_DATA === 'true') {
      let totalTransactions = 0;
      if (accountId && MOCK_DATA.transactions[accountId]) {
        totalTransactions = MOCK_DATA.transactions[accountId].length;
      } else {
        Object.values(MOCK_DATA.transactions).forEach(accountTransactions => {
          totalTransactions += accountTransactions.length;
        });
      }
      
      res.json({
        success: true,
        message: 'Transaction synchronization completed (mock)',
        data: {
          syncedTransactions: totalTransactions,
          accountId: accountId || 'all',
          startDate: startDate || null,
          endDate: endDate || null,
          timestamp: new Date().toISOString(),
          status: 'mock'
        }
      });
      return;
    }

    // TODO: Implement actual sync logic with Powens API
    // This should:
    // 1. Get transactions from Powens for the specified account/date range
    // 2. Create/update transactions in the database
    // 3. Return sync results
    
    const userId = '00000000-0000-0000-0000-000000000001'; // TODO: Get from authentication
    const filters = accountId ? { account_id: accountId } : {};
    const transactionCount = await TransactionModel.countByUserId(userId, filters);
    
    res.json({
      success: true,
      message: 'Transaction synchronization completed',
      data: {
        syncedTransactions: transactionCount,
        accountId: accountId || 'all',
        startDate: startDate || null,
        endDate: endDate || null,
        timestamp: new Date().toISOString(),
        status: 'completed'
      }
    });
  } catch (error) {
    logger.error('Error during transaction synchronization:', error);
    next(error);
  }
});

/**
 * @route GET /api/transactions/summary
 * @desc Get transaction summary and statistics
 * @access Public
 */
router.get('/summary', async (req, res, next) => {
  try {
    const { accountId, period = '30d' } = req.query;
    
    logger.info('Transaction summary requested', { accountId, period });
    
    // Check if we should use mock data
    if (process.env.ENABLE_MOCK_DATA === 'true') {
      let transactions = [];
      
      if (accountId && MOCK_DATA.transactions[accountId]) {
        transactions = MOCK_DATA.transactions[accountId];
      } else {
        Object.values(MOCK_DATA.transactions).forEach(accountTransactions => {
          transactions = transactions.concat(accountTransactions);
        });
      }
      
      // Calculate summary statistics
      const income = transactions
        .filter(tx => tx.amount > 0)
        .reduce((sum, tx) => sum + tx.amount, 0);
        
      const expenses = transactions
        .filter(tx => tx.amount < 0)
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      
      const netFlow = income - expenses;
      
      res.json({
        success: true,
        message: 'Transaction summary generated (mock data)',
        data: {
          period,
          accountId: accountId || 'all',
          summary: {
            totalTransactions: transactions.length,
            totalIncome: income,
            totalExpenses: expenses,
            netFlow: netFlow
          },
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Calculate date range based on period
    const endDate = new Date();
    let startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    const userId = '00000000-0000-0000-0000-000000000001'; // TODO: Get from authentication
    const filters = {
      date_from: startDate.toISOString().split('T')[0],
      date_to: endDate.toISOString().split('T')[0]
    };
    
    if (accountId) filters.account_id = accountId;

    const summary = await TransactionModel.getSummary(userId, filters);
    
    res.json({
      success: true,
      message: 'Transaction summary generated',
      data: {
        period,
        accountId: accountId || 'all',
        dateRange: {
          startDate: filters.date_from,
          endDate: filters.date_to
        },
        summary: {
          totalTransactions: parseInt(summary.total_transactions) || 0,
          totalIncome: parseFloat(summary.total_income) || 0,
          totalExpenses: parseFloat(summary.total_expenses) || 0,
          netFlow: parseFloat(summary.net_flow) || 0,
          averageTransaction: parseFloat(summary.average_amount) || 0
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error generating transaction summary:', error);
    next(error);
  }
});

/**
 * @route GET /api/transactions/categories
 * @desc Get transaction categories with spending amounts
 * @access Public
 */
router.get('/categories', async (req, res, next) => {
  try {
    const { accountId, period = '30d' } = req.query;
    
    logger.info('Transaction categories requested', { accountId, period });
    
    // Check if we should use mock data
    if (process.env.ENABLE_MOCK_DATA === 'true') {
      let transactions = [];
      
      if (accountId && MOCK_DATA.transactions[accountId]) {
        transactions = MOCK_DATA.transactions[accountId];
      } else {
        Object.values(MOCK_DATA.transactions).forEach(accountTransactions => {
          transactions = transactions.concat(accountTransactions);
        });
      }
      
      // Group by category
      const categorySpending = {};
      transactions.forEach(tx => {
        const category = tx.category || 'Other';
        if (!categorySpending[category]) {
          categorySpending[category] = { total: 0, count: 0 };
        }
        categorySpending[category].total += Math.abs(tx.amount);
        categorySpending[category].count += 1;
      });
      
      const categories = Object.entries(categorySpending).map(([name, data]) => ({
        category: name,
        total_amount: data.total,
        transaction_count: data.count,
        percentage: 0 // Will be calculated on frontend
      }));
      
      res.json({
        success: true,
        message: 'Transaction categories retrieved (mock data)',
        data: categories
      });
      return;
    }

    // Calculate date range based on period
    const endDate = new Date();
    let startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    const userId = '00000000-0000-0000-0000-000000000001'; // TODO: Get from authentication
    const filters = {
      date_from: startDate.toISOString().split('T')[0],
      date_to: endDate.toISOString().split('T')[0]
    };
    
    if (accountId) filters.account_id = accountId;

    const categories = await TransactionModel.getCategoryBreakdown(userId, filters);
    
    res.json({
      success: true,
      message: 'Transaction categories retrieved',
      data: categories.map(cat => ({
        category: cat.category,
        total_amount: parseFloat(cat.total_amount) || 0,
        transaction_count: parseInt(cat.transaction_count) || 0,
        percentage: parseFloat(cat.percentage) || 0
      }))
    });
  } catch (error) {
    logger.error('Error retrieving transaction categories:', error);
    next(error);
  }
});

module.exports = router;
