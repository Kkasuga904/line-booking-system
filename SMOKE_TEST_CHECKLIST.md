# スモークテストチェックリスト

## 🎯 実行方法

### A店環境テスト
```bash
# 環境変数設定
export STORE_ID=store-a

# 開発サーバー起動
npm run dev

# 別ターミナルでテスト実行
npm run test:store-a
```

### B店環境テスト
```bash
# 環境変数設定
export STORE_ID=store-b

# 開発サーバー起動
npm run dev

# 別ターミナルでテスト実行
npm run test:store-b
```

## ✅ チェック項目（実行順）

### 1. 設定検証
- [ ] store-a の設定が正しく読み込まれる
  - [ ] テーマカラー: #27ae60（緑）
  - [ ] 営業時間: 10:00-22:00
  - [ ] 予約間隔: 15分
- [ ] store-b の設定が正しく読み込まれる
  - [ ] テーマカラー: #e74c3c（赤）
  - [ ] 営業時間: 11:30-20:00
  - [ ] 予約間隔: 30分

### 2. 基本機能
- [ ] ヘルスチェックAPI が正常応答
- [ ] 予約作成が成功
- [ ] 予約一覧取得が成功
- [ ] 予約キャンセルが成功

### 3. 容量制限
- [ ] 最大1組設定時、2組目がブロックされる
- [ ] 最大人数超過時にエラーになる
- [ ] 時間帯別の制限が機能する

### 4. カレンダー表示
- [ ] カレンダーデータが取得できる
- [ ] 予約済み時間帯の色分けが正しい
- [ ] 容量制限が視覚的に表示される

### 5. LIFF連携
- [ ] LIFF起動が成功
- [ ] 顧客情報が正しく保存される
- [ ] LINE通知が送信される

### 6. ログ確認
- [ ] すべてのAPIログに store_id が含まれる
- [ ] エラーログが構造化されている
- [ ] パフォーマンスメトリクスが記録される

### 7. URLパラメータ
- [ ] ?store_id=store-a で A店設定になる
- [ ] ?store_id=store-b で B店設定になる
- [ ] パラメータが環境変数より優先される

### 8. パフォーマンス
- [ ] P95レスポンスタイム < 1000ms
- [ ] 平均レスポンスタイム < 500ms
- [ ] 同時リクエスト処理が正常

## 📊 監視ポイント

### Cloud Run ログ確認
```bash
# ログの監視（store_id でフィルタ）
gcloud logging read "resource.type=cloud_run_revision AND jsonPayload.store_id=store-a" --limit 50 --format json

# エラー率の確認
gcloud logging read "severity>=ERROR AND jsonPayload.store_id=store-a" --limit 10
```

### メトリクス確認
- 5xx エラー率（< 0.1%）
- リクエスト数（正常範囲内）
- レイテンシ（P50, P95, P99）
- メモリ使用量（< 80%）

## 🚨 問題発生時の対応

### 1. 設定エラー
```bash
# 設定ファイルの検証
node -e "const {loadValidatedConfig} = require('./utils/store-config-validated'); loadValidatedConfig('store-a').then(console.log)"
```

### 2. API エラー
```bash
# 詳細ログの確認
export DEBUG=* 
npm run dev
```

### 3. データベースエラー
```bash
# Supabase接続確認
node -e "const {createClient} = require('@supabase/supabase-js'); /* 接続テスト */"
```

## 📈 受け入れ基準

### A店環境
- [ ] 24時間稼働で問題なし
- [ ] エラー率 < 0.1%
- [ ] P95レイテンシ < 1秒
- [ ] すべてのログに store_id 含まれる

### B店環境
- [ ] A店と同じ基準をクリア
- [ ] 店舗間の設定が混在しない
- [ ] 独立した動作が確認できる

## 🎬 次のステップ

1. **A店本番デプロイ**
   ```bash
   gcloud run deploy line-booking-api \
     --source . \
     --region asia-northeast1 \
     --set-env-vars="STORE_ID=store-a" \
     --tag=store-a
   ```

2. **24-48時間監視**
   - CloudRunダッシュボード確認
   - アラート設定
   - ログ分析

3. **B店展開**
   - A店で問題なければ同じ手順でデプロイ
   - 段階的トラフィック移行

## 📝 メモ

- テスト実行前に必ず `npm install` を実行
- 環境変数 STORE_ID が正しく設定されているか確認
- ローカルテストは localhost:8080 で実行
- 本番テストは実際のCloud Run URLで実行