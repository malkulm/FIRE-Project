// Shared Domain Entry Point
module.exports = {
  database: require('./config/database'),
  logger: require('./utils/logger'),
  migrationRunner: require('./utils/migrationRunner'),
  middleware: {
    errorHandler: require('./middleware/errorHandler'),
    rateLimit: require('./middleware/rateLimit'),
    requestLogger: require('./middleware/requestLogger')
  }
};