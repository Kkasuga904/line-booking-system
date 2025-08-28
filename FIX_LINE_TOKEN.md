# LINE Channel Access Token更新手順

## 🚨 現在の問題
LINE Channel Access Tokenが無効（401エラー）のため、LINE返信機能が動作していません。

## ✅ 解決手順

### 1. LINE Developersで新しいトークンを発行

1. [LINE Developers Console](https://developers.line.biz/)にログイン
2. 対象のチャネル（プロバイダー）を選択
3. **「Messaging API設定」**タブをクリック
4. **「チャネルアクセストークン」**セクションまでスクロール
5. 現在のトークンの横にある**「再発行」**ボタンをクリック
6. 新しいトークンをコピー（172文字程度の長い文字列）

### 2. ローカル環境を更新

`.env.local`ファイルを編集：
```
LINE_CHANNEL_ACCESS_TOKEN=（ここに新しいトークンを貼り付け）
```

### 3. トークンの有効性を確認

```bash
node test-line-reply.js
```

「✅ トークン有効」と表示されれば成功

### 4. Vercel環境変数を更新

```bash
# 古いトークンを削除
vercel env rm LINE_CHANNEL_ACCESS_TOKEN production

# 新しいトークンを追加（新しいトークンをコピーしてから実行）
echo "新しいトークンをここに貼り付け" | vercel env add LINE_CHANNEL_ACCESS_TOKEN production --force
```

### 5. デプロイ（39分後）

現在デプロイ制限中のため、39分後に実行：
```bash
vercel --prod --force
```

または、GitHubにpushして自動デプロイ：
```bash
git add .
git commit -m "Update LINE Channel Access Token"
git push
```

## 📋 確認事項

### LINE Developers Consoleで確認
- [ ] Webhook URL: `https://line-booking-system-seven.vercel.app/api/webhook-simple`
- [ ] Webhookの利用: **ON**
- [ ] 応答メッセージ: **OFF**
- [ ] あいさつメッセージ: **OFF**

### テストメッセージ
LINEで「予約」と送信して、以下の返信が来るか確認：

```
ご予約はこちらから：

📱 LINE内で予約（おすすめ）
https://liff.line.me/2006487876-xd1A5qJB

🌐 ブラウザで予約
https://line-booking-system-seven.vercel.app/liff-calendar
```

## ⚠️ 注意事項

1. **トークンは機密情報**
   - GitHubにコミットしない
   - 画面共有時は隠す

2. **有効期限**
   - 通常は無期限だが、再発行すると古いトークンは無効になる
   - 複数の環境で同じBotを使う場合は注意

3. **トラブルシューティング**
   - 401エラー: トークンが無効
   - 403エラー: 権限不足
   - 429エラー: レート制限

## 🔧 自動化スクリプト

トークン更新後、以下を実行して全体の整合性を確認：

```bash
node prevent-issues.js
```