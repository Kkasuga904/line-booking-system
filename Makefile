# LINE Booking System - Makefile
# Windows環境でのGCP Cloud Runデプロイメント

.PHONY: help install setup deploy-dev deploy-prod test clean logs docker-build docker-run

# デフォルトプロジェクトID
PROJECT_ID ?= line-booking-mk-001
REGION ?= asia-northeast1
SERVICE_NAME ?= line-booking-api

# カラー出力用
RED := 
GREEN := 
YELLOW := 
BLUE := 
NC := 

help:
	@echo "LINE Booking System - 利用可能なコマンド:"
	@echo ""
	@echo "  make install       - 必要なパッケージをインストール"
	@echo "  make setup        - GCP初期設定"
	@echo "  make deploy-dev   - 開発環境へデプロイ"
	@echo "  make deploy-prod  - 本番環境へデプロイ" 
	@echo "  make test         - テスト実行"
	@echo "  make logs         - Cloud Runのログ表示"
	@echo "  make docker-build - Dockerイメージビルド"
	@echo "  make docker-run   - ローカルでDocker実行"
	@echo "  make clean        - 一時ファイル削除"

# 依存パッケージインストール
install:
	@echo "📦 パッケージインストール中..."
	npm install
	@echo "✅ インストール完了"

# GCP初期設定
setup:
	@echo "🔧 GCP設定中..."
	gcloud config set project $(PROJECT_ID)
	gcloud config set compute/region $(REGION)
	@echo "📋 必要なAPIを有効化中..."
	gcloud services enable run.googleapis.com
	gcloud services enable artifactregistry.googleapis.com
	gcloud services enable secretmanager.googleapis.com
	gcloud services enable cloudbuild.googleapis.com
	@echo "✅ セットアップ完了"

# 開発環境デプロイ
deploy-dev:
	@echo "🚀 開発環境へデプロイ中..."
	gcloud run deploy $(SERVICE_NAME)-dev \
		--source . \
		--region $(REGION) \
		--platform managed \
		--allow-unauthenticated \
		--min-instances 0 \
		--max-instances 5 \
		--cpu 1 \
		--memory 512Mi \
		--timeout 60 \
		--update-secrets=LINE_CHANNEL_ACCESS_TOKEN=line-channel-access-token:latest,LINE_CHANNEL_SECRET=line-channel-secret:latest,SUPABASE_URL=supabase-url:latest,SUPABASE_ANON_KEY=supabase-anon-key:latest \
		--set-env-vars=NODE_ENV=development,STORE_ID=***REMOVED-ROTATE-CREDENTIAL***,LIFF_ID=***REMOVED-ROTATE-CREDENTIAL***
	@echo "✅ デプロイ完了"
	@echo "📌 URL:"
	@gcloud run services describe $(SERVICE_NAME)-dev --region $(REGION) --format 'value(status.url)'

# 本番環境デプロイ
deploy-prod:
	@echo "⚠️  本番環境へのデプロイです。続行しますか？ [y/N]"
	@read -r confirm && [ "$$confirm" = "y" ] || exit 1
	@echo "🚀 本番環境へデプロイ中..."
	gcloud run deploy $(SERVICE_NAME) \
		--source . \
		--region $(REGION) \
		--platform managed \
		--allow-unauthenticated \
		--min-instances 0 \
		--max-instances 10 \
		--cpu 1 \
		--memory 512Mi \
		--timeout 60 \
		--update-secrets=LINE_CHANNEL_ACCESS_TOKEN=line-channel-access-token:latest,LINE_CHANNEL_SECRET=line-channel-secret:latest,SUPABASE_URL=supabase-url:latest,SUPABASE_ANON_KEY=supabase-anon-key:latest \
		--set-env-vars=NODE_ENV=production,STORE_ID=***REMOVED-ROTATE-CREDENTIAL***,LIFF_ID=***REMOVED-ROTATE-CREDENTIAL***
	@echo "✅ デプロイ完了"
	@echo "📌 URL:"
	@gcloud run services describe $(SERVICE_NAME) --region $(REGION) --format 'value(status.url)'

# テスト実行
test:
	@echo "🧪 テスト実行中..."
	npm test
	@echo "✅ テスト完了"

# ログ表示
logs:
	@echo "📜 Cloud Runログ表示中... (Ctrl+Cで終了)"
	gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$(SERVICE_NAME)" \
		--limit 50 \
		--format "value(timestamp,jsonPayload.message)"

# Dockerイメージビルド
docker-build:
	@echo "🐳 Dockerイメージビルド中..."
	docker build -t $(SERVICE_NAME) .
	@echo "✅ ビルド完了"

# ローカルDocker実行
docker-run:
	@echo "🐳 ローカルでDocker実行中..."
	docker run -p 8080:8080 --env-file .env.local $(SERVICE_NAME)

# 一時ファイル削除
clean:
	@echo "🧹 クリーンアップ中..."
	-rm -rf node_modules
	-rm -rf coverage
	-rm -rf .nyc_output
	-rm -rf *.log
	@echo "✅ クリーンアップ完了"

# ヘルスチェック
health:
	@echo "🏥 ヘルスチェック中..."
	@SERVICE_URL=$$(gcloud run services describe $(SERVICE_NAME) --region $(REGION) --format 'value(status.url)'); \
	if [ -n "$$SERVICE_URL" ]; then \
		curl -s $$SERVICE_URL/api/ping || echo "❌ サービスが応答しません"; \
	else \
		echo "❌ サービスURLが見つかりません"; \
	fi

# シークレット設定（初回のみ）
secrets:
	@echo "🔐 シークレット設定中..."
	@echo "LINE_CHANNEL_ACCESS_TOKEN を入力してEnter:"
	@read -r token && echo "$$token" | gcloud secrets create line-channel-access-token --data-file=-
	@echo "LINE_CHANNEL_SECRET を入力してEnter:"
	@read -r secret && echo "$$secret" | gcloud secrets create line-channel-secret --data-file=-
	@echo "SUPABASE_URL を入力してEnter:"
	@read -r url && echo "$$url" | gcloud secrets create supabase-url --data-file=-
	@echo "SUPABASE_ANON_KEY を入力してEnter:"
	@read -r key && echo "$$key" | gcloud secrets create supabase-anon-key --data-file=-
	@echo "✅ シークレット設定完了"

# プロジェクト情報表示
info:
	@echo "📊 プロジェクト情報:"
	@echo "  Project ID: $(PROJECT_ID)"
	@echo "  Region: $(REGION)"
	@echo "  Service: $(SERVICE_NAME)"
	@echo ""
	@echo "🌐 デプロイ済みサービス:"
	@gcloud run services list --region $(REGION)

# 予算アラート設定
budget:
	@echo "💰 予算アラート設定中..."
	@echo "請求先アカウントIDを入力してEnter:"
	@read -r billing_id && \
	gcloud billing budgets create \
		--billing-account=$$billing_id \
		--display-name="LINE Booking Budget" \
		--budget-amount=1000JPY \
		--threshold-rule=percent=50 \
		--threshold-rule=percent=90 \
		--threshold-rule=percent=100
	@echo "✅ 予算アラート設定完了"