const { logger } = require('../utils/logger');

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Default error status and message
  let status = err.status || err.statusCode || 500;
  let message = 'Internal Server Error';
  let code = 'INTERNAL_ERROR';
  let details = 'An unexpected error occurred';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = err.message;
  } else if (err.name === 'UnauthorizedError' || err.message === 'Unauthorized') {
    status = 401;
    code = 'UNAUTHORIZED';
    message = 'Authentication required';
    details = 'Valid authentication credentials are required';
  } else if (err.name === 'ForbiddenError' || status === 403) {
    status = 403;
    code = 'FORBIDDEN';
    message = 'Access denied';
    details = 'Insufficient permissions for this resource';
  } else if (err.name === 'NotFoundError' || status === 404) {
    status = 404;
    code = 'NOT_FOUND';
    message = 'Resource not found';
    details = 'The requested resource does not exist';
  } else if (err.code === '23505') { // PostgreSQL unique violation
    status = 409;
    code = 'DUPLICATE_RESOURCE';
    message = 'Resource already exists';
    details = 'A resource with these details already exists';
  } else if (err.code === '23503') { // PostgreSQL foreign key violation
    status = 400;
    code = 'INVALID_REFERENCE';
    message = 'Invalid reference';
    details = 'Referenced resource does not exist';
  } else if (err.code === '23502') { // PostgreSQL not null violation
    status = 400;
    code = 'MISSING_REQUIRED_FIELD';
    message = 'Required field missing';
    details = 'One or more required fields are missing';
  } else if (err.name === 'SyntaxError' && err.message.includes('JSON')) {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Invalid JSON format';
    details = 'Request body contains invalid JSON';
  } else if (status >= 400 && status < 500) {
    // Client errors - use provided message if available
    code = err.code || 'CLIENT_ERROR';
    message = err.message || 'Client error';
    details = err.details || err.message || 'Invalid request';
  }

  // Create standardized error response
  const errorResponse = {
    success: false,
    error: {
      code,
      message,
      details
    },
    timestamp: new Date().toISOString(),
    requestId: req.id || 'unknown'
  };

  // Include stack trace in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = err.stack;
  }

  // Send error response
  res.status(status).json(errorResponse);
};

module.exports = errorHandler;
