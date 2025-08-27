# トラブルシューティング ナレッジベース

## 問題: LINE Bot が返信しない（Vercel キャッシュ問題）

### 発生日
2025-08-27

### 症状
- LINE Bot にメッセージを送っても返信が来ない
- Vercel ログに `fetch failed` エラーが表示される
- コードを修正してもエラーが解消されない

### 根本原因
**Vercel のビルドキャッシュが非常に強力で、古いバージョンのコードが実行され続ける**

具体的には：
1. Node.js の `fetch` API を使用していた古いコード
2. `https` モジュールに変更したが、Vercel がキャッシュから古いコードを使い続けた
3. git push しても、同じファイル名だとキャッシュが更新されない場合がある

### エラーログ
```
TypeError: fetch failed
    at node:internal/deps/undici/undici:13510:13
    at async Object.handler (file:///var/task/api/webhook.js:35:22)
```

### 解決方法
1. **ファイル名を変更** することで強制的にキャッシュをバイパス
   - `api/webhook-supabase.js` → `api/webhook-handler.js`
   - `vercel.json` の rewrites も更新

2. **CommonJS 形式に書き換え** （import → require）
   ```javascript
   // ❌ ESM (キャッシュされやすい)
   import https from 'https';
   export default async function handler() {}
   
   // ✅ CommonJS (より確実)
   const https = require('https');
   exports.default = async function handler() {}
   ```

### 再発防止策

#### 1. バージョン番号をコードに埋め込む
```javascript
const WEBHOOK_VERSION = '1.0.1';  // デプロイごとに更新
console.log(`=== Webhook v${WEBHOOK_VERSION} Start ===`);
```

#### 2. Vercel のビルドキャッシュをクリアする方法
- ファイル名を変更
- force push を使用: `git push --force-with-lease`
- 空コミットで強制デプロイ: `git commit --allow-empty -m "Force rebuild"`

#### 3. デプロイ確認手順
```bash
# 1. デプロイ後、バージョンを確認
curl https://line-booking-system-seven.vercel.app/api/version

# 2. ログでバージョン番号を確認
# Vercel Dashboard → Functions → Logs
```

#### 4. 環境変数の確認
- Vercel Dashboard → Settings → Environment Variables
- 特に `LINE_CHANNEL_ACCESS_TOKEN` が正しく設定されているか

### チェックリスト
- [ ] コードにバージョン番号を含める
- [ ] デプロイ後、必ずバージョン番号をログで確認
- [ ] 重要な変更時はファイル名変更を検討
- [ ] CommonJS 形式を使用（ESM より確実）
- [ ] 環境変数が正しく設定されているか確認

### 関連ファイル
- `api/webhook-handler.js` - メインの Webhook ハンドラー（CommonJS形式）
- `api/webhook-supabase.js` - 古い Webhook（fetch使用、問題あり）
- `vercel.json` - ルーティング設定
- `api/version.js` - バージョン確認エンドポイント

### 教訓
**Vercel のキャッシュは非常に強力**。コードが更新されない場合は、まずキャッシュを疑い、ファイル名変更または force rebuild を試す。

### 重要な対策実装済み
1. **webhook-handler.js** - CommonJS形式でhttpsモジュール使用
2. **バージョン管理** - コード内にバージョン番号埋め込み
3. **即座に200返却** - LINE APIの要件に準拠
4. **バージョンチェックAPI** - `/api/version` でデプロイ確認可能