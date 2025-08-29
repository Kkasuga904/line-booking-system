# 🚀 GCPデプロイ実行コマンド集

## 1. プロジェクト作成と設定

PowerShellまたはコマンドプロンプトで以下を実行：

```powershell
# プロジェクトID（ユニークにするため日付を追加）
$PROJECT_ID = "line-booking-prod-20250828"

# 1. プロジェクト作成
gcloud projects create $PROJECT_ID --name="LINE Booking System"

# 2. プロジェクトを設定
gcloud config set project $PROJECT_ID

# 3. リージョン設定（東京）
gcloud config set compute/region asia-northeast1

# 4. 請求先アカウントをリンク（請求先ID確認）
gcloud billing accounts list

# 請求先IDを確認したら（例：01234-56789-ABCDE）
gcloud billing projects link $PROJECT_ID --billing-account=YOUR_BILLING_ACCOUNT_ID
```

## 2. 必要なAPIを有効化

```powershell
# 必須APIを一括有効化
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com
```

## 3. Secret Manager設定

```powershell
# シークレット作成（実際の値を使用）
echo "2l2dPaFJzJm9dOGWUDWjSkTd4q6rPFCQyNlJCsjroXvp8ms5ixN5y5wLaWkdL7yvbjGhrREmcrINg4sT+8/nKhExKuolhDSfddrgv9ZNqHwamM43ELsG51/IVWsdaRTxnAyRHCj6+pdQrhQmnw1f/wdB04t89/1O/w1cDnyilFU=" | gcloud secrets create line-channel-access-token --data-file=-

echo "c093c9b8e2c2e80ce48f039e6833f636" | gcloud secrets create line-channel-secret --data-file=-

echo "https://faenvzzeguvlconvrqgp.supabase.co" | gcloud secrets create supabase-url --data-file=-

echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8" | gcloud secrets create supabase-anon-key --data-file=-
```

## 4. 初回デプロイ（重要）

```powershell
cd C:\Users\user\line-booking-system

# Cloud Runへデプロイ
gcloud run deploy line-booking-api `
  --source . `
  --region asia-northeast1 `
  --platform managed `
  --allow-unauthenticated `
  --min-instances 0 `
  --max-instances 10 `
  --cpu 1 `
  --memory 512Mi `
  --timeout 60 `
  --update-secrets=LINE_CHANNEL_ACCESS_TOKEN=line-channel-access-token:latest,LINE_CHANNEL_SECRET=line-channel-secret:latest,SUPABASE_URL=supabase-url:latest,SUPABASE_ANON_KEY=supabase-anon-key:latest `
  --set-env-vars=NODE_ENV=production,STORE_ID=default-store,LIFF_ID=2006487876-xd1A5qJB
```

## 5. デプロイ後の確認

```powershell
# サービスURL取得
gcloud run services describe line-booking-api --region asia-northeast1 --format "value(status.url)"

# ヘルスチェック
curl https://line-booking-api-xxxxx-an.a.run.app/api/ping

# ログ確認
gcloud logging read "resource.type=cloud_run_revision" --limit 20
```

## 6. LINE Developers設定更新

1. [LINE Developers Console](https://developers.line.biz/)にログイン
2. SmartWeb Works 予約 Botを選択
3. Messaging API設定タブ
4. Webhook URLを更新：
   ```
   https://line-booking-api-xxxxx-an.a.run.app/webhook
   ```
5. Webhook: ON
6. 応答メッセージ: OFF

## 7. 動作テスト

LINEアプリで「予約」とメッセージを送信して返信確認

## ⚠️ トラブルシューティング

### APIが有効化されていない場合
```powershell
gcloud services list --available | Select-String "run"
```

### シークレットエラーの場合
```powershell
gcloud secrets list
gcloud secrets versions list line-channel-access-token
```

### デプロイ失敗の場合
```powershell
gcloud logging read "severity=ERROR" --limit 50
```

## 🎯 次回以降のデプロイ

Makefileを使用して簡単にデプロイ：

```bash
# 開発環境
make deploy-dev

# 本番環境
make deploy-prod
```

または直接コマンド：

```powershell
cd C:\Users\user\line-booking-system
gcloud run deploy line-booking-api --source . --region asia-northeast1
```