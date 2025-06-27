const express = require('express');
const router = express.Router();

/**
 * @route GET /api/docs
 * @desc Serve API documentation
 * @access Public
 */
router.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>FIRE Planning API Documentation</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6;
                margin: 0;
                padding: 20px;
                background-color: #f5f5f5;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
                background: white;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            h1, h2, h3 { color: #2c3e50; }
            .endpoint {
                background: #f8f9fa;
                border-left: 4px solid #3498db;
                padding: 15px;
                margin: 15px 0;
                border-radius: 4px;
            }
            .method {
                display: inline-block;
                padding: 4px 8px;
                border-radius: 4px;
                font-weight: bold;
                font-size: 12px;
                margin-right: 10px;
            }
            .get { background: #d5f4e6; color: #27ae60; }
            .post { background: #fef9e7; color: #f39c12; }
            .put { background: #e8f4fd; color: #3498db; }
            .delete { background: #fadbd8; color: #e74c3c; }
            code {
                background: #2c3e50;
                color: #ecf0f1;
                padding: 2px 6px;
                border-radius: 3px;
                font-family: 'Courier New', monospace;
            }
            pre {
                background: #2c3e50;
                color: #ecf0f1;
                padding: 15px;
                border-radius: 5px;
                overflow-x: auto;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔥 FIRE Planning API Documentation</h1>
            <p><strong>Version:</strong> 1.0.0</p>
            <p><strong>Base URL:</strong> <code>/api</code></p>
            <p><strong>Status:</strong> Development - Implementation in progress</p>

            <h2>📋 Overview</h2>
            <p>The FIRE Planning API provides endpoints for managing banking data collection via Powens integration. This API is designed for agentic AI development and modular architecture.</p>

            <h2>🔐 Authentication</h2>
            <div class="endpoint">
                <h3><span class="method post">POST</span>/auth/powens/init</h3>
                <p>Initialize Powens connection</p>
                <pre>Response: { "success": true, "data": { "status": "initialized" } }</pre>
            </div>

            <div class="endpoint">
                <h3><span class="method get">GET</span>/auth/powens/url</h3>
                <p>Get Powens authorization URL</p>
                <pre>Response: { "success": true, "data": { "authUrl": "...", "state": "..." } }</pre>
            </div>

            <div class="endpoint">
                <h3><span class="method post">POST</span>/auth/powens/callback</h3>
                <p>Handle Powens callback after authorization</p>
                <pre>Body: { "code": "auth_code", "state": "state_value" }</pre>
            </div>

            <div class="endpoint">
                <h3><span class="method post">POST</span>/auth/powens/refresh</h3>
                <p>Refresh Powens access tokens</p>
                <pre>Response: { "success": true, "data": { "newAccessToken": "..." } }</pre>
            </div>

            <h2>🏦 Accounts</h2>
            <div class="endpoint">
                <h3><span class="method get">GET</span>/accounts</h3>
                <p>Get all bank accounts</p>
                <pre>Response: { "success": true, "data": [...], "meta": { "total": 3 } }</pre>
            </div>

            <div class="endpoint">
                <h3><span class="method get">GET</span>/accounts/:id</h3>
                <p>Get specific account by ID</p>
                <pre>Response: { "success": true, "data": { "id": "acc-001", ... } }</pre>
            </div>

            <div class="endpoint">
                <h3><span class="method post">POST</span>/accounts/sync</h3>
                <p>Synchronize account data from Powens API</p>
                <pre>Response: { "success": true, "data": { "syncedAccounts": 3 } }</pre>
            </div>

            <h2>💳 Transactions</h2>
            <div class="endpoint">
                <h3><span class="method get">GET</span>/transactions</h3>
                <p>Get all transactions with optional filters</p>
                <p><strong>Query Parameters:</strong> accountId, limit, offset, startDate, endDate</p>
                <pre>Response: { "success": true, "data": [...], "meta": { "total": 25 } }</pre>
            </div>

            <div class="endpoint">
                <h3><span class="method get">GET</span>/transactions/summary</h3>
                <p>Get transaction summary and statistics</p>
                <pre>Response: { "success": true, "data": { "summary": { "totalIncome": 1000 } } }</pre>
            </div>

            <h2>🔄 Synchronization</h2>
            <div class="endpoint">
                <h3><span class="method post">POST</span>/sync/full</h3>
                <p>Perform full data synchronization</p>
                <pre>Response: { "success": true, "data": { "accountsSynced": 3, "transactionsSynced": 25 } }</pre>
            </div>

            <div class="endpoint">
                <h3><span class="method get">GET</span>/sync/status</h3>
                <p>Get current synchronization status</p>
                <pre>Response: { "success": true, "data": { "isRunning": false, "lastSync": {...} } }</pre>
            </div>

            <h2>📝 Response Format</h2>
            <p>All API responses follow this standard format:</p>
            <pre>{
  "success": true|false,
  "message": "Human readable message",
  "data": { ... },
  "meta": { "total": 10, "timestamp": "2025-06-09T10:00:00Z" },
  "error": { "code": "ERROR_CODE", "message": "...", "details": "..." }
}</pre>

            <h2>🚀 Getting Started</h2>
            <ol>
                <li>Initialize Powens connection: <code>POST /api/auth/powens/init</code></li>
                <li>Get authorization URL: <code>GET /api/auth/powens/url</code></li>
                <li>Complete bank authorization (external)</li>
                <li>Handle callback: <code>POST /api/auth/powens/callback</code></li>
                <li>Sync data: <code>POST /api/sync/full</code></li>
                <li>Retrieve data: <code>GET /api/accounts</code> and <code>GET /api/transactions</code></li>
            </ol>

            <h2>🧪 Testing</h2>
            <p>Visit the <a href="/">Testing Dashboard</a> to interact with the API endpoints.</p>
            <p>Mock data is available when <code>ENABLE_MOCK_DATA=true</code> in environment variables.</p>
        </div>
    </body>
    </html>
  `);
});

module.exports = router;
