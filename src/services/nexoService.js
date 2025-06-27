const axios = require('axios');
const { logger } = require('../utils/logger');

/**
 * Nexo Payment Gateway API Service
 * 
 * This service provides a segregated interface to the Nexo Payment Gateway API
 * for cryptocurrency asset management and deposit address creation.
 * 
 * Documentation: https://pg.nexo.com/
 */
class NexoService {
  constructor() {
    this.apiKey = process.env.NEXO_API_KEY;
    this.baseURL = process.env.NEXO_API_BASE_URL || 'https://pg.nexo.com/api/v1';
    this.webhookSecret = process.env.NEXO_WEBHOOK_SECRET;
    
    if (!this.apiKey) {
      logger.warn('Nexo API key not configured. Nexo functionality will be limited.');
    }
    
    // Setup axios instance with default headers
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'x-api-key': this.apiKey })
      }
    });

    // Request/Response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Nexo API Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
          hasApiKey: !!config.headers['x-api-key']
        });
        return config;
      },
      (error) => {
        logger.error('Nexo API Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Nexo API Response', {
          status: response.status,
          url: response.config.url,
          dataSize: JSON.stringify(response.data).length
        });
        return response;
      },
      (error) => {
        logger.error('Nexo API Response Error', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          errorData: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Check if Nexo service is properly configured
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Get connection status and basic info
   */
  async getConnectionStatus() {
    try {
      if (!this.isConfigured()) {
        return {
          connected: false,
          error: 'API key not configured',
          configured: false
        };
      }

      // Test connection by fetching assets
      const assets = await this.getAssets();
      
      return {
        connected: true,
        configured: true,
        assetsCount: assets?.assets?.length || 0,
        baseURL: this.baseURL
      };
    } catch (error) {
      return {
        connected: false,
        configured: true,
        error: error.message,
        baseURL: this.baseURL
      };
    }
  }

  /**
   * Get all supported assets from Nexo Payment Gateway
   * 
   * @returns {Promise<Object>} Assets response from Nexo API
   */
  async getAssets() {
    try {
      if (!this.isConfigured()) {
        throw new Error('Nexo API key is not configured');
      }

      logger.info('Fetching Nexo supported assets');
      
      const response = await this.client.get('/assets');
      
      logger.info('Successfully fetched Nexo assets', {
        assetsCount: response.data?.assets?.length || 0
      });
      
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch Nexo assets', {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        errorData: error.response?.data
      });
      
      // Re-throw with more context
      const nexoError = new Error(`Nexo API Error: ${error.message}`);
      nexoError.originalError = error;
      nexoError.status = error.response?.status;
      nexoError.nexoErrorData = error.response?.data;
      throw nexoError;
    }
  }

  /**
   * Create a deposit address for a specific asset and reference ID
   * 
   * @param {string} referenceId - Unique merchant reference ID (0-50 chars, alphanumeric + hyphens/underscores)
   * @param {string} asset - Asset symbol (e.g., 'BTC', 'ETH', 'USDT_ETH')
   * @returns {Promise<Object>} Deposit address response
   */
  async createDepositAddress(referenceId, asset) {
    try {
      if (!this.isConfigured()) {
        throw new Error('Nexo API key is not configured');
      }

      // Validate inputs
      if (!referenceId || typeof referenceId !== 'string') {
        throw new Error('Reference ID is required and must be a string');
      }
      
      if (!asset || typeof asset !== 'string') {
        throw new Error('Asset is required and must be a string');
      }

      if (referenceId.length > 50) {
        throw new Error('Reference ID must be 50 characters or less');
      }

      if (!/^[a-zA-Z0-9\-_]+$/.test(referenceId)) {
        throw new Error('Reference ID can only contain alphanumeric characters, hyphens, and underscores');
      }

      logger.info('Creating Nexo deposit address', {
        referenceId,
        asset
      });

      const requestData = {
        referenceId,
        asset
      };
      
      const response = await this.client.post('/addresses', requestData);
      
      logger.info('Successfully created Nexo deposit address', {
        referenceId,
        asset,
        address: response.data?.address,
        blockchain: response.data?.blockchain
      });
      
      return response.data;
    } catch (error) {
      logger.error('Failed to create Nexo deposit address', {
        referenceId,
        asset,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        errorData: error.response?.data
      });
      
      // Re-throw with more context
      const nexoError = new Error(`Nexo API Error: ${error.message}`);
      nexoError.originalError = error;
      nexoError.status = error.response?.status;
      nexoError.nexoErrorData = error.response?.data;
      throw nexoError;
    }
  }

  /**
   * Verify webhook signature for incoming webhook events
   * 
   * @param {Object} eventData - The webhook event data
   * @param {string} receivedSignature - The X-SIGNATURE header value
   * @returns {boolean} True if signature is valid
   */
  verifyWebhookSignature(eventData, receivedSignature) {
    try {
      if (!this.webhookSecret) {
        logger.warn('Nexo webhook secret not configured, cannot verify signature');
        return false;
      }

      const crypto = require('crypto');
      
      // Create the data string as per Nexo documentation
      const dataString = `${JSON.stringify(eventData)}/${this.webhookSecret}`;
      
      // Compute SHA256 hash
      const computedSignature = `0x${crypto
        .createHash('sha256')
        .update(dataString)
        .digest('hex')}`;
      
      const isValid = receivedSignature === computedSignature;
      
      logger.debug('Nexo webhook signature verification', {
        isValid,
        receivedSignature: receivedSignature?.substring(0, 10) + '...',
        computedSignature: computedSignature?.substring(0, 10) + '...'
      });
      
      return isValid;
    } catch (error) {
      logger.error('Error verifying Nexo webhook signature', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Handle incoming webhook events from Nexo
   * 
   * @param {Object} eventData - The webhook event data
   * @param {string} signature - The X-SIGNATURE header value
   * @returns {Promise<Object>} Processing result
   */
  async handleWebhook(eventData, signature) {
    try {
      logger.info('Handling Nexo webhook event', {
        eventType: eventData?.eventType,
        transactionId: eventData?.data?.transactionId,
        asset: eventData?.data?.asset,
        amount: eventData?.data?.amount
      });

      // Verify signature
      if (!this.verifyWebhookSignature(eventData, signature)) {
        throw new Error('Invalid webhook signature');
      }

      // Process different event types
      switch (eventData.eventType) {
        case 'PG_DEPOSIT':
          return await this.handleDepositEvent(eventData.data);
        
        default:
          logger.warn('Unknown Nexo webhook event type', {
            eventType: eventData.eventType
          });
          return {
            success: true,
            message: 'Event received but not processed (unknown type)',
            eventType: eventData.eventType
          };
      }
    } catch (error) {
      logger.error('Error handling Nexo webhook', {
        error: error.message,
        eventType: eventData?.eventType
      });
      throw error;
    }
  }

  /**
   * Handle deposit webhook events
   * 
   * @param {Object} depositData - Deposit event data
   * @returns {Promise<Object>} Processing result
   */
  async handleDepositEvent(depositData) {
    try {
      logger.info('Processing Nexo deposit event', {
        transactionId: depositData.transactionId,
        asset: depositData.asset,
        amount: depositData.amount,
        depositAddress: depositData.depositAddress,
        referenceId: depositData.referenceId
      });

      // Here you would typically:
      // 1. Store the deposit information in your database
      // 2. Update user balances
      // 3. Send notifications
      // 4. Trigger any business logic
      
      // For now, we'll just log and return success
      return {
        success: true,
        message: 'Deposit event processed successfully',
        transactionId: depositData.transactionId,
        asset: depositData.asset,
        amount: depositData.amount
      };
    } catch (error) {
      logger.error('Error processing Nexo deposit event', {
        error: error.message,
        transactionId: depositData?.transactionId
      });
      throw error;
    }
  }

  /**
   * Get API configuration info (for debugging/status)
   */
  getConfig() {
    return {
      configured: this.isConfigured(),
      baseURL: this.baseURL,
      hasWebhookSecret: !!this.webhookSecret
    };
  }
}

module.exports = new NexoService();
