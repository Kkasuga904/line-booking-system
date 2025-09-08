#!/bin/bash

# Deploy script for v2 API with feature flags

set -e

# Configuration
PROJECT_ID="line-booking-prod-20241228"
SERVICE_NAME="line-booking-api-v2"
REGION="asia-northeast1"
MEMORY="512Mi"
CPU="1"
MAX_INSTANCES="2"
MIN_INSTANCES="0"
TIMEOUT="300"

# Feature flags
export FEATURE_IDEMPOTENCY=true
export LOG_LEVEL=info

echo "🚀 Deploying Reservation API v2..."
echo "   Project: $PROJECT_ID"
echo "   Service: $SERVICE_NAME"
echo "   Region: $REGION"
echo ""

# Check for required files
if [ ! -f ".env.yaml" ]; then
  echo "❌ Error: .env.yaml not found"
  exit 1
fi

if [ ! -f "server-v2.js" ]; then
  echo "❌ Error: server-v2.js not found"
  exit 1
fi

# Add feature flags to .env.yaml temporarily
cp .env.yaml .env.yaml.backup
cat >> .env.yaml << EOF
FEATURE_IDEMPOTENCY: "$FEATURE_IDEMPOTENCY"
LOG_LEVEL: "$LOG_LEVEL"
EOF

# Deploy to Cloud Run
echo "📦 Building and deploying..."
gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --port 8080 \
  --env-vars-file .env.yaml \
  --memory $MEMORY \
  --cpu $CPU \
  --max-instances $MAX_INSTANCES \
  --min-instances $MIN_INSTANCES \
  --timeout $TIMEOUT \
  --set-env-vars="NODE_ENV=production" \
  --quiet

# Restore original .env.yaml
mv .env.yaml.backup .env.yaml

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --format 'value(status.url)')

echo ""
echo "✅ Deployment successful!"
echo "   Service URL: $SERVICE_URL"
echo ""

# Run health check
echo "🏥 Running health check..."
curl -s "$SERVICE_URL/health" | jq '.'

echo ""
echo "📝 Test commands:"
echo "   curl $SERVICE_URL/api/v2/reservations?storeId=store1"
echo "   curl -X POST $SERVICE_URL/api/v2/reservations \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -H 'Idempotency-Key: test-key-123' \\"
echo "     -d '{\"storeId\":\"store1\",\"startAt\":\"2025-09-04T21:30:00+09:00\",\"name\":\"Test\",\"phone\":\"090-1234-5678\"}'"