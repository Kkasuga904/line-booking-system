#!/bin/bash

# GCP初期セットアップスクリプト
# 使用方法: ./scripts/setup-gcp.sh <PROJECT_ID>

set -e

PROJECT_ID=${1:-"line-booking-dev"}
REGION="asia-northeast1"
SERVICE_ACCOUNT="github-actions"

echo "🚀 GCP Project Setup: $PROJECT_ID"
echo "================================"

# プロジェクト作成（既存の場合はスキップ）
echo "1. Creating project..."
gcloud projects create $PROJECT_ID --name="LINE Booking System" 2>/dev/null || echo "Project already exists"

# プロジェクト設定
gcloud config set project $PROJECT_ID

# 必要なAPIを有効化
echo "2. Enabling APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  monitoring.googleapis.com \
  logging.googleapis.com \
  cloudbuild.googleapis.com

# Artifact Registry作成
echo "3. Creating Artifact Registry..."
gcloud artifacts repositories create line-booking-system \
  --repository-format=docker \
  --location=$REGION \
  --description="LINE Booking System Docker images" \
  2>/dev/null || echo "Repository already exists"

# Service Account作成（GitHub Actions用）
echo "4. Creating Service Account..."
gcloud iam service-accounts create $SERVICE_ACCOUNT \
  --display-name="GitHub Actions Deployment" \
  2>/dev/null || echo "Service account already exists"

# 権限付与
echo "5. Granting permissions..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# サービスアカウントキー作成
echo "6. Creating service account key..."
gcloud iam service-accounts keys create ./gcp-key.json \
  --iam-account=$SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add the following secrets to GitHub:"
echo "   - GCP_PROJECT_ID_DEV: $PROJECT_ID"
echo "   - GCP_SA_KEY_DEV: $(cat gcp-key.json | base64 -w 0)"
echo ""
echo "2. Run Terraform to create infrastructure:"
echo "   cd infra/terraform/dev"
echo "   terraform init"
echo "   terraform plan -var=\"project_id=$PROJECT_ID\""
echo "   terraform apply -var=\"project_id=$PROJECT_ID\""
echo ""
echo "3. Deploy the application:"
echo "   git push origin dev"