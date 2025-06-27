# API Reference

Complete API documentation for the FIRE Planning banking data collection service.

## Base URL
`/api`

## Response Format

All API responses follow a consistent format:

```json
{
  "success": true|false,
  "message": "Human readable message",
  "data": { ... },
  "meta": {
    "total": 10,
    "limit": 50,
    "offset": 0,
    "timestamp": "2025-06-09T10:00:00Z"
  },
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message",
    "details": "Detailed error information"
  }
}
```

## Authentication Endpoints

### Initialize Powens Connection
```http
POST /api/auth/powens/init
```

Initializes a new connection with Powens API.

**Response:**
```json
{
  "success": true,
  "message": "Powens connection initialized",
  "data": {
    "status": "initialized",
    "timestamp": "2025-06-09T10:00:00Z"
  }
}
```

### Get Authorization URL
```http
GET /api/auth/powens/url
```

Returns the Powens authorization URL for bank connection.

**Response:**
```json
{
  "success": true,
  "data": {
    "authUrl": "https://webview.powens.com?client_id=...",
    "state": "random-state-value",
    "timestamp": "2025-06-09T10:00:00Z"
  }
}
```

### Handle Authorization Callback
```http
POST /api/auth/powens/callback
```

Processes the authorization callback from Powens.

**Request Body:**
```json
{
  "code": "authorization_code",
  "state": "state_value"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "encrypted_token",
    "status": "connected",
    "timestamp": "2025-06-09T10:00:00Z"
  }
}
```

### Refresh Tokens
```http
POST /api/auth/powens/refresh
```

Refreshes expired Powens access tokens.

**Response:**
```json
{
  "success": true,
  "data": {
    "newAccessToken": "new_encrypted_token",
    "timestamp": "2025-06-09T10:00:00Z"
  }
}
```

## Account Endpoints

### List All Accounts
```http
GET /api/accounts
```

Retrieves all bank accounts.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "acc-001",
      "name": "Compte Courant",
      "type": "CHECKING",
      "iban": "LU123456789012345678",
      "bic": "SPKELULL",
      "balance": 3257.42,
      "currency": "EUR",
      "bank_name": "Spuerkeess",
      "last_update": "2025-06-09T10:00:00Z"
    }
  ],
  "meta": {
    "total": 3,
    "timestamp": "2025-06-09T10:00:00Z"
  }
}
```

### Get Specific Account
```http
GET /api/accounts/:id
```

Retrieves a specific account by ID.

**Parameters:**
- `id` (string) - Account ID

**Response:** Same format as individual account object above.

### Sync Account Data
```http
POST /api/accounts/sync
```

Synchronizes account data from Powens API.

**Response:**
```json
{
  "success": true,
  "data": {
    "syncedAccounts": 3,
    "timestamp": "2025-06-09T10:00:00Z"
  }
}
```

### Update Account
```http
PUT /api/accounts/:id
```

Updates account information.

**Request Body:**
```json
{
  "name": "New Account Name"
}
```

### Delete Account
```http
DELETE /api/accounts/:id
```

Removes an account from the system.

## Transaction Endpoints

### List Transactions
```http
GET /api/transactions
```

Retrieves transactions with optional filtering.

**Query Parameters:**
- `accountId` (string) - Filter by account ID
- `limit` (number) - Number of results (default: 50, max: 100)
- `offset` (number) - Pagination offset (default: 0)
- `startDate` (string) - Start date filter (ISO format)
- `endDate` (string) - End date filter (ISO format)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "tx-001",
      "account_id": "acc-001",
      "date": "2025-06-08T09:24:00Z",
      "description": "Salaire Juin 2025",
      "amount": 3850.00,
      "currency": "EUR",
      "category": "Revenus",
      "type": "CREDIT"
    }
  ],
  "meta": {
    "total": 25,
    "limit": 50,
    "offset": 0,
    "timestamp": "2025-06-09T10:00:00Z"
  }
}
```

### Get Specific Transaction
```http
GET /api/transactions/:id
```

Retrieves a specific transaction by ID.

### Sync Transaction Data
```http
POST /api/transactions/sync
```

Synchronizes transaction data from Powens API.

**Request Body:**
```json
{
  "accountId": "acc-001",
  "startDate": "2025-01-01T00:00:00Z",
  "endDate": "2025-12-31T23:59:59Z"
}
```

### Get Transaction Summary
```http
GET /api/transactions/summary
```

Returns transaction statistics and summary.

**Query Parameters:**
- `accountId` (string) - Filter by account ID
- `period` (string) - Time period (30d, 90d, 1y)

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "30d",
    "summary": {
      "totalTransactions": 25,
      "totalIncome": 3850.00,
      "totalExpenses": 567.89,
      "netFlow": 3282.11
    }
  }
}
```

## Synchronization Endpoints

### Full Synchronization
```http
POST /api/sync/full
```

Performs complete data synchronization (accounts + transactions).

**Response:**
```json
{
  "success": true,
  "data": {
    "syncType": "full",
    "accountsSynced": 3,
    "transactionsSynced": 25,
    "duration": "2.3s",
    "timestamp": "2025-06-09T10:00:00Z"
  }
}
```

### Accounts Only Sync
```http
POST /api/sync/accounts
```

Synchronizes only account data.

### Transactions Only Sync
```http
POST /api/sync/transactions
```

Synchronizes only transaction data.

**Request Body:**
```json
{
  "accountId": "acc-001",
  "startDate": "2025-01-01T00:00:00Z",
  "endDate": "2025-12-31T23:59:59Z"
}
```

### Get Sync Status
```http
GET /api/sync/status
```

Returns current synchronization status.

**Response:**
```json
{
  "success": true,
  "data": {
    "isRunning": false,
    "lastSync": {
      "type": "full",
      "timestamp": "2025-06-09T09:00:00Z",
      "duration": "2.3s",
      "status": "completed",
      "accountsSynced": 3,
      "transactionsSynced": 25
    },
    "nextScheduledSync": "2025-06-09T12:00:00Z",
    "connectionStatus": {
      "powens": "configured",
      "database": "connected"
    }
  }
}
```

### Get Sync Logs
```http
GET /api/sync/logs
```

Returns synchronization history and logs.

**Query Parameters:**
- `limit` (number) - Number of results (default: 20)
- `offset` (number) - Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "full",
      "status": "completed",
      "startTime": "2025-06-09T09:00:00Z",
      "endTime": "2025-06-09T09:02:18Z",
      "itemsProcessed": 28,
      "itemsSucceeded": 28,
      "itemsFailed": 0,
      "errorMessage": null
    }
  ]
}
```

### Cancel Sync
```http
DELETE /api/sync/cancel
```

Cancels a running synchronization process.

## Error Codes

Common error codes returned by the API:

- `VALIDATION_ERROR` - Request validation failed
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Access denied
- `NOT_FOUND` - Resource not found
- `DUPLICATE_RESOURCE` - Resource already exists
- `INVALID_REFERENCE` - Referenced resource doesn't exist
- `MISSING_REQUIRED_FIELD` - Required field missing
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Server error

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Too Many Requests
- `500` - Internal Server Error

## Rate Limiting

- General API: 100 requests per 15 minutes per IP
- Authentication endpoints: 10 requests per 15 minutes per IP
- Sync endpoints: 5 requests per 5 minutes per IP

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time

## Development Features

When `ENABLE_MOCK_DATA=true`:
- Mock account and transaction data is returned
- No actual Powens API calls are made
- All endpoints return sample data for testing

## Health Check

```http
GET /health
```

Returns API health status (outside `/api` path).

**Response:**
```json
{
  "success": true,
  "message": "FIRE Planning API is running",
  "version": "1.0.0",
  "environment": "development",
  "timestamp": "2025-06-09T10:00:00Z"
}
```
