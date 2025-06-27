const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const powensService = require('../services/powens/powensService');

// Models
const BankConnectionModel = require('../models/BankConnection');
const BankAccountModel = require('../models/BankAccount');
const TransactionModel = require('../models/Transaction');
const UserModel = require('../models/User');

/**
 * 🆕 GET /api/auth/powens/connectors
 * OPTION 2 - STEP 2: Get connectors list with fields for manual connection
 */
router.get('/connectors', async (req, res, next) => {
  try {
    logger.info('🏦 📋 OPTION 2 - STEP 2: Getting connectors list with fields', {
      step: 'GET_CONNECTORS_START'
    });

    const connectors = await powensService.getConnectorsWithFields();
    
    // Filter to show connectors suitable for manual connection
    const manualConnectors = connectors.filter(connector => 
      connector.auth_mechanism === 'webauth' && !connector.hidden
    );

    logger.info('✅ 📋 OPTION 2 - STEP 2: Connectors retrieved successfully', {
      totalConnectors: connectors.length,
      manualConnectors: manualConnectors.length,
      step: 'GET_CONNECTORS_SUCCESS'
    });

    res.json({
      success: true,
      data: {
        connectors: manualConnectors.map(connector => ({
          id: connector.id,
          uuid: connector.uuid,
          name: connector.name,
          slug: connector.slug,
          color: connector.color,
          auth_mechanism: connector.auth_mechanism,
          capabilities: connector.capabilities,
          beta: connector.beta || false,
          fields: connector.fields || [], // Important for manual connection
          logo_url: connector.logo_url
        })),
        total: manualConnectors.length,
        message: "Use POST /api/auth/powens/create-connection to create a connection"
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ 📋 OPTION 2 - STEP 2: Failed to fetch connectors', {
      error: error.message,
      step: 'GET_CONNECTORS_ERROR'
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch connectors',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 🆕 POST /api/auth/powens/create-connection
 * OPTION 2 - STEP 3: Add connection via API (Fixed endpoints)
 */
router.post('/create-connection', async (req, res, next) => {
  try {
    const { connector_id, user_id = '00000000-0000-0000-0000-000000000001', ...connectionFields } = req.body;

    if (!connector_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing connector_id in request body',
        timestamp: new Date().toISOString()
      });
    }

    logger.info('🔗 🆕 OPTION 2 - STEP 3: Creating connection via API', {
      connectorId: connector_id,
      userId: user_id,
      hasFields: Object.keys(connectionFields).length > 0,
      step: 'CREATE_CONNECTION_START'
    });

    // Get user's permanent token
    const userTokenData = await UserModel.getPowensToken(user_id);
    if (!userTokenData || !userTokenData.powens_permanent_token) {
      // Try to initialize user if no token exists
      logger.info('🔄 No permanent token found, initializing user', { userId: user_id });
      const initResult = await powensService.initializeUser(user_id);
      const token = initResult.auth_token;
      
      // Create connection with new token
      const connectionResult = await powensService.createManualConnection(
        token, 
        connector_id, 
        connectionFields
      );

      logger.info('✅ 🔗 OPTION 2 - STEP 3: Connection created with new user token', {
        connectionId: connectionResult.id,
        userId: user_id,
        connectorId: connector_id,
        step: 'CREATE_CONNECTION_NEW_USER_SUCCESS'
      });

      // Save connection to database
      const connectionData = {
        user_id: user_id,
        powens_user_id: initResult.id_user,
        powens_connection_id: connectionResult.id,
        bank_name: connectionResult.connector?.name || 'Manual Connection',
        bank_logo_url: connectionResult.connector?.logo_url,
        access_token: token,
        refresh_token: token,
        token_expires_at: initResult.expires_in ? new Date(Date.now() + (initResult.expires_in * 1000)) : new Date(Date.now() + (3600 * 24 * 365 * 1000)),
        token_source: 'manual_api',
        connection_state: connectionResult.state,
        last_sync_at: connectionResult.last_update
      };

      const savedConnection = await BankConnectionModel.create(connectionData);

      return res.json({
        success: true,
        data: {
          connection_id: connectionResult.id,
          user_id: user_id,
          saved_connection_id: savedConnection.id,
          connection_state: connectionResult.state,
          bank_name: connectionData.bank_name,
          accounts_count: connectionResult.accounts?.length || 0,
          next_step: "Check accounts with GET /api/auth/powens/check-accounts"
        },
        message: 'Connection created successfully via API',
        timestamp: new Date().toISOString()
      });
    }

    const token = userTokenData.powens_permanent_token;

    // Create connection via Powens API
    const connectionResult = await powensService.createManualConnection(
      token, 
      connector_id, 
      connectionFields
    );

    logger.info('✅ 🔗 OPTION 2 - STEP 3: Connection created successfully', {
      connectionId: connectionResult.id,
      userId: user_id,
      connectorId: connector_id,
      step: 'CREATE_CONNECTION_SUCCESS'
    });

    // Save connection to database
    const connectionData = {
      user_id: user_id,
      powens_user_id: userTokenData.powens_user_id,
      powens_connection_id: connectionResult.id,
      bank_name: connectionResult.connector?.name || 'Manual Connection',
      bank_logo_url: connectionResult.connector?.logo_url,
      access_token: token,
      refresh_token: token,
      token_expires_at: userTokenData.powens_token_expires_at || new Date(Date.now() + (3600 * 24 * 365 * 1000)),
      token_source: 'manual_api',
      connection_state: connectionResult.state,
      last_sync_at: connectionResult.last_update
    };

    const savedConnection = await BankConnectionModel.create(connectionData);

    logger.info('✅ 🆕 OPTION 2 - STEP 3: Connection saved to database', {
      savedConnectionId: savedConnection.id,
      powensConnectionId: connectionResult.id,
      step: 'CREATE_CONNECTION_SAVED'
    });

    res.json({
      success: true,
      data: {
        connection_id: connectionResult.id,
        user_id: user_id,
        saved_connection_id: savedConnection.id,
        connection_state: connectionResult.state,
        bank_name: connectionData.bank_name,
        accounts_count: connectionResult.accounts?.length || 0,
        next_step: "Check accounts with GET /api/auth/powens/check-accounts"
      },
      message: 'Connection created successfully via API',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ 🔗 OPTION 2 - STEP 3: Connection creation failed', {
      connectorId: req.body.connector_id,
      userId: req.body.user_id,
      error: error.message,
      step: 'CREATE_CONNECTION_ERROR'
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to create connection',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 🆕 GET /api/auth/powens/check-accounts
 * OPTION 2 - STEP 4: Check which accounts are available and their status
 */
router.get('/check-accounts', async (req, res, next) => {
  try {
    const { user_id = '00000000-0000-0000-0000-000000000001', connection_id } = req.query;

    logger.info('📊 🆕 OPTION 2 - STEP 4: Checking accounts status', {
      userId: user_id,
      connectionId: connection_id,
      step: 'CHECK_ACCOUNTS_START'
    });

    // Get user's permanent token
    const userTokenData = await UserModel.getPowensToken(user_id);
    if (!userTokenData || !userTokenData.powens_permanent_token) {
      throw new Error('No permanent token found for user');
    }

    const token = userTokenData.powens_permanent_token;

    // Get accounts (including disabled ones)
    const accounts = await powensService.getUserAccounts(token, user_id);

    // Separate enabled and disabled accounts
    const enabledAccounts = accounts.filter(acc => !acc.disabled);
    const disabledAccounts = accounts.filter(acc => acc.disabled);

    logger.info('✅ 📊 OPTION 2 - STEP 4: Accounts status retrieved', {
      totalAccounts: accounts.length,
      enabledAccounts: enabledAccounts.length,
      disabledAccounts: disabledAccounts.length,
      step: 'CHECK_ACCOUNTS_SUCCESS'
    });

    res.json({
      success: true,
      data: {
        total_accounts: accounts.length,
        enabled_accounts: enabledAccounts.length,
        disabled_accounts: disabledAccounts.length,
        accounts: accounts.map(acc => ({
          id: acc.id,
          name: acc.name || acc.original_name,
          balance: acc.balance,
          currency: acc.currency?.name || acc.currency,
          type: acc.type,
          iban: acc.iban,
          disabled: acc.disabled,
          status: acc.disabled ? 'DISABLED' : 'ENABLED'
        })),
        disabled_account_ids: disabledAccounts.map(acc => acc.id),
        next_step: disabledAccounts.length > 0 ? 
          "Enable accounts with POST /api/auth/powens/enable-accounts" : 
          "All accounts are already enabled! Test with GET /api/auth/powens/test-data"
      },
      message: `Found ${accounts.length} accounts (${enabledAccounts.length} enabled, ${disabledAccounts.length} disabled)`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ 📊 OPTION 2 - STEP 4: Check accounts failed', {
      userId: req.query.user_id,
      error: error.message,
      step: 'CHECK_ACCOUNTS_ERROR'
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to check accounts',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 🆕 POST /api/auth/powens/enable-accounts
 * OPTION 2 - STEP 5: Enable disabled accounts (Fixed API endpoint)
 */
router.post('/enable-accounts', async (req, res, next) => {
  try {
    const { account_ids, user_id = '00000000-0000-0000-0000-000000000001' } = req.body;

    if (!account_ids || !Array.isArray(account_ids)) {
      return res.status(400).json({
        success: false,
        error: 'Missing account_ids array in request body',
        example: { account_ids: [416338, 416339] },
        timestamp: new Date().toISOString()
      });
    }

    logger.info('🔓 🆕 OPTION 2 - STEP 5: Enabling accounts', {
      userId: user_id,
      accountIds: account_ids,
      accountCount: account_ids.length,
      step: 'ENABLE_ACCOUNTS_START'
    });

    // Get user's permanent token
    const userTokenData = await UserModel.getPowensToken(user_id);
    if (!userTokenData || !userTokenData.powens_permanent_token) {
      throw new Error('No permanent token found for user');
    }

    const token = userTokenData.powens_permanent_token;

    // Enable accounts via Powens API (Fixed: using correct endpoint)
    const enableResults = await powensService.enableAccounts(token, account_ids);

    logger.info('✅ 🔓 OPTION 2 - STEP 5: Accounts enabled successfully', {
      userId: user_id,
      enabledCount: enableResults.length,
      step: 'ENABLE_ACCOUNTS_SUCCESS'
    });

    // Now fetch the updated accounts data
    const updatedAccounts = await powensService.getUserAccounts(token, user_id);
    const enabledAccounts = updatedAccounts.filter(acc => !acc.disabled);

    logger.info('📊 OPTION 2 - STEP 5: Updated accounts fetched', {
      totalAccounts: updatedAccounts.length,
      enabledAccounts: enabledAccounts.length,
      step: 'ENABLE_ACCOUNTS_DATA_FETCHED'
    });

    res.json({
      success: true,
      data: {
        enabled_account_ids: account_ids,
        total_enabled_accounts: enabledAccounts.length,
        accounts: enabledAccounts.map(acc => ({
          id: acc.id,
          name: acc.name || acc.original_name,
          balance: acc.balance,
          currency: acc.currency?.name || acc.currency,
          type: acc.type,
          iban: acc.iban,
          status: 'ENABLED'
        })),
        next_step: "Test data retrieval with GET /api/auth/powens/test-data"
      },
      message: `Successfully enabled ${account_ids.length} accounts`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ 🔓 OPTION 2 - STEP 5: Enable accounts failed', {
      accountIds: req.body.account_ids,
      userId: req.body.user_id,
      error: error.message,
      step: 'ENABLE_ACCOUNTS_ERROR'
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to enable accounts',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 🆕 GET /api/auth/powens/test-data
 * OPTION 2 - FINAL: Test that getUserAccounts and getUserTransactions now work
 */
router.get('/test-data', async (req, res, next) => {
  try {
    const { user_id = '00000000-0000-0000-0000-000000000001' } = req.query;

    logger.info('🧪 🆕 OPTION 2 - FINAL: Testing data retrieval', {
      userId: user_id,
      step: 'TEST_DATA_START'
    });

    // Get user's permanent token
    const userTokenData = await UserModel.getPowensToken(user_id);
    if (!userTokenData || !userTokenData.powens_permanent_token) {
      throw new Error('No permanent token found for user');
    }

    const token = userTokenData.powens_permanent_token;

    // Test all data retrieval methods
    const [connections, accounts, transactions] = await Promise.all([
      powensService.getUserConnections(token),
      powensService.getUserAccounts(token, user_id),
      powensService.getUserTransactions(token, { limit: 10, userId: user_id })
    ]);

    logger.info('✅ 🧪 OPTION 2 - FINAL: Data retrieval test completed', {
      userId: user_id,
      connections: connections.length,
      accounts: accounts.length,
      transactions: transactions.length,
      hasData: accounts.length > 0 || transactions.length > 0,
      step: 'TEST_DATA_SUCCESS'
    });

    res.json({
      success: true,
      data: {
        test_results: {
          connections_count: connections.length,
          accounts_count: accounts.length,
          transactions_count: transactions.length,
          has_data: accounts.length > 0 || transactions.length > 0,
          status: accounts.length > 0 ? 'SUCCESS - DATA AVAILABLE!' : 'NO DATA YET'
        },
        connections: connections.map(c => ({
          id: c.id,
          state: c.state,
          last_update: c.last_update,
          connector_name: c.connector?.name
        })),
        accounts: accounts.slice(0, 3).map(a => ({
          id: a.id,
          name: a.name || a.original_name,
          balance: a.balance,
          type: a.type,
          disabled: a.disabled
        })),
        sample_transactions: transactions.slice(0, 3).map(t => ({
          id: t.id,
          date: t.date,
          value: t.value,
          wording: t.wording || t.original_wording
        })),
        message: accounts.length > 0 ? 
          'SUCCESS! Your getUserAccounts and getUserTransactions methods now return data!' :
          'No accounts found. Check connection status.'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ 🧪 OPTION 2 - FINAL: Data test failed', {
      userId: req.query.user_id,
      error: error.message,
      step: 'TEST_DATA_ERROR'
    });
    
    res.status(500).json({
      success: false,
      error: 'Data retrieval test failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 📊 GET /api/auth/powens/connections
 * List user's bank connections (enhanced for Option 2)
 */
router.get('/connections', async (req, res, next) => {
  try {
    const userId = req.query.user_id || '00000000-0000-0000-0000-000000000001';
    
    logger.info('📋 OPTION 2: Getting user connections', { 
      userId,
      step: 'GET_CONNECTIONS_START'
    });

    // Get connections from database
    const dbConnections = await BankConnectionModel.findByUserId(userId);
    
    logger.info('📊 OPTION 2: Database connections retrieved', {
      userId,
      connectionCount: dbConnections.length,
      step: 'GET_CONNECTIONS_SUCCESS'
    });

    res.json({
      success: true,
      data: {
        connections: dbConnections.map(conn => ({
          id: conn.id,
          powens_connection_id: conn.powens_connection_id,
          bank_name: conn.bank_name,
          bank_logo_url: conn.bank_logo_url,
          connection_state: conn.connection_state,
          last_sync_at: conn.last_sync_at,
          created_at: conn.created_at,
          token_source: conn.token_source
        })),
        total: dbConnections.length,
        user_id: userId,
        next_steps: dbConnections.length > 0 ? 
          "Use GET /api/auth/powens/check-accounts to see account status" :
          "Use POST /api/auth/powens/create-connection to create a connection"
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ OPTION 2: Database connections query failed', {
      userId: req.query.user_id,
      error: error.message,
      step: 'GET_CONNECTIONS_ERROR'
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get connections',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 🔧 GET /api/auth/powens/connector/{connectorId}
 * Get specific connector details with fields (for manual connection setup)
 */
router.get('/connector/:connectorId', async (req, res, next) => {
  try {
    const { connectorId } = req.params;

    logger.info('🔍 Getting specific connector details', {
      connectorId,
      step: 'GET_CONNECTOR_DETAILS_START'
    });

    const connector = await powensService.getConnectorWithFields(connectorId);

    logger.info('✅ Connector details retrieved', {
      connectorId,
      connectorName: connector.name,
      fieldsCount: connector.fields?.length || 0,
      step: 'GET_CONNECTOR_DETAILS_SUCCESS'
    });

    res.json({
      success: true,
      data: {
        connector: {
          id: connector.id,
          uuid: connector.uuid,
          name: connector.name,
          slug: connector.slug,
          color: connector.color,
          logo_url: connector.logo_url,
          auth_mechanism: connector.auth_mechanism,
          capabilities: connector.capabilities,
          beta: connector.beta || false,
          fields: connector.fields || []
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Failed to get connector details', {
      connectorId: req.params.connectorId,
      error: error.message,
      step: 'GET_CONNECTOR_DETAILS_ERROR'
    });
    
    res.status(404).json({
      success: false,
      error: 'Failed to get connector details',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;