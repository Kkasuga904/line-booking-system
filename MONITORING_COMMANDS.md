# 📊 監視コマンド集

## リアルタイムログ監視

### store-a のすべてのログ
```bash
gcloud logging tail \
  "resource.type=cloud_run_revision AND jsonPayload.store_id=store-a" \
  --project=line-booking-prod-20241228
```

### エラーログのみ
```bash
gcloud logging tail \
  "resource.type=cloud_run_revision AND severity>=ERROR AND jsonPayload.store_id=store-a" \
  --project=line-booking-prod-20241228
```

### 予約作成ログ
```bash
gcloud logging tail \
  "resource.type=cloud_run_revision AND jsonPayload.msg=~'Reservation.*created' AND jsonPayload.store_id=store-a" \
  --project=line-booking-prod-20241228
```

### 高レイテンシ（>1秒）
```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND jsonPayload.ms>1000 AND jsonPayload.store_id=store-a" \
  --limit=20 \
  --project=line-booking-prod-20241228
```

## メトリクス確認

### Cloud Run ダッシュボード
```
https://console.cloud.google.com/run/detail/asia-northeast1/line-booking-api/metrics?project=line-booking-prod-20241228
```

### 5xxエラー率確認
```bash
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/request_count" AND metric.labels.response_code_class="5xx"' \
  --project=line-booking-prod-20241228
```

## ヘルスチェック

### カナリア版直接アクセス
```bash
curl https://store-a-canary---line-booking-api-116429620992.asia-northeast1.run.app/api/health
```

### 設定確認
```bash
curl https://store-a-canary---line-booking-api-116429620992.asia-northeast1.run.app/api/config
```

## トラフィック管理

### 現在のトラフィック配分確認
```bash
gcloud run services describe line-booking-api \
  --region asia-northeast1 \
  --project=line-booking-prod-20241228 \
  --format="value(status.traffic[].percent,status.traffic[].tag)"
```

### 30%に増やす
```bash
gcloud run services update-traffic line-booking-api \
  --to-tags store-a-canary=30 \
  --region asia-northeast1 \
  --project=line-booking-prod-20241228
```

### 50%に増やす
```bash
gcloud run services update-traffic line-booking-api \
  --to-tags store-a-canary=50 \
  --region asia-northeast1 \
  --project=line-booking-prod-20241228
```

### 100%に切り替え
```bash
gcloud run services update-traffic line-booking-api \
  --to-tags store-a-canary=100 \
  --region asia-northeast1 \
  --project=line-booking-prod-20241228
```

## 問題検出

### store_id が unknown のリクエスト
```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND jsonPayload.store_id=unknown" \
  --limit=10 \
  --project=line-booking-prod-20241228
```

### LINE設定エラー
```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND jsonPayload.msg=~'LINE.*missing'" \
  --limit=10 \
  --project=line-booking-prod-20241228
```

### 容量制限によるブロック
```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND jsonPayload.msg=~'Capacity.*blocked'" \
  --limit=10 \
  --project=line-booking-prod-20241228
```

## スモークテスト実行

### ローカルから本番環境をテスト
```bash
# Windows
set TEST_URL=https://line-booking-api-116429620992.asia-northeast1.run.app
set STORE_ID=store-a
npm run smoke-test

# Linux/Mac
export TEST_URL=https://line-booking-api-116429620992.asia-northeast1.run.app
export STORE_ID=store-a
npm run smoke-test
```

## 監視期間中のチェックリスト

### 15分ごと
- [ ] エラー率 < 0.1%
- [ ] P95レイテンシ < 1秒
- [ ] store_id がすべてのログに含まれる

### 1時間ごと
- [ ] 予約作成/キャンセルが正常動作
- [ ] 容量制限が機能
- [ ] メモリ使用率 < 80%
- [ ] CPU使用率 < 80%

### 6時間ごと
- [ ] コールドスタート頻度確認
- [ ] 予約成功率 > 95%
- [ ] 異常なトラフィックパターンなし