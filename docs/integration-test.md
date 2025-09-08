# 統合テスト手順書

## 環境変数設定
```bash
export API_HOST=https://line-booking-api-dxp5vd3wbq-an.a.run.app
export STORE_ID=store1
```

## 1. 正常系テスト

### 1.1 新規予約作成（制限外スロット）
```bash
# JST 21:30 の予約を作成
curl -i -X POST ${API_HOST}/api/v2/reservations \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 11111111-1111-4111-8111-111111111111' \
  -d '{
    "storeId": "'${STORE_ID}'",
    "startAt": "2025-09-04T21:30:00+09:00",
    "name": "テスト太郎",
    "phone": "090-1234-5678",
    "people": 2
  }'

# 期待結果:
# - Status: 201 Created
# - Response: reservation object with UTC times
# - UI: カレンダーに21:30で表示される
# - 既存予約の周辺が赤くならない
```

### 1.2 予約後の即時反映確認
```bash
# GET で確認
curl -i "${API_HOST}/api/v2/reservations?storeId=${STORE_ID}&start=2025-09-04T00:00:00Z&end=2025-09-05T00:00:00Z"

# 期待結果:
# - 作成した予約が含まれる
# - start: "2025-09-04T12:30:00.000Z" (21:30 JST in UTC)
# - classNames: ["fc-booking"]
```

## 2. 重複防止テスト

### 2.1 同一Idempotency-Key再送
```bash
# 同じキーで再送信
curl -i -X POST ${API_HOST}/api/v2/reservations \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 11111111-1111-4111-8111-111111111111' \
  -d '{
    "storeId": "'${STORE_ID}'",
    "startAt": "2025-09-04T21:30:00+09:00",
    "name": "テスト太郎",
    "phone": "090-1234-5678",
    "people": 2
  }'

# 期待結果:
# - Status: 200 OK (または 409)
# - Response: { error: "duplicate_request" }
# - duplicate: true フラグ付き
```

### 2.2 同一スロット・別Idempotency-Key
```bash
# 別のキーで同じ時間帯
curl -i -X POST ${API_HOST}/api/v2/reservations \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 22222222-2222-4222-8222-222222222222' \
  -d '{
    "storeId": "'${STORE_ID}'",
    "startAt": "2025-09-04T21:30:00+09:00",
    "name": "別の人",
    "phone": "090-9876-5432",
    "people": 1
  }'

# 期待結果:
# - Status: 409 Conflict
# - Response: { error: "slot_taken" }
```

## 3. 制限チェックテスト

### 3.1 制限設定
```bash
# 21:00-22:00 に最大2組の制限を設定
curl -i -X POST ${API_HOST}/api/v2/constraints \
  -H 'Content-Type: application/json' \
  -d '{
    "storeId": "'${STORE_ID}'",
    "startTime": "2025-09-04T12:00:00.000Z",
    "endTime": "2025-09-04T13:00:00.000Z",
    "maxGroups": 2
  }'
```

### 3.2 制限内での予約
```bash
# 1組目
curl -i -X POST ${API_HOST}/api/v2/reservations \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 33333333-3333-4333-8333-333333333333' \
  -d '{
    "storeId": "'${STORE_ID}'",
    "startAt": "2025-09-04T21:00:00+09:00",
    "name": "制限内1",
    "phone": "090-1111-1111",
    "people": 2
  }'

# 2組目
curl -i -X POST ${API_HOST}/api/v2/reservations \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 44444444-4444-4444-8444-444444444444' \
  -d '{
    "storeId": "'${STORE_ID}'",
    "startAt": "2025-09-04T21:00:00+09:00",
    "name": "制限内2",
    "phone": "090-2222-2222",
    "people": 2,
    "seatId": "seat-2"
  }'

# 3組目（制限超過）
curl -i -X POST ${API_HOST}/api/v2/reservations \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 55555555-5555-4555-8555-555555555555' \
  -d '{
    "storeId": "'${STORE_ID}'",
    "startAt": "2025-09-04T21:00:00+09:00",
    "name": "制限超過",
    "phone": "090-3333-3333",
    "people": 2,
    "seatId": "seat-3"
  }'

# 期待結果（3組目）:
# - Status: 409 Conflict
# - Response: { error: "slot_taken", message: "This time slot is full (2/2 groups)" }
```

## 4. タイムゾーンテスト

### 4.1 境界時刻テスト
```bash
# 23:59 JST (翌日 14:59 UTC になるはず → 14:30 UTC に丸められる)
curl -i -X POST ${API_HOST}/api/v2/reservations \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 66666666-6666-4666-8666-666666666666' \
  -d '{
    "storeId": "'${STORE_ID}'",
    "startAt": "2025-09-04T23:59:00+09:00",
    "name": "境界テスト",
    "phone": "090-4444-4444",
    "people": 1
  }'

# 期待結果:
# - slot_start_at_utc: "2025-09-04T14:30:00.000Z"
# - UIでは 23:30 として表示
```

### 4.2 UTC直接指定
```bash
# UTC で直接指定
curl -i -X POST ${API_HOST}/api/v2/reservations \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 77777777-7777-4777-8777-777777777777' \
  -d '{
    "storeId": "'${STORE_ID}'",
    "startAt": "2025-09-05T03:15:00.000Z",
    "name": "UTC指定",
    "phone": "090-5555-5555",
    "people": 1
  }'

# 期待結果:
# - slot_start_at_utc: "2025-09-05T03:00:00.000Z" (03:00に丸め)
# - UIでは 12:00 JST として表示
```

## 5. UI統合テスト

### 5.1 カレンダー表示確認
1. ブラウザで管理画面を開く
2. カレンダービューを確認
   - 予約: 通常のイベントとして表示（fc-booking クラス）
   - 制限: 背景色として表示（fc-constraint クラス）
   - 重複なし

### 5.2 予約作成フロー
1. カレンダーの空き時間をクリック
2. フォームに入力
3. 送信ボタンクリック
4. 確認:
   - 即座にカレンダーに表示
   - ダブルクリック防止が機能
   - エラー時は適切なメッセージ

### 5.3 制限エリア確認
1. 制限設定された時間帯を確認
   - 赤い背景色
   - opacity: 0.3
   - クリック不可（pointer-events: none）

## 6. ログ確認

### 開発環境
```javascript
// ブラウザコンソールで実行
localStorage.setItem('debug', 'true');
location.reload();
```

### 本番環境
```bash
# Cloud Runログを確認
gcloud run logs read --service=line-booking-api --region=asia-northeast1 --limit=50
```

期待されるログ:
```
[RESERVATION CREATE] {
  storeId: 'store1',
  receivedStartAt: '2025-09-04T21:30:00+09:00',
  utcNormalized: '2025-09-04T12:30:00.000Z',
  slotStartUTC: '2025-09-04T12:30:00.000Z',
  slotEndUTC: '2025-09-04T13:00:00.000Z',
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  computedKey: 'store1:2025-09-04T12:30:00.000Z:_default_'
}
```

## 7. 回帰テストチェックリスト

- [ ] 新規予約作成後、他の日付の背景が赤くならない
- [ ] 予約削除後、カレンダーから即座に消える
- [ ] リロード後も予約が正しい位置に表示される
- [ ] 月を切り替えても制限が正しく表示される
- [ ] 同時に複数タブで操作しても重複作成されない
- [ ] ネットワークエラー時に適切なエラーメッセージ
- [ ] 30分境界への丸めが正しく動作
- [ ] JST/UTC変換が正確