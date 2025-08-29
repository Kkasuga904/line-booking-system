# 🔧 GCP環境セットアップ完全ガイド

## 1. 必要なツールのインストール

### 📦 Google Cloud SDK（gcloud CLI）

```powershell
# PowerShellで実行
.\install-gcloud.ps1
```

または手動インストール：
1. https://cloud.google.com/sdk/docs/install にアクセス
2. Windows用インストーラーをダウンロード
3. インストーラーを実行（デフォルト設定でOK）

### 📦 Terraform

```powershell
# PowerShellで実行
.\install-terraform.ps1
```

または手動インストール：
1. https://www.terraform.io/downloads にアクセス
2. Windows AMD64版をダウンロード
3. C:\terraform に展開
4. システム環境変数のPATHに追加

### ✅ インストール確認

新しいコマンドプロンプトを開いて：

```cmd
gcloud --version
terraform --version
```

## 2. GCPアカウント作成

### 🆕 新規アカウント作成（$300無料クレジット付き）

1. **Googleアカウント準備**
   - 既存のGmailアカウントでOK
   - または新規作成: https://accounts.google.com/signup

2. **GCP無料トライアル登録**
   - https://cloud.google.com/free にアクセス
   - 「無料で利用開始」をクリック
   - 必要情報を入力：
     - 国: 日本
     - アカウントタイプ: 個人
     - クレジットカード情報（確認用、自動課金なし）

3. **初期プロジェクト作成**
   - 自動的に「My First Project」が作成される
   - または新規作成: https://console.cloud.google.com/projectcreate

### 💳 料金について

**無料枠：**
- 初回$300クレジット（90日間）
- Cloud Run: 200万リクエスト/月 無料
- Secret Manager: 1万アクセス/月 無料
- Cloud Build: 120分/月 無料

**課金防止設定：**
- 無料トライアル期間は自動課金されない
- 明示的にアップグレードしない限り課金なし

## 3. gcloud初期設定

```bash
# 1. ログイン（ブラウザが開きます）
gcloud auth login

# 2. プロジェクト作成
gcloud projects create line-booking-mk-001 --name="LINE Booking System"

# 3. プロジェクト設定
gcloud config set project line-booking-mk-001

# 4. リージョン設定
gcloud config set compute/region asia-northeast1

# 5. 必要なAPIを有効化
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

## 4. Billing Account設定（重要）

### 請求アカウントの確認

```bash
# 請求アカウント一覧
gcloud billing accounts list

# プロジェクトに請求アカウントをリンク
gcloud billing projects link line-booking-mk-001 \
  --billing-account=YOUR_BILLING_ACCOUNT_ID
```

### Budget Alert設定（課金防止）

```bash
# 予算アラート作成（1000円で通知）
gcloud billing budgets create \
  --billing-account=YOUR_BILLING_ACCOUNT_ID \
  --display-name="LINE Booking Budget" \
  --budget-amount=1000JPY \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100
```

## 5. サービスアカウント作成（CI/CD用）

```bash
# サービスアカウント作成
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Deploy"

# 権限付与
PROJECT_ID=line-booking-mk-001
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.admin"

# キー作成
gcloud iam service-accounts keys create ./gcp-key.json \
  --iam-account=github-actions@$PROJECT_ID.iam.gserviceaccount.com
```

## 6. 環境変数設定（Windows）

```powershell
# PowerShellで実行
[Environment]::SetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS", "C:\Users\user\line-booking-system\gcp-key.json", "User")
[Environment]::SetEnvironmentVariable("GCP_PROJECT", "line-booking-mk-001", "User")
```

## 7. 動作確認

```bash
# プロジェクト確認
gcloud projects describe line-booking-mk-001

# 認証確認
gcloud auth list

# API確認
gcloud services list --enabled

# Cloud Run確認（空のはず）
gcloud run services list --region=asia-northeast1
```

## 🚨 トラブルシューティング

### gcloudコマンドが見つからない
→ 新しいターミナルを開く or PCを再起動

### 認証エラー
```bash
gcloud auth application-default login
```

### プロジェクトIDが使えない
→ グローバルユニークなので別の名前に変更
例: line-booking-mk-20240828

### 請求先アカウントがない
→ GCPコンソールで請求先アカウントを作成
https://console.cloud.google.com/billing

## 📝 チェックリスト

- [ ] gcloud CLIインストール完了
- [ ] Terraformインストール完了
- [ ] GCPアカウント作成完了
- [ ] 無料トライアル有効化
- [ ] プロジェクト作成完了
- [ ] 必要なAPI有効化完了
- [ ] 予算アラート設定完了
- [ ] サービスアカウント作成完了

## 次のステップ

すべて完了したら：

```bash
# 初回デプロイ
cd C:\Users\user\line-booking-system
gcloud run deploy line-booking-api \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated
```

これで月額0円のLINE予約システムが動きます！