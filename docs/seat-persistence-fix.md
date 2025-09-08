# 席割り当て永続化修正 - 2025年9月1日

## 問題
「予約作ったとき席割り当ててるのにあとから予約詳細モーダルみたら未割り当てになってる」
- 席を割り当てても保存されない
- 詳細モーダルで常に「未割り当て」と表示される

## 原因
1. **データベーススキーマの問題**
   - `seat_code`カラムがSupabaseに存在していた（ALTER TABLEで追加済み）
   - しかしAPIレスポンスに`seat_code`が含まれていなかった

2. **APIレスポンスの問題（api/admin.js:287-304）**
   - handleList関数でDBから`seat_code`を取得していたが
   - レスポンスのマッピング処理で`seat_code`を含めていなかった

## 解決策

### 1. APIレスポンスに`seat_code`を追加
```javascript
// api/admin.js line 287-304
return {
  id: r.id,
  customer_name: r.customer_name,
  customerName: r.customer_name,
  date: dateStr,
  time: timeStr,
  people: r.people || 0,
  numberOfPeople: r.people || 0,
  status: r.status,
  message: r.message,
  phone: r.phone,
  email: r.email,
  seatId: r.seat_id,
  seat_id: r.seat_id,
  seat_code: r.seat_code,  // ← これを追加
  createdAt: r.created_at,
  updatedAt: r.updated_at
};
```

### 2. フロントエンド側の処理（既に対応済み）
- `admin-full-featured.html`では既に`seat_code`を正しく処理
- 予約作成時：`seat_code`に席コード（T1, T2等）を送信
- 表示時：`getSeatDisplayName(reservation.seat_id || reservation.seat_code)`で表示

## テスト結果
- 予約ID 219: seat_code "T1"が正常に保存・取得
- 予約ID 220: seat_code "T2"が正常に保存・取得  
- 予約ID 221: seat_code "T4"が正常に保存・取得

## 再発防止策
1. **APIレスポンスの完全性チェック**
   - DBから取得する全フィールドがレスポンスに含まれることを確認
   - 新しいカラムを追加した際は必ずAPIレスポンスも更新

2. **スキーマ変更の手順**
   ```sql
   -- 1. カラム追加
   ALTER TABLE public.reservations 
   ADD COLUMN IF NOT EXISTS seat_code text;
   
   -- 2. APIレスポンス更新（api/admin.js）
   -- 3. フロントエンド対応確認
   -- 4. デプロイ＆テスト
   ```

3. **席管理の設計**
   - `seat_id`: UUID専用（将来の拡張用）
   - `seat_code`: 文字列席コード（T1, T2等）
   - 現在は`seat_code`のみ使用、`seat_id`は常にnull

## デプロイ情報
- Cloud Run URL: https://line-booking-api-dxp5vd3wbq-an.a.run.app
- 管理画面URL: https://line-booking-api-dxp5vd3wbq-an.a.run.app/admin-full-featured.html
- デプロイ日時: 2025-09-01 18:00 JST
- 確認済み機能: 席割り当ての作成・表示・永続化