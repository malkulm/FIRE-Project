# Nexo Payment Gateway Integration

This document describes the Nexo Payment Gateway integration added to the FIRE Planning project. The integration provides a segregated codebase for cryptocurrency asset management and deposit address creation through the Nexo API.

## Overview

The Nexo integration allows you to:
- Connect to the Nexo Payment Gateway API
- Fetch supported cryptocurrency assets
- Create deposit addresses for specific assets and reference IDs
- Handle webhook notifications for crypto deposits
- Manage crypto asset data alongside traditional banking data

## Architecture

The Nexo integration is completely segregated from the existing Powens banking integration:

```
src/
├── services/
│   ├── nexoService.js          # Nexo API client and business logic
│   └── powens/                 # Existing Powens services (unchanged)
├── routes/
│   ├── nexo.js                 # Nexo API endpoints
│   └── ...                     # Other existing routes (unchanged)
├── public/
│   ├── nexo.html               # Nexo integration webpage
│   └── index.html              # Updated homepage with Nexo link
└── server.js                   # Updated to include Nexo routes
```

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```env
# Nexo API Configuration
NEXO_API_KEY=your_nexo_api_key_here
NEXO_API_BASE_URL=https://pg.nexo.com/api/v1
NEXO_WEBHOOK_SECRET=your_webhook_secret_here
```

### Required Setup

1. **Nexo Onboarding**: Complete the merchant onboarding process at [Nexo Onboarding](https://nexo.com/)
2. **API Key**: Obtain your API key from the Nexo Payment Gateway dashboard
3. **Webhook Secret**: Configure your webhook secret for signature verification
4. **Webhook URL**: Set your webhook endpoint in the Nexo dashboard: `https://your-domain.com/api/nexo/webhook`

## API Endpoints

### Asset Management

#### GET /api/nexo/assets
Fetch all supported cryptocurrency assets.

**Headers:**
- `x-api-key`: Your Nexo API key

**Response:**
```json
{
  "success": true,
  "data": {
    "assets": [
      {
        "asset": "BTC",
        "blockchain": "bitcoin",
        "address": "",
        "decimals": 8
      },
      {
        "asset": "ETH",
        "blockchain": "ethereum", 
        "address": "",
        "decimals": 18
      }
    ]
  }
}
```

### Deposit Address Creation

#### POST /api/nexo/addresses
Create a deposit address for a specific asset and reference ID.

**Headers:**
- `Content-Type`: application/json
- `x-api-key`: Your Nexo API key

**Request Body:**
```json
{
  "referenceId": "merchant_reference_ID-1",
  "asset": "BTC"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "referenceId": "merchant_reference_ID-1",
    "asset": "BTC",
    "blockchain": "bitcoin",
    "address": "bc1qct9wk67qup7wz8p772r700prd74rhngnml0jcu"
  }
}
```

### Webhook Handling

#### POST /api/nexo/webhook
Handle incoming webhook notifications from Nexo.

**Headers:**
- `X-Signature`: Webhook signature for verification
- `Content-Type`: application/json

**Webhook Payload:**
```json
{
  "eventType": "PG_DEPOSIT",
  "data": {
    "transactionId": "bfd5f586-a706-4d26-8ca1-ea91dbecea2b",
    "transactionHash": "0x02fc56662f353ebc4300d21690464e0e8afb77edc2329124b9f8b7e341f43896",
    "referenceId": "merchant_reference_ID-1",
    "depositAddress": "0xdac17f958d2ee523a2206206994597c13d831ec7",
    "asset": "ETH",
    "amount": "0.00042142",
    "timestamp": "2020-07-28T13:53:24.674Z",
    "fiat": {
      "usd": {
        "value": "27.76630856",
        "course": "13.88315428"
      }
    }
  }
}
```

### Status and Configuration

#### GET /api/nexo/status
Check Nexo connection status and configuration.

#### GET /api/nexo/config
Get current Nexo service configuration (for debugging).

## Web Interface

### Homepage Integration

The main dashboard at `http://localhost:3000/` now includes:
- **Powens Bank Connector**: Existing banking integration
- **Nexo Crypto Connector**: New cryptocurrency integration

### Nexo Page

Visit `http://localhost:3000/nexo` for the dedicated Nexo interface featuring:
- Connection status checking
- Asset listing with detailed information
- Deposit address creation form
- Configuration verification
- API testing examples
- Webhook documentation

## Supported Networks & Assets

| Network | Description | Assets |
|---------|-------------|--------|
| bitcoin | Bitcoin network | BTC |
| ethereum | Ethereum mainnet | ETH, PAXG, USDT, USDC, AAVE |
| polygon | Polygon mainnet | POL, ETH, USDT, USDC, AAVE |
| bsc | Binance Smart Chain | BNB |

## Usage Examples

### Testing with cURL

```bash
# Check connection status
curl http://localhost:3000/api/nexo/status

# Get supported assets (requires API key)
curl -H "x-api-key: YOUR_NEXO_API_KEY" \
     http://localhost:3000/api/nexo/assets

# Create deposit address
curl -X POST http://localhost:3000/api/nexo/addresses \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_NEXO_API_KEY" \
  -d '{"referenceId": "test-123", "asset": "BTC"}'

# View configuration
curl http://localhost:3000/api/nexo/config
```

### JavaScript Integration

```javascript
// Fetch supported assets
const response = await fetch('/api/nexo/assets');
const data = await response.json();
console.log('Supported assets:', data.data.assets);

// Create deposit address
const addressResponse = await fetch('/api/nexo/addresses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    referenceId: 'user-123',
    asset: 'BTC'
  })
});
const addressData = await addressResponse.json();
console.log('Deposit address:', addressData.data.address);
```

## Security Features

### Webhook Signature Verification

All webhooks are verified using SHA256 HMAC signatures:

1. Receive webhook with `X-Signature` header
2. Compute signature: `SHA256(JSON.stringify(eventData) + "/" + webhookSecret)`
3. Compare signatures for integrity verification

### API Key Authentication

All Nexo API requests require the `x-api-key` header for authentication.

### HTTPS Only

All API communications must use HTTPS for security.

## Error Handling

The service includes comprehensive error handling:

- **Configuration Errors**: Clear messages when API key is missing
- **API Errors**: Detailed error information from Nexo API
- **Validation Errors**: Input validation for reference IDs and assets
- **Network Errors**: Timeout and connection error handling

## Development Workflow

1. **Setup Environment**: Configure `.env` with Nexo credentials
2. **Start Server**: Run `npm start` or your preferred method
3. **Test Connection**: Visit `/nexo` and click "Check Connection"
4. **Fetch Assets**: Use "Fetch Assets" to verify API connectivity
5. **Create Addresses**: Test deposit address creation
6. **Monitor Webhooks**: Set up webhook endpoint for live testing

## Integration Benefits

- **Segregated Architecture**: Nexo code is completely separate from Powens
- **Unified Dashboard**: Access both banking and crypto data from one interface
- **Comprehensive Logging**: All API interactions are logged for debugging
- **Error Resilience**: Graceful handling of API failures and configuration issues
- **Development Friendly**: Rich web interface for testing and debugging

## Production Considerations

### Security
- Store API keys securely (environment variables, secrets manager)
- Use HTTPS for all communications
- Implement proper error handling and logging
- Verify webhook signatures to ensure data integrity

### Monitoring
- Monitor API rate limits and quotas
- Set up alerts for webhook failures
- Track deposit address creation and usage
- Monitor connection status and API health

### Scalability
- Consider implementing caching for asset lists
- Store deposit addresses in your database
- Implement proper retry logic for failed API calls
- Consider using queues for webhook processing

## Support

For Nexo-specific issues:
- Review the [Nexo Payment Gateway Documentation](https://pg.nexo.com/)
- Contact Nexo Client Care for API-related support
- Check the Nexo Payment Gateway dashboard for configuration issues

For integration issues:
- Check server logs for detailed error information
- Use the `/nexo` page for debugging and testing
- Verify environment variable configuration
- Test API connectivity with the status endpoints
