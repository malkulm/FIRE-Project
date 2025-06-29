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
router.get('/url', async (req, res, next) => {
  try {
    const { connector_id, user_id = '00000000-0000-0000-0000-000000000001', source } = req.query;

    logger.info('🔗 🆕 AUTH URL: Generating bank connection URL (alternative endpoint)', {
      connectorId: connector_id,
      userId: user_id,
      source,
      query: req.query,
      step: 'AUTH_URL_REQUEST'
    });

    // FIXED: Make connector_id optional - frontend might not provide it initially
    let actualConnectorId = connector_id;
    if (!actualConnectorId) {
      logger.info('⚠️ No connector_id provided, will generate URL without specific connector', {
        step: 'AUTH_URL_NO_CONNECTOR'
      });
    }

    // CRITICAL FIX: Use exact redirect URI from environment variable
    const redirectUri = process.env.POWENS_REDIRECT_URI;
    
    logger.info('🔧 AUTH URL: Using redirect URI configuration', {
      redirectUri,
      envVar: process.env.POWENS_REDIRECT_URI,
      isUndefined: redirectUri === 'undefined' || !redirectUri,
      hasConnectorId: !!actualConnectorId,
      step: 'AUTH_URL_CONFIG'
    });

    if (!redirectUri || redirectUri === 'undefined') {
      throw new Error('POWENS_REDIRECT_URI environment variable is not set properly');
    }

    const authUrl = await powensService.auth.generateAuthUrl(user_id, {
      connectorId: actualConnectorId,
      redirectUri: redirectUri,
      state: user_id
    });

    logger.info('✅ 🔗 AUTH URL: Generated successfully', {
      userId: user_id,
      connectorId: actualConnectorId,
      authUrl: authUrl,
      redirectUri: redirectUri,
      step: 'AUTH_URL_SUCCESS'
    });

    res.json({
      success: true,
      data: {
        webauth_url: authUrl,
        auth_url: authUrl, // Alternative name
        state: user_id,
        connector_id: actualConnectorId,
        user_id: user_id,
        redirect_uri: redirectUri
      },
      message: 'Navigate to webauth_url to connect your bank account',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ 🔗 AUTH URL: Generation failed', {
      connectorId: req.query.connector_id,
      userId: req.query.user_id,
      error: error.message,
      stack: error.stack,
      step: 'AUTH_URL_ERROR'
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate authorization URL',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 🆕 GET /api/auth/powens/callback
 * Handle webauth callback after user connects bank
 * ENHANCED DEBUGGING VERSION to identify 504 timeout root cause
 */
router.get('/callback', async (req, res, next) => {
  const startTime = Date.now();
  let step = 'CALLBACK_START';
  
  try {
    logger.info('📨 🆕 WEBAUTH CALLBACK: Received bank connection callback', {
      query: req.query,
      headers: {
        accept: req.headers.accept,
        userAgent: req.headers['user-agent'],
        referer: req.headers.referer
      },
      step: 'CALLBACK_START',
      timestamp: new Date().toISOString()
    });

    // Add timeout protection for the entire callback
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Callback timeout after 25 seconds')), 25000);
    });

    const callbackWork = async () => {
      step = 'EXCHANGE_TOKEN';
      logger.info('🔄 STEP 1: Exchanging code for token', {
        connectionId: req.query.id_connection || req.query.connection_id,
        state: req.query.state,
        step,
        elapsed: Date.now() - startTime
      });

      const callbackResult = await powensService.auth.exchangeCodeForToken(
        req.query.id_connection || req.query.connection_id, 
        req.query.state
      );
      const { connection_id, access_token, connection } = callbackResult;

      logger.info('✅ STEP 1 COMPLETE: Token exchange successful', {
        connectionId: connection_id,
        hasAccessToken: !!access_token,
        step,
        elapsed: Date.now() - startTime
      });

      step = 'GET_USER_TOKEN';
      logger.info('🔄 STEP 2: Getting user token', {
        userId: req.query.state,
        step,
        elapsed: Date.now() - startTime
      });

      const UserModel = require('../models/User');
      const userTokenData = await UserModel.getPowensToken(req.query.state);
      
      if (!userTokenData || !userTokenData.powens_permanent_token) {
        throw new Error('No user token found');
      }

      const token = userTokenData.powens_permanent_token;

      logger.info('✅ STEP 2 COMPLETE: User token retrieved', {
        hasToken: !!token,
        powensUserId: userTokenData.powens_user_id,
        step,
        elapsed: Date.now() - startTime
      });

      step = 'FETCH_API_DATA';
      logger.info('🔄 STEP 3: Fetching connection and account data from Powens API', {
        step,
        elapsed: Date.now() - startTime
      });

      const [connections, accounts] = await Promise.all([
        powensService.data.getUserConnections(token),
        powensService.data.getUserAccounts(token, req.query.state)
      ]);

      logger.info('✅ STEP 3 COMPLETE: API data fetched', {
        connections: connections.length,
        accounts: accounts.length,
        connectionId: connection_id,
        step,
        elapsed: Date.now() - startTime
      });

      step = 'SAVE_CONNECTION';
      logger.info('🔄 STEP 4: Saving connection to database', {
        step,
        elapsed: Date.now() - startTime
      });

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
        
        logger.info('✅ STEP 4 COMPLETE: Connection saved to database', {
          savedConnectionId: savedConnection.id,
          powensConnectionId: connectionToSave.id,
          bankName: connectionData.bank_name,
          step,
          elapsed: Date.now() - startTime
        });
      }

      step = 'SAVE_ACCOUNTS';
      logger.info('🔄 STEP 5: Saving accounts to database', {
        accountCount: accounts.length,
        step,
        elapsed: Date.now() - startTime
      });

      let savedAccounts = 0;
      for (const account of accounts) {
        const accountData = powensService.data.mapPowensAccountToLocal(
          account, 
          req.query.state, 
          savedConnection ? savedConnection.id : null
        );
        await BankAccountModel.findOrCreateByPowensId(accountData);
        savedAccounts++;
        
        // Log every few accounts to track progress
        if (savedAccounts % 5 === 0 || savedAccounts === accounts.length) {
          logger.info(`💾 Account save progress: ${savedAccounts}/${accounts.length}`, {
            step,
            elapsed: Date.now() - startTime
          });
        }
      }

      logger.info('✅ STEP 5 COMPLETE: All accounts saved', {
        savedAccounts,
        step,
        elapsed: Date.now() - startTime
      });

      step = 'PREPARE_RESPONSE';
      logger.info('🔄 STEP 6: Preparing response', {
        acceptHeader: req.headers.accept,
        isJsonRequest: req.headers.accept && req.headers.accept.includes('application/json'),
        step,
        elapsed: Date.now() - startTime
      });

      // Return the data for response
      return {
        connection_id,
        savedConnection,
        savedAccounts,
        req
      };
    };

    // Race between the callback work and timeout
    const result = await Promise.race([callbackWork(), timeoutPromise]);
    const { connection_id, savedConnection, savedAccounts } = result;

    logger.info('✅ 🆕 CALLBACK: Bank connection completed successfully', {
      connectionId: connection_id,
      userId: req.query.state,
      savedConnectionId: savedConnection?.id,
      savedAccounts,
      totalElapsed: Date.now() - startTime,
      step: 'CALLBACK_SUCCESS'
    });

    step = 'SEND_RESPONSE';
    logger.info('🔄 STEP 7: Sending response to client', {
      step,
      elapsed: Date.now() - startTime
    });

    // Redirect to success page or return JSON based on Accept header
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      logger.info('📤 Sending JSON response', { step, elapsed: Date.now() - startTime });
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
      const redirectUrl = process.env.FRONTEND_SUCCESS_URL || '/';
      const finalRedirectUrl = `${redirectUrl}?success=true&connection_id=${connection_id}&accounts=${savedAccounts}`;
      
      logger.info('🔀 Sending redirect response', { 
        redirectUrl: finalRedirectUrl,
        step, 
        elapsed: Date.now() - startTime 
      });
      
      res.redirect(finalRedirectUrl);
    }

    logger.info('✅ STEP 7 COMPLETE: Response sent successfully', {
      step,
      totalElapsed: Date.now() - startTime
    });

  } catch (error) {
    logger.error('❌ 🆕 CALLBACK: Processing failed', {
      query: req.query,
      error: error.message,
      stack: error.stack,
      step: step,
      elapsed: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });

    try {
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        logger.info('📤 Sending JSON error response', { step: 'ERROR_JSON_RESPONSE' });
        res.status(500).json({
          success: false,
          error: 'Callback processing failed',
          message: error.message,
          step: step,
          elapsed: Date.now() - startTime,
          timestamp: new Date().toISOString()
        });
      } else {
        const errorUrl = process.env.FRONTEND_ERROR_URL || '/';
        const finalErrorUrl = `${errorUrl}?error=true&message=${encodeURIComponent(error.message)}&step=${step}`;
        
        logger.info('🔀 Sending error redirect response', { 
          errorUrl: finalErrorUrl,
          step: 'ERROR_REDIRECT_RESPONSE'
        });
        
        res.redirect(finalErrorUrl);
      }
      
      logger.info('✅ Error response sent successfully', { step: 'ERROR_RESPONSE_SENT' });
    } catch (responseError) {
      logger.error('❌ Failed to send error response', {
        originalError: error.message,
        responseError: responseError.message,
        step: 'ERROR_RESPONSE_FAILED'
      });
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