#!/bin/bash

# スタンバイデプロイスクリプト（トラフィックなし）
# 使用方法: ./deploy-standby.sh store-a account2

set -e

# 引数チェック
if [ $# -lt 2 ]; then
  echo "Usage: $0 <store-id> <account>"
  echo "Example: $0 store-a account2"
  exit 1
fi

STORE_ID=$1
ACCOUNT=$2

# 設定
SERVICE_NAME="line-booking-api"
REGION="asia-northeast1"
TAG="${ACCOUNT}-${STORE_ID}"

# プロジェクトID設定
if [ "$ACCOUNT" = "account1" ]; then
  PROJECT_ID="line-booking-prod-20241228"
elif [ "$ACCOUNT" = "account2" ]; then
  PROJECT_ID="line-booking-prod-account2"  # 要変更
else
  echo "❌ Unknown account: $ACCOUNT"
  exit 1
fi

echo "=========================================="
echo "🔄 STANDBY DEPLOYMENT (No Traffic)"
echo "=========================================="
echo "Store: $STORE_ID"
echo "Account: $ACCOUNT"
echo "Project: $PROJECT_ID"
echo "Tag: $TAG"
echo "=========================================="

# 設定検証
echo ""
echo "📋 Validating configuration..."
node -e "
const { loadValidatedConfig } = require('./utils/store-config-validated');
loadValidatedConfig('$STORE_ID')
  .then(config => {
    console.log('✅ Config validation passed');
  })
  .catch(err => {
    console.error('❌ Config validation failed:', err.message);
    process.exit(1);
  });
"

if [ $? -ne 0 ]; then
  echo "❌ Configuration validation failed"
  exit 1
fi

# 環境変数を構築
STORE_ID_UPPER=$(echo $STORE_ID | tr '[:lower:]' '[:upper:]' | tr '-' '_')
LINE_SECRET_KEY="LINE_CHANNEL_SECRET_${STORE_ID_UPPER}"
LINE_TOKEN_KEY="LINE_CHANNEL_ACCESS_TOKEN_${STORE_ID_UPPER}"
LIFF_ID_KEY="LIFF_ID_${STORE_ID_UPPER}"

ENV_VARS="STORE_ID=$STORE_ID"
ENV_VARS="${ENV_VARS},NODE_ENV=production"
ENV_VARS="${ENV_VARS},SUPABASE_URL=${SUPABASE_URL}"

# デプロイ実行（トラフィックなし）
echo ""
echo "🚀 Deploying to Cloud Run (standby mode)..."
gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars="$ENV_VARS" \
  --update-secrets="${LINE_SECRET_KEY}=line-channel-secret-${STORE_ID}:latest" \
  --update-secrets="${LINE_TOKEN_KEY}=line-access-token-${STORE_ID}:latest" \
  --update-secrets="SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest" \
  --tag=$TAG \
  --no-traffic \
  --project=$PROJECT_ID \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10

if [ $? -ne 0 ]; then
  echo "❌ Deployment failed"
  exit 1
fi

# サービスURL取得
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project=$PROJECT_ID \
  --format="value(status.url)")

TAGGED_URL="${SERVICE_URL/https:\/\//https://$TAG---}"

echo ""
echo "=========================================="
echo "✅ STANDBY DEPLOYMENT SUCCESSFUL"
echo "=========================================="
echo "Service URL: $SERVICE_URL"
echo "Tagged URL: $TAGGED_URL"
echo ""
echo "📊 Health check:"
echo "   curl ${TAGGED_URL}/api/health"
echo ""
echo "🔄 To activate with traffic:"
echo "   ./deploy-canary.sh $STORE_ID $ACCOUNT 10"
echo "=========================================="