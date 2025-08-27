# ES Module vs CommonJS - ベストプラクティス

## なぜ混在がダメなのか

### 1. Vercel/Node.js環境での問題
```javascript
// ❌ 混在させると起こる問題
// ファイル1: ES Module
import https from 'https';
export default function handler() {}

// ファイル2: CommonJS  
const https = require('https');
module.exports = function handler() {}

// 結果: "require is not defined" エラー
```

### 2. 実際に起きた問題
- **転ばぬ先の杖が仇に** - 両方のフォーマットを使おうとして逆に問題発生
- Account 1は動かない、Account 2は動く - 混在が原因で予期しない挙動
- デバッグが困難 - どちらの形式で書かれているか確認が必要

## 推奨: ES Module一択

### package.jsonで宣言
```json
{
  "type": "module"  // これでES Module固定
}
```

### すべてのファイルをES Moduleで統一
```javascript
// ✅ 良い例 - ES Moduleで統一
import { createClient } from '@supabase/supabase-js';
import https from 'https';

export default async function handler(req, res) {
  // 処理
}

// 名前付きエクスポートも可能
export { handler, otherFunction };
```

## CommonJSが必要な場合の対処法

### 1. 別プロジェクトに分離
```
project/
├── es-module-app/     # ES Module専用
│   └── package.json   # "type": "module"
└── commonjs-app/      # CommonJS専用
    └── package.json   # "type": "commonjs" または指定なし
```

### 2. .mjsと.cjsで明示的に分ける
```
api/
├── handler.mjs       # ES Module (強制)
├── legacy.cjs        # CommonJS (強制)
└── normal.js         # package.jsonの設定に従う
```

### 3. Dynamic importでCommonJSを読む
```javascript
// ES ModuleからCommonJSを読む場合
const module = await import('./commonjs-file.cjs');
```

## Vercel特有の注意点

### 1. Vercelはデフォルトでは両方サポート
- でも混在させると予期しない動作
- デプロイ時にビルドエラーが出ないこともある（最悪）

### 2. 環境変数でモジュールタイプは変えられない
```javascript
// ❌ これはダメ - 実行時には遅い
if (process.env.USE_ES_MODULE) {
  import('./module.js');
} else {
  require('./module.js');
}
```

## 移行戦略

### CommonJS → ES Module移行
```javascript
// Step 1: requireをimportに
- const express = require('express');
+ import express from 'express';

// Step 2: module.exportsをexport defaultに
- module.exports = handler;
+ export default handler;

// Step 3: __dirname, __filenameの置き換え
+ import { fileURLToPath } from 'url';
+ const __filename = fileURLToPath(import.meta.url);
+ const __dirname = path.dirname(__filename);
```

## チェックリスト

### プロジェクト開始時
- [ ] package.jsonに`"type": "module"`を設定
- [ ] ESLintでrequire使用を禁止
- [ ] すべての開発者に方針を共有

### コードレビュー時
- [ ] requireが使われていないか
- [ ] module.exportsが使われていないか
- [ ] import/exportで統一されているか

### デプロイ前
```bash
# 自動チェックスクリプト実行
npm run validate:webhook
```

## まとめ

**混在させない = トラブル回避**

1. **ES Module一択が安全** - 現代的で、Vercelも推奨
2. **package.jsonで明示** - `"type": "module"`
3. **自動チェック導入** - CIでrequireを検出
4. **転ばぬ先の杖** - 最初から統一しておく

今回の教訓：
- 「両方使えるようにしておこう」は逆効果
- 統一性 > 柔軟性
- シンプル・イズ・ベスト