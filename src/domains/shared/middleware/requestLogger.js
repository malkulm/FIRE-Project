const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');

// Request logging middleware
const requestLogger = (req, res, next) => {
  // Generate unique request ID
  req.id = uuidv4();
  
  // Capture start time
  const startTime = Date.now();
  
  // Log incoming request
  logger.info('Incoming request', {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    timestamp: new Date().toISOString()
  });
  
  // Capture original end function
  const originalEnd = res.end;
  
  // Override res.end to log response
  res.end = function(chunk, encoding) {
    // Calculate response time
    const duration = Date.now() - startTime;
    
    // Log response
    logger.info('Request completed', {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length'),
      timestamp: new Date().toISOString()
    });
    
    // Call original end function
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

module.exports = requestLogger;
