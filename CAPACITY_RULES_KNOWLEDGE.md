# 予約制限（キャパシティ）システム ナレッジベース

## 概要
予約制限システムは、時間帯ごとに予約可能な組数・人数を制限し、視覚的に表示する機能です。

## システム構成

### 1. データベース構造
```sql
capacity_control_rules テーブル:
- id: UUID (主キー)
- store_id: 店舗ID
- date_mode: 'single' | 'range' (単日/期間)
- date: 特定日付（単日モード）
- start_date/end_date: 期間（範囲モード）
- start_time/end_time: 時間範囲
- max_groups: 最大組数
- max_people: 最大人数
- is_active: 有効/無効
```

### 2. ステータス判定ロジック

#### 残席数ベースの判定（2025年9月実装）
```javascript
// 残席数を計算
const remainingGroups = maxGroups - currentGroups;
const remainingPeople = maxPeople - currentPeople;
const remaining = Math.min(remainingGroups, remainingPeople);

// ステータス判定
if (remaining <= 0) {
    status = 'full';        // 満席（グレー表示）
} else if (remaining <= 1) {
    status = 'limited';     // もうすぐ満席（黄色表示）
} else {
    status = 'available';   // 空席あり（緑/白表示）
}
```

### 3. 色表示の仕様

| ステータス | 色 | 背景色 | 説明 | 予約可否 |
|---------|---|--------|------|---------|
| full | グレー | #e0e0e0 | 満席 | 不可 |
| limited | 黄色 | #ffd54f | 残り1組/1名 | 可 |
| available | 緑/白 | #4caf50 or #f5f5f7 | 空席あり | 可 |

## APIエンドポイント

### GET /api/capacity-availability
指定日の予約可能状況を取得

**リクエスト:**
```
GET /api/capacity-availability?date=2025-09-02&store_id=default-store
```

**レスポンス:**
```json
{
  "success": true,
  "availability": {
    "18:00": {
      "status": "limited",
      "selectable": true,
      "color": "#ff9800",
      "currentGroups": 0,
      "maxGroups": 1,
      "remainingGroups": 1,
      "message": "残1組"
    }
  }
}
```

### POST /api/capacity-rules
予約制限ルールを作成

### PUT /api/capacity-rules/:id
予約制限ルールを更新

### DELETE /api/capacity-rules/:id
予約制限ルールを削除

## トラブルシューティング

### 問題1: 色が変わらない

**原因:**
1. ブラウザキャッシュ
2. APIレスポンスの遅延
3. CSSの上書き

**解決方法:**
```javascript
// 1. キャッシュクリア
location.reload(true);

// 2. URLにタイムスタンプ追加
url + '?t=' + Date.now()

// 3. スタイル強制適用
element.style.cssText = 'background: #ffd54f !important;'
```

### 問題2: ルールが適用されない

**原因:**
1. date_modeの不一致
2. 時間範囲の判定エラー
3. is_activeがfalse

**確認方法:**
```javascript
// APIレスポンスを確認
fetch('/api/capacity-availability?date=2025-09-02&store_id=default-store')
  .then(r => r.json())
  .then(d => console.log(d))
```

### 問題3: 最大1組制限の表示

**仕様:**
- 最大1組/1人の制限
  - 予約0件 → 黄色（残り1組）
  - 予約1件 → グレー（満席）

## 実装のベストプラクティス

### 1. キャッシュ対策
```javascript
// APIリクエストにキャッシュ無効化
fetch(url, {
  cache: 'no-cache',
  headers: {
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  }
})
```

### 2. スタイル適用
```javascript
// style.cssTextを使用（setAttribute より確実）
element.style.cssText = `
  background-color: ${color} !important;
  pointer-events: ${selectable ? 'auto' : 'none'} !important;
`;
```

### 3. デバッグログ
```javascript
// 開発環境でのみデバッグログを出力
if (process.env.NODE_ENV === 'development') {
  console.log('[DEBUG] Capacity rule:', rule);
}
```

## 監視システム（capacity-monitor.js）

### 機能
1. 5秒ごとに自動チェック
2. 色の不一致を検出
3. 自動修正
4. エラー通知

### 使用方法
```javascript
// 監視開始
window.CapacityMonitor.startMonitoring('2025-09-02');

// 手動チェック
window.CapacityMonitor.checkAndFixAllSlots('2025-09-02');

// 監視停止
window.CapacityMonitor.stopMonitoring();
```

## テストケース

### ケース1: 1組制限
```
設定: max_groups=1, max_people=50
予約0件 → status="limited" (黄色)
予約1件 → status="full" (グレー)
```

### ケース2: 2組制限
```
設定: max_groups=2, max_people=50
予約0件 → status="available" (緑)
予約1件 → status="limited" (黄色)
予約2件 → status="full" (グレー)
```

### ケース3: 人数制限優先
```
設定: max_groups=10, max_people=10
予約: 5組10名 → status="full" (グレー)
（組数は余裕があるが人数が上限）
```

## 今後の改善案

1. **リアルタイム更新**
   - WebSocketで予約状況をリアルタイム反映

2. **予測表示**
   - 過去データから混雑予測

3. **柔軟な制限設定**
   - 曜日別の自動設定
   - 季節・イベント対応

4. **パフォーマンス最適化**
   - 結果のキャッシング
   - バッチ処理

## APIフィールドマッピング問題と解決策

### 問題の概要
フロントエンドとバックエンドでフィールド名の不一致により、予約作成時に400エラーが発生する問題。

### よくあるフィールド名の不一致

| バックエンド要求 | フロントエンドのバリエーション | 説明 |
|--------------|--------------------------|------|
| customer_name | customerName, name | 顧客名 |
| customer_phone | phoneNumber, phone, tel | 電話番号 |
| customer_email | email, mail | メールアドレス |
| date | reservationDate | 予約日 |
| time | reservationTime | 予約時間 |
| people | numberOfPeople, peopleCount, guests | 人数 |
| message | specialRequests, note, comment | メッセージ |
| seat_preference | seat_id, seatPreference | 座席希望 |

### 解決策1: サーバー側でのフィールドマッピング

```javascript
// server.js での実装
const fieldMappings = {
  'customer_name': req.body.customer_name || req.body.customerName || req.body.name,
  'customer_phone': req.body.customer_phone || req.body.phoneNumber || req.body.phone || req.body.tel,
  'customer_email': req.body.customer_email || req.body.email || req.body.mail,
  'date': req.body.date || req.body.reservationDate,
  'time': req.body.time || req.body.reservationTime,
  'people': req.body.people || req.body.numberOfPeople || req.body.peopleCount || req.body.guests,
  'message': req.body.message || req.body.specialRequests || req.body.note || req.body.comment,
  'seat_preference': req.body.seat_preference || req.body.seat_id || req.body.seatPreference
};
```

### 解決策2: クライアント側でのフィールド検証（api-field-validator.js）

```javascript
// APIリクエストをインターセプトして自動修正
const validator = new APIFieldValidator();
validator.startMonitoring();

// テスト用
validator.testFieldMapping({
  customerName: "田中太郎",
  phoneNumber: "090-1234-5678",
  date: "2025-09-02",
  time: "18:00",
  numberOfPeople: 2
});
```

### デバッグ方法

#### 1. ブラウザコンソールでのチェック
```javascript
// APIフィールドバリデーターのデバッグ情報表示
window.APIValidator.showDebugInfo();

// インターセプトされたリクエストを確認
window.APIValidator.interceptedRequests;
```

#### 2. サーバーログでの確認
```javascript
// server.js にログを追加
console.log('Received fields:', Object.keys(req.body));
console.log('Mapped fields:', fieldMappings);
```

### よくあるエラーと対処法

#### エラー1: "Missing required field: customer_phone"
**原因:** フロントエンドが `phone` で送信、バックエンドは `customer_phone` を期待

**対処法:**
```javascript
// フロントエンド側を修正
const formData = {
  customer_name: document.getElementById('customerName').value,
  customer_phone: document.getElementById('phone').value,  // phoneではなくcustomer_phone
  // ...
};
```

#### エラー2: "Cannot read properties of null"
**原因:** 存在しないDOM要素を参照

**対処法:**
```javascript
// 要素の存在チェックを追加
const element = document.getElementById('seatPreference');
if (element) {
  formData.seat_preference = element.value;
}
```

### 予防コードの実装

1. **api-field-validator.js** - 自動フィールドマッピング
2. **code-quality-monitor.js** - 重複宣言の検出
3. **capacity-monitor.js** - キャパシティ表示の監視

これらのモニターを全ページで読み込むことで、問題を早期発見・自動修正できます。

```html
<!-- 全HTMLファイルに追加 -->
<script src="/js/api-field-validator.js"></script>
<script src="/js/code-quality-monitor.js"></script>
<script src="/js/capacity-monitor.js"></script>
```

## 更新履歴

- 2025-09-02: APIフィールドマッピング問題の解決策追加
- 2025-09-02: api-field-validator.js追加
- 2025-09-02: 残席数ベースの判定に変更
- 2025-09-02: capacity-monitor.js追加
- 2025-09-01: 初回実装