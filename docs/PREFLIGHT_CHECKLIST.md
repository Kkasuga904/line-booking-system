# 🚀 マルチテナント本番デプロイ - 事前チェックリスト

## 1. 環境変数・シークレット確認

### 1-1. Cloud Run 環境変数（アカウント1: A店）
```bash
# 現在の環境変数確認
gcloud run services describe line-booking-api \
  --region=asia-northeast1 \
  --format="export" | grep -E "STORE_ID|SUPABASE|LINE|LIFF"
```

必須環境変数:
- [ ] `STORE_ID=store-a`
- [ ] `SUPABASE_URL=https://faenvzzeguvlconvrqgp.supabase.co`
- [ ] `SUPABASE_ANON_KEY=<your-anon-key>`
- [ ] `SUPABASE_SERVICE_ROLE_KEY=<your-service-key>`
- [ ] `LINE_CHANNEL_SECRET_STORE_A=<store-a-secret>`
- [ ] `LINE_CHANNEL_ACCESS_TOKEN_STORE_A=<store-a-token>`
- [ ] `LIFF_ID_STORE_A=<store-a-liff-id>`

### 1-2. Secret Manager確認
```bash
# シークレット一覧
gcloud secrets list --filter="labels.store=store-a"

# シークレットの存在確認
gcloud secrets versions access latest --secret="line-channel-secret-store-a"
gcloud secrets versions access latest --secret="line-access-token-store-a"
```

### 1-3. 設定ファイル検証
```bash
# ローカルで設定検証
node -e "
const { loadValidatedConfig } = require('./utils/store-config-validated');
loadValidatedConfig('store-a')
  .then(config => {
    console.log('✅ Config OK for store-a');
    console.log('  Store Name:', config.ui.storeName);
    console.log('  Theme:', config.ui.theme.primaryColor);
    console.log('  Hours:', config.booking.open, '-', config.booking.close);
  })
  .catch(err => console.error('❌ Config Error:', err.message));
"
```

## 2. コード準備確認

### 2-1. 必須ファイル存在確認
```bash
# チェック対象ファイル
ls -la config/store/store-a.json
ls -la utils/store-config.js
ls -la utils/store-config-validated.js
ls -la utils/logger.js
```

### 2-2. 予約作成経路確認
```bash
# RPC経由のみであることを確認（直INSERTなし）
grep -r "insert.*reservations" api/ --include="*.js" | grep -v "rpc"
```

### 2-3. ログ出力確認
```bash
# logger.js経由でstore_id出力されているか
grep -r "console.log\|console.error" api/ --include="*.js" | grep -v "logger"
```

## 3. データベース準備

### 3-1. Supabase RPC関数確認
```sql
-- 必要なRPC関数が存在するか確認
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION'
AND routine_name IN (
  'create_reservation_with_checks',
  'get_customer_info',
  'assign_seat_to_reservation'
);
```

### 3-2. トリガー確認
```sql
-- 容量チェックトリガーの存在確認
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND table_name = 'reservations';
```

## 4. デプロイ前の最終確認

### 4-1. ブランチ状態
```bash
# 正しいブランチにいるか
git branch --show-current  # unify/tenant-ready であること

# 最新の変更がコミットされているか
git status

# リモートと同期しているか
git fetch origin
git status -uno
```

### 4-2. ビルド確認
```bash
# Dockerビルドが成功するか（ローカル）
docker build -t line-booking-test .
docker run -e STORE_ID=store-a -p 8080:8080 line-booking-test
```

### 4-3. ローカルスモークテスト
```bash
# A店設定でテスト
export STORE_ID=store-a
npm run dev

# 別ターミナルで
npm run test:store-a
```

## 5. アカウント2準備（並行作業）

### 5-1. コード同期
```bash
# アカウント2のリポジトリに同じコードをプッシュ
git remote add account2 <account2-repo-url>
git push account2 unify/tenant-ready
```

### 5-2. 環境変数準備（アカウント2）
```bash
# Secret Manager にシークレット作成
gcloud secrets create line-channel-secret-store-a \
  --data-file=- \
  --project=<account2-project>

gcloud secrets create line-access-token-store-a \
  --data-file=- \
  --project=<account2-project>
```

## ✅ チェック完了確認

すべてのチェックが完了したら、以下を実行:

### アカウント1（主戦場）
```bash
# カナリアデプロイ（10%トラフィック）
./scripts/deploy-canary.sh store-a account1 10
```

### アカウント2（スタンバイ）
```bash
# デプロイのみ（トラフィックなし）
./scripts/deploy-standby.sh store-a account2
```

## 📊 監視開始

デプロイ後、以下を監視:
- Cloud Run ダッシュボード
- ログ（store_id でフィルタ）
- エラー率
- レイテンシ

24-48時間問題なければ、トラフィックを100%に切り替え。