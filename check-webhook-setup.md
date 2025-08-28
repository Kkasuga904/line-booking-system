# LINE Webhook設定確認手順

## 1. LINE Developers Consoleで確認

1. [LINE Developers](https://developers.line.biz/) にログイン
2. 対象のチャネルを選択
3. **Messaging API設定**タブを開く

## 2. Webhook設定の確認

### ✅ 必須設定:
- **Webhook URL**: `https://line-booking-system-seven.vercel.app/api/webhook-simple`
- **Webhookの利用**: ON
- **応答メッセージ**: OFF（重要！）
- **あいさつメッセージ**: OFF（友だち追加時のメッセージはWebhookで送信）

## 3. 動作テスト

### テスト1: Webhook接続確認
LINE Developers ConsoleのWebhook設定画面で「検証」ボタンをクリック
- ✅ 成功なら「成功」と表示される
- ❌ 失敗なら URLを確認

### テスト2: メッセージ返信テスト
1. LINE公式アカウントに「予約」とメッセージを送信
2. 以下の返信が来るか確認：
```
ご予約はこちらから：

📱 LINE内で予約（おすすめ）
https://liff.line.me/2006487876-xd1A5qJB

🌐 ブラウザで予約
https://line-booking-system-seven.vercel.app/liff-calendar
```

## 4. トラブルシューティング

### 返信が来ない場合:

1. **環境変数の確認**
   - Vercelで `LINE_CHANNEL_ACCESS_TOKEN` が設定されているか
   - Vercelで `LINE_CHANNEL_SECRET` が設定されているか

2. **Vercelのログ確認**
   ```
   vercel logs --prod
   ```

3. **LINE Developers設定**
   - 応答メッセージがOFFになっているか
   - WebhookがONになっているか
   - Webhook URLが正しいか

4. **アクセストークンの再発行**
   - LINE DevelopersでChannel Access Tokenを再発行
   - Vercelの環境変数を更新
   ```
   vercel env rm LINE_CHANNEL_ACCESS_TOKEN production
   vercel env add LINE_CHANNEL_ACCESS_TOKEN production
   ```

## 5. 現在の設定値

- **Webhook URL**: `https://line-booking-system-seven.vercel.app/api/webhook-simple`
- **LIFF ID**: `2006487876-xd1A5qJB`
- **STORE_ID**: `default-store`