const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const powensService = require('../services/powens/powensService');

/**
 * @route POST /api/webhooks/powens
 * @desc Handle Powens webhooks for connection events
 * @access Public (should be secured with webhook signature in production)
 */
router.post('/powens', async (req, res, next) => {
  try {
    const webhookData = req.body;
    
    logger.info('Powens webhook received', { 
      type: webhookData.type || 'unknown',
      userId: webhookData.user?.id,
      connectionId: webhookData.connection?.id,
      headers: req.headers,
      body: webhookData
    });

    // Capture the authorization token for data sync
    if (req.headers.authorization) {
      global.lastWebhookAuth = req.headers.authorization;
    }

    // Process the webhook
    const result = await powensService.handleWebhook(webhookData);
    
    logger.info('Powens webhook processed successfully', { 
      type: webhookData.type,
      result: result
    });

    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Powens webhook processing failed', { 
      error: error.message,
      body: req.body
    });
    
    // Still return 200 to prevent Powens from retrying
    res.status(200).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /
 * @desc Handle Powens webhooks sent to root (fallback)
 * @access Public
 */
router.post('/', async (req, res, next) => {
  try {
    const webhookData = req.body;
    
    logger.info('Powens webhook received at root', { 
      userAgent: req.get('User-Agent'),
      contentType: req.get('Content-Type'),
      body: webhookData,
      headers: req.headers
    });

    // Check if this is from Powens/Budgea
    const userAgent = req.get('User-Agent') || '';
    if (userAgent.includes('Budgea') || userAgent.includes('Powens')) {
      // Capture the authorization token for data sync
      if (req.headers.authorization) {
        global.lastWebhookAuth = req.headers.authorization;
        logger.info('Captured webhook authorization token', { 
          tokenPreview: req.headers.authorization.substring(0, 20) + '...'
        });
      }

      // Process as Powens webhook
      const result = await powensService.handleWebhook(webhookData);
      
      logger.info('Root Powens webhook processed', { 
        result: result
      });

      return res.status(200).json({
        success: true,
        message: 'Powens webhook processed at root',
        timestamp: new Date().toISOString()
      });
    }

    // Not a Powens webhook
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
      message: 'Use /api/webhooks/powens for Powens webhooks'
    });
  } catch (error) {
    logger.error('Root webhook processing failed', { 
      error: error.message,
      body: req.body
    });
    
    res.status(200).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
