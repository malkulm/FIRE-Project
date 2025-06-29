const express = require('express');
const router = express.Router();
const { logger } = require('../../shared/utils/logger');
const syncService = require('../services/syncService');
const BankConnectionModel = require('../models/BankConnection');
const BankAccountModel = require('../models/BankAccount');
const TransactionModel = require('../models/Transaction');
const UserModel = require('../models/User');

/**
 * @route POST /api/sync/full
 * @desc Full sync for all user connections (the missing endpoint!)
 * @access Public
 */
router.post('/full', async (req, res, next) => {
  try {
    const { force = false, includeTransactions = true } = req.body;
    
    // Use the default admin user UUID from the migration
    const userId = '00000000-0000-0000-0000-000000000001';

    logger.info('🚀 FULL SYNC REQUESTED', { 
      userId, 
      force, 
      includeTransactions,
      timestamp: new Date().toISOString()
    });

    // Trigger sync for all user connections
    const results = await syncService.syncAllUserConnections(userId, {
      force,
      includeTransactions
    });

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'failed').length;

    logger.info('✅ FULL SYNC COMPLETED', {
      userId,
      totalConnections: results.length,
      successful: successCount,
      failed: errorCount,
      successRate: results.length > 0 ? ((successCount / results.length) * 100).toFixed(1) + '%' : '0%'
    });

    res.json({
      success: true,
      message: `Full sync completed for ${results.length} connections`,
      data: {
        userId,
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: errorCount,
          successRate: results.length > 0 ? ((successCount / results.length) * 100).toFixed(1) + '%' : '0%'
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('❌ FULL SYNC FAILED', { 
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
});

/**
 * @route POST /api/sync/accounts
 * @desc Call getUserAccounts(), display response, and sync to database
 * @access Public
 */
router.post('/accounts', async (req, res, next) => {
  try {
    const userId = '00000000-0000-0000-0000-000000000001'; // Default admin user
    
    logger.info('🏦 SYNC ACCOUNTS REQUESTED', { 
      userId,
      timestamp: new Date().toISOString()
    });

    // Get user's permanent token from database
    const userTokenData = await UserModel.getPowensToken(userId);
    if (!userTokenData || !userTokenData.powens_permanent_token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_TOKEN_FOUND',
          message: 'No Powens token found for user',
          details: 'Please authenticate with Powens first'
        }
      });
    }

    const accessToken = userTokenData.powens_permanent_token;
    const powensService = require('../services/powensService');

    // Call getUserAccounts with the user ID to get powens_user_id from database
    const accounts = await powensService.getUserAccounts(accessToken, userId);
    
    logger.info('📊 ACCOUNTS RETRIEVED FROM POWENS API', {
      userId,
      accountCount: accounts.length,
      powensUserId: userTokenData.powens_user_id
    });

    // Sync accounts to database
    let syncedAccounts = 0;
    let syncErrors = [];
    
    for (const powensAccount of accounts) {
      try {
        // Find or get connection for this account
        let connection = null;
        const connections = await BankConnectionModel.findByUserId(userId);
        
        if (connections.length > 0) {
          // Use first connection or find matching one
          connection = connections[0];
        } else {
          // Create a default connection if none exists
          const connectionData = {
            user_id: userId,
            powens_user_id: userTokenData.powens_user_id,
            powens_connection_id: 'sync_accounts_default',
            bank_name: powensAccount.bank?.name || 'Unknown Bank',
            bank_logo_url: powensAccount.bank?.logo_url,
            access_token: accessToken,
            refresh_token: accessToken,
            token_expires_at: userTokenData.powens_token_expires_at || new Date(Date.now() + (3600 * 24 * 365 * 1000)),
            token_source: 'sync_accounts'
          };
          connection = await BankConnectionModel.create(connectionData);
        }

        // Map and store account
        const accountData = powensService.mapPowensAccountToLocal(powensAccount, userId, connection.id);
        await BankAccountModel.findOrCreateByPowensId(accountData);
        syncedAccounts++;
        
      } catch (accountError) {
        logger.error('❌ Failed to sync individual account', {
          powensAccountId: powensAccount.id,
          error: accountError.message
        });
        syncErrors.push({
          powensAccountId: powensAccount.id,
          error: accountError.message
        });
      }
    }

    const successRate = accounts.length > 0 ? ((syncedAccounts / accounts.length) * 100).toFixed(1) + '%' : '100%';

    logger.info('✅ ACCOUNTS SYNC COMPLETED', {
      userId,
      totalAccounts: accounts.length,
      syncedAccounts,
      errors: syncErrors.length,
      successRate
    });

    // Return detailed response for display on webpage
    res.json({
      success: true,
      message: `Retrieved ${accounts.length} accounts from Powens API and synced ${syncedAccounts} to database`,
      data: {
        userId,
        powensUserId: userTokenData.powens_user_id,
        apiResponse: {
          accountCount: accounts.length,
          accounts: accounts.map(acc => ({
            id: acc.id,
            name: acc.name || acc.original_name,
            balance: acc.balance,
            currency: acc.currency?.name || acc.currency,
            type: acc.type?.name || acc.type,
            iban: acc.iban,
            bank: acc.bank?.name
          }))
        },
        syncResults: {
          totalAccounts: accounts.length,
          syncedAccounts,
          failedAccounts: syncErrors.length,
          successRate,
          errors: syncErrors
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('❌ SYNC ACCOUNTS FAILED', { 
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'SYNC_ACCOUNTS_FAILED',
        message: error.message,
        details: 'Failed to retrieve accounts from Powens API'
      }
    });
  }
});

/**
 * @route GET /api/sync/debug/connections
 * @desc Debug endpoint to check what connections exist in database
 * @access Public
 */
router.get('/debug/connections', async (req, res, next) => {
  try {
    const userId = '00000000-0000-0000-0000-000000000001';
    const connections = await BankConnectionModel.findByUserId(userId);
    
    // Get user's Powens token info
    const userTokenData = await UserModel.getPowensToken(userId);
    
    res.json({
      success: true,
      message: 'Debug: Database connections status',
      data: {
        userId,
        userToken: {
          hasToken: !!userTokenData?.powens_permanent_token,
          powensUserId: userTokenData?.powens_user_id,
          tokenType: userTokenData?.powens_token_type,
          isExpired: userTokenData?.isExpired,
          tokenPreview: userTokenData?.powens_permanent_token ? 
            userTokenData.powens_permanent_token.substring(0, 15) + '...' : 'NOT SET'
        },
        connectionsFound: connections.length,
        connections: connections.map(c => ({
          id: c.id,
          bank_name: c.bank_name,
          status: c.status,
          token_source: c.token_source,
          powens_connection_id: c.powens_connection_id,
          powens_user_id: c.powens_user_id,
          powens_user_id_from_api: c.powens_user_id_from_api,
          created_at: c.created_at,
          last_sync_at: c.last_sync_at,
          last_sync_status: c.last_sync_status
        })),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('❌ Failed to get debug connections', { error: error.message });
    next(error);
  }
});

/**
 * @route GET /api/sync/debug/accounts
 * @desc Debug endpoint to check what accounts exist in database
 * @access Public
 */
router.get('/debug/accounts', async (req, res, next) => {
  try {
    const userId = '00000000-0000-0000-0000-000000000001';
    
    // Get all accounts for the user
    const accounts = await BankAccountModel.findByUserId(userId);
    
    res.json({
      success: true,
      message: 'Debug: Database accounts status',
      data: {
        userId,
        accountsFound: accounts.length,
        accounts: accounts.map(a => ({
          id: a.id,
          account_name: a.account_name,
          account_type: a.account_type,
          bank_name: a.bank_name,
          balance: a.balance,
          currency: a.currency,
          iban: a.iban,
          powens_account_id: a.powens_account_id,
          connection_id: a.connection_id,
          created_at: a.created_at,
          updated_at: a.updated_at
        })),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('❌ Failed to get debug accounts', { error: error.message });
    next(error);
  }
});

/**
 * @route GET /api/sync/debug/transactions
 * @desc Debug endpoint to check what transactions exist in database
 * @access Public
 */
router.get('/debug/transactions', async (req, res, next) => {
  try {
    const userId = '00000000-0000-0000-0000-000000000001';
    const { limit = 50 } = req.query;
    
    // Get recent transactions for the user
    const transactions = await TransactionModel.findByUserId(userId, { limit: parseInt(limit) });
    
    res.json({
      success: true,
      message: 'Debug: Database transactions status',
      data: {
        userId,
        transactionsFound: transactions.length,
        limit: parseInt(limit),
        transactions: transactions.map(t => ({
          id: t.id,
          description: t.description,
          amount: t.amount,
          currency: t.currency,
          transaction_date: t.transaction_date,
          transaction_type: t.transaction_type,
          category: t.category,
          account_id: t.account_id,
          powens_transaction_id: t.powens_transaction_id,
          created_at: t.created_at
        })),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('❌ Failed to get debug transactions', { error: error.message });
    next(error);
  }
});

/**
 * @route POST /api/sync/debug/test-token
 * @desc Debug endpoint to test user's Powens token by making API calls
 * @access Public
 */
router.post('/debug/test-token', async (req, res, next) => {
  try {
    const userId = '00000000-0000-0000-0000-000000000001';
    
    // Get user's token
    const userTokenData = await UserModel.getPowensToken(userId);
    if (!userTokenData || !userTokenData.powens_permanent_token) {
      return res.json({
        success: false,
        message: 'No Powens token found for user',
        data: { userId, hasToken: false }
      });
    }
    
    const powensService = require('../services/powensService');
    const token = userTokenData.powens_permanent_token;
    
    logger.info('🧪 Testing Powens token with API calls', { 
      userId,
      tokenPreview: token.substring(0, 15) + '...'
    });
    
    let results = {
      token: {
        valid: true,
        preview: token.substring(0, 15) + '...',
        powensUserId: userTokenData.powens_user_id
      },
      connections: { success: false, count: 0, error: null },
      accounts: { success: false, count: 0, error: null },
      transactions: { success: false, count: 0, error: null }
    };
    
    // Test connections API
    try {
      const connections = await powensService.getUserConnections(token);
      results.connections = { success: true, count: connections.length, data: connections };
    } catch (error) {
      results.connections = { success: false, count: 0, error: error.message };
    }
    
    // Test accounts API
    try {
      const accounts = await powensService.getUserAccounts(token, userId);
      results.accounts = { success: true, count: accounts.length, data: accounts };
    } catch (error) {
      results.accounts = { success: false, count: 0, error: error.message };
    }
    
    // Test transactions API
    try {
      const transactions = await powensService.getUserTransactions(token, { limit: 10 });
      results.transactions = { success: true, count: transactions.length, data: transactions };
    } catch (error) {
      results.transactions = { success: false, count: 0, error: error.message };
    }
    
    const allSuccess = results.connections.success && results.accounts.success && results.transactions.success;
    
    logger.info('🧪 Token test completed', {
      userId,
      allSuccess,
      connections: results.connections.success,
      accounts: results.accounts.success,
      transactions: results.transactions.success
    });
    
    res.json({
      success: true,
      message: `Token test completed - ${allSuccess ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`,
      data: {
        userId,
        overallResult: allSuccess ? 'SUCCESS' : 'PARTIAL_FAILURE',
        results,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('❌ Token test failed', { error: error.message });
    next(error);
  }
});

/**
 * @route POST /api/sync/connection/:connectionId
 * @desc Manually trigger sync for a specific connection
 * @access Public
 */
router.post('/connection/:connectionId', async (req, res, next) => {
  try {
    const { connectionId } = req.params;
    const { force = false, includeTransactions = true } = req.body;

    logger.info('Manual sync requested', { connectionId, force, includeTransactions });

    // Validate connection exists
    const connection = await BankConnectionModel.findById(connectionId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'Connection not found',
          details: `Connection with ID ${connectionId} does not exist`
        }
      });
    }

    // Trigger sync
    const result = await syncService.syncConnection(connectionId, {
      type: 'manual',
      force,
      includeTransactions,
      userId: connection.user_id
    });

    res.json({
      success: true,
      message: 'Sync completed',
      data: result
    });

  } catch (error) {
    logger.error('Manual sync failed', { error: error.message });
    next(error);
  }
});

/**
 * @route POST /api/sync/user/:userId
 * @desc Manually trigger sync for all user connections
 * @access Public
 */
router.post('/user/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { force = false, includeTransactions = true } = req.body;

    logger.info('Manual sync all connections requested', { userId, force, includeTransactions });

    // Trigger sync for all user connections
    const results = await syncService.syncAllUserConnections(userId, {
      force,
      includeTransactions
    });

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'failed').length;

    res.json({
      success: true,
      message: `Sync completed for ${results.length} connections`,
      data: {
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: errorCount,
          successRate: results.length > 0 ? ((successCount / results.length) * 100).toFixed(1) + '%' : '0%'
        }
      }
    });

  } catch (error) {
    logger.error('Manual sync all failed', { error: error.message });
    next(error);
  }
});

/**
 * @route POST /api/sync/full-history-default
 * @desc Trigger full history sync for the default admin user (all connections)
 * @access Public
 */
router.post('/full-history-default', async (req, res, next) => {
  try {
    const { force = false } = req.body;
    
    // Use the default admin user UUID from the migration
    const userId = '00000000-0000-0000-0000-000000000001';

    logger.info('Full history sync for default user requested', { userId, force });

    // Get all connections for the user
    const connections = await BankConnectionModel.findByUserId(userId);
    
    if (connections.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NO_CONNECTIONS_FOUND',
          message: 'No connections found for user',
          details: 'Please establish a bank connection first'
        }
      });
    }

    // Import the Powens sync service for direct access
    const powensSyncService = require('../services/powensSyncService');
    
    let results = [];
    
    // Trigger full history sync for each connection
    for (const connection of connections) {
      try {
        logger.info('Starting full history sync for connection', {
          connectionId: connection.id,
          bankName: connection.bank_name
        });
        
        const result = await powensSyncService.syncConnectionData(
          userId, 
          connection.id, 
          { fullHistorySync: true }
        );
        
        results.push({
          connectionId: connection.id,
          bankName: connection.bank_name,
          status: 'success',
          result
        });
        
      } catch (error) {
        logger.error('Full history sync failed for connection', {
          connectionId: connection.id,
          bankName: connection.bank_name,
          error: error.message
        });
        
        results.push({
          connectionId: connection.id,
          bankName: connection.bank_name,
          status: 'failed',
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'failed').length;

    res.json({
      success: true,
      message: `Full history sync completed for ${results.length} connections - fetched ALL available transactions`,
      data: {
        userId,
        syncType: 'FULL_HISTORY_SYNC',
        note: 'This sync fetched all available transaction history without date filters from Powens API',
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: errorCount,
          successRate: results.length > 0 ? ((successCount / results.length) * 100).toFixed(1) + '%' : '0%'
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Full history sync for default user failed', { error: error.message });
    next(error);
  }
});

/**
 * @route POST /api/sync/user-default
 * @desc Manually trigger sync for the default admin user
 * @access Public
 */
router.post('/user-default', async (req, res, next) => {
  try {
    const { force = false, includeTransactions = true } = req.body;
    
    // Use the default admin user UUID from the migration
    const userId = '00000000-0000-0000-0000-000000000001';

    logger.info('Manual sync for default user requested', { userId, force, includeTransactions });

    // Trigger sync for all user connections
    const results = await syncService.syncAllUserConnections(userId, {
      force,
      includeTransactions
    });

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'failed').length;

    res.json({
      success: true,
      message: `Sync completed for ${results.length} connections`,
      data: {
        userId,
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: errorCount,
          successRate: results.length > 0 ? ((successCount / results.length) * 100).toFixed(1) + '%' : '0%'
        }
      }
    });

  } catch (error) {
    logger.error('Manual sync for default user failed', { error: error.message });
    next(error);
  }
});

/**
 * @route GET /api/sync/status/:connectionId
 * @desc Get sync status for a connection
 * @access Public
 */
router.get('/status/:connectionId', async (req, res, next) => {
  try {
    const { connectionId } = req.params;

    const status = await syncService.getSyncStatus(connectionId);

    res.json({
      success: true,
      message: 'Sync status retrieved',
      data: status
    });

  } catch (error) {
    logger.error('Failed to get sync status', { error: error.message });
    next(error);
  }
});

/**
 * @route GET /api/sync/stats
 * @desc Get sync service statistics
 * @access Public
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = syncService.getStats();

    res.json({
      success: true,
      message: 'Sync statistics retrieved',
      data: stats
    });

  } catch (error) {
    logger.error('Failed to get sync stats', { error: error.message });
    next(error);
  }
});

/**
 * @route POST /api/sync/full-history/:connectionId
 * @desc Sync all available transaction history for a connection (no date filter)
 * @access Public
 */
router.post('/full-history/:connectionId', async (req, res, next) => {
  try {
    const { connectionId } = req.params;
    const { force = false } = req.body;

    logger.info('Full history sync requested', { connectionId, force });

    // Validate connection exists
    const connection = await BankConnectionModel.findById(connectionId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'Connection not found',
          details: `Connection with ID ${connectionId} does not exist`
        }
      });
    }

    // Import the Powens sync service for direct access
    const powensSyncService = require('../services/powensSyncService');
    
    // Trigger sync with full history option
    const result = await powensSyncService.syncConnectionData(
      connection.user_id, 
      connectionId, 
      { fullHistorySync: true }
    );

    res.json({
      success: true,
      message: 'Full history sync completed - fetched ALL available transactions from Powens',
      data: {
        connectionId,
        userId: connection.user_id,
        bankName: connection.bank_name,
        syncResults: result,
        note: 'This sync fetched all available transaction history without date filters',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Full history sync failed', { 
      connectionId: req.params.connectionId,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
});

/**
 * @route POST /api/sync/incremental-default
 * @desc Trigger incremental sync for default user using last_update parameter
 * @access Public
 */
router.post('/incremental-default', async (req, res, next) => {
  try {
    const { force = false } = req.body;
    
    // Use the default admin user UUID from the migration
    const userId = '00000000-0000-0000-0000-000000000001';

    logger.info('Incremental sync for default user requested', { userId, force });

    // Get all connections for the user
    const connections = await BankConnectionModel.findByUserId(userId);
    
    if (connections.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NO_CONNECTIONS_FOUND',
          message: 'No connections found for user',
          details: 'Please establish a bank connection first'
        }
      });
    }

    // Import the Powens sync service for direct access
    const powensSyncService = require('../services/powensSyncService');
    
    let results = [];
    
    // Trigger incremental sync for each connection (default behavior with last_update)
    for (const connection of connections) {
      try {
        const lastSyncTimestamp = await BankConnectionModel.getLastSyncTimestamp(connection.id);
        
        logger.info('Starting incremental sync for connection', {
          connectionId: connection.id,
          bankName: connection.bank_name,
          lastSyncTimestamp,
          strategy: lastSyncTimestamp ? 'incremental' : 'initial'
        });
        
        const result = await powensSyncService.syncConnectionData(
          userId, 
          connection.id, 
          { fullHistorySync: false } // Use incremental sync logic
        );
        
        results.push({
          connectionId: connection.id,
          bankName: connection.bank_name,
          lastSyncTimestamp,
          strategy: lastSyncTimestamp ? 'incremental' : 'initial',
          status: 'success',
          result
        });
        
      } catch (error) {
        logger.error('Incremental sync failed for connection', {
          connectionId: connection.id,
          bankName: connection.bank_name,
          error: error.message
        });
        
        results.push({
          connectionId: connection.id,
          bankName: connection.bank_name,
          status: 'failed',
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'failed').length;

    res.json({
      success: true,
      message: `Incremental sync completed for ${results.length} connections using last_update parameter`,
      data: {
        userId,
        syncType: 'INCREMENTAL_SYNC_PHASE1',
        note: 'This sync uses Powens last_update parameter for efficient incremental synchronization',
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: errorCount,
          successRate: results.length > 0 ? ((successCount / results.length) * 100).toFixed(1) + '%' : '0%'
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Incremental sync for default user failed', { error: error.message });
    next(error);
  }
});

/**
 * @route POST /api/sync/accounts-only/:connectionId
 * @desc Sync only accounts (no transactions) for a connection
 * @access Public
 */
router.post('/accounts-only/:connectionId', async (req, res, next) => {
  try {
    const { connectionId } = req.params;
    const { force = false } = req.body;

    logger.info('Accounts-only sync requested', { connectionId, force });

    // Validate connection exists
    const connection = await BankConnectionModel.findById(connectionId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'Connection not found',
          details: `Connection with ID ${connectionId} does not exist`
        }
      });
    }

    // Trigger sync without transactions
    const result = await syncService.syncConnection(connectionId, {
      type: 'manual',
      force,
      includeTransactions: false,
      userId: connection.user_id
    });

    res.json({
      success: true,
      message: 'Accounts sync completed',
      data: result
    });

  } catch (error) {
    logger.error('Accounts-only sync failed', { error: error.message });
    next(error);
  }
});

module.exports = router;