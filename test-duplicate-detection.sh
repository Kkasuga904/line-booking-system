#!/bin/bash
# Test script for duplicate detection refactor
# 2025-09-02

# Configuration
API_URL="https://line-booking-api-116429620992.asia-northeast1.run.app"
# API_URL="http://localhost:8080"  # For local testing

# Test data
STORE_ID="default-store"
DATE=$(date -d tomorrow +%Y-%m-%d)
TIME="18:00:00"
CUSTOMER="田中太郎"
PHONE="090-1234-5678"

echo "========================================="
echo "Duplicate Detection Test Suite"
echo "========================================="
echo "API: $API_URL"
echo "Date: $DATE"
echo "Time: $TIME"
echo ""

# Test 1: Normal reservation creation
echo "Test 1: Normal reservation creation"
echo "------------------------------------"
curl -X POST "$API_URL/api/admin?action=create" \
  -H "Content-Type: application/json" \
  -d '{
    "store_id": "'$STORE_ID'",
    "customer_name": "'$CUSTOMER'",
    "date": "'$DATE'",
    "time": "'$TIME'",
    "people": 2,
    "phone": "'$PHONE'",
    "seat_code": "T1"
  }' | jq '.'

echo ""
sleep 1

# Test 2: Duplicate slot (same seat, date, time) - should return 409 slot_taken
echo "Test 2: Duplicate slot (same seat) - Expect 409 slot_taken"
echo "-----------------------------------------------------------"
curl -X POST "$API_URL/api/admin?action=create" \
  -H "Content-Type: application/json" \
  -d '{
    "store_id": "'$STORE_ID'",
    "customer_name": "佐藤花子",
    "date": "'$DATE'",
    "time": "'$TIME'",
    "people": 3,
    "phone": "090-9876-5432",
    "seat_code": "T1"
  }' | jq '.'

echo ""
sleep 1

# Test 3: Different seat, same time - should succeed
echo "Test 3: Different seat, same time - Should succeed"
echo "--------------------------------------------------"
curl -X POST "$API_URL/api/admin?action=create" \
  -H "Content-Type: application/json" \
  -d '{
    "store_id": "'$STORE_ID'",
    "customer_name": "佐藤花子",
    "date": "'$DATE'",
    "time": "'$TIME'",
    "people": 3,
    "phone": "090-9876-5432",
    "seat_code": "T2"
  }' | jq '.'

echo ""
sleep 1

# Test 4: Idempotency-Key test - first request
IDEMPOTENCY_KEY=$(uuidgen || echo "test-key-$(date +%s)")
echo "Test 4a: With Idempotency-Key (first request)"
echo "---------------------------------------------"
echo "Idempotency-Key: $IDEMPOTENCY_KEY"
curl -X POST "$API_URL/api/admin?action=create" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "store_id": "'$STORE_ID'",
    "customer_name": "山田三郎",
    "date": "'$DATE'",
    "time": "19:00:00",
    "people": 4,
    "phone": "090-1111-2222",
    "seat_code": "T3"
  }' | jq '.'

echo ""
sleep 1

# Test 5: Idempotency-Key test - duplicate request (should return same result)
echo "Test 4b: Same Idempotency-Key (duplicate request)"
echo "-------------------------------------------------"
echo "Idempotency-Key: $IDEMPOTENCY_KEY"
curl -X POST "$API_URL/api/admin?action=create" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "store_id": "'$STORE_ID'",
    "customer_name": "山田三郎",
    "date": "'$DATE'",
    "time": "19:00:00",
    "people": 4,
    "phone": "090-1111-2222",
    "seat_code": "T3"
  }' | jq '.'

echo ""
echo "========================================="
echo "Test Suite Complete"
echo "========================================="
echo ""
echo "Expected Results:"
echo "- Test 1: 200 OK (success: true)"
echo "- Test 2: 409 Conflict (error: slot_taken)"
echo "- Test 3: 200 OK (success: true)"
echo "- Test 4a: 200 OK (success: true)"
echo "- Test 4b: 200 OK (success: true, duplicate: true)"