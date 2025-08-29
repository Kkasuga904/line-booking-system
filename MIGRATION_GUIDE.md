# 🚀 Vercel → GCP Cloud Run 移行ガイド

## 前提条件
- GCPアカウント作成済み
- gcloud CLIインストール済み
- Terraform インストール済み（v1.0以上）
- GitHub リポジトリ管理者権限

## 📋 移行ステップ

### 1. GCPプロジェクト作成と初期設定

```bash
# プロジェクトID決定（グローバルユニーク）
PROJECT_ID="line-booking-prod-xxxxx"  # xxxxxは任意の文字列

# セットアップスクリプト実行
chmod +x ./scripts/setup-gcp.sh
./scripts/setup-gcp.sh $PROJECT_ID

# 認証
gcloud auth login
gcloud config set project $PROJECT_ID
```

### 2. Secret Manager設定

```bash
# 秘密情報を登録
gcloud secrets create line-channel-access-token --data-file=- <<< "***REMOVED-ROTATE-CREDENTIAL***"

gcloud secrets create line-channel-secret --data-file=- <<< "***REMOVED-ROTATE-CREDENTIAL***"

gcloud secrets create supabase-url --data-file=- <<< "***REMOVED-ROTATE-CREDENTIAL***"

gcloud secrets create supabase-anon-key --data-file=- <<< "***REMOVED-ROTATE-CREDENTIAL***"
```

### 3. 初回デプロイ（手動）

```bash
# Cloud Runへデプロイ
gcloud run deploy line-booking-api \
  --source . \
  --region asia-northeast1 \
  --platform managed \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 10 \
  --cpu 1 \
  --memory 512Mi \
  --timeout 60 \
  --update-secrets=LINE_CHANNEL_ACCESS_TOKEN=line-channel-access-token:latest,LINE_CHANNEL_SECRET=line-channel-secret:latest,SUPABASE_URL=supabase-url:latest,SUPABASE_ANON_KEY=supabase-anon-key:latest \
  --set-env-vars=NODE_ENV=production,STORE_ID=***REMOVED-ROTATE-CREDENTIAL***,LIFF_ID=***REMOVED-ROTATE-CREDENTIAL***

# デプロイ完了後、URLを取得
SERVICE_URL=$(gcloud run services describe line-booking-api --region asia-northeast1 --format 'value(status.url)')
echo "Service URL: $SERVICE_URL"
echo "Webhook URL: $SERVICE_URL/webhook"
```

### 4. LINE Developersの設定更新

1. [LINE Developers Console](https://developers.line.biz/)にログイン
2. SmartWeb Works 予約 Botを選択
3. Messaging API設定タブ
4. Webhook URLを更新：
   ```
   https://line-booking-api-xxxxx-an.a.run.app/webhook
   ```
5. Webhook: ON
6. 応答メッセージ: OFF

### 5. 動作確認

```bash
# ヘルスチェック
curl https://line-booking-api-xxxxx-an.a.run.app/api/ping

# Webhookテスト
curl -X POST https://line-booking-api-xxxxx-an.a.run.app/webhook \
  -H "Content-Type: application/json" \
  -d '{"events":[{"type":"message","message":{"text":"test"}}]}'
```

LINEアプリで「予約」とメッセージを送信して返信確認

### 6. GitHub Actions設定

GitHubリポジトリのSettings → Secrets and variablesで以下を追加：

- `GCP_PROJECT_ID_PROD`: プロジェクトID
- `GCP_SA_KEY_PROD`: サービスアカウントキー（base64エンコード）

```bash
# サービスアカウントキーを取得してbase64エンコード
cat gcp-key.json | base64 -w 0
```

### 7. 監視設定

```bash
# Budget Alert設定（1000円、3000円、10000円）
gcloud billing budgets create \
  --billing-account=YOUR_BILLING_ACCOUNT_ID \
  --display-name="LINE Booking Budget" \
  --budget-amount=1000JPY \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100
```

## 🔄 併走期間（1週間）

### 両環境の並行運用

1. **Vercel**: 既存URLで稼働継続
2. **GCP**: 新URLでテスト運用
3. 問題なければLINE Webhook URLを完全移行

### モニタリング項目
- [ ] レスポンスタイム（p95 < 1秒）
- [ ] エラー率（< 0.1%）
- [ ] 日次コスト（< 50円）
- [ ] LINE返信成功率（100%）

## 🛑 Vercel停止手順

併走期間後、問題なければ：

1. Vercelダッシュボードでプロジェクトを一時停止
2. 1週間様子見
3. 問題なければプロジェクト削除

## 💰 コスト見積もり

| サービス | 無料枠 | 予想使用量 | 月額 |
|---------|--------|-----------|------|
| Cloud Run | 200万req/月 | 1万req | ¥0 |
| Secret Manager | 1万アクセス/月 | 100 | ¥0 |
| Cloud Logging | 50GB/月 | 1GB | ¥0 |
| Artifact Registry | 0.5GB | 0.1GB | ¥0 |
| **合計** | | | **¥0〜100** |

## 🚨 トラブルシューティング

### デプロイ失敗
```bash
# ログ確認
gcloud logging read "resource.type=cloud_run_revision" --limit 50

# 権限確認
gcloud projects get-iam-policy $PROJECT_ID
```

### LINE返信が来ない
1. Secret Managerの値確認
2. Cloud RunのログでエラーチェックChannel
3. LINE Developers ConsoleでWebhook URL確認

### コスト超過アラート
1. Cloud Runの最小インスタンスを0に
2. ログ保持期間を7日に短縮
3. 不要なサービスを停止

## 📞 サポート

問題発生時：
1. Cloud Runログを確認
2. GitHub Issuesに記録
3. 緊急時はVercelに切り戻し可能（URLを戻すだけ）