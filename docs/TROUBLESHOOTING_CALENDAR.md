# カレンダー表示トラブルシューティング・ナレッジ

## 問題の概要
FullCalendarに予約データが表示されない問題が複数の原因で発生

## 根本原因（3つの複合要因）

### 1. ESモジュールのエクスポート重複
**問題:**
```javascript
// utils/store-config.js
export function getStoreId() { ... }
// ...
export { getStoreId }; // 重複エクスポートでSyntaxError
```

**解決:**
- 関数定義時に`export`を付けたら、最後の`export {}`文は不要
- 純ESMに統一し、CommonJS併記を削除

### 2. API応答フィールド名の不一致
**問題:**
```javascript
// APIが返すデータ
{ success: true, data: [...] }

// フロントエンドが期待するデータ
{ success: true, reservations: [...] }
```

**解決:**
- APIとフロントエンドのフィールド名を統一
- データベースフィールド名の変換を適切に実施
  - `people` → `numberOfPeople`
  - `customer_name` → `customerName`

### 3. 時刻フォーマットの不整合
**問題:**
```javascript
// データ: "18:00:00" (HH:MM:SS形式)
// 誤った処理
start: `${date}T${time}:00` // → "2025-08-31T18:00:00:00" (不正な形式)
```

**解決:**
```javascript
start: `${date}T${time}` // → "2025-08-31T18:00:00" (正しいISO8601形式)
```

### 4. セキュリティミドルウェアの過剰なレート制限
**問題:**
- 開発環境で1分60リクエスト制限
- 429 Too Many Requestsエラー
- IPブロッキング機能が開発を妨害

**解決:**
```javascript
if (process.env.NODE_ENV === 'production') {
  app.use(securityManager.middleware());
}
```

## 診断手順

### 1. API動作確認
```bash
curl -s "http://localhost:8080/api/admin?action=list&store_id=default-store"
```

### 2. ブラウザコンソールでのデバッグ
```javascript
// APIレスポンス確認
fetch('/api/admin?action=list&store_id=default-store')
  .then(r => r.json())
  .then(data => console.log('Data:', data));

// カレンダーイベント確認
calendar.getEvents().forEach(e => console.log(e.title, e.start));
```

### 3. サーバーログ確認
- エラーの詳細情報
- モジュールインポートエラー
- データベースフィールドエラー

## 再発防止策

### 1. データ整合性チェック
- APIレスポンスとフロントエンドの期待値を一致させる
- フィールド名マッピングを一元管理

### 2. 時刻処理の標準化
- ISO8601形式の統一使用
- タイムゾーン処理の明確化

### 3. 開発環境の最適化
- セキュリティ機能の環境別制御
- デバッグログの充実

### 4. テストの追加
- APIレスポンス形式のテスト
- FullCalendarイベント追加のテスト
- エンドツーエンドテスト

## チェックリスト

- [ ] ESモジュールのエクスポートが重複していないか
- [ ] APIレスポンスのフィールド名が正しいか
- [ ] 時刻フォーマットがISO8601に準拠しているか
- [ ] 開発環境でセキュリティ制限が無効化されているか
- [ ] データベースフィールド名の変換が適切か
- [ ] FullCalendarの初期化が正常か
- [ ] ブラウザキャッシュがクリアされているか

## 関連ファイル
- `/api/admin.js` - APIハンドラー
- `/utils/store-config.js` - 店舗設定
- `/public/admin-full-featured.html` - 管理画面
- `/server.js` - サーバー設定
- `/middleware/security.js` - セキュリティ設定