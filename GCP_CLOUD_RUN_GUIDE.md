# 🚀 LINE予約システム - GCP Cloud Run デプロイガイド

## 📋 プロジェクト情報

- **GCPプロジェクトID**: `line-booking-prod-20241228`
- **サービスURL**: `https://line-booking-api-116429620992.asia-northeast1.run.app`
- **リージョン**: `asia-northeast1`（東京）

## 🔧 デプロイ手順

### 1. 前提条件

- Google Cloud SDK インストール済み
- GCPプロジェクト作成済み
- 課金アカウント設定済み

### 2. 簡単デプロイ（バッチファイル使用）

```bash
cd line-booking-system
deploy-to-gcp-prod.bat
```

環境変数を入力：
- LINE Channel Secret
- LINE Channel Access Token  
- Supabase URL
- Supabase Anon Key

### 3. 手動デプロイ

```bash
# プロジェクト設定
gcloud config set project line-booking-prod-20241228

# APIを有効化
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com

# Artifact Registryリポジトリ作成
gcloud artifacts repositories create line-booking \
  --repository-format=docker \
  --location=asia-northeast1

# Cloud Buildでデプロイ
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_LINE_CHANNEL_SECRET="xxx",_LINE_CHANNEL_ACCESS_TOKEN="xxx",_SUPABASE_URL="xxx",_SUPABASE_ANON_KEY="xxx" \
  --region=asia-northeast1
```

## 🔍 デプロイ確認

### ヘルスチェック
```bash
curl https://line-booking-api-116429620992.asia-northeast1.run.app/api/ping
```

### ログ確認
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=line-booking-api" --limit 50
```

### サービス詳細
```bash
gcloud run services describe line-booking-api --region asia-northeast1
```

## 📝 LINE Webhook設定

1. LINE Developers Consoleにログイン
2. Messaging API設定を開く
3. Webhook URLに以下を設定：
   ```
   https://line-booking-api-116429620992.asia-northeast1.run.app/api/webhook
   ```
4. Webhookの利用をONに設定
5. 応答メッセージをOFFに設定

## 💰 コスト管理

### 推定月額コスト
- Cloud Run: 約$10-30（トラフィック依存）
- Artifact Registry: 約$1-5
- Cloud Build: 約$0.003/ビルド分

### コスト最適化設定
```bash
# 最小インスタンス数を0に設定（コールドスタート許容）
gcloud run services update line-booking-api \
  --min-instances=0 \
  --region=asia-northeast1

# 最大インスタンス数を制限
gcloud run services update line-booking-api \
  --max-instances=10 \
  --region=asia-northeast1
```

## 🚨 トラブルシューティング

### デプロイエラー
```bash
# ビルドログ確認
gcloud builds list --limit=5

# 詳細ログ
gcloud builds log <BUILD_ID>
```

### 500エラー
```bash
# エラーログ確認
gcloud logging read "severity>=ERROR AND resource.type=cloud_run_revision" --limit=20
```

### 認証エラー
```bash
# サービスアカウント確認
gcloud iam service-accounts list

# 権限付与
gcloud projects add-iam-policy-binding line-booking-prod-20241228 \
  --member="serviceAccount:line-booking-api@line-booking-prod-20241228.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

## 🔄 更新とロールバック

### アプリケーション更新
```bash
# コード変更後
cd line-booking-system
deploy-to-gcp-prod.bat
```

### ロールバック
```bash
# 前のリビジョンに100%トラフィックを戻す
gcloud run services update-traffic line-booking-api \
  --to-revisions=PREV=100 \
  --region=asia-northeast1
```

## 📊 モニタリング

### Cloud Console
https://console.cloud.google.com/run/detail/asia-northeast1/line-booking-api/metrics?project=line-booking-prod-20241228

### コマンドライン
```bash
# リアルタイムログ
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=line-booking-api"

# メトリクス確認
gcloud monitoring metrics-descriptors list --filter="metric.type:run.googleapis.com"
```

## 🔐 セキュリティ

### シークレット管理
```bash
# Secret Managerにシークレット作成
echo -n "your-secret-value" | gcloud secrets create line-channel-secret --data-file=-

# Cloud Runでシークレット使用
gcloud run services update line-booking-api \
  --set-secrets=LINE_CHANNEL_SECRET=line-channel-secret:latest \
  --region=asia-northeast1
```

### IAMポリシー
```bash
# 特定のユーザーのみデプロイ可能に
gcloud run services add-iam-policy-binding line-booking-api \
  --member="user:your-email@gmail.com" \
  --role="roles/run.developer" \
  --region=asia-northeast1
```