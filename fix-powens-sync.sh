#!/bin/bash

echo "🔧 FIRE Planning - Powens Data Sync Fix"
echo "======================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

API_BASE="http://localhost:3000"
ADMIN_USER_ID="00000000-0000-0000-0000-000000000001"

echo "Step 1: Check current configuration"
echo "-----------------------------------"

# Check if mock data is enabled
echo -e "${YELLOW}Checking mock data setting...${NC}"
if grep -q "ENABLE_MOCK_DATA=true" .env 2>/dev/null; then
    echo -e "${RED}❌ Mock data is ENABLED in .env file${NC}"
    echo "   This is why you're seeing mock data instead of real data from Powens."
    echo ""
    echo "   To fix this, update your .env file:"
    echo "   ENABLE_MOCK_DATA=false"
    echo ""
    read -p "Do you want me to fix this now? (y/n): " fix_env
    if [ "$fix_env" = "y" ] || [ "$fix_env" = "Y" ]; then
        if [ -f .env ]; then
            sed -i 's/ENABLE_MOCK_DATA=true/ENABLE_MOCK_DATA=false/' .env
            echo -e "${GREEN}✅ Updated .env file: ENABLE_MOCK_DATA=false${NC}"
        else
            echo -e "${RED}❌ .env file not found${NC}"
        fi
    fi
else
    echo -e "${GREEN}✅ Mock data is disabled (good)${NC}"
fi

echo ""
echo "Step 2: Check API connectivity"
echo "------------------------------"

# Test API health
echo -e "${YELLOW}Testing API health...${NC}"
if curl -s "$API_BASE/health" > /dev/null; then
    echo -e "${GREEN}✅ API is running${NC}"
else
    echo -e "${RED}❌ API is not accessible${NC}"
    echo "   Make sure your application is running on port 3000"
    exit 1
fi

echo ""
echo "Step 3: Check Powens connections"
echo "--------------------------------"

# Check connections
echo -e "${YELLOW}Checking Powens connections...${NC}"
connections_response=$(curl -s "$API_BASE/api/auth/powens/connections")
connections_count=$(echo "$connections_response" | jq -r '.meta.total // 0' 2>/dev/null || echo "0")

echo "Response: $connections_response"
echo ""

if [ "$connections_count" = "0" ]; then
    echo -e "${RED}❌ No Powens connections found${NC}"
    echo "   You need to connect to your bank first:"
    echo "   1. Go to $API_BASE"
    echo "   2. Click 'Connect to Powens'"
    echo "   3. Complete the bank connection process"
    echo ""
    read -p "Have you already connected to your bank? (y/n): " has_connected
    if [ "$has_connected" = "n" ] || [ "$has_connected" = "N" ]; then
        echo "   Please connect to your bank first, then run this script again."
        exit 1
    fi
else
    echo -e "${GREEN}✅ Found $connections_count Powens connection(s)${NC}"
    
    # Get connection ID for sync
    connection_id=$(echo "$connections_response" | jq -r '.data[0].id // empty' 2>/dev/null)
    if [ -n "$connection_id" ]; then
        echo "   Connection ID: $connection_id"
    fi
fi

echo ""
echo "Step 4: Check current accounts data"
echo "-----------------------------------"

# Check accounts
echo -e "${YELLOW}Checking accounts data...${NC}"
accounts_response=$(curl -s "$API_BASE/api/accounts")
echo "Response: $accounts_response"
echo ""

is_mock=$(echo "$accounts_response" | grep -o "mock data" || echo "")
if [ -n "$is_mock" ]; then
    echo -e "${RED}❌ Still receiving mock data${NC}"
    echo "   You need to restart your application after changing ENABLE_MOCK_DATA=false"
    echo ""
    echo "   Restart commands:"
    echo "   - If using systemctl: sudo systemctl restart fire-planning"
    echo "   - If using pm2: pm2 restart all"
    echo "   - If running manually: stop and restart your Node.js process"
    echo ""
    read -p "Do you want to restart the service now? (y/n): " restart_service
    if [ "$restart_service" = "y" ] || [ "$restart_service" = "Y" ]; then
        echo "Attempting to restart service..."
        if sudo systemctl restart fire-planning 2>/dev/null; then
            echo -e "${GREEN}✅ Service restarted${NC}"
            sleep 3
        else
            echo -e "${YELLOW}⚠️  Could not restart with systemctl. Please restart manually.${NC}"
        fi
    fi
    exit 1
else
    accounts_count=$(echo "$accounts_response" | jq -r '.meta.total // 0' 2>/dev/null || echo "0")
    if [ "$accounts_count" = "0" ]; then
        echo -e "${YELLOW}⚠️  No accounts found in database${NC}"
        echo "   This means the sync hasn't run yet or failed."
    else
        echo -e "${GREEN}✅ Found $accounts_count account(s) in database${NC}"
    fi
fi

echo ""
echo "Step 5: Trigger manual sync"
echo "---------------------------"

if [ -n "$connection_id" ]; then
    echo -e "${YELLOW}Triggering manual sync for connection: $connection_id${NC}"
    
    # Trigger sync
    sync_response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d '{"force": true, "includeTransactions": true}' \
        "$API_BASE/api/sync/connection/$connection_id")
    
    echo "Sync response: $sync_response"
    echo ""
    
    sync_success=$(echo "$sync_response" | jq -r '.success // false' 2>/dev/null)
    if [ "$sync_success" = "true" ]; then
        echo -e "${GREEN}✅ Sync completed successfully${NC}"
        
        # Check accounts again
        echo ""
        echo -e "${YELLOW}Checking accounts after sync...${NC}"
        accounts_after_sync=$(curl -s "$API_BASE/api/accounts")
        echo "Response: $accounts_after_sync"
        echo ""
        
        accounts_count_after=$(echo "$accounts_after_sync" | jq -r '.meta.total // 0' 2>/dev/null || echo "0")
        if [ "$accounts_count_after" -gt "0" ]; then
            echo -e "${GREEN}🎉 SUCCESS! Found $accounts_count_after account(s) from Powens${NC}"
        else
            echo -e "${RED}❌ Sync completed but no accounts found${NC}"
        fi
        
        # Check transactions
        echo ""
        echo -e "${YELLOW}Checking transactions...${NC}"
        transactions_response=$(curl -s "$API_BASE/api/transactions")
        transactions_count=$(echo "$transactions_response" | jq -r '.meta.total // 0' 2>/dev/null || echo "0")
        echo "Found $transactions_count transaction(s)"
        
    else
        echo -e "${RED}❌ Sync failed${NC}"
        error_message=$(echo "$sync_response" | jq -r '.error.message // "Unknown error"' 2>/dev/null)
        echo "   Error: $error_message"
    fi
else
    echo -e "${RED}❌ No connection ID available for sync${NC}"
    echo "   Please ensure you have a valid Powens connection"
fi

echo ""
echo "Step 6: Alternative sync for default admin user"
echo "----------------------------------------------"

if [ "$accounts_count" = "0" ] || [ -z "$connection_id" ]; then
    echo -e "${YELLOW}Trying sync for default admin user ($ADMIN_USER_ID)...${NC}"
    
    user_sync_response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d '{"force": true, "includeTransactions": true}' \
        "$API_BASE/api/sync/user-default")
    
    echo "User sync response: $user_sync_response"
    echo ""
    
    user_sync_success=$(echo "$user_sync_response" | jq -r '.success // false' 2>/dev/null)
    if [ "$user_sync_success" = "true" ]; then
        echo -e "${GREEN}✅ User sync completed${NC}"
        
        # Check results
        results_total=$(echo "$user_sync_response" | jq -r '.data.summary.total // 0' 2>/dev/null)
        results_successful=$(echo "$user_sync_response" | jq -r '.data.summary.successful // 0' 2>/dev/null)
        
        echo "   Total connections processed: $results_total"
        echo "   Successful syncs: $results_successful"
        
        if [ "$results_successful" -gt "0" ]; then
            # Check accounts again after user sync
            echo ""
            echo -e "${YELLOW}Checking accounts after user sync...${NC}"
            final_accounts_response=$(curl -s "$API_BASE/api/accounts")
            final_accounts_count=$(echo "$final_accounts_response" | jq -r '.meta.total // 0' 2>/dev/null || echo "0")
            
            if [ "$final_accounts_count" -gt "0" ]; then
                echo -e "${GREEN}🎉 SUCCESS! Found $final_accounts_count account(s) after user sync${NC}"
            fi
        fi
    else
        echo -e "${RED}❌ User sync failed${NC}"
        user_error_message=$(echo "$user_sync_response" | jq -r '.error.message // "Unknown error"' 2>/dev/null)
        echo "   Error: $user_error_message"
    fi
fi

echo ""
echo "==================================="
echo "🔍 DIAGNOSIS SUMMARY"
echo "==================================="

# Final check
final_accounts=$(curl -s "$API_BASE/api/accounts")
final_count=$(echo "$final_accounts" | jq -r '.meta.total // 0' 2>/dev/null || echo "0")
final_is_mock=$(echo "$final_accounts" | grep -o "mock data" || echo "")

if [ -n "$final_is_mock" ]; then
    echo -e "${RED}❌ ISSUE: Still showing mock data${NC}"
    echo "   Solutions:"
    echo "   1. Ensure ENABLE_MOCK_DATA=false in .env"
    echo "   2. Restart your application"
    echo "   3. Check application logs for errors"
elif [ "$final_count" = "0" ]; then
    echo -e "${YELLOW}⚠️  ISSUE: No real accounts found${NC}"
    echo "   Possible causes:"
    echo "   1. Powens connection might be invalid/expired"
    echo "   2. Sync process failed"
    echo "   3. Database connection issues"
    echo "   4. User ID mismatch (using admin user: $ADMIN_USER_ID)"
    echo ""
    echo "   Next steps:"
    echo "   1. Check application logs: journalctl -u fire-planning -f"
    echo "   2. Verify database connection"
    echo "   3. Re-establish Powens connection if needed"
    echo "   4. Check if connections exist for the admin user"
else
    echo -e "${GREEN}🎉 SUCCESS: Found $final_count real account(s)${NC}"
    echo "   Your Powens integration is working correctly!"
fi

echo ""
echo "==================================="
echo "📋 USEFUL COMMANDS"
echo "==================================="
echo "Check accounts:          curl $API_BASE/api/accounts"
echo "Check transactions:      curl $API_BASE/api/transactions"
echo "Check connections:       curl $API_BASE/api/auth/powens/connections"
echo "Manual sync (default):   curl -X POST $API_BASE/api/sync/user-default"
echo "Manual sync (specific):  curl -X POST $API_BASE/api/sync/user/$ADMIN_USER_ID"
echo "Check logs:              journalctl -u fire-planning -f"
echo "Check sync status:       curl $API_BASE/api/sync/stats"
echo ""
echo "Admin User ID: $ADMIN_USER_ID"
echo ""
