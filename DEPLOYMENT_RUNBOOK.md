# 📘 マルチテナント本番デプロイ実行手順書

## 🎯 目標
A店（store-a）をカナリアデプロイ → 監視 → 全量切替 → B店展開

## 📋 事前準備チェック

### 1. シークレット作成（初回のみ）
```bash
# アカウント1
PROJECT_ID="line-booking-prod-20241228"

# LINE Channel Secret
echo -n "YOUR_LINE_CHANNEL_SECRET_FOR_STORE_A" | \
  gcloud secrets create line-channel-secret-store-a \
  --data-file=- \
  --project=$PROJECT_ID

# LINE Access Token  
echo -n "YOUR_LINE_ACCESS_TOKEN_FOR_STORE_A" | \
  gcloud secrets create line-access-token-store-a \
  --data-file=- \
  --project=$PROJECT_ID

# Supabase Service Role Key
echo -n "YOUR_SUPABASE_SERVICE_ROLE_KEY" | \
  gcloud secrets create supabase-service-role-key \
  --data-file=- \
  --project=$PROJECT_ID
```

### 2. 設定ファイル確認
```bash
# 設定検証
node -e "
const { loadValidatedConfig } = require('./utils/store-config-validated');
Promise.all([
  loadValidatedConfig('store-a'),
  loadValidatedConfig('store-b')
]).then(configs => {
  console.log('✅ All configs valid');
  configs.forEach(c => console.log('  -', c.ui.storeName || c.storeId));
}).catch(err => {
  console.error('❌ Config error:', err.message);
  process.exit(1);
});
"
```

## 🚀 フェーズ1: A店カナリアデプロイ（アカウント1）

### Step 1: カナリアデプロイ（10%）
```bash
# 実行権限付与
chmod +x scripts/deploy-canary.sh

# A店を10%トラフィックでデプロイ
./scripts/deploy-canary.sh store-a account1 10
```

### Step 2: スモークテスト
```bash
# 本番URLでテスト
export TEST_URL=https://line-booking-api-116429620992.asia-northeast1.run.app
export STORE_ID=store-a
npm run smoke-test

# タグ付きURLで直接テスト
curl https://account1-store-a---line-booking-api-116429620992.asia-northeast1.run.app/api/health
```

### Step 3: ログ監視（15分）
```bash
# store_id でフィルタしてログ確認
gcloud logging tail \
  "resource.type=cloud_run_revision AND jsonPayload.store_id=store-a" \
  --project=line-booking-prod-20241228

# エラーログのみ
gcloud logging tail \
  "resource.type=cloud_run_revision AND severity>=ERROR AND jsonPayload.store_id=store-a" \
  --project=line-booking-prod-20241228
```

### Step 4: メトリクス確認
```bash
# Cloud Runダッシュボード
open https://console.cloud.google.com/run/detail/asia-northeast1/line-booking-api/metrics?project=line-booking-prod-20241228

# 確認項目:
# - 5xx エラー率 < 0.1%
# - P95 レイテンシ < 1秒
# - CPU使用率 < 80%
# - メモリ使用率 < 80%
```

## ⏰ 24時間監視期間

### 監視チェックリスト（1時間ごと）
- [ ] エラー率確認
- [ ] レイテンシ確認
- [ ] ログに store_id が含まれているか
- [ ] 予約作成/キャンセルが正常動作
- [ ] 容量制限が機能している

### 問題なければ Step 5 へ

## ✅ フェーズ2: A店全量切替

### Step 5: トラフィック100%
```bash
# A店に全トラフィック
./scripts/deploy-canary.sh store-a account1 100
```

### Step 6: 最終確認（30分）
```bash
# 全量切替後の監視
gcloud logging tail \
  "resource.type=cloud_run_revision AND jsonPayload.store_id=store-a" \
  --project=line-booking-prod-20241228
```

## 🔄 フェーズ3: アカウント2同期（スタンバイ）

### Step 7: コード同期
```bash
# アカウント2のリポジトリ設定（初回のみ）
git remote add account2 https://github.com/[ACCOUNT2_REPO].git

# コードをプッシュ
git push account2 unify/tenant-ready
```

### Step 8: アカウント2にシークレット作成
```bash
PROJECT_ID="line-booking-prod-account2"  # 要変更

# 同じ手順でシークレット作成
echo -n "YOUR_LINE_CHANNEL_SECRET_FOR_STORE_A" | \
  gcloud secrets create line-channel-secret-store-a \
  --data-file=- \
  --project=$PROJECT_ID
# ... (他のシークレットも同様)
```

### Step 9: スタンバイデプロイ
```bash
# トラフィックなしでデプロイ
./scripts/deploy-standby.sh store-a account2

# ヘルスチェック
curl https://account2-store-a---[ACCOUNT2_URL]/api/health
```

## 🏪 フェーズ4: B店展開

### Step 10: B店設定追加
```bash
# config/store/store-b.json が存在することを確認
ls -la config/store/store-b.json

# B店のシークレット作成（両アカウント）
echo -n "YOUR_LINE_CHANNEL_SECRET_FOR_STORE_B" | \
  gcloud secrets create line-channel-secret-store-b \
  --data-file=- \
  --project=$PROJECT_ID
```

### Step 11: B店カナリアデプロイ
```bash
# アカウント1でB店開始
./scripts/deploy-canary.sh store-b account1 10

# テスト
export STORE_ID=store-b
npm run smoke-test
```

### Step 12: B店も同じ流れで展開
A店と同じ手順（監視 → 全量 → アカウント2）を繰り返す

## 🔙 ロールバック手順

### 即座にロールバック
```bash
# 前のバージョンに100%戻す
gcloud run services update-traffic line-booking-api \
  --to-revisions PREVIOUS_REVISION=100 \
  --region asia-northeast1 \
  --project=line-booking-prod-20241228
```

### タグ付きバージョンを削除
```bash
gcloud run services update-traffic line-booking-api \
  --remove-tags account1-store-a \
  --region asia-northeast1 \
  --project=line-booking-prod-20241228
```

## 📊 成功基準

### A店デプロイ成功の判定
- ✅ 24時間エラー率 < 0.1%
- ✅ P95レイテンシ < 1秒
- ✅ すべてのログに store_id 含まれる
- ✅ 予約作成/キャンセル正常動作
- ✅ 容量制限が機能

### 最終ゴール
- ✅ A店・B店が独立して動作
- ✅ 両アカウントで同じコードベース
- ✅ 店舗追加が設定ファイルのみで可能

## 🆘 トラブルシューティング

### ログに store_id がない
```bash
# 問題のあるAPIを特定
gcloud logging read \
  "resource.type=cloud_run_revision AND jsonPayload.store_id=unknown" \
  --limit 10 \
  --project=$PROJECT_ID
```

### 設定エラー
```bash
# 設定の再検証
node -e "
const { loadValidatedConfig } = require('./utils/store-config-validated');
loadValidatedConfig('store-a')
  .then(c => console.log('Config OK:', JSON.stringify(c, null, 2)))
  .catch(e => console.error('Config Error:', e));
"
```

### シークレットアクセスエラー
```bash
# IAM権限確認
gcloud run services describe line-booking-api \
  --region asia-northeast1 \
  --format="value(spec.template.spec.serviceAccountName)"

# サービスアカウントに権限付与
gcloud secrets add-iam-policy-binding line-channel-secret-store-a \
  --member="serviceAccount:SERVICE_ACCOUNT@PROJECT.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 📝 運用メモ

- カナリアは最低24時間維持
- 週末や深夜のデプロイは避ける
- 必ず2人以上で確認しながら実施
- ロールバック手順を事前に確認

---
最終更新: 2024-12-31
次回レビュー: デプロイ完了後