#!/bin/bash

# Integration tests for v3 API
# No global guards, only DB constraints

API_HOST="${API_HOST:-http://localhost:8080}"
STORE_ID="${STORE_ID:-store1}"

echo "======================================"
echo "Integration Tests for Reservation API v3"
echo "Host: $API_HOST"
echo "Store: $STORE_ID"
echo "======================================"
echo ""

# Test 1: Normal reservation creation
echo "TEST 1: Create normal reservation"
echo "--------------------------------"
curl -i -X POST "$API_HOST/api/admin?action=create" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: test-normal-001' \
  -d '{
    "store_id": "'$STORE_ID'",
    "startAt": "2025-09-10T21:30:00+09:00",
    "user_name": "山田太郎",
    "user_phone": "090-1234-5678",
    "people": 2,
    "message": "窓際の席希望"
  }'
echo -e "\n\nExpected: 201 Created with bk_* event ID\n"
sleep 2

# Test 2: Duplicate request (same Idempotency-Key)
echo "TEST 2: Duplicate request with same Idempotency-Key"
echo "---------------------------------------------------"
curl -i -X POST "$API_HOST/api/admin?action=create" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: test-normal-001' \
  -d '{
    "store_id": "'$STORE_ID'",
    "startAt": "2025-09-10T21:30:00+09:00",
    "user_name": "山田太郎",
    "user_phone": "090-1234-5678",
    "people": 2
  }'
echo -e "\n\nExpected: 200 OK (idempotent) or 409 duplicate_request\n"
sleep 2

# Test 3: Slot taken (different Idempotency-Key, same slot)
echo "TEST 3: Same slot with different Idempotency-Key"
echo "------------------------------------------------"
curl -i -X POST "$API_HOST/api/admin?action=create" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: test-conflict-002' \
  -d '{
    "store_id": "'$STORE_ID'",
    "startAt": "2025-09-10T21:30:00+09:00",
    "user_name": "鈴木花子",
    "user_phone": "090-9876-5432",
    "people": 3
  }'
echo -e "\n\nExpected: 409 slot_taken\n"
sleep 2

# Test 4: Different slot (should succeed)
echo "TEST 4: Different time slot"
echo "---------------------------"
curl -i -X POST "$API_HOST/api/admin?action=create" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: test-different-003' \
  -d '{
    "store_id": "'$STORE_ID'",
    "startAt": "2025-09-10T20:00:00+09:00",
    "user_name": "佐藤次郎",
    "user_phone": "090-5555-5555",
    "people": 4
  }'
echo -e "\n\nExpected: 201 Created\n"
sleep 2

# Test 5: Missing Idempotency-Key
echo "TEST 5: Request without Idempotency-Key"
echo "---------------------------------------"
curl -i -X POST "$API_HOST/api/admin?action=create" \
  -H 'Content-Type: application/json' \
  -d '{
    "store_id": "'$STORE_ID'",
    "startAt": "2025-09-10T19:00:00+09:00",
    "user_name": "田中三郎",
    "user_phone": "090-3333-3333",
    "people": 1
  }'
echo -e "\n\nExpected: 400 missing_idempotency_key\n"
sleep 2

# Test 6: Time rounding (21:45 -> 21:30)
echo "TEST 6: Time rounding (21:45 -> 21:30)"
echo "--------------------------------------"
curl -i -X POST "$API_HOST/api/admin?action=create" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: test-rounding-004' \
  -d '{
    "store_id": "'$STORE_ID'",
    "startAt": "2025-09-10T21:45:00+09:00",
    "user_name": "時間丸め",
    "user_phone": "090-4444-4444",
    "people": 2
  }'
echo -e "\n\nExpected: 409 slot_taken (rounded to 21:30 which is taken)\n"
sleep 2

# Test 7: Fetch bookings
echo "TEST 7: Fetch booking events"
echo "----------------------------"
curl -i "$API_HOST/api/events?type=booking&store_id=$STORE_ID"
echo -e "\n\nExpected: Array of bk_* events with fc-booking class\n"
sleep 2

# Test 8: Create constraint
echo "TEST 8: Create capacity constraint"
echo "----------------------------------"
curl -i -X POST "$API_HOST/api/events/constraints" \
  -H 'Content-Type: application/json' \
  -d '{
    "store_id": "'$STORE_ID'",
    "start_time": "2025-09-10T12:00:00.000Z",
    "end_time": "2025-09-10T13:00:00.000Z",
    "max_groups": 3,
    "max_people": 10
  }'
echo -e "\n\nExpected: 201 Created with cs_* event\n"
sleep 2

# Test 9: Fetch constraints
echo "TEST 9: Fetch constraint events"
echo "-------------------------------"
curl -i "$API_HOST/api/events?type=constraint&store_id=$STORE_ID"
echo -e "\n\nExpected: Array of cs_* events with fc-constraint class and display:background\n"
sleep 2

# Test 10: Verify separation
echo "TEST 10: Verify events are separated"
echo "------------------------------------"
echo "Fetching all events and checking IDs..."
curl -s "$API_HOST/api/events?type=booking&store_id=$STORE_ID" | grep -o '"id":"[^"]*"' | head -5
echo "---"
curl -s "$API_HOST/api/events?type=constraint&store_id=$STORE_ID" | grep -o '"id":"[^"]*"' | head -5
echo -e "\nExpected: bk_* for bookings, cs_* for constraints\n"

echo "======================================"
echo "Integration tests completed"
echo "======================================"
echo ""
echo "Manual verification checklist:"
echo "1. [ ] No 'duplicate_create_window' errors in logs"
echo "2. [ ] Bookings have bk_* prefix"
echo "3. [ ] Constraints have cs_* prefix"
echo "4. [ ] Constraints show as background only"
echo "5. [ ] No red backgrounds on unrelated slots"
echo "6. [ ] Idempotency-Key is required"
echo "7. [ ] Times are properly rounded to 30-min slots"
echo "8. [ ] UTC conversion works correctly"