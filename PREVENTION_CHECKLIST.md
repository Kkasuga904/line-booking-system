# LINE予約システム 再発防止チェックリスト

## 🚨 よくある問題と対策

### 1. 予約が管理画面に表示されない問題

#### 原因
- store_idの不一致（account-001 vs default-store）
- 環境変数STORE_IDの設定ミス
- APIのハードコーディング

#### 予防策
```javascript
// ❌ 悪い例 - ハードコーディング
const storeId = 'account-001';

// ✅ 良い例 - 環境変数with フォールバック
const storeId = (process.env.STORE_ID || 'default-store').trim();
```

#### チェックスクリプト
```javascript
// scripts/check-store-consistency.js
import { createClient } from '@supabase/supabase-js';

async function checkStoreConsistency() {
  // 1. 環境変数確認
  console.log('環境変数STORE_ID:', process.env.STORE_ID || '未設定');
  
  // 2. 各APIファイルのstore_id確認
  const apis = [
    'api/calendar-reservation.js',
    'api/admin.js',
    'api/seats-manage.js'
  ];
  
  for (const api of apis) {
    // ファイル内のstore_id設定を確認
    console.log(`${api}: チェック必要`);
  }
  
  // 3. データベース内のstore_id分布確認
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data } = await supabase
    .from('reservations')
    .select('store_id')
    .limit(100);
  
  const storeCount = {};
  data.forEach(r => {
    storeCount[r.store_id] = (storeCount[r.store_id] || 0) + 1;
  });
  
  console.log('Store ID分布:', storeCount);
}
```

### 2. LINEからのレスポンスが返ってこない

#### 原因
- ES ModuleとCommonJSの混在
- 非同期処理のタイミング問題
- 環境変数（LINE_CHANNEL_ACCESS_TOKEN）未設定

#### 予防策
```javascript
// ✅ webhook処理のベストプラクティス
export default async function handler(req, res) {
  // 1. 即座に200を返す（重要！）
  res.status(200).json({ ok: true });
  
  // 2. その後で処理
  if (req.body?.events) {
    await processEvents(req.body.events);
  }
}
```

#### モジュール形式チェック
```bash
# package.jsonで統一
{
  "type": "module"  # ES Module固定
}

# 検証スクリプト実行
npm run validate:webhook
```

### 3. 予約フォーム送信エラー

#### 原因
- APIフィールド名の不一致（note vs message）
- 必須フィールドの欠如
- データ型の不一致

#### 予防策
```javascript
// ✅ フィールドマッピングの明示化
const reservationData = {
  store_id: storeId,              // 必須
  customer_name: name || 'ゲスト',  // デフォルト値
  date: date,                     // YYYY-MM-DD形式
  time: time + ':00',              // HH:MM:SS形式
  people: parseInt(people) || 1,   // 数値型
  message: note || '',             // messageフィールド（noteではない）
  phone: phone || null,            // nullable
  email: email || null,            // nullable
  user_id: userId || 'liff-user'   // デフォルトユーザー
};
```

### 4. 席データが表示されない

#### 原因
- is_activeフラグがfalse
- store_idの不一致
- is_lockedカラムが存在しない

#### 予防策
```sql
-- データベース初期化時に実行
ALTER TABLE seats 
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

-- 既存データの修正
UPDATE seats SET is_active = true WHERE store_id = 'default-store';
UPDATE seats SET is_locked = false WHERE is_locked IS NULL;
```

### 5. Vercelデプロイ制限

#### 原因
- Hobbyプランの制限（12関数、100デプロイ/日）

#### 予防策
```javascript
// APIファイル統合例
// ❌ 悪い例 - 個別ファイル
api/admin-auth.js
api/admin-create.js
api/admin-delete.js
api/admin-supabase.js

// ✅ 良い例 - 統合ファイル
api/admin.js?action=auth
api/admin.js?action=create
api/admin.js?action=delete
api/admin.js?action=supabase
```

## 🔧 デバッグ用ユーティリティ

### 環境変数チェック
```javascript
// scripts/check-env.js
const requiredEnvs = [
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_SECRET', 
  'LIFF_ID',
  'STORE_ID',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY'
];

requiredEnvs.forEach(env => {
  const value = process.env[env];
  if (!value) {
    console.error(`❌ ${env}: 未設定`);
  } else {
    console.log(`✅ ${env}: ${value.substring(0, 10)}...`);
  }
});
```

### データ整合性チェック
```javascript
// scripts/data-integrity-check.js
async function checkDataIntegrity() {
  const checks = [];
  
  // 1. 予約のstore_id確認
  const { data: reservations } = await supabase
    .from('reservations')
    .select('store_id')
    .is('store_id', null);
  
  if (reservations.length > 0) {
    checks.push(`⚠️ store_idがnullの予約: ${reservations.length}件`);
  }
  
  // 2. 席のis_active確認
  const { data: inactiveSeats } = await supabase
    .from('seats')
    .select('id')
    .eq('is_active', false);
  
  if (inactiveSeats.length > 0) {
    checks.push(`⚠️ 非アクティブな席: ${inactiveSeats.length}件`);
  }
  
  // 3. customer_nameの確認
  const { data: noNameReservations } = await supabase
    .from('reservations')
    .select('id')
    .or('customer_name.is.null,customer_name.eq.');
  
  if (noNameReservations.length > 0) {
    checks.push(`⚠️ 名前なし予約: ${noNameReservations.length}件`);
  }
  
  return checks;
}
```

## 📝 デプロイ前チェックリスト

```bash
# デプロイ前に必ず実行
npm run validate          # ES Module検証
npm run validate:webhook  # Webhook検証
vercel env ls production  # 環境変数確認
vercel ls                 # 関数数確認（12以下）
```

## 🚀 トラブルシューティングフロー

1. **問題発生時の初動**
   ```bash
   # ログ確認
   vercel logs
   
   # APIレスポンス確認
   curl https://line-booking-system-seven.vercel.app/api/admin?action=supabase
   
   # データベース直接確認
   node scripts/check-all-reservations.js
   ```

2. **store_id問題の解決**
   ```bash
   # 環境変数更新
   vercel env rm STORE_ID production
   vercel env add STORE_ID production
   # → "default-store"を入力
   
   # 再デプロイ
   vercel --prod
   ```

3. **Webhook問題の解決**
   ```bash
   # ヘルスチェック
   curl https://line-booking-system-seven.vercel.app/api/webhook-health
   
   # モジュール形式確認
   npm run validate:webhook
   ```

## 📌 重要な教訓

1. **環境変数は必ず`.trim()`する**
   - Vercelの環境変数は改行が混入することがある

2. **store_idは統一する**
   - すべてのAPIで同じstore_idを使用
   - ハードコーディングを避ける

3. **ES Moduleで統一**
   - CommonJSとの混在は避ける
   - package.jsonで`"type": "module"`を明示

4. **エラーログを詳細に**
   - console.logだけでなくconsole.errorも活用
   - エラーオブジェクト全体を出力

5. **APIレスポンスは必ず検証**
   - response.okをチェック
   - エラー時の詳細メッセージを取得

## 🔄 定期メンテナンス

### 週次チェック
- [ ] 予約データの整合性確認
- [ ] 席データのアクティブ状態確認
- [ ] エラーログの確認

### 月次チェック
- [ ] 環境変数の棚卸し
- [ ] 不要なAPIファイルの削除
- [ ] デプロイ履歴の確認

### 更新時チェック
- [ ] store_id設定の確認
- [ ] フィールド名の一致確認
- [ ] モジュール形式の統一確認