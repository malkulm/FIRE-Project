// Shared Domain Entry Point
const { logger, logAPICall, logDBOperation, logAuth } = require('./utils/logger');

module.exports = {
  database: require('./config/database'),
  logger,
  logAPICall,
  logDBOperation, 
  logAuth,
  migrationRunner: require('./utils/migrationRunner'),
  middleware: {
    errorHandler: require('./middleware/errorHandler'),
    rateLimit: require('./middleware/rateLimit'),
    requestLogger: require('./middleware/requestLogger')
  }
};