# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
```bash
# Start development server with hot reload
npm run dev

# Start production server
npm start

# Run test suite
npm test

# Run database migrations
npm run migrate

# Seed database with test data
npm run seed
```

### Development URLs (when running locally)
- API Base: http://localhost:3000/api
- Dashboard: http://localhost:3000
- Nexo Integration: http://localhost:3000/nexo
- Health Check: http://localhost:3000/health
- API Documentation: http://localhost:3000/api/docs (if enabled)

## Architecture Overview

### High-Level Structure
This is a Node.js/Express banking data collection service that integrates with the Powens API for FIRE (Financial Independence, Retire Early) planning. The architecture follows a modular pattern with clear separation of concerns.

### Key Components

**Database Layer** (`src/config/database.js`)
- PostgreSQL with connection pooling
- Transaction support with automatic rollback
- Comprehensive error handling and logging
- Schema validation utilities

**Services Architecture** (`src/services/`)
- **Powens Integration** (`src/services/powens/`): Modular services for bank data
  - `powensAuthService.js`: Authentication and token management
  - `powensDataService.js`: Data collection and mapping
  - `powensSyncService.js`: Synchronization logic
  - `powensService.js`: Main facade that unifies all services
- **Sync Service** (`src/services/syncService.js`): Handles data synchronization
- **Nexo Service** (`src/services/nexoService.js`): Cryptocurrency integration

**API Routes** (`src/routes/`)
- RESTful endpoints following consistent patterns
- Comprehensive error handling with structured responses
- Input validation using Joi schemas
- Rate limiting and security middleware

**Data Models** (`src/models/`)
- User, BankAccount, BankConnection, Transaction models
- Database abstraction with ORM-like patterns

### Critical Integration Points

**Powens Banking API Integration**
- Supports two connection methods: WebAuth flow and Manual API flow
- Token management with encryption/decryption
- Webhook handling for real-time updates
- Fallback authentication mechanisms

**Database Relationships**
- Users → BankConnections (1:many)
- BankConnections → BankAccounts (1:many)
- BankAccounts → Transactions (1:many)
- Comprehensive foreign key constraints

## Development vs Production Environment

**Important**: This repository is for development purposes only. It is NOT the production server.

### Deployment Process
1. **Development**: Make changes and commit to this GitHub repository
2. **Production Deployment**: Manual process on the server side:
   - `git pull` to get latest changes from this repository
   - `npm install` to install any new dependencies
   - `npm start` to restart the production server

### Development Guidelines

### Before Making Changes
1. Read `docs/AGENTIC_DEVELOPMENT.md` for comprehensive development protocols
2. Check `docs/API_REFERENCE.md` for current API contracts
3. Review `docs/DATABASE_SCHEMA.md` for data relationships
4. Update `docs/CHANGE_LOG.md` with all modifications

### Code Patterns
- Use structured logging with the Winston logger (`src/utils/logger.js`)
- Follow existing error response format with success/error structure
- All database operations use the database wrapper (`src/config/database.js`)
- Input validation on all API endpoints using Joi schemas
- Consistent middleware stack: logging, rate limiting, CORS, security headers

### Environment Configuration
- Database: PostgreSQL database named `fire_planning`
- Database connection via `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- Powens API credentials: `POWENS_CLIENT_ID`, `POWENS_CLIENT_SECRET`
- Optional features controlled by environment flags (e.g., `ENABLE_API_DOCS`)

### Testing & Debugging
- Minimal web interface available at root URL for testing
- Comprehensive logging with operation tracking
- Health check endpoint for service monitoring
- Database migration system for schema changes

## Important Patterns

**Powens Service Usage**
```javascript
const powensService = require('../services/powens/powensService');

// Authentication flow
const authUrl = await powensService.generateAuthUrl(userId);
const tokens = await powensService.exchangeCodeForToken(code, state);

// Data collection
const accounts = await powensService.getUserAccounts(accessToken);
const transactions = await powensService.getUserTransactions(accessToken);
```

**Database Transactions**
```javascript
const result = await database.transaction(async (client) => {
  // Multiple operations within transaction
  await client.query('INSERT...', params);
  await client.query('UPDATE...', params);
  return result;
});
```

**Error Handling**
```javascript
res.status(errorCode).json({
  success: false,
  error: {
    code: 'ERROR_CODE',
    message: 'Human readable message',
    details: 'Technical details'
  },
  timestamp: new Date().toISOString()
});
```

This codebase is optimized for AI agent development with comprehensive documentation, consistent patterns, and modular architecture.