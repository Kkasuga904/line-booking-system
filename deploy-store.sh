#!/bin/bash

# 店舗別デプロイスクリプト
# 使用方法: ./deploy-store.sh [store-id] [domain]
# 例: ./deploy-store.sh store-001 elegance.line-booking.jp

STORE_ID=$1
DOMAIN=$2
ENV_FILE=".env.${STORE_ID}"

if [ -z "$STORE_ID" ] || [ -z "$DOMAIN" ]; then
    echo "使用方法: ./deploy-store.sh [store-id] [domain]"
    exit 1
fi

echo "=================================================="
echo "   店舗デプロイ: ${STORE_ID}"
echo "   ドメイン: ${DOMAIN}"
echo "=================================================="

# Vercelへのデプロイ
echo "Vercelにデプロイ中..."
vercel --prod --env-file=${ENV_FILE} --scope=line-booking --name=${STORE_ID}

# Webhook URLの表示
echo ""
echo "=================================================="
echo "   デプロイ完了！"
echo "=================================================="
echo "Webhook URL: https://${DOMAIN}/webhook"
echo "管理画面: https://${DOMAIN}/admin"
echo ""
echo "LINE Developers Consoleに上記のWebhook URLを設定してください"
echo "=================================================="