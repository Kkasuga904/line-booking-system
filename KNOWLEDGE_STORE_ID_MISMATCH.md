# Store ID不一致問題のナレッジベース

## 問題の概要
2025年8月30日、LINEからの予約時に「Store ID mismatch」エラーが発生し、予約が失敗する問題が発生。

### エラーメッセージ
```
予約の処理に失敗しました。
エラー: Store ID mismatch: frontend=default, server=default-store
```

## 根本原因

### 1. 設定値の不統一
- **フロントエンド** (`liff-calendar.html`): `'default'` を使用
- **バックエンド** (`server.js`): `'default-store'` を期待
- この値の不一致により、サーバー側の検証でエラーが発生

### 2. なぜ発生したか
```javascript
// liff-calendar.html (元のコード)
const storeId = urlParams.get('store_id') || 'default';  // ← 問題の箇所

// server.js (元のコード)
const storeId = process.env.STORE_ID || 'default-store';  // ← 異なるデフォルト値
```

各ファイルで独立してデフォルト値を設定していたため、開発者が異なる値を設定してしまった。

### 3. 発生時期
- 初期実装時から存在していた潜在的な問題
- テスト環境では`store_id`パラメータを明示的に渡していたため発見されず
- 本番環境でパラメータなしでアクセスした際に初めて顕在化

## 実施した修正

### 1. フロントエンド側の統一
```javascript
// liff-calendar.html (修正後)
const storeId = urlParams.get('store_id') || 'default-store';  // 統一
```

### 2. サーバー側の柔軟な対応
```javascript
// server.js (修正後)
// defaultとdefault-storeを同じものとして扱う
const normalizedFrontendStoreId = store_id === 'default' ? 'default-store' : store_id;
const normalizedServerStoreId = storeId === 'default' ? 'default-store' : storeId;

if (normalizedFrontendStoreId && normalizedServerStoreId && 
    normalizedFrontendStoreId !== normalizedServerStoreId) {
    // エラー処理
}
```

## 再発防止策

### 1. 設定値の一元管理
```javascript
// config/constants.js (推奨)
module.exports = {
    DEFAULT_STORE_ID: 'default-store',
    // その他の共通定数
};
```

### 2. 環境変数の活用
```bash
# .env
DEFAULT_STORE_ID=default-store
```

### 3. 自動検証スクリプト
`scripts/prevent-store-id-mismatch.js` を作成：
- 全ファイルのStore ID設定を検査
- 不整合を自動検出
- `--fix` オプションで自動修正

実行方法：
```bash
node scripts/prevent-store-id-mismatch.js        # 検査のみ
node scripts/prevent-store-id-mismatch.js --fix  # 自動修正
```

### 4. CI/CDパイプラインへの組み込み
```yaml
# .github/workflows/validate.yml
- name: Validate Store ID consistency
  run: node scripts/prevent-store-id-mismatch.js
```

## ベストプラクティス

### 1. デフォルト値の管理
- ❌ **悪い例**: 各ファイルで独立して定義
  ```javascript
  // file1.js
  const storeId = 'default';
  
  // file2.js
  const storeId = 'default-store';
  ```

- ✅ **良い例**: 共通設定から参照
  ```javascript
  // 両ファイル共通
  const { DEFAULT_STORE_ID } = require('./config/constants');
  const storeId = urlParams.get('store_id') || DEFAULT_STORE_ID;
  ```

### 2. 値の正規化
レガシーシステムとの互換性を保つ場合：
```javascript
function normalizeStoreId(id) {
    const mapping = {
        'default': 'default-store',
        'store1': 'store-001',
        // 他のマッピング
    };
    return mapping[id] || id;
}
```

### 3. バリデーション強化
```javascript
// 許可されたStore IDのリスト
const VALID_STORE_IDS = ['default-store', 'store-001', 'store-002'];

function validateStoreId(storeId) {
    if (!VALID_STORE_IDS.includes(storeId)) {
        throw new Error(`Invalid store ID: ${storeId}`);
    }
    return true;
}
```

## 学んだ教訓

1. **定数は一元管理する**
   - 複数の場所で同じ値を使う場合は、必ず共通の設定ファイルに定義

2. **デフォルト値の重要性**
   - デフォルト値も重要な設定値として扱い、適切に管理する

3. **互換性の考慮**
   - 既存システムとの互換性を保つため、正規化ロジックを実装

4. **早期検証**
   - 開発段階で不整合を検出できる仕組みを構築

5. **ログの重要性**
   - 詳細なログにより、問題の特定が迅速に行えた

## 関連ファイル
- `/server.js` - サーバー側のStore ID検証
- `/public/liff-calendar.html` - LINE予約カレンダー
- `/scripts/prevent-store-id-mismatch.js` - 検証スクリプト
- `/api/calendar-reservation` - 予約APIエンドポイント

## 今後の改善案

1. **TypeScriptの導入**
   - 型定義により、コンパイル時に不整合を検出

2. **設定管理システム**
   - 環境ごとの設定を一元管理するシステムの導入

3. **E2Eテストの強化**
   - デフォルト値での動作も含めたテストケースの追加

## 参考リンク
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [12 Factor App - Config](https://12factor.net/config)
- [Node.js環境変数管理のベストプラクティス](https://www.npmjs.com/package/dotenv)