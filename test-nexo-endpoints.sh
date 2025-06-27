#!/bin/bash

# Nexo API Integration Test Script
# Tests the Nexo Payment Gateway endpoints

BASE_URL="http://localhost:3000"
API_KEY="${NEXO_API_KEY}"

echo "🧪 Testing Nexo API Integration"
echo "=================================="
echo

# Test 1: Health check
echo "1. Testing health endpoint..."
curl -s "${BASE_URL}/health" | jq '.' || echo "❌ Health check failed"
echo
echo

# Test 2: Nexo status
echo "2. Testing Nexo status..."
curl -s "${BASE_URL}/api/nexo/status" | jq '.' || echo "❌ Status check failed"
echo
echo

# Test 3: Nexo configuration
echo "3. Testing Nexo configuration..."
curl -s "${BASE_URL}/api/nexo/config" | jq '.' || echo "❌ Config check failed"
echo
echo

# Test 4: Nexo assets (requires API key)
if [ -n "$API_KEY" ]; then
    echo "4. Testing Nexo assets with API key..."
    curl -s -H "x-api-key: ${API_KEY}" "${BASE_URL}/api/nexo/assets" | jq '.' || echo "❌ Assets fetch failed"
    echo
    echo
    
    # Test 5: Create deposit address (requires API key)
    echo "5. Testing deposit address creation..."
    curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "x-api-key: ${API_KEY}" \
        -d '{"referenceId": "test-script-123", "asset": "BTC"}' \
        "${BASE_URL}/api/nexo/addresses" | jq '.' || echo "❌ Address creation failed"
    echo
    echo
else
    echo "4. ⚠️  Skipping API key tests (NEXO_API_KEY not set)"
    echo "   To test with API key, run: NEXO_API_KEY=your_key ./test-nexo-endpoints.sh"
    echo
    echo "5. Testing assets without API key (should fail)..."
    curl -s "${BASE_URL}/api/nexo/assets" | jq '.' || echo "❌ Expected failure occurred"
    echo
    echo
fi

# Test 6: Test webhook endpoint structure (without signature)
echo "6. Testing webhook endpoint structure..."
curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"eventType": "PG_DEPOSIT", "data": {"test": "data"}}' \
    "${BASE_URL}/api/nexo/webhook" | jq '.' || echo "❌ Webhook test failed"
echo
echo

echo "✅ Nexo API integration tests completed!"
echo
echo "📝 Next steps:"
echo "   1. Configure NEXO_API_KEY in your .env file"
echo "   2. Visit ${BASE_URL}/nexo for the web interface"
echo "   3. Set up webhook URL in Nexo dashboard: ${BASE_URL}/api/nexo/webhook"
echo
echo "🔗 Quick Links:"
echo "   - Main Dashboard: ${BASE_URL}/"
echo "   - Nexo Interface: ${BASE_URL}/nexo"
echo "   - API Documentation: ${BASE_URL}/api/docs (if enabled)"
echo "   - Health Check: ${BASE_URL}/health"
