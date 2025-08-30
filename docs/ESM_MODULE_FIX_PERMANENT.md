# ESMモジュール形式対応 - 恒久的解決策

## 問題の概要
Node.jsアプリケーションでESM（ECMAScript Modules）とCommonJSモジュールの混在により、以下のエラーが発生：
- `Error [ERR_REQUIRE_ESM]: require() of ES Module not supported`
- `SyntaxError: Cannot use import statement outside a module`
- Module import失敗による500エラー

## 恒久的解決策

### 1. package.jsonの設定
```json
{
  "type": "module",
  "engines": {
    "node": ">=14.0.0"
  }
}
```

### 2. すべてのモジュールをESM形式に統一

#### Before (CommonJS):
```javascript
const { createClient } = require('@supabase/supabase-js');
module.exports = { functionName };
```

#### After (ESM):
```javascript
import { createClient } from '@supabase/supabase-js';
export { functionName };
```

### 3. 環境変数の遅延初期化パターン

```javascript
// ❌ Bad: モジュールロード時に初期化
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ✅ Good: 遅延初期化
let supabase = null;

function getSupabaseClient() {
  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
  }
  return supabase;
}
```

### 4. サーバーでの静的インポート

```javascript
// server.js の先頭で静的インポート
import { getCapacityStatus } from './api/capacity-status.js';

// ルートハンドラで直接使用
app.get('/api/capacity-status', async (req, res) => {
  try {
    return await getCapacityStatus(req, res);
  } catch (error) {
    console.error('Capacity status API error:', error);
    res.status(500).json({ error: 'API not available' });
  }
});
```

## チェックリスト

### 新しいAPIモジュール作成時
- [ ] ESM形式（import/export）を使用
- [ ] 環境変数依存の初期化は遅延実行
- [ ] server.jsに静的インポートを追加
- [ ] ファイル拡張子を明示的に指定（.js）

### 既存モジュールの変換時
- [ ] require → import に変換
- [ ] module.exports → export に変換
- [ ] __dirname使用箇所の修正
- [ ] 動的import()の静的importへの変換

## トラブルシューティング

### エラー: `Cannot find module`
```javascript
// ❌ 拡張子なし
import { function } from './module';

// ✅ 拡張子あり
import { function } from './module.js';
```

### エラー: `__dirname is not defined`
```javascript
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

### エラー: 環境変数が undefined
```javascript
// 遅延初期化パターンを使用
// または、server起動前に環境変数を設定
```

## デプロイ時の注意事項

1. **Dockerfile**
   - Node.js 14以上を使用
   - package.jsonの"type": "module"を確認

2. **Cloud Run**
   - 環境変数は.env.yamlで管理
   - デプロイコマンドで--env-vars-fileを指定

3. **ローカルテスト**
   ```javascript
   // test-server.js
   process.env.SUPABASE_URL = 'your-url';
   process.env.SUPABASE_ANON_KEY = 'your-key';
   // ... 他の環境変数
   
   import('./server.js');
   ```

## 実装済みファイル

### 変換済みESMモジュール
- `/api/capacity-status.js` - 容量状態API
- `/server.js` - メインサーバー（ESM対応）

### 今後の変換対象
- `/api/reservation-validate.js`
- `/api/reservation-create.js`
- その他のAPIモジュール

## メリット

1. **一貫性**: すべてのモジュールが同じ形式
2. **将来性**: ESMは標準仕様
3. **パフォーマンス**: 静的解析による最適化
4. **メンテナンス性**: import/exportの明確な依存関係

## 参考リンク
- [Node.js ESM Documentation](https://nodejs.org/api/esm.html)
- [ESM vs CommonJS](https://nodejs.org/api/esm.html#differences-between-es-modules-and-commonjs)