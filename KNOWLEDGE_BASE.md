# LINE予約システム ナレッジベース

## 🎯 システム概要

### アーキテクチャ
```
LINE Bot → Webhook → LIFF → Calendar → Reservation API → Supabase DB
                                      ↓
                              Admin Panel ← Admin API
```

### 主要コンポーネント
- **LINE Bot**: ユーザーインターフェース
- **LIFF (LINE Front-end Framework)**: LINE内ブラウザで動作する予約フォーム
- **Vercel Functions**: サーバーレスAPI
- **Supabase**: PostgreSQLデータベース

## 📁 ファイル構成と役割

```
line-booking-system/
├── api/
│   ├── webhook-simple.js      # LINEメッセージ受信・返信
│   ├── calendar-reservation.js # 予約作成API
│   ├── admin.js               # 管理画面API（統合版）
│   ├── seats-manage.js        # 席管理API
│   └── calendar-slots.js      # 予約済み時間取得
├── public/
│   ├── index.html             # 予約一覧画面
│   ├── admin-calendar-v2.html # カレンダー管理画面
│   ├── liff-calendar-v2.html  # LIFF予約カレンダー
│   └── seats-management.html  # 席管理画面
└── vercel.json               # ルーティング設定
```

## 🔑 重要な設定値

### 環境変数（Vercel）
```bash
LINE_CHANNEL_ACCESS_TOKEN  # LINE Bot用トークン
LINE_CHANNEL_SECRET        # LINE Bot認証用
LIFF_ID                   # 2006487876-xd1A5qJB（現在の値）
STORE_ID                  # default-store（重要！）
SUPABASE_URL              # https://faenvzzeguvlconvrqgp.supabase.co
SUPABASE_ANON_KEY         # Supabaseアクセスキー
```

### データベーススキーマ

#### reservations テーブル
```sql
- id: integer (PK)
- store_id: text          # 店舗ID（default-store）
- customer_name: text      # 顧客名
- date: date              # 予約日
- time: time              # 予約時間
- people: integer         # 人数
- message: text           # メッセージ
- status: text            # pending/confirmed/cancelled
- phone: text             # 電話番号
- email: text             # メールアドレス
- seat_id: uuid           # 席ID（FK）
- user_id: text           # ユーザーID
- created_at: timestamp
- updated_at: timestamp
```

#### seats テーブル
```sql
- id: uuid (PK)
- store_id: text          # 店舗ID
- name: text              # 席名
- seat_type: text         # chair/table/room/counter
- capacity: integer       # 収容人数
- description: text       # 説明
- is_active: boolean      # 有効フラグ
- is_locked: boolean      # ロック状態
- display_order: integer  # 表示順
```

## 🐛 トラブルシューティング

### Case 1: 予約が管理画面に表示されない

**症状**: LINEから予約しても管理画面に反映されない

**原因**: store_idの不一致
- 予約: account-001に保存
- 管理画面: default-storeを表示

**解決方法**:
```javascript
// calendar-reservation.js を修正
const storeId = store_id || process.env.STORE_ID || 'default-store';

// admin.js も同様に修正
const storeId = (process.env.STORE_ID || 'default-store').trim();
```

### Case 2: LINEメッセージの返信が来ない

**症状**: 「予約」と送っても返信なし

**原因**: 
1. ES Module形式エラー
2. 環境変数未設定
3. 非同期処理タイミング

**解決方法**:
```javascript
// webhook-simple.js
export default async function handler(req, res) {
  // 1. 即座に200を返す（最重要）
  res.status(200).json({ ok: true });
  
  // 2. その後で処理
  // ...
}
```

### Case 3: 予約送信エラー

**症状**: カレンダーで「予約送信失敗」

**原因**: フィールド名不一致
- フロント: `note`を送信
- API: `message`を期待

**解決方法**:
```javascript
// liff-calendar-v2.html
body: JSON.stringify({
  message: note || '',  // noteではなくmessage
  // ...
})
```

### Case 4: 席が表示されない

**症状**: 席管理画面が空

**原因**: store_id不一致 or is_activeがfalse

**解決方法**:
```sql
UPDATE seats SET is_active = true WHERE store_id = 'default-store';
```

### Case 5: Vercel デプロイエラー

**症状**: "No more than 12 Serverless Functions"

**原因**: Hobbyプラン制限（12関数まで）

**解決方法**: APIファイル統合
```javascript
// 個別API → 統合API
api/admin.js?action=auth
api/admin.js?action=create
api/admin.js?action=delete
api/admin.js?action=supabase
```

## 💡 ベストプラクティス

### 1. 環境変数の扱い
```javascript
// 必ずtrim()する（改行対策）
const storeId = (process.env.STORE_ID || 'default-store').trim();
```

### 2. エラーハンドリング
```javascript
try {
  // 処理
} catch (error) {
  console.error('詳細エラー:', {
    message: error.message,
    stack: error.stack,
    data: error.response?.data
  });
  // エラーでも200を返す（LINE Webhook用）
  res.status(200).json({ ok: false, error: error.message });
}
```

### 3. デバッグログ
```javascript
console.log('=== API Start ===');
console.log('Timestamp:', new Date().toISOString());
console.log('Request:', JSON.stringify(req.body));
// 処理
console.log('Processing time:', Date.now() - startTime);
```

### 4. データ検証
```javascript
// 必須フィールドチェック
if (!date || !time) {
  return res.status(400).json({ 
    error: '日付と時間は必須です' 
  });
}

// 型変換
const people = parseInt(req.body.people) || 1;
```

## 🚀 デプロイフロー

### 1. 事前チェック
```bash
# モジュール検証
npm run validate

# 環境変数確認  
vercel env ls production

# APIファイル数確認（12以下）
ls api/*.js | wc -l
```

### 2. デプロイ
```bash
# コミット
git add -A
git commit -m "Fix: [問題の内容]"
git push

# Vercel自動デプロイ or 手動
vercel --prod
```

### 3. 動作確認
```bash
# API確認
curl https://line-booking-system-seven.vercel.app/api/admin?action=supabase

# ログ確認
vercel logs
```

## 📊 モニタリング

### ヘルスチェック
```bash
# Webhook健康状態
curl https://line-booking-system-seven.vercel.app/api/webhook-health

# 予約データ確認
node scripts/check-all-reservations.js

# 席データ確認
node scripts/check-store-id.js
```

### ログ分析
```javascript
// Vercelログから問題箇所特定
vercel logs | grep "ERROR"
vercel logs | grep "store_id"
```

## 🔄 メンテナンス

### 定期実行スクリプト

#### データ整合性チェック
```javascript
// scripts/maintenance.js
async function dailyMaintenance() {
  // 1. nullチェック
  const { data: nullStoreReservations } = await supabase
    .from('reservations')
    .select('id')
    .is('store_id', null);
    
  if (nullStoreReservations.length > 0) {
    // 修正処理
    await supabase
      .from('reservations')
      .update({ store_id: 'default-store' })
      .is('store_id', null);
  }
  
  // 2. 古いpendingを削除
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  
  await supabase
    .from('reservations')
    .delete()
    .eq('status', 'pending')
    .lt('created_at', threeDaysAgo.toISOString());
}
```

## 📚 参考リンク

- [Vercel Functions制限](https://vercel.com/docs/concepts/limits)
- [LINE Messaging API](https://developers.line.biz/ja/docs/messaging-api/)
- [LIFF Documentation](https://developers.line.biz/ja/docs/liff/)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)

## 🆘 緊急対応

### システムダウン時
1. Vercelステータス確認: https://www.vercel-status.com/
2. Supabaseステータス確認: https://status.supabase.com/
3. 環境変数リセット
4. 最悪の場合: 前のコミットにロールバック

### データ不整合時
1. `scripts/check-all-reservations.js`実行
2. store_id統一スクリプト実行
3. 必要に応じて手動修正

### LINE Bot停止時
1. LINE_CHANNEL_ACCESS_TOKEN確認
2. Webhook URL確認
3. LINE Developersコンソールで再設定

## 📈 今後の改善案

1. **エラー通知システム**
   - Slackへの自動通知
   - エラーレート監視

2. **バックアップ自動化**
   - 日次バックアップ
   - 復元テスト

3. **パフォーマンス最適化**
   - キャッシュ導入
   - データベースインデックス

4. **セキュリティ強化**
   - レート制限
   - 入力値検証強化