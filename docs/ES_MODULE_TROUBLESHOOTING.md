# ES Module トラブルシューティング ナレッジベース

## 問題の概要
Vercelデプロイ時に以下のエラーが発生する場合があります：
```
ReferenceError: require is not defined in ES module scope, you can use import instead
This file is being treated as an ES module because it has a '.js' file extension and '/var/task/package.json' contains "type": "module".
```

## 原因
- `package.json` に `"type": "module"` が設定されているため、`.js` ファイルはES Moduleとして扱われる
- CommonJS構文（`require()`, `module.exports`など）は使用できない

## 解決方法

### 1. CommonJS → ES Module 変換対応表

| CommonJS | ES Module |
|----------|-----------|
| `const x = require('module')` | `import x from 'module'` |
| `const { x, y } = require('module')` | `import { x, y } from 'module'` |
| `module.exports = handler` | `export default handler` |
| `exports.handler = handler` | `export { handler }` |
| `__dirname` | `path.dirname(fileURLToPath(import.meta.url))` |
| `__filename` | `fileURLToPath(import.meta.url)` |

### 2. 具体的な修正例

**Before (CommonJS):**
```javascript
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // ...
}
```

**After (ES Module):**
```javascript
import https from 'https';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // ...
}
```

## 再発防止策

### 1. 自動検証スクリプト
`scripts/validate-modules.js` を用意しました。デプロイ前に実行してください：

```bash
node scripts/validate-modules.js
```

このスクリプトは以下をチェックします：
- `require()` の使用
- `module.exports` の使用
- `exports.xxx` の使用
- `__dirname` / `__filename` の使用

### 2. package.json にスクリプト追加
```json
{
  "scripts": {
    "validate": "node scripts/validate-modules.js",
    "predeploy": "npm run validate",
    "deploy": "vercel --prod"
  }
}
```

### 3. VSCode 設定
`.vscode/settings.json` に追加：
```json
{
  "eslint.rules": {
    "no-restricted-globals": ["error", "require", "__dirname", "__filename"]
  }
}
```

## よくあるパターンと対処法

### パターン1: 動的import
**問題のコード:**
```javascript
const module = require(`./modules/${name}`);
```

**解決策:**
```javascript
const module = await import(`./modules/${name}`);
```

### パターン2: 条件付きrequire
**問題のコード:**
```javascript
if (process.env.NODE_ENV === 'production') {
  const prod = require('./prod-config');
}
```

**解決策:**
```javascript
if (process.env.NODE_ENV === 'production') {
  const prod = await import('./prod-config');
}
```

### パターン3: JSON読み込み
**問題のコード:**
```javascript
const config = require('./config.json');
```

**解決策:**
```javascript
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const config = JSON.parse(readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));
```

## Vercel特有の注意点

1. **ファイル拡張子**
   - `.js` → ES Module として扱われる
   - `.cjs` → CommonJS として扱われる
   - `.mjs` → 明示的にES Module

2. **環境変数での切り替え**
   - Vercelでは `package.json` の `"type": "module"` を尊重
   - ローカルとVercelで挙動が異なる場合がある

3. **エラーメッセージの見方**
   - `at file:///var/task/api/xxx.js:4:15` → 4行目15文字目にエラー
   - 通常は `require()` や `module.exports` の位置

## デバッグ手順

1. **エラーログ確認**
   ```bash
   vercel logs --follow
   ```

2. **ローカルでES Module環境テスト**
   ```bash
   NODE_OPTIONS='--experimental-modules' node api/webhook-handler.js
   ```

3. **検証スクリプト実行**
   ```bash
   npm run validate
   ```

## チェックリスト

デプロイ前に確認：
- [ ] `require()` を `import` に変換済み
- [ ] `module.exports` を `export default` に変換済み
- [ ] `validate-modules.js` でエラーなし
- [ ] ローカルでテスト実行成功
- [ ] Vercel Functions ログにエラーなし

## 参考リンク
- [Node.js ES Modules](https://nodejs.org/api/esm.html)
- [Vercel Functions with ES Modules](https://vercel.com/docs/functions/runtimes/node-js#es-modules)
- [MDN: JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)