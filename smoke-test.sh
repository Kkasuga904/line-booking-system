#!/bin/bash

# Smoke Test Script for LINE Booking System
# Usage: ./smoke-test.sh <DEPLOYMENT_URL>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get deployment URL from argument or use default
DEPLOY_URL=${1:-"https://line-booking-system-seven.vercel.app"}

echo "🔍 Starting smoke test for: $DEPLOY_URL"
echo "================================"

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test endpoint
test_endpoint() {
    local endpoint=$1
    local expected_status=$2
    local description=$3
    
    echo -n "Testing $description... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOY_URL$endpoint")
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (Status: $response)"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $response)"
        ((TESTS_FAILED++))
    fi
}

# Test POST endpoint with data
test_post_endpoint() {
    local endpoint=$1
    local data=$2
    local expected_status=$3
    local description=$4
    
    echo -n "Testing $description... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$data" \
        "$DEPLOY_URL$endpoint")
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (Status: $response)"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $response)"
        ((TESTS_FAILED++))
    fi
}

# 1. Test Health Check Endpoints
echo -e "\n${YELLOW}1. Health Check Tests${NC}"
test_endpoint "/api/ping" "200" "Ping endpoint"
test_endpoint "/api/health" "200" "Health endpoint"
test_endpoint "/api/webhook-health" "200" "Webhook health"

# 2. Test Public Pages
echo -e "\n${YELLOW}2. Public Page Tests${NC}"
test_endpoint "/" "200" "Homepage"
test_endpoint "/admin" "200" "Admin page"
test_endpoint "/admin-calendar" "200" "Calendar page"
test_endpoint "/liff" "200" "LIFF page"

# 3. Test API Endpoints
echo -e "\n${YELLOW}3. API Endpoint Tests${NC}"
test_endpoint "/api/admin" "200" "Admin API"
test_endpoint "/api/calendar-reservation" "405" "Calendar API (GET should fail)"

# 4. Test Webhook with Sample Data
echo -e "\n${YELLOW}4. Webhook Tests${NC}"

# Test webhook with empty events
test_post_endpoint "/webhook" '{"events":[]}' "200" "Webhook with empty events"

# Test webhook with follow event
follow_event='{
  "events": [{
    "type": "follow",
    "replyToken": "test_token",
    "source": {"userId": "test_user"}
  }]
}'
test_post_endpoint "/webhook" "$follow_event" "200" "Webhook with follow event"

# Test webhook with message event
message_event='{
  "events": [{
    "type": "message",
    "replyToken": "test_token",
    "source": {"userId": "test_user"},
    "message": {"text": "予約"}
  }]
}'
test_post_endpoint "/webhook" "$message_event" "200" "Webhook with message event"

# 5. Test Error Handling
echo -e "\n${YELLOW}5. Error Handling Tests${NC}"
test_endpoint "/api/nonexistent" "404" "404 Error handling"
test_endpoint "/api/webhook" "405" "Method not allowed (GET on POST endpoint)"

# 6. Test Security Headers
echo -e "\n${YELLOW}6. Security Header Tests${NC}"
echo -n "Testing security headers... "

headers=$(curl -s -I "$DEPLOY_URL" | grep -E "X-Content-Type-Options|X-Frame-Options|X-XSS-Protection")

if [[ $headers == *"X-Content-Type-Options"* ]] && \
   [[ $headers == *"X-Frame-Options"* ]] && \
   [[ $headers == *"X-XSS-Protection"* ]]; then
    echo -e "${GREEN}✓ PASS${NC} (Security headers present)"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC} (Missing security headers)"
    ((TESTS_FAILED++))
fi

# 7. Performance Test
echo -e "\n${YELLOW}7. Performance Tests${NC}"
echo -n "Testing response time... "

start_time=$(date +%s%N)
curl -s -o /dev/null "$DEPLOY_URL/api/ping"
end_time=$(date +%s%N)

response_time=$(( ($end_time - $start_time) / 1000000 ))

if [ "$response_time" -lt 1000 ]; then
    echo -e "${GREEN}✓ PASS${NC} (Response time: ${response_time}ms)"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠ SLOW${NC} (Response time: ${response_time}ms)"
fi

# Summary
echo -e "\n================================"
echo "📊 Test Results Summary"
echo "================================"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

if [ "$TESTS_FAILED" -eq 0 ]; then
    echo -e "\n${GREEN}✅ All smoke tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed. Please review the failures above.${NC}"
    exit 1
fi