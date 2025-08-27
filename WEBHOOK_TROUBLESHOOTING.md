# LINE Webhook トラブルシューティングガイド

## 問題の症状と原因

### 1. Webhookからレスポンスが返ってこない問題

**症状:**
- LINEでメッセージを送ってもBotから返信が来ない
- Account 1は動かないが、Account 2は動作する

**根本原因:**
1. **ES Module と CommonJS の混在**
   - Vercel環境でES Moduleとして動作するのに`require()`を使用していた
   - `module.exports`と`export default`の混在

2. **非同期処理のタイミング問題**
   - レスポンスを返す前に非同期処理を開始していた
   - LINE APIは即座にレスポンス(200 OK)を要求する

3. **環境変数の未設定**
   - LINE_CHANNEL_ACCESS_TOKENが設定されていない
   - LIFF_IDが設定されていない

4. **Vercel関数の制限**
   - Hobbyプランは12関数まで
   - APIファイルの統合が必要

## 再発防止策

### 1. コード規約の統一

```javascript
// ❌ 悪い例 - CommonJS
const https = require('https');
module.exports = async function handler(req, res) { }

// ✅ 良い例 - ES Module
import https from 'https';
export default async function handler(req, res) { }
```

### 2. Webhook処理パターン

```javascript
// ✅ 推奨パターン - 即座にレスポンスを返す
export default async function handler(req, res) {
  console.log('=== Webhook Start ===');
  
  // 1. すぐに200を返す（重要！）
  res.status(200).json({ ok: true });
  
  // 2. その後で処理を実行
  if (req.body?.events) {
    // 非同期処理はここで
    await processEvents(req.body.events);
  }
}
```

### 3. エラーハンドリング

```javascript
// 各処理でtry-catchを使用
try {
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    console.error('LINE API Error:', response.status);
  }
} catch (error) {
  console.error('Request failed:', error);
  // エラーでも処理を継続
}
```

### 4. 環境変数チェック

```javascript
// 起動時に環境変数をチェック
const requiredEnvVars = [
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_SECRET',
  'LIFF_ID'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.warn(`WARNING: ${envVar} is not set`);
  }
}
```

## デバッグ手順

### 1. ヘルスチェック
```bash
# Webhook健康状態を確認
curl https://line-booking-system-seven.vercel.app/api/webhook-health
```

### 2. ログ確認
```bash
# Vercelのログを確認
vercel logs --prod
```

### 3. 環境変数確認
```bash
# 環境変数が設定されているか確認
vercel env ls
```

### 4. テスト送信
```javascript
// テスト用スクリプト
const testWebhook = async () => {
  const response = await fetch('https://line-booking-system-seven.vercel.app/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      events: [{
        type: 'message',
        replyToken: 'test-token',
        message: { type: 'text', text: 'テスト' }
      }]
    })
  });
  
  console.log('Status:', response.status);
  const result = await response.json();
  console.log('Response:', result);
};
```

## Account間の相互影響

### 問題の原因
Account 2の修正時にAccount 1のコードを変更してしまう可能性：

1. **共通ファイルの変更**
   - 両アカウントで同じWebhook処理を使用
   - 片方の修正が他方に影響

2. **環境変数の混在**
   - 同じ環境変数名を使用
   - デプロイ時の設定ミス

### 対策

1. **独立したエンドポイント**
```javascript
// Account 1専用
/api/webhook-account1

// Account 2専用  
/api/webhook-account2
```

2. **環境変数の分離**
```
ACCOUNT1_LINE_TOKEN=xxx
ACCOUNT2_LINE_TOKEN=yyy
```

3. **デプロイ前の確認**
```bash
# デプロイ前に差分確認
git diff
vercel --prod --confirm
```

## モニタリング

### 定期的な健康チェック
```javascript
// 5分ごとに健康状態を確認
setInterval(async () => {
  const health = await fetch('/api/webhook-health');
  if (!health.ok) {
    // アラート送信
    console.error('Webhook is unhealthy');
  }
}, 5 * 60 * 1000);
```

### エラー通知
```javascript
// エラー発生時に管理者に通知
if (error) {
  await notifyAdmin({
    error: error.message,
    timestamp: new Date().toISOString(),
    endpoint: 'webhook-simple'
  });
}
```

## チェックリスト

### デプロイ前
- [ ] ES Module形式で統一されているか
- [ ] 環境変数が設定されているか
- [ ] エラーハンドリングが適切か
- [ ] ログ出力が十分か

### デプロイ後
- [ ] ヘルスチェックが通るか
- [ ] テストメッセージに返信があるか
- [ ] エラーログが出ていないか
- [ ] 両アカウントが動作するか

## まとめ

Webhookが動作しない主な原因：
1. ES Module/CommonJSの混在
2. 非同期処理のタイミング
3. 環境変数の未設定
4. API制限の超過

これらを防ぐため：
- コード規約を統一
- 適切なエラーハンドリング
- 定期的なモニタリング
- デプロイ前の確認

Account間の影響を防ぐため：
- エンドポイントの分離
- 環境変数の分離
- 独立したテスト