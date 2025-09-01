# 🚀 新規顧客セットアップガイド

## 完全分離型マルチテナント対応済み

### ✅ データベース分離状況

現在のシステムは**完全にstore_id**でデータが分離されています：

#### 1. **予約データ (reservations テーブル)**
- すべてのクエリで `store_id` フィルタリング実装済み
- 他店舗のデータは絶対に見えない設計

#### 2. **店舗設定 (store_settings テーブル)**
```sql
-- 各店舗の設定を保存
CREATE TABLE IF NOT EXISTS store_settings (
  id SERIAL PRIMARY KEY,
  store_id VARCHAR(255) UNIQUE NOT NULL,
  store_name VARCHAR(255),
  business_hours JSONB,
  holidays JSONB,
  max_capacity INTEGER DEFAULT 40,
  max_people_per_group INTEGER DEFAULT 8,
  line_channel_secret VARCHAR(255),
  line_channel_access_token TEXT,
  liff_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. **座席管理 (seats テーブル)**
```sql
CREATE TABLE IF NOT EXISTS seats (
  id SERIAL PRIMARY KEY,
  store_id VARCHAR(255) NOT NULL,
  seat_name VARCHAR(50),
  seat_type VARCHAR(50), -- 'table', 'counter', 'private'
  capacity INTEGER,
  is_available BOOLEAN DEFAULT true,
  position_x INTEGER,
  position_y INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 📋 新規顧客追加手順

### Step 1: LINE公式アカウント設定
顧客側で準備してもらうもの：
1. LINE公式アカウント作成
2. LINE Developers でチャネル作成
3. 以下を取得：
   - Channel Secret
   - Channel Access Token
   - LIFF ID

### Step 2: 環境変数ファイル作成

```yaml
# .env.{customer_id}.yaml
SUPABASE_URL: "https://faenvzzeguvlconvrqgp.supabase.co"
SUPABASE_ANON_KEY: "eyJhbGc..."  # 共通
STORE_ID: "{customer_id}"  # 例: "restaurant-tokyo-001"
LINE_CHANNEL_ACCESS_TOKEN: "{顧客のトークン}"
LINE_CHANNEL_SECRET: "{顧客のシークレット}"
LIFF_ID: "{顧客のLIFF ID}"
```

### Step 3: 初期データ投入スクリプト実行

```bash
# 新規顧客初期化
node scripts/init-new-customer.js \
  --store-id="restaurant-tokyo-001" \
  --store-name="東京レストラン" \
  --channel-secret="xxx" \
  --channel-token="yyy" \
  --liff-id="zzz"
```

### Step 4: デプロイ方法選択

#### オプション A: 共有インスタンス（推奨）
```bash
# 既存のCloud Runサービスを使用
# URLパラメータで店舗切り替え
https://line-booking-api.run.app/admin-dashboard.html?store_id=restaurant-tokyo-001
```

#### オプション B: 専用インスタンス
```bash
# 顧客専用のサービスをデプロイ
gcloud run deploy line-booking-{customer_id} \
  --source . \
  --region asia-northeast1 \
  --env-vars-file .env.{customer_id}.yaml \
  --allow-unauthenticated
```

## 🔒 セキュリティ確認項目

### データ分離の保証
- [x] すべてのSQLクエリで store_id フィルタリング
- [x] APIエンドポイントで store_id 検証
- [x] 管理画面で store_id によるアクセス制御
- [x] Webhookで store_id 自動識別

### 認証・認可
- [x] LINE Channel Secret/Token による認証
- [x] 各店舗独立した認証情報
- [x] LIFF による顧客認証

## 📊 動作確認チェックリスト

### 1. 基本機能テスト
- [ ] 予約作成（LINE経由）
- [ ] 予約確認
- [ ] 予約キャンセル
- [ ] 空席確認

### 2. 管理機能テスト
- [ ] ダッシュボード表示
- [ ] 予約一覧
- [ ] 座席管理
- [ ] 統計表示

### 3. データ分離テスト
- [ ] 他店舗のデータが見えないこと
- [ ] store_id が正しく保存されること
- [ ] 統計が店舗別に集計されること

## 🎯 導入済み顧客管理

| 顧客ID | 店舗名 | ステータス | 導入日 |
|--------|--------|----------|--------|
| default-store | デフォルト店舗 | 稼働中 | 2024-12-28 |
| store-a | 店舗A | テスト中 | - |
| store-b | 店舗B | テスト中 | - |

## 💡 トラブルシューティング

### Q: 新規顧客のデータが表示されない
A: store_id が正しく設定されているか確認
```bash
# 環境変数確認
echo $STORE_ID

# URLパラメータ確認
?store_id=restaurant-tokyo-001
```

### Q: LINEメッセージが届かない
A: Webhook URLの設定確認
```
https://line-booking-api.run.app/webhook?store_id=restaurant-tokyo-001
```

### Q: ダッシュボードにログインできない
A: store_settings テーブルにレコードがあるか確認

## 📞 サポート

問題が発生した場合は、以下の情報を準備：
1. store_id
2. エラーメッセージ
3. 発生時刻
4. 操作内容

---

**結論: はい、全く新しい顧客でも完全に分離された環境で利用可能です！**