const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Create logs directory if it doesn't exist
const logDir = process.env.LOG_FILE_PATH || './logs';
require('fs').mkdirSync(logDir, { recursive: true });

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = ' ' + JSON.stringify(meta, null, 2);
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'fire-planning-api' },
  transports: [
    // File transport for all logs
    new DailyRotateFile({
      filename: path.join(logDir, 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'debug'
    }),
    
    // File transport for errors only
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error'
    })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

// Function to log API calls for debugging
const logAPICall = (method, url, token = null, data = null) => {
  logger.debug('API Call', {
    method,
    url,
    hasToken: !!token,
    tokenPreview: token ? `${token.substring(0, 10)}...` : null,
    dataKeys: data ? Object.keys(data) : null,
    timestamp: new Date().toISOString()
  });
};

// Function to log database operations
const logDBOperation = (operation, table, conditions = null, error = null) => {
  const logData = {
    operation,
    table,
    conditions,
    timestamp: new Date().toISOString()
  };

  if (error) {
    logger.error('Database operation failed', { ...logData, error: error.message });
  } else {
    logger.debug('Database operation', logData);
  }
};

// Function to log authentication events
const logAuth = (event, userId = null, details = {}) => {
  logger.info('Authentication event', {
    event,
    userId,
    ...details,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  logger,
  logAPICall,
  logDBOperation,
  logAuth
};
