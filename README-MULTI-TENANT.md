# LINE予約システム マルチテナント構成ガイド

## 🎯 概要

このシステムは、複数のLINE公式アカウントを独立して運用できるマルチテナント構成です。
各テナント（店舗）は独自のLINEアカウント、Webhook URL、データストレージを持ち、相互に影響しません。

## 🏗️ アーキテクチャ

```
単一ドメイン (app.yourdomain.com)
    ├── /tenant-a/webhook → テナントA専用
    ├── /tenant-b/webhook → テナントB専用
    └── /tenant-c/webhook → テナントC専用
```

### 主な特徴

- ✅ **独立運用**: 各テナントは完全に独立
- ✅ **単一URL**: サブパスで複数テナントを管理
- ✅ **CI/CD対応**: GitHub Actionsで自動デプロイ
- ✅ **個別更新可能**: 特定テナントのみの更新が可能
- ✅ **データ分離**: 各テナントのデータは完全分離

## 🚀 クイックスタート

### 1. 環境設定

```bash
# リポジトリのクローン
git clone https://github.com/your-org/line-booking-system.git
cd line-booking-system

# 環境変数ファイルの作成
cp env.example .env.production
```

### 2. 環境変数の設定

`.env.production`を編集し、各テナントのLINE認証情報を設定:

```env
# テナントA
TENANT_A_CHANNEL_ACCESS_TOKEN=your_token_here
TENANT_A_CHANNEL_SECRET=your_secret_here

# テナントB
TENANT_B_CHANNEL_ACCESS_TOKEN=your_token_here
TENANT_B_CHANNEL_SECRET=your_secret_here
```

### 3. デプロイ

```bash
# 全テナントをデプロイ
./deploy.sh all production

# 特定テナントのみデプロイ
./deploy.sh tenant-a production
```

## 📝 LINE Developers Console設定

各LINEアカウントで以下のWebhook URLを設定:

| テナント | Webhook URL |
|---------|------------|
| テナントA | `https://app.yourdomain.com/tenant-a/webhook` |
| テナントB | `https://app.yourdomain.com/tenant-b/webhook` |
| テナントC | `https://app.yourdomain.com/tenant-c/webhook` |

## 🔧 運用管理

### ローカル開発

```bash
# Docker Composeで起動
docker-compose up -d

# 特定テナントのログ確認
docker-compose logs -f tenant-a

# 全テナントの状態確認
docker-compose ps
```

### 管理画面アクセス

- テナントA: http://localhost:3001/admin
- テナントB: http://localhost:3002/admin
- テナントC: http://localhost:3003/admin

## 🔄 CI/CD パイプライン

GitHub Actionsによる自動デプロイ:

1. `main`ブランチへのpush時に自動デプロイ
2. 特定テナントのみの更新も可能
3. 自動ロールバック機能付き

### 手動デプロイ

GitHub Actionsの「Run workflow」から:
- Tenant選択: 特定テナントまたは全て
- Branch選択: main/production

## 📊 モニタリング

### ヘルスチェック

```bash
# 全テナントの状態確認
curl http://app.yourdomain.com/health

# 特定テナントのAPI確認
curl http://app.yourdomain.com/tenant-a/api/info
```

### ログ確認

```bash
# リアルタイムログ
docker-compose logs -f tenant-a

# エラーログのみ
docker-compose logs tenant-a | grep ERROR
```

## 🆕 新規テナント追加

### 1. docker-compose.ymlに追加

```yaml
tenant-d:
  build: .
  container_name: line-booking-tenant-d
  environment:
    - TENANT_ID=tenant-d
    - PORT=3004
    # ... その他の設定
```

### 2. Nginx設定を更新

```nginx
location /tenant-d/ {
    proxy_pass http://tenant-d:3004/;
    # ... プロキシ設定
}
```

### 3. 環境変数を追加

```env
TENANT_D_CHANNEL_ACCESS_TOKEN=xxx
TENANT_D_CHANNEL_SECRET=xxx
```

### 4. デプロイ

```bash
./deploy.sh tenant-d production
```

## 🔒 セキュリティ

- SSL/TLS暗号化（Let's Encrypt推奨）
- 環境変数によるシークレット管理
- GitHub Secretsでの認証情報保護
- 各テナントのデータ完全分離

## 🐛 トラブルシューティング

### コンテナが起動しない

```bash
# ログ確認
docker-compose logs tenant-a

# 環境変数確認
docker-compose config
```

### Webhookが受信できない

1. Webhook URLが正しいか確認
2. SSL証明書が有効か確認
3. Nginxのプロキシ設定を確認

### データベースエラー

```bash
# データディレクトリの権限確認
ls -la ./data/tenant-a/

# 権限修正
chmod -R 755 ./data/
```

## 📚 ドキュメント

- [アーキテクチャ詳細](./multi-tenant-architecture.md)
- [API仕様書](./docs/api.md)
- [運用マニュアル](./docs/operations.md)

## 📞 サポート

問題が発生した場合は、以下をご確認ください:

1. このREADMEのトラブルシューティング
2. [GitHub Issues](https://github.com/your-org/line-booking-system/issues)
3. システムログ（`docker-compose logs`）

---

© 2025 LINE Booking System - Multi-Tenant Edition