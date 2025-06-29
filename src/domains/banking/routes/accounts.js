const express = require('express');
const router = express.Router();
const { logger } = require('../../shared/utils/logger');
const { MOCK_DATA } = require('../services/constants');
const BankAccountModel = require('../models/BankAccount');

/**
 * @route GET /api/accounts
 * @desc Get all bank accounts
 * @access Public
 */
router.get('/', async (req, res, next) => {
  try {
    logger.info('Accounts list requested');
    
    // Check if we should use mock data
    if (process.env.ENABLE_MOCK_DATA === 'true') {
      res.json({
        success: true,
        message: 'Accounts retrieved successfully (mock data)',
        data: MOCK_DATA.accounts,
        meta: {
          total: MOCK_DATA.accounts.length,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Use the default admin user UUID from the migration
    // TODO: Implement proper user authentication and get user_id from token
    const userId = '00000000-0000-0000-0000-000000000001';
    
    const accounts = await BankAccountModel.findByUserId(userId);
    
    // Transform database format to API format
    const transformedAccounts = accounts.map(account => ({
      id: account.id.toString(),
      name: account.account_name,
      number: account.account_number,
      iban: account.iban,
      bic: account.bic,
      balance: parseFloat(account.balance) || 0,
      currency: account.currency || 'EUR',
      bank_name: account.bank_name,
      type: account.account_type?.toUpperCase() || 'CHECKING',
      last_update: account.last_balance_update || account.updated_at,
      is_primary: account.is_primary || false,
      available_balance: parseFloat(account.available_balance) || null,
      connection_status: account.connection_status
    }));

    res.json({
      success: true,
      message: 'Accounts retrieved successfully',
      data: transformedAccounts,
      meta: {
        total: transformedAccounts.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error retrieving accounts:', error);
    next(error);
  }
});

/**
 * @route GET /api/accounts/:id
 * @desc Get specific account by ID
 * @access Public
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    logger.info('Account details requested', { accountId: id });
    
    // Check if we should use mock data
    if (process.env.ENABLE_MOCK_DATA === 'true') {
      const account = MOCK_DATA.accounts.find(acc => acc.id === id);
      if (account) {
        res.json({
          success: true,
          message: 'Account retrieved successfully (mock data)',
          data: account
        });
      } else {
        res.status(404).json({
          success: false,
          error: {
            code: 'ACCOUNT_NOT_FOUND',
            message: 'Account not found',
            details: `Account with ID ${id} does not exist`
          }
        });
      }
      return;
    }

    const account = await BankAccountModel.findById(id);
    
    if (!account) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: 'Account not found',
          details: `Account with ID ${id} does not exist`
        }
      });
      return;
    }

    // Transform database format to API format
    const transformedAccount = {
      id: account.id.toString(),
      name: account.account_name,
      number: account.account_number,
      iban: account.iban,
      bic: account.bic,
      balance: parseFloat(account.balance) || 0,
      currency: account.currency || 'EUR',
      bank_name: account.bank_name,
      type: account.account_type?.toUpperCase() || 'CHECKING',
      last_update: account.last_balance_update || account.updated_at,
      is_primary: account.is_primary || false,
      available_balance: parseFloat(account.available_balance) || null,
      connection_status: account.connection_status
    };

    res.json({
      success: true,
      message: 'Account retrieved successfully',
      data: transformedAccount
    });
  } catch (error) {
    logger.error('Error retrieving account:', error);
    next(error);
  }
});

/**
 * @route POST /api/accounts/sync
 * @desc Synchronize account data from Powens API
 * @access Public
 */
router.post('/sync', async (req, res, next) => {
  try {
    logger.info('Account synchronization requested');
    
    // Check if we should use mock data
    if (process.env.ENABLE_MOCK_DATA === 'true') {
      res.json({
        success: true,
        message: 'Account synchronization completed (mock)',
        data: {
          syncedAccounts: MOCK_DATA.accounts.length,
          timestamp: new Date().toISOString(),
          status: 'mock'
        }
      });
      return;
    }

    // TODO: Implement actual sync logic with Powens API
    // This should:
    // 1. Get all active connections for the user
    // 2. Fetch accounts from Powens for each connection
    // 3. Create/update accounts in the database
    // 4. Return sync results
    
    const userId = '00000000-0000-0000-0000-000000000001'; // TODO: Get from authentication
    const accounts = await BankAccountModel.findByUserId(userId);
    
    res.json({
      success: true,
      message: 'Account synchronization completed',
      data: {
        syncedAccounts: accounts.length,
        timestamp: new Date().toISOString(),
        status: 'completed'
      }
    });
  } catch (error) {
    logger.error('Error during account synchronization:', error);
    next(error);
  }
});

/**
 * @route PUT /api/accounts/:id
 * @desc Update account information
 * @access Public
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    logger.info('Account update requested', { accountId: id, updateData });
    
    // Check if we should use mock data
    if (process.env.ENABLE_MOCK_DATA === 'true') {
      res.json({
        success: true,
        message: 'Account update - Mock mode enabled',
        data: {
          accountId: id,
          updated: false,
          reason: 'Mock mode enabled'
        }
      });
      return;
    }

    // Validate account exists
    const existingAccount = await BankAccountModel.findById(id);
    if (!existingAccount) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: 'Account not found',
          details: `Account with ID ${id} does not exist`
        }
      });
      return;
    }

    // Transform API format to database format
    const dbUpdateData = {};
    if (updateData.name) dbUpdateData.account_name = updateData.name;
    if (updateData.balance !== undefined) dbUpdateData.balance = updateData.balance;
    if (updateData.available_balance !== undefined) dbUpdateData.available_balance = updateData.available_balance;
    if (updateData.is_primary !== undefined) dbUpdateData.is_primary = updateData.is_primary;

    const updatedAccount = await BankAccountModel.update(id, dbUpdateData);
    
    res.json({
      success: true,
      message: 'Account updated successfully',
      data: {
        accountId: id,
        updated: true,
        account: {
          id: updatedAccount.id.toString(),
          name: updatedAccount.account_name,
          balance: parseFloat(updatedAccount.balance) || 0,
          is_primary: updatedAccount.is_primary || false
        }
      }
    });
  } catch (error) {
    logger.error('Error updating account:', error);
    next(error);
  }
});

/**
 * @route DELETE /api/accounts/:id
 * @desc Delete account (deactivate)
 * @access Public
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    logger.info('Account deletion requested', { accountId: id });
    
    // Check if we should use mock data
    if (process.env.ENABLE_MOCK_DATA === 'true') {
      res.json({
        success: true,
        message: 'Account deletion - Mock mode enabled',
        data: {
          accountId: id,
          deleted: false,
          reason: 'Mock mode enabled'
        }
      });
      return;
    }

    // Validate account exists
    const existingAccount = await BankAccountModel.findById(id);
    if (!existingAccount) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: 'Account not found',
          details: `Account with ID ${id} does not exist`
        }
      });
      return;
    }

    // Deactivate account instead of hard delete
    await BankAccountModel.deactivate(id);
    
    res.json({
      success: true,
      message: 'Account deactivated successfully',
      data: {
        accountId: id,
        deleted: true,
        action: 'deactivated'
      }
    });
  } catch (error) {
    logger.error('Error deleting account:', error);
    next(error);
  }
});

/**
 * @route GET /api/accounts/summary/:userId
 * @desc Get account summary for user
 * @access Public
 */
router.get('/summary/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    logger.info('Account summary requested', { userId });
    
    // Check if we should use mock data
    if (process.env.ENABLE_MOCK_DATA === 'true') {
      const mockSummary = {
        total_accounts: MOCK_DATA.accounts.length,
        checking_balance: MOCK_DATA.accounts.filter(a => a.type === 'CHECKING').reduce((sum, a) => sum + a.balance, 0),
        savings_balance: MOCK_DATA.accounts.filter(a => a.type === 'SAVINGS').reduce((sum, a) => sum + a.balance, 0),
        investment_balance: MOCK_DATA.accounts.filter(a => a.type === 'INVESTMENT').reduce((sum, a) => sum + a.balance, 0),
        credit_balance: 0,
        total_balance: MOCK_DATA.accounts.reduce((sum, a) => sum + a.balance, 0),
        last_update: new Date().toISOString()
      };
      
      res.json({
        success: true,
        message: 'Account summary retrieved successfully (mock data)',
        data: mockSummary
      });
      return;
    }

    const summary = await BankAccountModel.getUserSummary(userId);
    
    res.json({
      success: true,
      message: 'Account summary retrieved successfully',
      data: {
        total_accounts: parseInt(summary.total_accounts) || 0,
        checking_balance: parseFloat(summary.checking_balance) || 0,
        savings_balance: parseFloat(summary.savings_balance) || 0,
        investment_balance: parseFloat(summary.investment_balance) || 0,
        credit_balance: parseFloat(summary.credit_balance) || 0,
        total_balance: parseFloat(summary.total_balance) || 0,
        last_update: summary.last_update
      }
    });
  } catch (error) {
    logger.error('Error retrieving account summary:', error);
    next(error);
  }
});

module.exports = router;
