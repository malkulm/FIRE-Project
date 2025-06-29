const axios = require('axios');
const { logger } = require('../../shared/utils/logger');
const { POWENS_API_URL } = require('./constants');

// Models
const UserModel = require('../models/User');

/**
 * Powens Authentication Service
 * Handles user authentication, token management, and connection creation with Powens API
 * Supports both webauth (Option 1) and manual API connections (Option 2)
 */
class PowensAuthService {
  constructor() {
    this.apiUrl = POWENS_API_URL;
    this.clientId = process.env.POWENS_CLIENT_ID;
    this.clientSecret = process.env.POWENS_CLIENT_SECRET;
    
    logger.info('🔧 POWENS AUTH SERVICE INITIALIZED', {
      apiUrl: this.apiUrl,
      hasClientId: !!this.clientId,
      hasClientSecret: !!this.clientSecret
    });
  }

  /**
   * Initialize a temporary or permanent user in Powens
   * Based on: POST /auth/init
   */
  async initializeUser(userId = null) {
    logger.info('👤 Initializing Powens user', {
      userId,
      step: 'INIT_USER_START'
    });

    try {
      const response = await axios.post(`${this.apiUrl}/auth/init`, {
        client_id: this.clientId,
        client_secret: this.clientSecret
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const { auth_token, type, id_user, expires_in } = response.data;

      logger.info('✅ Powens user initialized successfully', {
        userId,
        powensUserId: id_user,
        tokenType: type,
        expiresIn: expires_in,
        step: 'INIT_USER_SUCCESS'
      });

      // Store the user token in database if userId provided
      if (userId) {
        const expiresAt = expires_in ? new Date(Date.now() + (expires_in * 1000)) : null;
        
        await UserModel.updatePowensToken(userId, {
          powens_user_id: id_user,
          powens_permanent_token: auth_token,
          powens_token_expires_at: expiresAt,
          powens_token_type: type
        });

        logger.info('✅ Powens token stored in database', {
          userId,
          powensUserId: id_user,
          tokenType: type
        });
      }

      return {
        auth_token,
        type,
        id_user,
        expires_in
      };
    } catch (error) {
      logger.error('❌ Failed to initialize Powens user', {
        userId,
        error: error.message,
        status: error.response?.status,
        responseData: error.response?.data,
        step: 'INIT_USER_ERROR'
      });
      throw new Error(`Failed to initialize user: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Create permanent user token for existing user
   * Based on: POST /auth/token/access
   */
  async createPermanentUserToken(userId) {
    logger.info('🔒 Creating permanent user token', {
      userId,
      step: 'CREATE_PERMANENT_TOKEN_START'
    });

    try {
      // Check if user already has a permanent token
      const existingToken = await UserModel.getPowensToken(userId);
      if (existingToken && existingToken.powens_permanent_token && existingToken.powens_token_type === 'permanent') {
        logger.info('✅ User already has permanent token', {
          userId,
          powensUserId: existingToken.powens_user_id,
          step: 'CREATE_PERMANENT_TOKEN_EXISTS'
        });
        return existingToken.powens_permanent_token;
      }

      // Initialize user if no token exists
      if (!existingToken) {
        const initResult = await this.initializeUser(userId);
        return initResult.auth_token;
      }

      // Generate temporary code and exchange for permanent token
      const tempCode = await this.generateTemporaryCode(existingToken.powens_permanent_token);
      
      const response = await axios.post(`${this.apiUrl}/auth/token/access`, {
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: tempCode.code
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const { access_token, token_type } = response.data;

      // Update database with permanent token
      await UserModel.updatePowensToken(userId, {
        powens_permanent_token: access_token,
        powens_token_type: 'permanent',
        powens_token_expires_at: null // Permanent tokens don't expire
      });

      logger.info('✅ Permanent user token created', {
        userId,
        tokenType: token_type,
        step: 'CREATE_PERMANENT_TOKEN_SUCCESS'
      });

      return access_token;
    } catch (error) {
      logger.error('❌ Failed to create permanent user token', {
        userId,
        error: error.message,
        status: error.response?.status,
        responseData: error.response?.data,
        step: 'CREATE_PERMANENT_TOKEN_ERROR'
      });
      throw new Error(`Failed to create permanent token: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Generate temporary code for user
   * Based on: GET /auth/token/code
   */
  async generateTemporaryCode(permanentToken, type = 'singleAccess') {
    logger.info('🎫 Generating temporary code', {
      type,
      step: 'GENERATE_TEMP_CODE_START'
    });

    try {
      const response = await axios.get(`${this.apiUrl}/auth/token/code`, {
        params: { type },
        headers: {
          'Authorization': `Bearer ${permanentToken}`,
          'Content-Type': 'application/json'
        }
      });

      const { code, type: codeType, access, expires_in } = response.data;

      logger.info('✅ Temporary code generated', {
        codeType,
        access,
        expiresIn: expires_in,
        step: 'GENERATE_TEMP_CODE_SUCCESS'
      });

      return {
        code,
        type: codeType,
        access,
        expires_in
      };
    } catch (error) {
      logger.error('❌ Failed to generate temporary code', {
        type,
        error: error.message,
        status: error.response?.status,
        responseData: error.response?.data,
        step: 'GENERATE_TEMP_CODE_ERROR'
      });
      throw new Error(`Failed to generate temporary code: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get available connectors (banks)
   * Based on: GET /connectors
   */
  async getAvailableConnectors() {
    logger.info('🏦 Getting available connectors', {
      step: 'GET_CONNECTORS_START'
    });

    try {
      const response = await axios.get(`${this.apiUrl}/connectors`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const connectors = response.data.connectors || response.data || [];

      logger.info('✅ Available connectors retrieved', {
        connectorCount: connectors.length,
        step: 'GET_CONNECTORS_SUCCESS'
      });

      return connectors;
    } catch (error) {
      logger.error('❌ Failed to get available connectors', {
        error: error.message,
        status: error.response?.status,
        responseData: error.response?.data,
        step: 'GET_CONNECTORS_ERROR'
      });
      throw new Error(`Failed to get connectors: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Generate auth URL for webauth flow (Option 1)
   * FIXED: Use correct Powens webview endpoint structure
   * Based on: https://{domain}.biapi.pro/2.0/auth/webview/connect
   */
  async generateAuthUrl(userId, options = {}) {
    logger.info('🔗 Generating webauth URL', {
      userId,
      options,
      step: 'GENERATE_AUTH_URL_START'
    });

    try {
      const {
        redirectUri = process.env.POWENS_REDIRECT_URI,
        connectorId = null,
        state = userId
      } = options;

      // CRITICAL FIX: Use exact redirect URI from environment
      if (!redirectUri || redirectUri === 'undefined') {
        throw new Error('POWENS_REDIRECT_URI environment variable is not set or is undefined');
      }

      logger.info('🔧 Using redirect URI configuration', {
        redirectUri,
        envValue: process.env.POWENS_REDIRECT_URI,
        connectorId,
        state,
        step: 'REDIRECT_URI_CONFIG'
      });

      // Get or create temporary code
      const userToken = await UserModel.getPowensToken(userId);
      if (!userToken) {
        // Initialize user if no token exists
        logger.info('🆕 No user token found, initializing user', { userId });
        await this.initializeUser(userId);
        const newUserToken = await UserModel.getPowensToken(userId);
        if (!newUserToken) {
          throw new Error('Failed to initialize user token');
        }
      }

      const currentUserToken = await UserModel.getPowensToken(userId);
      const tempCode = await this.generateTemporaryCode(currentUserToken.powens_permanent_token, 'singleAccess');

      // FIXED: Use correct Powens webview connect endpoint structure
      const params = new URLSearchParams({
        redirect_uri: redirectUri,
        client_id: this.clientId,
        token: tempCode.code
      });

      if (connectorId) {
        params.append('id_connector', connectorId);
      }

      if (state) {
        params.append('state', state);
      }

      // FIXED: Use the correct endpoint path for webview
      const authUrl = `${this.apiUrl}/auth/webview/connect?${params}`;

      logger.info('✅ Webauth URL generated', {
        userId,
        authUrl,
        connectorId,
        redirectUri,
        clientId: this.clientId,
        hasToken: !!tempCode.code,
        step: 'GENERATE_AUTH_URL_SUCCESS'
      });

      return authUrl;
    } catch (error) {
      logger.error('❌ Failed to generate auth URL', {
        userId,
        options,
        error: error.message,
        step: 'GENERATE_AUTH_URL_ERROR'
      });
      throw new Error(`Failed to generate auth URL: ${error.message}`);
    }
  }

  /**
   * Exchange callback code for connection data (Option 1)
   */
  async exchangeCodeForToken(code, state) {
    logger.info('🔄 Exchanging callback for connection', {
      code: code ? 'present' : 'missing',
      state,
      step: 'EXCHANGE_CODE_START'
    });

    try {
      // In webauth flow, the code is actually a connection_id
      const connectionId = code;
      
      // Get user token for the connection check
      const userToken = await UserModel.getPowensToken(state);
      if (!userToken) {
        throw new Error('No user token found');
      }

      // Get connection details
      const response = await axios.get(`${this.apiUrl}/users/me/connections/${connectionId}?expand=accounts`, {
        headers: {
          'Authorization': `Bearer ${userToken.powens_permanent_token}`,
          'Content-Type': 'application/json'
        }
      });

      const connection = response.data;

      logger.info('✅ Connection details retrieved', {
        connectionId,
        state,
        accountsCount: connection.accounts?.length || 0,
        step: 'EXCHANGE_CODE_SUCCESS'
      });

      return {
        connection_id: connectionId,
        access_token: userToken.powens_permanent_token,
        connection: connection
      };
    } catch (error) {
      logger.error('❌ Failed to exchange code for connection', {
        code,
        state,
        error: error.message,
        status: error.response?.status,
        responseData: error.response?.data,
        step: 'EXCHANGE_CODE_ERROR'
      });
      throw new Error(`Failed to exchange code: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken, userId) {
    logger.info('🔄 Refreshing access token', {
      userId,
      step: 'REFRESH_TOKEN_START'
    });

    try {
      // For Powens, permanent tokens don't need refreshing
      // Just verify the token is still valid
      const userToken = await UserModel.getPowensToken(userId);
      if (!userToken || !userToken.powens_permanent_token) {
        throw new Error('No permanent token found');
      }

      // Test token validity by making a simple API call
      await axios.get(`${this.apiUrl}/users/me/connections`, {
        headers: {
          'Authorization': `Bearer ${userToken.powens_permanent_token}`,
          'Content-Type': 'application/json'
        }
      });

      logger.info('✅ Token is still valid', {
        userId,
        step: 'REFRESH_TOKEN_SUCCESS'
      });

      return userToken.powens_permanent_token;
    } catch (error) {
      logger.error('❌ Token refresh failed', {
        userId,
        error: error.message,
        status: error.response?.status,
        step: 'REFRESH_TOKEN_ERROR'
      });
      
      // If token is invalid, reinitialize user
      if (error.response?.status === 401) {
        logger.info('🔄 Token invalid, reinitializing user', { userId });
        const newToken = await this.initializeUser(userId);
        return newToken.auth_token;
      }
      
      throw new Error(`Failed to refresh token: ${error.message}`);
    }
  }

  // ============================================================================
  // 🆕 OPTION 2 - MANUAL API CONNECTION METHODS
  // ============================================================================

  /**
   * 🆕 OPTION 2 - STEP 3: Create Manual Connection via API
   * Based on: POST /users/{userId}/connections?expand=all_accounts
   */
  async createManualConnection(accessToken, connectorId, connectionFields = {}) {
    logger.info('🔗 🆕 OPTION 2 - STEP 3: Creating manual connection via API', {
      connectorId,
      hasFields: Object.keys(connectionFields).length > 0,
      step: 'CREATE_MANUAL_CONNECTION_START'
    });

    try {
      const connectionData = {
        id_connector: connectorId,
        ...connectionFields // Include any required fields for the connector
      };

      // Fixed: Use correct API endpoint according to Powens documentation
      const response = await axios.post(`${this.apiUrl}/users/me/connections?expand=all_accounts`, 
        connectionData, 
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const connection = response.data;

      logger.info('✅ 🆕 OPTION 2 - STEP 3: Manual connection created successfully', {
        connectionId: connection.id,
        connectorId,
        state: connection.state,
        accountsCount: connection.accounts?.length || 0,
        step: 'CREATE_MANUAL_CONNECTION_SUCCESS'
      });

      return connection;
    } catch (error) {
      logger.error('❌ 🆕 OPTION 2 - STEP 3: Manual connection creation failed', {
        connectorId,
        error: error.message,
        status: error.response?.status,
        responseData: error.response?.data,
        step: 'CREATE_MANUAL_CONNECTION_ERROR'
      });
      throw new Error(`Failed to create manual connection: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * 🆕 OPTION 2 - STEP 5: Enable Accounts
   * Based on: PUT /users/{userId}/accounts/{accountIds}
   * FIXED: Correct API endpoint according to Powens documentation
   */
  async enableAccounts(accessToken, accountIds) {
    logger.info('🔓 🆕 OPTION 2 - STEP 5: Enabling accounts via API', {
      accountIds,
      accountCount: accountIds.length,
      step: 'ENABLE_ACCOUNTS_START'
    });

    try {
      // Convert array to comma-separated string
      const accountIdsStr = accountIds.join(',');
      
      // Fixed: Correct endpoint without ?all parameter as per Powens docs
      const response = await axios.put(`${this.apiUrl}/users/me/accounts/${accountIdsStr}`, 
        { disabled: false }, // Enable accounts by setting disabled to false
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('✅ 🆕 OPTION 2 - STEP 5: Accounts enabled successfully', {
        accountIds,
        responseStatus: response.status,
        step: 'ENABLE_ACCOUNTS_SUCCESS'
      });

      return accountIds; // Return the enabled account IDs
    } catch (error) {
      logger.error('❌ 🆕 OPTION 2 - STEP 5: Enable accounts failed', {
        accountIds,
        error: error.message,
        status: error.response?.status,
        responseData: error.response?.data,
        step: 'ENABLE_ACCOUNTS_ERROR'
      });
      throw new Error(`Failed to enable accounts: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * 🆕 OPTION 2: Get Connector Details with Fields
   * Enhanced version to get connector fields for manual connection
   * Based on: GET /connectors/{connectorId}?expand=fields
   */
  async getConnectorWithFields(connectorId) {
    logger.info('🏦 🆕 OPTION 2: Getting connector details with fields', {
      connectorId,
      step: 'GET_CONNECTOR_FIELDS_START'
    });

    try {
      const response = await axios.get(`${this.apiUrl}/connectors/${connectorId}?expand=fields`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const connector = response.data;

      logger.info('✅ 🆕 OPTION 2: Connector details retrieved', {
        connectorId,
        name: connector.name,
        authMechanism: connector.auth_mechanism,
        fieldsCount: connector.fields?.length || 0,
        step: 'GET_CONNECTOR_FIELDS_SUCCESS'
      });

      return connector;
    } catch (error) {
      logger.error('❌ 🆕 OPTION 2: Failed to get connector details', {
        connectorId,
        error: error.message,
        status: error.response?.status,
        step: 'GET_CONNECTOR_FIELDS_ERROR'
      });
      throw new Error(`Failed to get connector details: ${error.message}`);
    }
  }

  /**
   * 🆕 OPTION 2: Get All Connectors with Fields for Manual Connection
   * Based on: GET /connectors?expand=fields
   */
  async getConnectorsWithFields() {
    logger.info('🏦 🆕 OPTION 2: Getting all connectors with fields', {
      step: 'GET_ALL_CONNECTORS_FIELDS_START'
    });

    try {
      const response = await axios.get(`${this.apiUrl}/connectors?expand=fields`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const connectors = response.data.connectors || response.data || [];

      logger.info('✅ 🆕 OPTION 2: All connectors with fields retrieved', {
        connectorCount: connectors.length,
        step: 'GET_ALL_CONNECTORS_FIELDS_SUCCESS'
      });

      return connectors;
    } catch (error) {
      logger.error('❌ 🆕 OPTION 2: Failed to get connectors with fields', {
        error: error.message,
        status: error.response?.status,
        step: 'GET_ALL_CONNECTORS_FIELDS_ERROR'
      });
      throw new Error(`Failed to get connectors with fields: ${error.message}`);
    }
  }
}

module.exports = new PowensAuthService();