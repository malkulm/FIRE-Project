const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const powensService = require('../services/powens/powensService');
const BankConnectionModel = require('../models/BankConnection');
const UserModel = require('../models/User');

// Default user ID for development (in production, get from session/JWT)
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * @route POST /api/auth/powens/init
 * @desc Initialize Powens connection with CORRECT authentication flow
 * @access Public
 */
router.post('/powens/init', async (req, res, next) => {
  try {
    const userId = req.user?.id || DEFAULT_USER_ID; // Get from auth in production
    
    logger.info('🚀 POWENS CONNECTION INITIALIZATION (NEW FLOW)', { userId });
    
    try {
      // STEP 1 & 3: Create permanent token and generate webview URL with temporary code
      const authData = await powensService.generateAuthUrl(userId);
      
      logger.info('✅ POWENS INITIALIZATION SUCCESSFUL (NEW FLOW)', {
        userId,
        hasAuthUrl: !!authData.authUrl,
        hasState: !!authData.state,
        temporaryCodePreview: authData.temporaryCode
      });
      
      res.json({
        success: true,
        message: 'Powens initialization successful (new authentication flow)',
        data: {
          authUrl: authData.authUrl,
          state: authData.state,
          temporaryCode: authData.temporaryCode, // Preview only
          instructions: 'Redirect user to authUrl to connect their bank account',
          flow: 'NEW_OFFICIAL_FLOW',
          timestamp: new Date().toISOString()
        }
      });
    } catch (initError) {
      logger.error('❌ POWENS INITIALIZATION FAILED (NEW FLOW)', { 
        error: initError.message,
        userId 
      });
      
      // Return error without fallback - new flow should work
      res.status(500).json({
        success: false,
        error: {
          code: 'POWENS_INIT_FAILED',
          message: 'Failed to initialize Powens connection',
          details: initError.message
        },
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('❌ Powens initialization failed', { 
      error: error.message,
      userId: req.user?.id || DEFAULT_USER_ID 
    });
    next(error);
  }
});

// REMOVED: Conflicting /powens/url route - now handled by webauthRoutes.js
// This was causing route conflicts and preventing the working implementation from being reached

/**
 * @route GET /api/auth/powens/callback
 * @desc Handle Powens OAuth callback - UPDATED FOR NEW FLOW
 * @access Public
 */
router.get('/powens/callback', async (req, res, next) => {
  const callbackId = `callback-${Date.now()}`;
  
  try {
    const { code, state, error: authError, connection_id } = req.query;
    
    logger.info('🔥 POWENS CALLBACK RECEIVED (NEW FLOW)', { 
      callbackId,
      hasCode: !!code, 
      hasState: !!state, 
      hasError: !!authError,
      hasConnectionId: !!connection_id,
      connectionId: connection_id,
      codePreview: code ? code.substring(0, 20) + '...' : 'none',
      statePreview: state ? state.substring(0, 20) + '...' : 'none',
      allParams: req.query
    });
    
    if (authError) {
      logger.warn('❌ Powens authorization failed', { callbackId, error: authError });
      return res.send(`
        <html>
          <head><title>Connection Failed</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #e74c3c;">❌ Bank Connection Failed</h1>
            <p>Authorization was cancelled or failed: ${authError}</p>
            <p><a href="https://finance.dr-bosic.com" style="color: #3498db;">Return to Dashboard</a></p>
            <script>
              setTimeout(() => {
                window.close();
              }, 3000);
            </script>
          </body>
        </html>
      `);
    }
    
    // Use connection_id if available, otherwise use code
    const connectionParam = connection_id || code;
    
    if (!connectionParam) {
      logger.error('❌ NO CONNECTION PARAMETER', { 
        callbackId,
        code, 
        connection_id, 
        query: req.query 
      });
      return res.send(`
        <html>
          <head><title>Connection Failed</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #e74c3c;">❌ Missing Authorization Parameter</h1>
            <p>No authorization code or connection ID received from Powens</p>
            <p><a href="https://finance.dr-bosic.com" style="color: #3498db;">Return to Dashboard</a></p>
            <script>
              setTimeout(() => {
                window.close();
              }, 3000);
            </script>
          </body>
        </html>
      `);
    }
    
    try {
      logger.info('🔄 STARTING NEW FLOW CALLBACK PROCESSING', { 
        callbackId,
        connectionParam: connectionParam.substring(0, 10) + '...',
        userId: DEFAULT_USER_ID
      });
      
      // STEP 4: Handle callback with new flow
      const callbackData = await powensService.handleCallback(connectionParam, state, DEFAULT_USER_ID);
      
      logger.info('✅ CALLBACK DATA RETRIEVED (NEW FLOW)', { 
        callbackId,
        hasAccessToken: !!callbackData.accessToken,
        powensUserId: callbackData.powensUserId,
        connections: callbackData.connections.length,
        accounts: callbackData.accounts.length,
        transactions: callbackData.transactions.length
      });
      
      // STEP 5: Save connection and data to database
      let savedConnection = null;
      let bankName = 'Unknown Bank';
      
      if (callbackData.accounts.length > 0) {
        const firstAccount = callbackData.accounts[0];
        const connection = callbackData.connections[0];
        
        // Determine bank name from multiple sources
        bankName = connection?.connector?.name || 
                  connection?.bank?.name || 
                  firstAccount?.bank?.name || 
                  'Bank Connected';
        
        logger.info('💾 SAVING CONNECTION DATA (NEW FLOW)', {
          callbackId,
          powensUserId: callbackData.powensUserId,
          bankName: bankName,
          userId: DEFAULT_USER_ID,
          accountsToSave: callbackData.accounts.length
        });
        
        const connectionData = {
          user_id: DEFAULT_USER_ID,
          powens_user_id: callbackData.powensUserId,
          powens_connection_id: connection_id || connection?.id || `conn_${Date.now()}`,
          bank_name: bankName,
          bank_logo_url: connection?.connector?.logo_url || firstAccount?.bank?.logo_url,
          access_token: callbackData.accessToken,
          refresh_token: callbackData.accessToken,
          token_expires_at: new Date(Date.now() + (3600 * 24 * 365 * 1000)), // 1 year
          token_source: 'new_flow',
          powens_user_id_from_api: callbackData.powensUserId
        };
        
        try {
          savedConnection = await BankConnectionModel.create(connectionData);
          logger.info('✅ CONNECTION SAVED (NEW FLOW)', { 
            callbackId,
            savedConnectionId: savedConnection.id,
            bankName: bankName,
            powensConnectionId: connectionData.powens_connection_id
          });
        } catch (dbError) {
          logger.error('❌ DATABASE SAVE FAILED (NEW FLOW)', {
            callbackId,
            error: dbError.message,
            stack: dbError.stack
          });
          throw dbError;
        }
        
        // STEP 6: Trigger immediate data sync
        if (savedConnection) {
          logger.info('🔄 STARTING IMMEDIATE DATA SYNC (NEW FLOW)', { 
            callbackId,
            connectionId: savedConnection.id 
          });
          try {
            const syncService = require('../services/syncService');
            const syncResult = await syncService.syncConnection(savedConnection.id, {
              type: 'initial',
              force: true,
              includeTransactions: true,
              userId: DEFAULT_USER_ID
            });
            
            logger.info('✅ DATA SYNC COMPLETED (NEW FLOW)', {
              callbackId,
              connectionId: savedConnection.id,
              syncedAccounts: syncResult.accountsSynced,
              syncedTransactions: syncResult.transactionsSynced,
              syncStatus: syncResult.status
            });
          } catch (syncError) {
            // ENHANCED ERROR LOGGING
            logger.error('❌ DATA SYNC FAILED (NEW FLOW) - DETAILED ERROR', { 
              callbackId,
              connectionId: savedConnection.id,
              error: syncError.message,
              stack: syncError.stack,
              errorName: syncError.name,
              errorCode: syncError.code,
              // Log the actual data that was being processed
              availableAccountsCount: callbackData.accounts.length,
              availableTransactionsCount: callbackData.transactions.length,
              sampleAccountData: callbackData.accounts.length > 0 ? {
                id: callbackData.accounts[0].id,
                name: callbackData.accounts[0].name,
                original_name: callbackData.accounts[0].original_name,
                type: callbackData.accounts[0].type,
                balance: callbackData.accounts[0].balance,
                currency: callbackData.accounts[0].currency,
                iban: callbackData.accounts[0].iban,
                allKeys: Object.keys(callbackData.accounts[0])
              } : null,
              sampleTransactionData: callbackData.transactions.length > 0 ? {
                id: callbackData.transactions[0].id,
                id_account: callbackData.transactions[0].id_account,
                value: callbackData.transactions[0].value,
                wording: callbackData.transactions[0].wording,
                date: callbackData.transactions[0].date,
                currency: callbackData.transactions[0].currency,
                allKeys: Object.keys(callbackData.transactions[0])
              } : null
            });
            // Don't fail the callback for sync errors
          }
        }
      } else {
        logger.warn('⚠️ NO ACCOUNTS RETURNED (NEW FLOW)', {
          callbackId,
          connectionsCount: callbackData.connections.length,
          accountsCount: callbackData.accounts.length,
          hasAccessToken: !!callbackData.accessToken
        });
      }
      
      // STEP 7: Return success page
      logger.info('✅ CALLBACK PROCESSING COMPLETE (NEW FLOW)', {
        callbackId,
        bankName: bankName,
        connectionsFound: callbackData.connections.length,
        accountsFound: callbackData.accounts.length,
        connectionSaved: !!savedConnection,
        savedConnectionId: savedConnection?.id,
        powensUserId: callbackData.powensUserId
      });
      
      res.send(`
        <html>
          <head><title>Connection Successful</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #27ae60;">✅ Bank Connection Successful!</h1>
            <p><strong>Flow:</strong> NEW OFFICIAL POWENS FLOW</p>
            <p><strong>Bank:</strong> ${bankName}</p>
            <p><strong>Powens User ID:</strong> ${callbackData.powensUserId}</p>
            <p><strong>Connections Found:</strong> ${callbackData.connections.length}</p>
            <p><strong>Accounts Found:</strong> ${callbackData.accounts.length}</p>
            <p><strong>Transactions Found:</strong> ${callbackData.transactions.length}</p>
            <p><strong>Connection Saved:</strong> ${savedConnection ? '✅ Yes (ID: ' + savedConnection.id + ')' : '❌ No'}</p>
            <p><strong>Callback ID:</strong> ${callbackId}</p>
            <p style="color: #7f8c8d;">You can now close this window and return to the dashboard.</p>
            <div style="margin: 20px 0;">
              <a href="https://finance.dr-bosic.com" style="background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                Return to Dashboard
              </a>
            </div>
            <p style="font-size: 14px; color: #95a5a6;">
              Banking data synchronization has been initiated automatically.
            </p>
            <script>
              // Auto-close after 10 seconds
              setTimeout(() => {
                window.close();
              }, 10000);
              
              // Try to communicate with parent window
              if (window.opener) {
                try {
                  window.opener.postMessage({
                    type: 'POWENS_CONNECTION_SUCCESS',
                    callbackId: '${callbackId}',
                    bankName: '${bankName}',
                    connections: ${callbackData.connections.length},
                    accounts: ${callbackData.accounts.length},
                    transactions: ${callbackData.transactions.length},
                    saved: ${!!savedConnection},
                    connectionId: ${savedConnection?.id || 'null'},
                    powensUserId: '${callbackData.powensUserId}',
                    flow: 'NEW_OFFICIAL_FLOW'
                  }, '*');
                } catch(e) {
                  console.log('Could not communicate with parent window');
                }
              }
            </script>
          </body>
        </html>
      `);
      
    } catch (error) {
      logger.error('❌ CALLBACK PROCESSING FAILED (NEW FLOW)', { 
        callbackId,
        error: error.message,
        stack: error.stack,
        connectionParam: connectionParam ? connectionParam.substring(0, 10) + '...' : 'none'
      });
      
      res.send(`
        <html>
          <head><title>Connection Failed</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #e74c3c;">❌ Connection Processing Failed</h1>
            <p><strong>Flow:</strong> NEW OFFICIAL POWENS FLOW</p>
            <p><strong>Error:</strong> ${error.message}</p>
            <p><strong>Callback ID:</strong> ${callbackId}</p>
            <p><a href="https://finance.dr-bosic.com" style="color: #3498db;">Return to Dashboard</a></p>
            <details style="margin: 20px; text-align: left;">
              <summary>Technical Details (for debugging)</summary>
              <pre style="background: #f4f4f4; padding: 10px; border-radius: 5px; overflow: auto;">
Connection ID: ${connection_id || 'N/A'}
Code: ${code ? code.substring(0, 20) + '...' : 'N/A'}
State: ${state ? state.substring(0, 20) + '...' : 'N/A'}
Error: ${error.message}
Callback ID: ${callbackId}
Flow: NEW_OFFICIAL_POWENS_FLOW
Timestamp: ${new Date().toISOString()}
              </pre>
            </details>
            <script>
              setTimeout(() => {
                window.close();
              }, 15000);
            </script>
          </body>
        </html>
      `);
    }
    
  } catch (error) {
    logger.error('❌ CALLBACK HANDLER FAILED (NEW FLOW)', { 
      callbackId,
      error: error.message,
      stack: error.stack 
    });
    next(error);
  }
});

/**
 * @route POST /api/auth/powens/callback
 * @desc Handle Powens callback after authorization (POST version) - UPDATED
 * @access Public
 */
router.post('/powens/callback', async (req, res, next) => {
  try {
    const { code, state, error: authError, connection_id } = req.body;
    
    logger.info('📨 Powens POST callback received (NEW FLOW)', { 
      hasCode: !!code, 
      hasState: !!state, 
      hasError: !!authError,
      hasConnectionId: !!connection_id,
      allParams: req.body
    });
    
    if (authError) {
      logger.warn('❌ Powens authorization failed', { error: authError });
      return res.status(400).json({
        success: false,
        error: {
          code: 'POWENS_AUTH_FAILED',
          message: 'Bank authorization was cancelled or failed',
          details: authError
        }
      });
    }
    
    const connectionParam = connection_id || code;
    
    if (!connectionParam) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_AUTH_PARAM',
          message: 'Authorization code or connection ID is required',
          details: 'No authorization parameter received from Powens'
        }
      });
    }
    
    // Use new flow to handle callback
    const callbackData = await powensService.handleCallback(connectionParam, state, DEFAULT_USER_ID);
    
    // Save connection data
    let savedConnection = null;
    if (callbackData.accounts.length > 0) {
      const firstAccount = callbackData.accounts[0];
      const connection = callbackData.connections[0];
      
      const connectionData = {
        user_id: DEFAULT_USER_ID,
        powens_user_id: callbackData.powensUserId,
        powens_connection_id: connection_id || connection?.id || 'webhook',
        bank_name: connection?.bank?.name || firstAccount?.bank?.name || 'Unknown Bank',
        bank_logo_url: connection?.bank?.logo_url || firstAccount?.bank?.logo_url,
        access_token: callbackData.accessToken,
        refresh_token: callbackData.accessToken,
        token_expires_at: new Date(Date.now() + (3600 * 24 * 365 * 1000)),
        token_source: 'new_flow_post',
        powens_user_id_from_api: callbackData.powensUserId
      };
      
      savedConnection = await BankConnectionModel.create(connectionData);
      
      logger.info('✅ Powens connection saved (NEW FLOW POST)', { 
        connectionId: savedConnection.id,
        bankName: connectionData.bank_name,
        powensUserId: callbackData.powensUserId
      });
      
      // Trigger data sync
      try {
        const syncService = require('../services/syncService');
        await syncService.syncConnection(savedConnection.id, {
          type: 'initial',
          force: true,
          includeTransactions: true,
          userId: DEFAULT_USER_ID
        });
      } catch (syncError) {
        logger.error('❌ Data sync failed in POST callback (NEW FLOW)', { error: syncError.message });
      }
    }
    
    res.json({
      success: true,
      message: 'Powens connection established successfully (new flow)',
      data: {
        flow: 'NEW_OFFICIAL_FLOW',
        powensUserId: callbackData.powensUserId,
        connectionsFound: callbackData.connections.length,
        accountsFound: callbackData.accounts.length,
        transactionsFound: callbackData.transactions.length,
        bankName: savedConnection?.bank_name,
        connectionSaved: !!savedConnection,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('❌ Powens POST callback failed (NEW FLOW)', { error: error.message });
    next(error);
  }
});

/**
 * @route POST /api/auth/powens/refresh
 * @desc Refresh Powens access tokens (UPDATED FOR NEW FLOW)
 * @access Public
 */
router.post('/powens/refresh', async (req, res, next) => {
  try {
    const userId = req.user?.id || DEFAULT_USER_ID;
    
    logger.info('🔄 Token refresh requested (NEW FLOW)', { userId });
    
    // Get user's connections
    const connections = await BankConnectionModel.findByUserId(userId);
    
    if (connections.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NO_CONNECTIONS',
          message: 'No Powens connections found for user',
          details: 'User must connect a bank account first'
        }
      });
    }
    
    let refreshedCount = 0;
    const results = [];
    
    // Refresh tokens for all connections using new flow
    for (const connection of connections) {
      try {
        const tokenData = await powensService.refreshAccessToken(connection.access_token, userId);
        
        await BankConnectionModel.updateTokens(
          connection.id,
          tokenData.accessToken,
          tokenData.refreshToken,
          tokenData.expiresAt
        );
        
        refreshedCount++;
        results.push({
          connectionId: connection.id,
          bankName: connection.bank_name,
          status: 'refreshed',
          expiresAt: tokenData.expiresAt
        });
        
      } catch (error) {
        logger.error('❌ Failed to refresh connection tokens (NEW FLOW)', { 
          connectionId: connection.id, 
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
    
    res.json({
      success: true,
      message: `Token refresh completed for ${refreshedCount}/${connections.length} connections (new flow)`,
      data: {
        flow: 'NEW_OFFICIAL_FLOW',
        totalConnections: connections.length,
        refreshedCount: refreshedCount,
        results: results,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('❌ Token refresh failed (NEW FLOW)', { error: error.message });
    next(error);
  }
});

/**
 * @route GET /api/auth/powens/connections
 * @desc Get user's Powens connections
 * @access Public
 */
router.get('/powens/connections', async (req, res, next) => {
  try {
    const userId = req.user?.id || DEFAULT_USER_ID;
    
    logger.info('📋 Powens connections requested', { userId });
    
    const connections = await BankConnectionModel.findByUserId(userId);
    
    // Remove sensitive data
    const safeConnections = connections.map(conn => ({
      id: conn.id,
      bank_name: conn.bank_name,
      bank_logo_url: conn.bank_logo_url,
      status: conn.status,
      last_sync_at: conn.last_sync_at,
      last_sync_status: conn.last_sync_status,
      sync_enabled: conn.sync_enabled,
      created_at: conn.created_at,
      token_source: conn.token_source,
      powens_user_id_from_api: conn.powens_user_id_from_api
    }));
    
    res.json({
      success: true,
      message: 'Powens connections retrieved',
      data: safeConnections,
      meta: {
        total: connections.length,
        active: connections.filter(c => c.status === 'active').length,
        newFlow: connections.filter(c => c.token_source === 'new_flow').length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('❌ Failed to get Powens connections', { error: error.message });
    next(error);
  }
});

/**
 * @route DELETE /api/auth/powens/connections/:connectionId
 * @desc Delete a Powens connection
 * @access Public
 */
router.delete('/powens/connections/:connectionId', async (req, res, next) => {
  try {
    const { connectionId } = req.params;
    const userId = req.user?.id || DEFAULT_USER_ID;
    
    logger.info('🗑️ Powens connection deletion requested', { userId, connectionId });
    
    const connection = await BankConnectionModel.findById(connectionId);
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'Connection not found',
          details: `Connection ${connectionId} does not exist`
        }
      });
    }
    
    if (connection.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authorized to delete this connection',
          details: 'Connection belongs to different user'
        }
      });
    }
    
    await BankConnectionModel.delete(connectionId);
    
    logger.info('✅ Powens connection deleted', { connectionId, bankName: connection.bank_name });
    
    res.json({
      success: true,
      message: 'Powens connection deleted successfully',
      data: {
        deletedConnectionId: connectionId,
        bankName: connection.bank_name,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('❌ Failed to delete Powens connection', { error: error.message });
    next(error);
  }
});

/**
 * @route GET /api/auth/powens/debug/user-token
 * @desc Debug endpoint to check user's Powens token status
 * @access Public
 */
router.get('/powens/debug/user-token', async (req, res, next) => {
  try {
    const userId = req.user?.id || DEFAULT_USER_ID;
    
    const userTokenData = await UserModel.getPowensToken(userId);
    
    res.json({
      success: true,
      message: 'User Powens token status',
      data: {
        userId,
        hasToken: !!userTokenData?.powens_permanent_token,
        powensUserId: userTokenData?.powens_user_id,
        tokenType: userTokenData?.powens_token_type,
        createdAt: userTokenData?.powens_token_created_at,
        expiresAt: userTokenData?.powens_token_expires_at,
        isExpired: userTokenData?.isExpired,
        tokenPreview: userTokenData?.powens_permanent_token ? 
          userTokenData.powens_permanent_token.substring(0, 15) + '...' : 'NOT SET'
      }
    });
  } catch (error) {
    logger.error('❌ Failed to get user token debug info', { error: error.message });
    next(error);
  }
});

module.exports = router;