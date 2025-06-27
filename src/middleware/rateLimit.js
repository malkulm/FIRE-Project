const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/logger');

// Rate limiting configuration
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
        details: message
      },
      timestamp: new Date().toISOString()
    },
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        url: req.originalUrl,
        method: req.method,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          details: message
        },
        timestamp: new Date().toISOString()
      });
    },
    skip: (req) => {
      // Skip rate limiting for health checks and development environment
      if (process.env.NODE_ENV === 'development') {
        return true; // Disable rate limiting in development
      }
      return false;
    }
  });
};

// Different rate limits for different endpoints
const rateLimiters = {
  // General API rate limit
  general: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    1000, // Increased limit for development/testing
    'Too many requests from this IP, please try again later'
  ),
  
  // More lenient limit for authentication endpoints
  auth: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    100, // Increased from 10 to 100 requests per windowMs
    'Too many authentication attempts, please try again later'
  ),
  
  // More lenient limit for sync operations
  sync: createRateLimiter(
    5 * 60 * 1000, // 5 minutes
    20, // Increased from 5 to 20 requests per windowMs
    'Too many sync requests, please wait before trying again'
  )
};

// Middleware to apply appropriate rate limiting based on route
const rateLimitMiddleware = (req, res, next) => {
  // Apply stricter limits for specific routes
  if (req.path.startsWith('/api/auth')) {
    return rateLimiters.auth(req, res, next);
  } else if (req.path.startsWith('/api/sync')) {
    return rateLimiters.sync(req, res, next);
  } else {
    return rateLimiters.general(req, res, next);
  }
};

module.exports = rateLimitMiddleware;
