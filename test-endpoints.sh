#!/bin/bash

# Quick test script to verify the FIRE Planning API endpoints
# This script tests the main endpoints to ensure they're working

echo "🔥 FIRE Planning API Endpoint Tests"
echo "=================================="

BASE_URL="http://localhost:3000"

echo -e "\n1. Testing Health Check..."
curl -s "$BASE_URL/health" | jq '.' || echo "Health check failed"

echo -e "\n2. Testing Powens Auth Endpoints..."
echo "   - Initialize Connection:"
curl -s -X POST "$BASE_URL/api/auth/powens/init" | jq '.' || echo "Init failed"

echo -e "\n   - Get Auth URL:"
curl -s "$BASE_URL/api/auth/powens/url" | jq '.' || echo "Get URL failed"

echo -e "\n3. Testing Account Endpoints..."
curl -s "$BASE_URL/api/accounts" | jq '.' || echo "Accounts failed"

echo -e "\n4. Testing Transaction Endpoints..."
curl -s "$BASE_URL/api/transactions" | jq '.' || echo "Transactions failed"

echo -e "\n5. Testing Sync Endpoints..."
echo "   - Sync Accounts:"
curl -s -X POST "$BASE_URL/api/sync/accounts" | jq '.' || echo "Sync accounts failed"

echo "   - Sync Transactions:"
curl -s -X POST "$BASE_URL/api/sync/transactions" | jq '.' || echo "Sync transactions failed"

echo "   - Full Sync:"
curl -s -X POST "$BASE_URL/api/sync/full" | jq '.' || echo "Full sync failed"

echo "   - Sync Status:"
curl -s "$BASE_URL/api/sync/status" | jq '.' || echo "Sync status failed"

echo -e "\n6. Testing Dashboard..."
echo "Visit: $BASE_URL to test the frontend"

echo -e "\n✅ Tests completed!"
echo "If all endpoints return JSON responses, the API is working correctly."
echo "Make sure ENABLE_MOCK_DATA=true is set in your .env file for test data."
