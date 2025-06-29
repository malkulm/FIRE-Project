const express = require('express');
const router = express.Router();
const { logger } = require('../../shared/utils/logger');
const powensService = require('../services/powensService');

// Models
const BankConnectionModel = require('../models/BankConnection');
const BankAccountModel = require('../models/BankAccount');
const TransactionModel = require('../models/Transaction');

/**
 * 🆕 GET /api/auth/powens/health
 * Simple health check endpoint to verify routes are working
 */
router.get('/health', async (req, res, next) => {
  try {
    logger.info('🏥 HEALTH CHECK: Powens routes health check', {
      step: 'HEALTH_CHECK_START',
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        status: 'healthy',
        service: 'powens-webauth-routes',
        timestamp: new Date().toISOString(),
        environment: {
          hasClientId: !!process.env.POWENS_CLIENT_ID,
          hasClientSecret: !!process.env.POWENS_CLIENT_SECRET,
          hasRedirectUri: !!process.env.POWENS_REDIRECT_URI,
          domain: process.env.POWENS_DOMAIN,
          nodeEnv: process.env.NODE_ENV
        }
      },
      message: 'Powens webauth routes are operational',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ HEALTH CHECK: Health check failed', {
      error: error.message,
      step: 'HEALTH_CHECK_ERROR'
    });
    
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 🆕 GET /api/auth/powens/connectors
 * List available bank connectors for user selection
 */
router.get('/connectors', async (req, res, next) => {
  try {
    logger.info('🏦 📋 CONNECTORS: Fetching available bank connectors', {
      step: 'GET_CONNECTORS_START'
    });

    const connectors = await powensService.auth.getAvailableConnectors();
    
    // Filter to show only webauth connectors for security
    const webAuthConnectors = connectors.filter(connector => 
      connector.auth_mechanism === 'webauth' && !connector.hidden
    );

    logger.info('✅ 📋 CONNECTORS: Retrieved successfully', {
      totalConnectors: connectors.length,
      webAuthConnectors: webAuthConnectors.length,
      step: 'GET_CONNECTORS_SUCCESS'
    });

    res.json({
      success: true,
      data: {
        connectors: webAuthConnectors.map(connector => ({
          id: connector.id,
          uuid: connector.uuid,
          name: connector.name,
          slug: connector.slug,
          color: connector.color,
          auth_mechanism: connector.auth_mechanism,
          capabilities: connector.capabilities,
          beta: connector.beta || false
        })),
        total: webAuthConnectors.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('❌ 📋 CONNECTORS: Failed to fetch connectors', {
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
 * 🆕 GET /api/auth/powens/webauth-url
 * Generate webauth URL for bank connection (FIXED)
 */
router.get('/webauth-url', async (req, res, next) => {
  try {
    const { connector_id, user_id = '00000000-0000-0000-0000-000000000001', source } = req.query;

    if (!connector_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing connector_id parameter',
        timestamp: new Date().toISOString()
      });
    }

    logger.info('🔗 🆕 WEBAUTH URL: Generating bank connection URL', {
      connectorId: connector_id,
      userId: user_id,
      source,
      step: 'WEBAUTH_URL_REQUEST'
    });

    // CRITICAL FIX: Use exact redirect URI from environment variable
    const redirectUri = process.env.POWENS_REDIRECT_URI;
    
    logger.info('🔧 WEBAUTH URL: Using redirect URI configuration', {
      redirectUri,
      envVar: process.env.POWENS_REDIRECT_URI,
      isUndefined: redirectUri === 'undefined' || !redirectUri,
      step: 'WEBAUTH_URL_CONFIG'
    });

    if (!redirectUri || redirectUri === 'undefined') {
      throw new Error('POWENS_REDIRECT_URI environment variable is not set properly');
    }

    const authUrl = await powensService.auth.generateAuthUrl(user_id, {
      connectorId: connector_id,
      redirectUri: redirectUri,
      state: user_id
    });

    logger.info('✅ 🔗 WEBAUTH URL: Generated successfully', {
      userId: user_id,
      connectorId: connector_id,
      authUrl: authUrl,
      redirectUri: redirectUri,
      step: 'WEBAUTH_URL_SUCCESS'
    });

    res.json({
      success: true,
      data: {
        webauth_url: authUrl,
        state: user_id,
        connector_id: connector_id,
        user_id: user_id,
        redirect_uri: redirectUri
      },
      message: 'Navigate to webauth_url to connect your bank account',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ 🔗 WEBAUTH URL: Generation failed', {
      connectorId: req.query.connector_id,
      userId: req.query.user_id,
      error: error.message,
      step: 'WEBAUTH_URL_ERROR'
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate webauth URL',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 🆕 GET /api/auth/powens/url (Alternative endpoint for webauth URL)
 * Generate webauth URL for bank connection - Alternative endpoint name
 * FIXED: Make connector_id optional for frontend compatibility
 */
router.get('/url', (req, res, next) => {
  // Simple test response to verify route registration
  res.json({
    success: true,
    data: {
      message: 'URL route is working',
      endpoint: '/api/auth/powens/url',
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * 🆕 GET /api/auth/powens/callback
 * Handle webauth callback after user connects bank
 */
router.get('/callback', async (req, res, next) => {
  try {
    logger.info('📨 🆕 WEBAUTH CALLBACK: Received bank connection callback', {
      query: req.query,
      step: 'CALLBACK_START'
    });

    // FIXED: Use the correct method name
    const callbackResult = await powensService.auth.exchangeCodeForToken(
      req.query.id_connection || req.query.connection_id, 
      req.query.state
    );
    const { connection_id, access_token, connection } = callbackResult;

    logger.info('🔄 🆕 CALLBACK: Processing connection data', {
      connectionId: connection_id,
      userId: req.query.state,
      step: 'CALLBACK_PROCESSING'
    });

    // Get user's token to fetch connection details
    const UserModel = require('../models/User');
    const userTokenData = await UserModel.getPowensToken(req.query.state);
    
    if (!userTokenData || !userTokenData.powens_permanent_token) {
      throw new Error('No user token found');
    }

    const token = userTokenData.powens_permanent_token;

    // Fetch connection details from Powens API
    const [connections, accounts] = await Promise.all([
      powensService.data.getUserConnections(token),
      powensService.data.getUserAccounts(token, req.query.state)
    ]);

    logger.info('📊 🆕 CALLBACK: Fetched connection data', {
      connections: connections.length,
      accounts: accounts.length,
      connectionId: connection_id,
      step: 'CALLBACK_DATA_FETCHED'
    });

    // Store connection in database
    let savedConnection = null;
    if (connections.length > 0) {
      const connectionToSave = connections.find(c => c.id.toString() === connection_id.toString()) || connections[0];
      
      const connectionData = {
        user_id: req.query.state,
        powens_user_id: userTokenData.powens_user_id,
        powens_connection_id: connectionToSave.id,
        bank_name: connectionToSave.connector?.name || 'Unknown Bank',
        bank_logo_url: connectionToSave.connector?.logo_url,
        access_token: token,
        refresh_token: token,
        token_expires_at: userTokenData.powens_token_expires_at || new Date(Date.now() + (3600 * 24 * 365 * 1000)),
        token_source: 'webauth_callback',
        connection_state: connectionToSave.state,
        last_sync_at: connectionToSave.last_update
      };

      savedConnection = await BankConnectionModel.create(connectionData);
      
      logger.info('✅ 🆕 CALLBACK: Connection saved to database', {
        savedConnectionId: savedConnection.id,
        powensConnectionId: connectionToSave.id,
        bankName: connectionData.bank_name,
        step: 'CALLBACK_CONNECTION_SAVED'
      });
    }

    // Store accounts in database
    let savedAccounts = 0;
    for (const account of accounts) {
      const accountData = powensService.data.mapPowensAccountToLocal(
        account, 
        req.query.state, 
        savedConnection ? savedConnection.id : null
      );
      await BankAccountModel.findOrCreateByPowensId(accountData);
      savedAccounts++;
    }

    logger.info('✅ 🆕 CALLBACK: Bank connection completed successfully', {
      connectionId: connection_id,
      userId: req.query.state,
      savedConnectionId: savedConnection?.id,
      savedAccounts,
      step: 'CALLBACK_SUCCESS'
    });

    // Redirect to success page or return JSON based on Accept header
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      res.json({
        success: true,
        data: {
          connection_id: connection_id,
          user_id: req.query.state,
          saved_connection_id: savedConnection?.id,
          saved_accounts: savedAccounts,
          bank_name: savedConnection?.bank_name
        },
        message: 'Bank connection established successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      // Redirect to frontend success page
      const redirectUrl = process.env.FRONTEND_SUCCESS_URL || '/success';
      res.redirect(`${redirectUrl}?connection_id=${connection_id}&accounts=${savedAccounts}`);
    }

  } catch (error) {
    logger.error('❌ 🆕 CALLBACK: Processing failed', {
      query: req.query,
      error: error.message,
      step: 'CALLBACK_ERROR'
    });

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      res.status(500).json({
        success: false,
        error: 'Callback processing failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    } else {
      // Redirect to frontend error page
      const errorUrl = process.env.FRONTEND_ERROR_URL || '/error';
      res.redirect(`${errorUrl}?error=${encodeURIComponent(error.message)}`);
    }
  }
});

/**
 * 📊 GET /api/auth/powens/connections
 * List user's bank connections (existing endpoint enhanced)
 */
router.get('/connections', async (req, res, next) => {
  try {
    const userId = req.query.user_id || '00000000-0000-0000-0000-000000000001';
    
    logger.info('📋 Powens connections requested', { 
      userId,
      step: 'GET_CONNECTIONS_START'
    });

    // Get connections from database
    const dbConnections = await BankConnectionModel.findByUserId(userId);
    
    logger.info('📊 Database connections retrieved', {
      userId,
      connectionCount: dbConnections.length,
      step: 'GET_CONNECTIONS_DB_SUCCESS'
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
        user_id: userId
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Database connections query failed', {
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
 * 🧪 GET /api/auth/powens/test-connection
 * Test endpoint to verify a specific bank connection works
 */
router.get('/test-connection', async (req, res, next) => {
  try {
    const { connection_id, user_id = '00000000-0000-0000-0000-000000000001' } = req.query;

    logger.info('🧪 🔍 TEST CONNECTION: Testing bank connection', {
      connectionId: connection_id,
      userId: user_id,
      step: 'TEST_CONNECTION_START'
    });

    // Get user's token
    const UserModel = require('../models/User');
    const userTokenData = await UserModel.getPowensToken(user_id);
    
    if (!userTokenData || !userTokenData.powens_permanent_token) {
      throw new Error('No user token found');
    }

    const token = userTokenData.powens_permanent_token;

    // Test the connection by fetching data
    const [connections, accounts, transactions] = await Promise.all([
      powensService.data.getUserConnections(token),
      powensService.data.getUserAccounts(token, user_id),
      powensService.data.getUserTransactions(token, { limit: 10, userId: user_id })
    ]);

    logger.info('✅ 🧪 TEST CONNECTION: Connection test completed', {
      userId: user_id,
      connectionId: connection_id,
      connections: connections.length,
      accounts: accounts.length,
      transactions: transactions.length,
      step: 'TEST_CONNECTION_SUCCESS'
    });

    res.json({
      success: true,
      data: {
        user_id: user_id,
        connection_id: connection_id,
        test_results: {
          connections_count: connections.length,
          accounts_count: accounts.length,
          transactions_count: transactions.length,
          has_data: accounts.length > 0 || transactions.length > 0
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
        }))
      },
      message: 'Connection test completed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ 🧪 TEST CONNECTION: Test failed', {
      connectionId: req.query.connection_id,
      userId: req.query.user_id,
      error: error.message,
      step: 'TEST_CONNECTION_ERROR'
    });
    
    res.status(500).json({
      success: false,
      error: 'Connection test failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;