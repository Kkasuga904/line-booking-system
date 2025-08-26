# 🔧 LINE Bot トラブルシューティングガイド

## よくある問題と解決方法

### 🔴 問題1: 404 Not Found エラー

#### 症状
- Webhook URLにアクセスすると404エラー
- Verifyボタンで「Failed」

#### 原因と解決方法

##### 原因A: vercel.jsonに登録されていない
```json
// vercel.jsonを確認
{
  "functions": {
    "api/your-endpoint.js": {  // ← ここに追加必要
      "maxDuration": 10
    }
  }
}
```

**解決手順:**
1. `vercel.json`を編集
2. 新しいエンドポイントを追加
3. `vercel --prod`で再デプロイ

##### 原因B: ファイル名の不一致
- URLパス: `/api/booking`
- ファイル名: `api/booking.js`

**確認コマンド:**
```bash
ls -la api/
```

---

### 🔴 問題2: events配列が空

#### 症状
```json
{
  "destination": "Ude37...",
  "events": []  // 空！
}
```

#### 原因と解決方法

##### 原因A: Verifyボタンのテスト
**これは仕様です！** Verifyボタンは空のイベントを送信します。

**解決:** スマホから実際にメッセージを送信してテスト

##### 原因B: 応答モードが「チャット」
**解決手順:**
1. LINE Official Account Managerにログイン
2. 設定 > 応答設定
3. 応答モード: **「Bot」**に変更

##### 原因C: 友だち追加していない/ブロック中
**解決:** QRコードで友だち追加、ブロック解除

---

### 🔴 問題3: 401 Authentication Failed

#### 症状
```json
{
  "message": "Authentication failed. Confirm that the access token in the authorization header is valid."
}
```

#### 原因と解決方法

##### 原因: アクセストークンが無効

**解決手順:**
```bash
# 1. 古いトークンを削除
vercel env rm LINE_CHANNEL_ACCESS_TOKEN production

# 2. 新しいトークンを追加
vercel env add LINE_CHANNEL_ACCESS_TOKEN production
# → LINE Developer Consoleで発行した新しいトークンを貼り付け

# 3. 再デプロイ
vercel --prod --force
```

---

### 🔴 問題4: 返信が来ない（エラーなし）

#### チェックリスト

1. **LINE側の設定**
   - [ ] 応答モード = Bot
   - [ ] Use webhook = Enabled
   - [ ] 友だち追加済み
   - [ ] ブロックしていない

2. **環境変数**
   - [ ] LINE_CHANNEL_ACCESS_TOKEN設定済み
   - [ ] トークンが正しいチャンネルのもの

3. **デバッグ確認**
   ```bash
   # Vercelのログを確認
   vercel logs --prod
   
   # ヘルスチェック
   curl https://your-domain.vercel.app/api/health
   ```

---

## 🛠️ デバッグツール

### 1. ヘルスチェックエンドポイント
```bash
# 基本チェック
curl https://line-booking-system-seven.vercel.app/api/health

# 詳細情報
curl https://line-booking-system-seven.vercel.app/api/health?detailed=true
```

### 2. Vercelログ確認
```bash
# リアルタイムログ
vercel logs --prod --follow

# 最新20件
vercel logs --prod -n 20
```

### 3. LINE Developer Console確認
1. Messaging API > Webhook settings > **Recent Deliveries**
2. 配信結果を確認：
   - ✅ Success: 正常
   - ⚠️ Delivered with 0 events: Verifyテスト
   - ❌ Failed: エラー発生

### 4. テスト用エンドポイント

#### /api/ping - 最小テスト
何でもログ出力するだけ
```javascript
// 一時的にWebhook URLを変更してテスト
https://your-domain.vercel.app/api/ping
```

#### /api/echo - エコーボット
メッセージをそのまま返す
```javascript
// 基本動作確認用
https://your-domain.vercel.app/api/echo
```

---

## 📋 セットアップチェックリスト

### 初回セットアップ
- [ ] LINE Developer Consoleでチャンネル作成
- [ ] アクセストークン発行
- [ ] Vercelに環境変数設定
- [ ] vercel.jsonにエンドポイント登録
- [ ] デプロイ実行
- [ ] Webhook URL設定
- [ ] 応答モード = Bot
- [ ] 友だち追加
- [ ] テストメッセージ送信

### デプロイ前チェック
- [ ] vercel.jsonに新しいエンドポイント追加済み？
- [ ] export default形式？（module.exportsではない）
- [ ] 環境変数は最新？
- [ ] エラーハンドリングで200返す？

---

## 🚨 緊急時の対処

### サービス停止時
1. `/api/health`で死活確認
2. Vercelダッシュボードで状態確認
3. 最新デプロイをロールバック

### 大量エラー発生時
1. Vercelログで原因特定
2. 一時的にWebhookを無効化
3. 修正後、再度有効化

---

## 📞 サポート情報

### ログの見方
```javascript
// 成功パターン
"Events count: 1"
"Processing event: message"
"User message: こんにちは"
"Reply sent successfully!"

// 失敗パターン
"ERROR: No LINE_CHANNEL_ACCESS_TOKEN"
"LINE API Error: 401"
"events: []"  // Verify以外で出たら問題
```

### 役立つリンク
- [LINE Developer Console](https://developers.line.biz/console/)
- [LINE Official Account Manager](https://manager.line.biz/)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [LINE Messaging API Docs](https://developers.line.biz/ja/docs/messaging-api/)

---

## 💡 Tips

1. **本番環境では必ずデータベースを使用**
   - 現在のメモリストレージは再起動で消える

2. **レート制限に注意**
   - LINE API: 1分間に1000リクエストまで

3. **セキュリティ**
   - トークンをコードに直接書かない
   - 環境変数を使用

4. **テスト方法**
   - 開発用と本番用でチャンネルを分ける
   - テスト用の友だちアカウントを作成