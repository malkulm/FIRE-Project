const express = require('express');
const { logger } = require('../utils/logger');
const nexoService = require('../services/nexoService');

const router = express.Router();

/**
 * @route GET /api/nexo/status
 * @desc Get Nexo connection status and configuration info
 * @access Public (for development)
 */
router.get('/status', async (req, res) => {
  try {
    logger.info('Checking Nexo connection status');
    
    const status = await nexoService.getConnectionStatus();
    const config = nexoService.getConfig();
    
    res.json({
      success: true,
      data: {
        ...status,
        config
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting Nexo status', { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'NEXO_STATUS_ERROR',
        message: 'Failed to get Nexo status',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/nexo/assets
 * @desc Get all supported assets from Nexo Payment Gateway
 * @access Public (for development)
 */
router.get('/assets', async (req, res) => {
  try {
    logger.info('Fetching Nexo assets via API endpoint');
    
    if (!nexoService.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NEXO_NOT_CONFIGURED',
          message: 'Nexo API key is not configured',
          details: 'Please set NEXO_API_KEY in your environment variables'
        },
        timestamp: new Date().toISOString()
      });
    }

    const assetsData = await nexoService.getAssets();
    
    res.json({
      success: true,
      data: assetsData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching Nexo assets via API', { 
      error: error.message,
      status: error.status,
      nexoErrorData: error.nexoErrorData
    });
    
    const statusCode = error.status || 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: 'NEXO_ASSETS_ERROR',
        message: 'Failed to fetch Nexo assets',
        details: error.message,
        nexoError: error.nexoErrorData
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/nexo/addresses
 * @desc Create a deposit address for a specific asset and reference ID
 * @access Public (for development)
 */
router.post('/addresses', async (req, res) => {
  try {
    const { referenceId, asset } = req.body;
    
    logger.info('Creating Nexo deposit address via API', {
      referenceId,
      asset
    });
    
    if (!nexoService.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NEXO_NOT_CONFIGURED',
          message: 'Nexo API key is not configured',
          details: 'Please set NEXO_API_KEY in your environment variables'
        },
        timestamp: new Date().toISOString()
      });
    }

    if (!referenceId || !asset) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Both referenceId and asset are required',
          details: 'Request body must include referenceId and asset fields'
        },
        timestamp: new Date().toISOString()
      });
    }

    const addressData = await nexoService.createDepositAddress(referenceId, asset);
    
    res.json({
      success: true,
      data: addressData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error creating Nexo deposit address via API', { 
      error: error.message,
      status: error.status,
      nexoErrorData: error.nexoErrorData,
      referenceId: req.body?.referenceId,
      asset: req.body?.asset
    });
    
    const statusCode = error.status || 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: 'NEXO_ADDRESS_ERROR',
        message: 'Failed to create Nexo deposit address',
        details: error.message,
        nexoError: error.nexoErrorData
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/nexo/webhook
 * @desc Handle incoming webhooks from Nexo Payment Gateway
 * @access Public (webhook endpoint)
 */
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-signature'];
    const eventData = req.body;
    
    logger.info('Received Nexo webhook', {
      eventType: eventData?.eventType,
      hasSignature: !!signature,
      transactionId: eventData?.data?.transactionId
    });

    if (!signature) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_SIGNATURE',
          message: 'X-Signature header is required',
          details: 'Webhooks must include X-Signature header for verification'
        },
        timestamp: new Date().toISOString()
      });
    }

    const result = await nexoService.handleWebhook(eventData, signature);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error handling Nexo webhook', { 
      error: error.message,
      eventType: req.body?.eventType
    });
    
    res.status(400).json({
      success: false,
      error: {
        code: 'WEBHOOK_ERROR',
        message: 'Failed to process webhook',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/nexo/config
 * @desc Get Nexo service configuration (for debugging)
 * @access Public (for development)
 */
router.get('/config', (req, res) => {
  try {
    const config = nexoService.getConfig();
    
    res.json({
      success: true,
      data: {
        ...config,
        // Don't expose sensitive data
        apiKeyConfigured: config.configured,
        webhookSecretConfigured: config.hasWebhookSecret
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting Nexo config', { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'CONFIG_ERROR',
        message: 'Failed to get configuration',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
