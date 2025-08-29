# LIFF問題再発防止ガイド

## 🎯 目的
LIFFシステムエラーや設定ミスを防ぎ、確実に動作する予約システムを維持する

## 📋 チェックリスト

### デプロイ前チェック

```bash
# 自動チェックスクリプトの実行
node scripts/prevent-liff-issues.js
```

#### 手動確認項目
- [ ] LIFF_IDが環境変数に設定されている
- [ ] LINE Developersコンソールでエンドポイントに`.html`が付いている
- [ ] publicフォルダが.dockerignoreに含まれていない
- [ ] server.jsで静的ファイル配信が設定されている

### デプロイ後チェック

```bash
# 1. LIFF健康チェック
curl https://line-booking-api-116429620992.asia-northeast1.run.app/api/liff-health

# 2. LIFFページ直接アクセス確認
curl https://line-booking-api-116429620992.asia-northeast1.run.app/liff-calendar.html

# 3. LINEアプリでテスト
# 「予約」とメッセージを送信して、返信されたボタンが動作することを確認
```

## 🚨 よくある問題と対処法

### 1. システムエラー問題

**症状**: `https://liff.line.me/[LIFF_ID]`でシステムエラー

**原因と対処**:
```yaml
# LINE Developersコンソールで確認
❌ エンドポイント: https://[domain]/liff-calendar
✅ エンドポイント: https://[domain]/liff-calendar.html  # .html必須！
```

### 2. 404エラー問題

**症状**: LIFFページが見つからない

**原因と対処**:
```javascript
// server.js
app.use(express.static(path.join(__dirname, 'public'))); // 必須
```

```dockerfile
# Dockerfile
COPY . .  # publicフォルダを含める
```

### 3. 古いURL形式問題

**症状**: LIFFが開かない

**原因と対処**:
```javascript
// ❌ 古い形式
'https://line.me/R/app/2006487876-xd1A5qJB'

// ✅ 新しい形式
'https://liff.line.me/2006487876-xd1A5qJB'
```

## 🛠️ 実装済み対策

### 1. Flex Messageによるデュアルボタン

```javascript
// server.js - 「予約」メッセージ処理
{
  type: 'button',
  action: {
    type: 'uri',
    label: 'LINEで予約（推奨）',
    uri: `https://liff.line.me/${liffId}`  // LIFF URL
  }
},
{
  type: 'button',
  action: {
    type: 'uri',
    label: 'ブラウザで予約',
    uri: 'https://[domain]/liff-calendar.html'  // 直接URL
  }
}
```

### 2. 検証ユーティリティ

```javascript
// utils/liff-validator.js
const LIFFValidator = require('./utils/liff-validator');
const validator = new LIFFValidator();
const result = validator.validateConfig();

if (!result.isValid) {
  console.error('LIFF設定エラー:', result.errors);
}
```

### 3. 監視エンドポイント

```javascript
// GET /api/liff-health
{
  "status": "healthy",
  "liff": {
    "id": "2006487876-xd1A5qJB",
    "url": "https://liff.line.me/2006487876-xd1A5qJB",
    "directUrl": "https://[domain]/liff-calendar.html"
  },
  "validation": {
    "liffIdFormat": true,
    "envVarsSet": {
      "LIFF_ID": true,
      "BASE_URL": true
    }
  }
}
```

## 📝 環境変数設定テンプレート

```yaml
# .env.yaml
LIFF_ID: "2006487876-xd1A5qJB"
BASE_URL: "https://line-booking-api-116429620992.asia-northeast1.run.app"
LINE_CHANNEL_ACCESS_TOKEN: "YOUR_TOKEN"
LINE_CHANNEL_SECRET: "YOUR_SECRET"
SUPABASE_URL: "YOUR_SUPABASE_URL"
SUPABASE_ANON_KEY: "YOUR_SUPABASE_KEY"
STORE_ID: "default-store"
```

## 🔍 デバッグ手順

### 1. コンソールログ確認

```javascript
// ブラウザコンソールで確認
// 1. LIFF初期化エラー
// 2. ネットワークエラー
// 3. 404エラー
```

### 2. Cloud Runログ確認

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=line-booking-api" --limit=50
```

### 3. エンドポイントテスト

```bash
# APIテスト
curl https://[domain]/api/webhook
curl https://[domain]/api/liff-health
curl https://[domain]/liff-calendar.html
```

## 📊 監視項目

### 定期監視

1. **LIFF Health Check** - 5分ごと
2. **エンドポイント可用性** - 10分ごと
3. **エラー率** - リアルタイム

### アラート設定

```javascript
// エラー閾値
if (errorRate > 0.05) {  // 5%以上のエラー
  sendAlert('LIFF Error Rate High');
}

if (liffInitFailures > 10) {  // 初期化失敗が10回以上
  sendAlert('LIFF Init Failures');
}
```

## 🚀 デプロイフロー

```bash
# 1. 検証
node scripts/prevent-liff-issues.js

# 2. デプロイ
gcloud run deploy line-booking-api \
  --source . \
  --env-vars-file .env.yaml

# 3. 確認
curl https://[domain]/api/liff-health

# 4. テスト
# LINEアプリで「予約」送信
```

## 📚 関連ドキュメント

- [KNOWLEDGE_LIFF.md](./KNOWLEDGE_LIFF.md) - 詳細な技術ナレッジ
- [LIFF_CONFIGURATION.md](./LIFF_CONFIGURATION.md) - 設定ガイド
- [utils/liff-validator.js](./utils/liff-validator.js) - 検証ユーティリティ
- [scripts/prevent-liff-issues.js](./scripts/prevent-liff-issues.js) - チェックスクリプト

## ✅ 対策実施状況

- [x] LIFF URL形式修正（.html拡張子追加）
- [x] Flex Messageによるデュアルボタン実装
- [x] 検証ユーティリティ作成
- [x] 監視エンドポイント実装
- [x] 自動チェックスクリプト作成
- [x] ナレッジベース作成
- [x] 環境変数管理強化

## 📅 更新履歴

| 日付 | 内容 | 対応者 |
|------|------|--------|
| 2025-08-28 | 初版作成・LIFF問題修正 | Claude |
| - | システムエラー対策実装 | - |
| - | 再発防止コード実装 | - |