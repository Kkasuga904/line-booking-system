# alert(1) ポップアップ問題の詳細分析と再発防止策

## 問題の概要
Vercelにデプロイした際に、ページ更新のたびに`alert(1)`ポップアップが表示される問題が発生した。

## 根本原因

### 1. テストコード内のXSSテストデータ
```javascript
// test-ui-improvements.js などに含まれていた問題のコード
const xssTestData = {
  uri: "javascript:alert(1)",  // XSS攻撃をシミュレート
  label: "XSS Test"
};
```

### 2. Vercelのビルドプロセス
- Vercelがすべてのファイルをビルドに含めていた
- `.vercelignore`が不適切または不在
- テストファイルが本番環境に含まれてしまった

### 3. Content Security Policy (CSP)の不在
- 初期状態ではCSPヘッダーが設定されていなかった
- `javascript:`スキームのURLが実行可能な状態だった

## 問題の発生メカニズム

1. **ビルド時の混入**
   - テストファイルがビルド成果物に含まれる
   - JavaScriptバンドルに`javascript:alert(1)`が混入

2. **ブラウザでの実行**
   - ブラウザがページロード時にJavaScriptを評価
   - `javascript:`スキームが実行される

3. **キャッシュの影響**
   - Vercelのビルドキャッシュに問題が残存
   - Service Workerがキャッシュを保持

## 実施した対策

### 1. CSPヘッダーの追加
```json
// vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self' https:; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com..."
        }
      ]
    }
  ]
}
```

### 2. .vercelignoreの強化
```
# テストファイルを除外
test/
tests/
**/*.test.*
**/*.spec.*
**/__tests__/**
**/test-runner.*
**/test-*.js
```

### 3. セキュリティバリデーターの実装
```javascript
// utils/security-validator.js
export function isValidUrl(url) {
  const dangerousSchemes = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:'
  ];
  // 危険なスキームをブロック
}
```

### 4. Service Workerの強制削除
```javascript
// service-worker.js
self.addEventListener('activate', e => {
  e.waitUntil(
    self.registration.unregister()
  );
});
```

## 再発防止のチェックリスト

### デプロイ前
- [ ] テストファイルが`.vercelignore`に含まれているか確認
- [ ] `javascript:`を含むコードを検索して除去
- [ ] CSPヘッダーが適切に設定されているか確認

### コード実装時
- [ ] URLを扱う際は必ずバリデーション関数を使用
- [ ] ユーザー入力は必ずサニタイズ
- [ ] 外部URLは許可リスト方式で管理

### テスト実装時
- [ ] XSSテストデータは別ファイルで管理
- [ ] テストファイルは必ず`test/`ディレクトリに配置
- [ ] 本番ビルドからテストを除外する設定を確認

## 緊急対応手順

問題が再発した場合：

1. **即座の対処**
   ```bash
   # Vercelのビルドキャッシュをクリア
   vercel --force
   ```

2. **ブラウザ側の対処**
   - シークレットモードで確認
   - キャッシュとCookieをクリア
   - Service Workerを手動削除

3. **コードの確認**
   ```bash
   # 危険なコードを検索
   grep -r "javascript:" . --include="*.js" --include="*.html"
   grep -r "alert(" . --include="*.js" --include="*.html"
   ```

## 学んだ教訓

1. **テストと本番の分離**
   - テストコードは本番環境から完全に分離する
   - ビルド設定で明示的に除外する

2. **Defense in Depth（多層防御）**
   - CSPヘッダー
   - 入力検証
   - 出力エスケープ
   - ビルド時の除外

3. **キャッシュ管理**
   - ビルドキャッシュの影響を理解
   - Service Workerの適切な管理
   - 強制リフレッシュの方法を準備

## 参考リンク

- [Content Security Policy (CSP) - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Vercel Build Output Configuration](https://vercel.com/docs/build-output-api)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

## 更新履歴

- 2025-01-27: 初版作成
- 問題発見から解決まで約2時間
- 影響範囲：line-booking-systemの本番環境