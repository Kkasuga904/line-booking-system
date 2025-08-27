#!/bin/bash
# Webhook デプロイスクリプト - Account 1
# Vercel のキャッシュ問題を回避するための手順

echo "🚀 LINE Booking System (Account 1) Webhook デプロイ開始..."

# 1. バージョン番号を更新
echo "📝 バージョン番号を更新してください (webhook-handler.js の WEBHOOK_VERSION)"
echo "   現在: 1.0.1"
read -p "   新バージョン: " NEW_VERSION

# 2. デプロイ日を更新
TODAY=$(date +%Y-%m-%d)
echo "📅 デプロイ日: $TODAY"

# 3. Git コミット
echo "💾 変更をコミット..."
git add -A
git commit -m "Update webhook to v$NEW_VERSION - force cache refresh"

# 4. Force push でキャッシュをクリア
echo "🔄 Force push でキャッシュをクリア..."
git push --force-with-lease

# 5. デプロイ確認
echo "⏳ デプロイ待機中 (20秒)..."
sleep 20

# 6. バージョン確認
echo "✅ バージョン確認中..."
curl https://line-booking-system-seven.vercel.app/api/version

echo ""
echo "📋 確認事項:"
echo "  1. Vercel ダッシュボードでデプロイ成功を確認"
echo "  2. LINE でテストメッセージを送信"
echo "  3. ログでバージョン番号を確認 (v${NEW_VERSION})"
echo ""
echo "🎉 デプロイ完了！"