# 📱 LINE Developers Webhook URL更新ガイド

## デプロイ完了後のWebhook URL

あなたのCloud Run サービスURL：
```
https://line-booking-api-[ランダム文字列]-an.a.run.app
```

Webhook URL（これをLINE Developersに設定）：
```
https://line-booking-api-[ランダム文字列]-an.a.run.app/webhook
```

## 設定手順

### 1. LINE Developers Consoleにアクセス
[https://developers.line.biz/](https://developers.line.biz/)

### 2. SmartWeb Works 予約 Botを選択
- プロバイダー: SmartWeb Works
- チャネル名: SmartWeb Works 予約 Bot

### 3. Messaging API設定タブを開く

### 4. Webhook設定を更新

| 設定項目 | 値 |
|---------|-----|
| Webhook URL | `https://line-booking-api-xxxxx-an.a.run.app/webhook` |
| Webhookの利用 | **ON** |
| 応答メッセージ | **OFF** |
| あいさつメッセージ | OFF（任意） |

### 5. 「検証」ボタンでテスト
- 「成功」と表示されればOK
- エラーの場合は下記トラブルシューティング参照

### 6. 設定を保存

## ✅ 動作確認

### LINEアプリでテスト
1. SmartWeb Works 予約 Botを友だち追加
2. 「予約」とメッセージを送信
3. 予約メニューが返信されれば成功！

### テストメッセージ例
- 「予約」→ 予約メニュー表示
- 「キャンセル」→ キャンセル確認
- 「確認」→ 予約状況確認

## 🚨 トラブルシューティング

### Webhook検証でエラーが出る場合

1. **URLが正しいか確認**
   ```bash
   # Windows コマンドプロンプトで実行
   curl https://line-booking-api-xxxxx-an.a.run.app/api/ping
   ```

2. **シークレットが正しく設定されているか確認**
   - LINE_CHANNEL_SECRET が正しいか
   - GCP Secret Managerに登録されているか

3. **Cloud Runのログを確認**
   ```bash
   gcloud logging tail "resource.type=cloud_run_revision"
   ```

### 返信が来ない場合

1. **Webhookの利用がONになっているか確認**

2. **応答メッセージがOFFになっているか確認**
   - ONだとBotの自動応答と競合します

3. **Channel Access Tokenが有効か確認**
   - 期限切れの場合は再発行が必要

4. **store_idが統一されているか確認**
   - すべて `default-store` になっている必要があります

## 📊 Cloud Run管理画面

GCPコンソールでサービスを確認：
[https://console.cloud.google.com/run](https://console.cloud.google.com/run)

- リージョン: asia-northeast1（東京）
- サービス名: line-booking-api
- プロジェクト: line-booking-prod-20241228

## 💰 料金モニタリング

### 無料枠内での運用
- Cloud Run: 200万リクエスト/月まで無料
- Secret Manager: 1万アクセス/月まで無料
- 予想コスト: 月額0円〜100円

### 料金確認
[https://console.cloud.google.com/billing](https://console.cloud.google.com/billing)

## 🔄 更新・再デプロイ

コードを更新した後の再デプロイ：

```bash
# バッチファイルで簡単デプロイ
cd C:\Users\user\line-booking-system
deploy-gcp.bat
```

または

```bash
# gcloudコマンド直接実行
gcloud run deploy line-booking-api --source . --region asia-northeast1
```

## 📝 メモ

- デプロイ日時: 2024年12月28日
- プロジェクトID: line-booking-prod-20241228
- 環境: Production
- store_id: default-store（統一済み）