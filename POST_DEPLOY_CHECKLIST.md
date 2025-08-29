# ✅ GCPデプロイ完了後チェックリスト

## 🎉 デプロイ完了！

Cloud Runへのデプロイが成功しました。以下の手順で動作確認を行ってください。

## 1. サービスURL確認

**quick-test.bat** を実行して、サービスURLを確認：
```
C:\Users\user\line-booking-system\quick-test.bat
```

表示される情報：
- サービスURL: `https://line-booking-api-xxxxx-an.a.run.app`
- Webhook URL: `https://line-booking-api-xxxxx-an.a.run.app/webhook`

## 2. LINE Developers設定

### 必須設定 ⚠️
1. [LINE Developers Console](https://developers.line.biz/)にログイン
2. **SmartWeb Works 予約 Bot**を選択
3. **Messaging API設定**タブ
4. **Webhook URL**を更新（上記で確認したURL）
5. **Webhookの利用**: ON
6. **応答メッセージ**: OFF

## 3. 動作テスト

### A. システムテスト
```bash
# クイックテスト実行
quick-test.bat
```

### B. LINE アプリテスト
1. SmartWeb Works 予約 Botとトーク開始
2. 「予約」と送信
3. 予約メニューが返ってくればOK！

## 4. 管理画面確認

ブラウザで管理画面にアクセス：
```
https://line-booking-api-xxxxx-an.a.run.app/admin
```

確認項目：
- [ ] 予約一覧が表示される
- [ ] カレンダーが正しく表示される
- [ ] 予約データ（43件）が見える

## 5. ログ監視

問題があればログを確認：
```bash
# リアルタイムログ監視
monitor-logs.bat
```

## 📊 GCPコンソール

### 主要リンク
- [Cloud Run](https://console.cloud.google.com/run?project=line-booking-prod-20241228)
- [ログ](https://console.cloud.google.com/logs?project=line-booking-prod-20241228)
- [請求](https://console.cloud.google.com/billing)
- [Secret Manager](https://console.cloud.google.com/security/secret-manager?project=line-booking-prod-20241228)

## 💰 コスト管理

### 現在の設定
- **最小インスタンス**: 0（リクエストがない時は課金なし）
- **最大インスタンス**: 10
- **メモリ**: 512Mi
- **CPU**: 1

### 無料枠
- Cloud Run: 200万リクエスト/月
- Secret Manager: 1万アクセス/月
- ログ: 50GB/月

### 予算アラート
まだ設定していない場合：
```bash
setup-budget-alert.bat
```

## 🔧 トラブルシューティング

### 返信が来ない
1. Webhook URLが正しいか確認
2. Webhookの利用がONか確認
3. 応答メッセージがOFFか確認
4. ログを確認: `monitor-logs.bat`

### 予約が表示されない
1. store_idが`default-store`に統一されているか確認
2. Supabaseの接続を確認
3. 管理画面のコンソールでエラーを確認

### エラー500
1. Secret Managerの値を確認
2. 環境変数を確認
3. ログで詳細エラーを確認

## 📝 メンテナンス

### コード更新後の再デプロイ
```bash
cd C:\Users\user\line-booking-system
gcloud run deploy line-booking-api --source . --region asia-northeast1
```

### サービス停止
```bash
gcloud run services delete line-booking-api --region asia-northeast1
```

### ログ削除（コスト削減）
```bash
gcloud logging logs delete "projects/line-booking-prod-20241228/logs/run.googleapis.com" --quiet
```

## ✅ 完了確認

- [ ] Cloud Runデプロイ成功
- [ ] ヘルスチェック成功（/api/ping）
- [ ] LINE Webhook URL更新済み
- [ ] LINEで「予約」メッセージテスト成功
- [ ] 管理画面アクセス可能
- [ ] 予約データ表示確認
- [ ] 予算アラート設定済み

すべて完了したら、Vercelは停止してOKです！

## 🎊 おめでとうございます！

GCP Cloud Runへの移行が完了しました。
- **月額コスト**: 0円〜100円（無料枠内）
- **デプロイ制限**: なし（Vercelの100回/日制限から解放）
- **商用利用**: OK
- **スケーラビリティ**: 自動スケール対応

何か問題があればログを確認してください：
```bash
monitor-logs.bat
```