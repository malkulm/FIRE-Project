const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const { logger } = require('./utils/logger');
const database = require('./config/database');
const rateLimitMiddleware = require('./middleware/rateLimit');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const scheduledSync = require('./jobs/scheduledSync');

// Import routes
const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/accounts');
const transactionRoutes = require('./routes/transactions');
const syncRoutes = require('./routes/sync');
const apiDocsRoutes = require('./routes/apiDocs');
const webhookRoutes = require('./routes/webhooks');
const nexoRoutes = require('./routes/nexo');
const webauthRoutes = require('./domains/banking/routes/webauthRoutes'); // Use domain version
const option2Routes = require('./domains/banking/routes/option2Routes'); // Use domain version

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware with CSP configuration for frontend functionality
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for frontend functionality
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles
      imgSrc: ["'self'", "data:", "https:"], // Allow images from HTTPS sources
      connectSrc: ["'self'"], // Allow API calls to same origin
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  credentials: true
}));

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging and rate limiting
app.use(requestLogger);
app.use(rateLimitMiddleware);

// Serve static files (minimal frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'FIRE Planning API is running',
    timestamp: new Date().toISOString(),
    version: require('../package.json').version,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Simple debug endpoint
app.get('/debug/routes', (req, res) => {
  res.json({
    success: true,
    message: 'Routes are working - check specific endpoints directly',
    endpoints: [
      'GET /health',
      'GET /api/auth/powens/url',
      'GET /api/auth/powens/connections',
      'GET /api/auth/powens/connectors'
    ],
    timestamp: new Date().toISOString()
  });
});

// Webhook routes (must come before other routes to handle POST /)
app.use('/', webhookRoutes);

// API routes - ORIGINAL STRUCTURE
app.use('/api/auth', authRoutes);
app.use('/api/auth/powens', webauthRoutes); // Option 1: Webauth routes for bank connections
app.use('/api/auth/powens', option2Routes); // Option 2: Manual API routes for bank connections
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/nexo', nexoRoutes);

// API documentation (if enabled)
if (process.env.ENABLE_API_DOCS === 'true') {
  app.use('/api/docs', apiDocsRoutes);
}

// Serve Nexo page
app.get('/nexo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'nexo.html'));
});

// Handle Powens callback at root URL - IMPORTANT: This must come after webhook routes
app.get('/', (req, res, next) => {
  const { code, state, connection_id, id_connection, error } = req.query;
  
  // Check if this is a Powens callback
  if (code || connection_id || id_connection || error) {
    logger.info('🔗 Powens callback detected at root URL, redirecting to callback handler', {
      hasCode: !!code,
      hasConnectionId: !!(connection_id || id_connection),
      hasError: !!error,
      state: state,
      step: 'ROOT_CALLBACK_REDIRECT'
    });
    
    // Redirect to the proper callback endpoint with all parameters
    const callbackUrl = new URL('/api/auth/powens/callback', `${req.protocol}://${req.get('host')}`);
    
    // Copy all query parameters
    Object.keys(req.query).forEach(key => {
      callbackUrl.searchParams.append(key, req.query[key]);
    });
    
    return res.redirect(callbackUrl.toString());
  }
  
  // Not a Powens callback, serve the normal frontend
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
      details: `The requested endpoint ${req.method} ${req.originalUrl} does not exist`
    },
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Database connection and server startup
async function startServer() {
  try {
    // Test database connection
    await database.testConnection();
    logger.info('Database connection established successfully');

    // Initialize scheduled sync jobs
    if (process.env.ENABLE_SCHEDULED_SYNC !== 'false') {
      try {
        scheduledSync.initialize();
        logger.info('Scheduled sync jobs initialized successfully');
      } catch (syncError) {
        logger.error('Failed to initialize scheduled sync jobs', { error: syncError.message });
        // Continue without scheduled jobs in development
        if (process.env.NODE_ENV === 'production') {
          throw syncError;
        }
      }
    } else {
      logger.info('Scheduled sync jobs disabled by configuration');
    }

    // Start server
    app.listen(PORT, () => {
      logger.info(`FIRE Planning API server started`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        scheduledSync: process.env.ENABLE_SCHEDULED_SYNC !== 'false',
        timestamp: new Date().toISOString()
      });
      
      if (process.env.NODE_ENV === 'development') {
        logger.info('Development URLs:', {
          api: `http://localhost:${PORT}/api`,
          dashboard: `http://localhost:${PORT}`,
          nexo: `http://localhost:${PORT}/nexo`,
          health: `http://localhost:${PORT}/health`,
          docs: process.env.ENABLE_API_DOCS === 'true' ? `http://localhost:${PORT}/api/docs` : 'disabled',
          webhooks: {
            powens: `http://localhost:${PORT}/api/webhooks/powens`,
            nexo: `http://localhost:${PORT}/api/nexo/webhook`
          },
          sync: {
            intelligent: `http://localhost:${PORT}/api/sync/intelligent/all`,
            status: `http://localhost:${PORT}/api/sync/status`,
            health: `http://localhost:${PORT}/api/sync/health`
          },
          nexoApi: {
            status: `http://localhost:${PORT}/api/nexo/status`,
            assets: `http://localhost:${PORT}/api/nexo/assets`,
            addresses: `http://localhost:${PORT}/api/nexo/addresses`,
            config: `http://localhost:${PORT}/api/nexo/config`
          },
          // Option 1 - Webauth endpoints for bank connections
          powensWebauth: {
            connectors: `http://localhost:${PORT}/api/auth/powens/connectors`,
            webauthUrl: `http://localhost:${PORT}/api/auth/powens/webauth-url?connector_id=CONNECTOR_ID`,
            url: `http://localhost:${PORT}/api/auth/powens/url`,
            callback: `http://localhost:${PORT}/api/auth/powens/callback`,
            connections: `http://localhost:${PORT}/api/auth/powens/connections`,
            testConnection: `http://localhost:${PORT}/api/auth/powens/test-connection`
          },
          // Option 2 - Manual API endpoints for bank connections
          powensOption2: {
            connectors: `http://localhost:${PORT}/api/auth/powens/connectors`,
            createConnection: `http://localhost:${PORT}/api/auth/powens/create-connection`,
            checkAccounts: `http://localhost:${PORT}/api/auth/powens/check-accounts`,
            enableAccounts: `http://localhost:${PORT}/api/auth/powens/enable-accounts`,
            testData: `http://localhost:${PORT}/api/auth/powens/test-data`,
            connections: `http://localhost:${PORT}/api/auth/powens/connections`,
            connectorDetails: `http://localhost:${PORT}/api/auth/powens/connector/{connectorId}`
          }
        });
        
        logger.info('🔗 OPTION 1 - WEBAUTH FLOW INSTRUCTIONS:', {
          step1: 'GET /api/auth/powens/connectors - List available banks',
          step2: 'GET /api/auth/powens/url - Generate bank connection URL',
          step3: 'User navigates to webauth URL and connects bank',
          step4: 'GET /api/auth/powens/callback - Handles callback automatically',
          step5: 'GET /api/auth/powens/test-connection - Test if connection works',
          step6: 'Now getUserAccounts and getUserTransactions will return data!'
        });

        logger.info('🔗 OPTION 2 - MANUAL API FLOW INSTRUCTIONS:', {
          step1: 'GET /api/auth/powens/connectors - List available banks with fields',
          step2: 'POST /api/auth/powens/create-connection - Create connection via API',
          step3: 'GET /api/auth/powens/check-accounts - Check account status',
          step4: 'POST /api/auth/powens/enable-accounts - Enable disabled accounts',
          step5: 'GET /api/auth/powens/test-data - Test data retrieval',
          step6: 'Now getUserAccounts and getUserTransactions will return data!',
          note: 'Option 2 provides more control and is better for debugging'
        });
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Stop scheduled jobs
  try {
    scheduledSync.stop();
    logger.info('Scheduled sync jobs stopped');
  } catch (error) {
    logger.error('Error stopping scheduled jobs', { error: error.message });
  }
  
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  // Stop scheduled jobs
  try {
    scheduledSync.stop();
    logger.info('Scheduled sync jobs stopped');
  } catch (error) {
    logger.error('Error stopping scheduled jobs', { error: error.message });
  }
  
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;