# 📋 LINE予約システム GCP Cloud Run デプロイ手順書

## 🎯 今すぐデプロイする手順

### 1️⃣ Google Cloud SDK Shellを開く
デスクトップの「Google Cloud SDK Shell」をダブルクリックして開きます。

### 2️⃣ プロジェクトディレクトリに移動
```bash
cd C:\Users\user\line-booking-system
```

### 3️⃣ GCPプロジェクトを設定
```bash
gcloud config set project line-booking-prod-20241228
```

### 4️⃣ 必要なAPIを有効化（初回のみ）
```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```
※ 3-5分かかる場合があります

### 5️⃣ Artifact Registryリポジトリ作成（初回のみ）
```bash
gcloud artifacts repositories create line-booking --repository-format=docker --location=asia-northeast1
```

### 6️⃣ Docker認証設定
```bash
gcloud auth configure-docker asia-northeast1-docker.pkg.dev
```
※ 「Do you want to continue (Y/n)?」と聞かれたら「Y」を入力

### 7️⃣ Dockerイメージをビルド
```bash
docker build -t asia-northeast1-docker.pkg.dev/line-booking-prod-20241228/line-booking/line-booking-api:latest .
```
※ 3-5分かかります

### 8️⃣ Dockerイメージをプッシュ
```bash
docker push asia-northeast1-docker.pkg.dev/line-booking-prod-20241228/line-booking/line-booking-api:latest
```
※ 2-3分かかります

### 9️⃣ Cloud Runにデプロイ
```bash
gcloud run deploy line-booking-api --image asia-northeast1-docker.pkg.dev/line-booking-prod-20241228/line-booking/line-booking-api:latest --platform managed --region asia-northeast1 --allow-unauthenticated --memory 512Mi --cpu 1 --min-instances 1 --max-instances 100 --port 8080
```
※ 1-2分かかります

### 🔟 環境変数を設定

実際の値を入れて以下のコマンドを実行：

```bash
gcloud run services update line-booking-api --region asia-northeast1 --set-env-vars LINE_CHANNEL_SECRET=あなたのシークレット,LINE_CHANNEL_ACCESS_TOKEN=あなたのトークン,SUPABASE_URL=あなたのSupabase URL,SUPABASE_ANON_KEY=あなたのSupabase Key
```

## ✅ デプロイ確認

### サービスURLの確認
```bash
gcloud run services describe line-booking-api --region asia-northeast1 --format "value(status.url)"
```

出力例：
```
https://line-booking-api-xxxxx.asia-northeast1.run.app
```

### Webhook URLの設定
LINE Developers Consoleで以下のURLを設定：
```
https://line-booking-api-xxxxx.asia-northeast1.run.app/api/webhook
```

## 🚨 トラブルシューティング

### エラー: "project not found"
```bash
gcloud auth login
```
でログインしてから再度実行

### エラー: "docker command not found"
Docker Desktopを起動してから再実行

### エラー: "permission denied"
```bash
gcloud auth application-default login
```
を実行してから再試行

## 🔄 更新時の手順

コード変更後：
1. ステップ7（Dockerビルド）から実行
2. ステップ8（Dockerプッシュ）
3. ステップ9（Cloud Runデプロイ）

## 📊 デプロイ状況確認

### ログ確認
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=line-booking-api" --limit 20
```

### サービス状態確認
```bash
gcloud run services list --region asia-northeast1
```

## 💡 ワンクリックデプロイ

全ての手順を自動実行したい場合：
```bash
RUN_DEPLOY_NOW.bat
```
をダブルクリックで実行