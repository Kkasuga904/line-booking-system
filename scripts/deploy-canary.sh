#!/bin/bash

# カナリアデプロイスクリプト
# 使用方法: ./deploy-canary.sh store-a account1 10

set -e

# 引数チェック
if [ $# -lt 3 ]; then
  echo "Usage: $0 <store-id> <account> <traffic-percentage>"
  echo "Example: $0 store-a account1 10"
  exit 1
fi

STORE_ID=$1
ACCOUNT=$2
TRAFFIC_PERCENT=$3

# 設定
SERVICE_NAME="line-booking-api"
REGION="asia-northeast1"
TAG="${ACCOUNT}-${STORE_ID}"

# プロジェクトID設定（環境に応じて変更）
if [ "$ACCOUNT" = "account1" ]; then
  PROJECT_ID="line-booking-prod-20241228"  # アカウント1のプロジェクトID
elif [ "$ACCOUNT" = "account2" ]; then
  PROJECT_ID="line-booking-prod-account2"   # アカウント2のプロジェクトID（要変更）
else
  echo "❌ Unknown account: $ACCOUNT"
  exit 1
fi

echo "=========================================="
echo "🚀 CANARY DEPLOYMENT"
echo "=========================================="
echo "Store: $STORE_ID"
echo "Account: $ACCOUNT"
echo "Project: $PROJECT_ID"
echo "Traffic: $TRAFFIC_PERCENT%"
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
    console.log('  Store:', config.ui.storeName || '$STORE_ID');
    console.log('  Theme:', config.ui.theme.primaryColor);
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

# LINE設定の環境変数を構築
echo ""
echo "🔑 Preparing environment variables..."

# 店舗別の環境変数名を生成
STORE_ID_UPPER=$(echo $STORE_ID | tr '[:lower:]' '[:upper:]' | tr '-' '_')
LINE_SECRET_KEY="LINE_CHANNEL_SECRET_${STORE_ID_UPPER}"
LINE_TOKEN_KEY="LINE_CHANNEL_ACCESS_TOKEN_${STORE_ID_UPPER}"
LIFF_ID_KEY="LIFF_ID_${STORE_ID_UPPER}"

# 環境変数を構築
ENV_VARS="STORE_ID=$STORE_ID"
ENV_VARS="${ENV_VARS},NODE_ENV=production"
ENV_VARS="${ENV_VARS},SUPABASE_URL=${SUPABASE_URL}"

# デプロイ実行
echo ""
echo "🚀 Deploying to Cloud Run..."
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
  --project=$PROJECT_ID \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10

if [ $? -ne 0 ]; then
  echo "❌ Deployment failed"
  exit 1
fi

# トラフィック設定
echo ""
echo "🔄 Setting traffic to $TRAFFIC_PERCENT%..."

if [ "$TRAFFIC_PERCENT" = "100" ]; then
  # 100%の場合は全トラフィックを新バージョンへ
  gcloud run services update-traffic $SERVICE_NAME \
    --region $REGION \
    --to-tags $TAG=100 \
    --project=$PROJECT_ID
else
  # カナリアデプロイ（部分的なトラフィック）
  # 現在のバージョンを取得
  CURRENT_VERSION=$(gcloud run services describe $SERVICE_NAME \
    --region $REGION \
    --project=$PROJECT_ID \
    --format="value(status.traffic[0].revisionName)")
  
  REMAINING_TRAFFIC=$((100 - TRAFFIC_PERCENT))
  
  gcloud run services update-traffic $SERVICE_NAME \
    --region $REGION \
    --to-tags $TAG=$TRAFFIC_PERCENT \
    --to-revisions $CURRENT_VERSION=$REMAINING_TRAFFIC \
    --project=$PROJECT_ID
fi

if [ $? -ne 0 ]; then
  echo "❌ Traffic update failed"
  exit 1
fi

# サービスURL取得
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project=$PROJECT_ID \
  --format="value(status.url)")

echo ""
echo "=========================================="
echo "✅ DEPLOYMENT SUCCESSFUL"
echo "=========================================="
echo "Service URL: $SERVICE_URL"
echo "Tagged URL: ${SERVICE_URL/https:\/\//https://$TAG---}"
echo ""
echo "📊 Next steps:"
echo "1. Run smoke test: npm run test:$STORE_ID"
echo "2. Monitor logs: gcloud logging tail \"resource.type=cloud_run_revision AND jsonPayload.store_id=$STORE_ID\""
echo "3. Check metrics: https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME/metrics?project=$PROJECT_ID"
echo ""
echo "🔄 To increase traffic to 100%:"
echo "   ./deploy-canary.sh $STORE_ID $ACCOUNT 100"
echo ""
echo "⏪ To rollback:"
echo "   gcloud run services update-traffic $SERVICE_NAME --to-revisions $CURRENT_VERSION=100 --region $REGION --project=$PROJECT_ID"
echo "=========================================="