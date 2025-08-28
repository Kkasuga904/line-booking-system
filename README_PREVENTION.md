# 🛡️ LINE予約システム 再発防止システム

## 概要
このドキュメントは、LINE予約システムで発生した問題を防ぐために作成された予防保守システムについて説明します。

## 🚀 クイックスタート

### 1. デプロイ前チェック
```bash
# デプロイ前に必ず実行
npm run pre-deploy
```

### 2. 問題の自動修正
```bash
# Store IDやデータ不整合を自動修正
npm run prevent-issues
```

### 3. システムバリデーション
```bash
# システム全体の動作確認
npm run validate:system
```

### 4. ヘルスチェック
```bash
# 本番環境の健康状態確認
npm run health
```

## 📋 利用可能なスクリプト

| コマンド | 説明 | いつ使うか |
|---------|------|-----------|
| `npm run prevent-issues` | データ不整合の自動修正 | 問題発生時、定期メンテナンス |
| `npm run validate:system` | システム全体の検証 | デプロイ後、問題調査時 |
| `npm run pre-deploy` | デプロイ前チェック | デプロイ前（必須） |
| `npm run health` | ヘルスチェック | 監視、問題調査時 |

## 🔍 各スクリプトの詳細

### 1. prevent-issues.js
**目的**: データとコードの問題を自動修正

**実行内容**:
- Store ID不一致の修正
- データベースカラムの確認と修正
- 席データの初期化
- APIファイルのハードコーディング検出
- 環境変数の検証
- 古いpending予約のクリーンアップ

**実行例**:
```bash
$ npm run prevent-issues

=== Store ID整合性チェック ===
✅ すべての予約のstore_idが正しいです
✅ すべての席のstore_idが正しいです

=== データベースカラム確認 ===
✅ is_lockedカラムが存在します

=== 席データ確認 ===
✅ 8件の席が存在します
```

### 2. validate-system.js
**目的**: システムの動作検証

**テスト項目**:
- API応答性（各APIの応答時間）
- データベース接続
- Store ID一貫性
- 予約作成機能
- 席データ存在確認
- LINE設定確認
- 公開ページアクセス

**実行例**:
```bash
$ npm run validate:system

📡 API応答性テスト
✅ PASSED GET /api/webhook-simple
✅ PASSED GET /api/calendar-reservation

総合スコア: 95% (19/20)
👍 システムは概ね正常です
```

### 3. pre-deploy-check.js
**目的**: デプロイ前の事前チェック

**チェック項目**:
- package.json設定（ES Module）
- 環境変数設定状況
- APIファイル数（12以下）
- vercel.json設定
- Store IDハードコーディング
- ES Module形式
- 必須publicファイル

**実行例**:
```bash
$ npm run pre-deploy

🚀 LINE予約システム デプロイ前チェック

✅ 成功: 15項目
⚠️ 警告: 2項目
❌ 失敗: 0項目

✅ デプロイ可能です！
```

### 4. health-check API
**目的**: 本番環境のリアルタイム監視

**エンドポイント**: `/api/health-check`

**監視項目**:
- API応答性
- 環境変数設定
- Store ID設定
- データベース接続
- データ整合性
- 席の可用性
- 古いpending予約
- LINE設定

**レスポンス例**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "api": { "status": "healthy" },
    "environment": { "status": "healthy" },
    "database": { "status": "healthy", "responseTime": "45ms" },
    "seatAvailability": { "status": "healthy", "count": 6 }
  },
  "summary": "All systems operational"
}
```

## 🚨 トラブルシューティング

### Case 1: デプロイが失敗する
```bash
# 1. 事前チェック実行
npm run pre-deploy

# 2. 失敗項目を確認して修正

# 3. 自動修正を試す
npm run prevent-issues

# 4. 再度チェック
npm run pre-deploy
```

### Case 2: 予約が表示されない
```bash
# 1. Store ID確認と修正
npm run prevent-issues

# 2. システムバリデーション
npm run validate:system

# 3. ヘルスチェック
npm run health
```

### Case 3: APIエラーが発生
```bash
# 1. ヘルスチェックで問題箇所特定
curl https://line-booking-system-seven.vercel.app/api/health-check | jq

# 2. ログ確認
vercel logs --prod

# 3. 自動修正実行
npm run prevent-issues
```

## 📅 推奨メンテナンススケジュール

### 日次
- ヘルスチェック監視
- エラーログ確認

### 週次
- `npm run prevent-issues` 実行
- `npm run validate:system` 実行

### デプロイ時（必須）
1. `npm run pre-deploy`
2. 問題があれば修正
3. `git commit` & `git push`
4. デプロイ後に `npm run validate:system`

## 🔐 セキュリティ考慮事項

- 環境変数は必ず`.trim()`して使用
- Store IDは環境変数から取得（ハードコーディング禁止）
- エラー時も適切なステータスコードを返す
- センシティブ情報はログに出力しない

## 📊 モニタリング

### Vercelダッシュボード
- Function実行回数
- エラー率
- レスポンスタイム

### カスタムモニタリング
```bash
# リアルタイムログ監視
npm run monitor

# ヘルスチェック定期実行（cronなどで設定）
*/5 * * * * curl https://line-booking-system-seven.vercel.app/api/health-check
```

## 🆘 緊急時対応

1. **即座にヘルスチェック**
   ```bash
   npm run health
   ```

2. **自動修正実行**
   ```bash
   npm run prevent-issues
   ```

3. **それでも解決しない場合**
   - KNOWLEDGE_BASE.md参照
   - PREVENTION_CHECKLIST.md参照
   - 前のコミットにロールバック

## 📝 更新履歴

- 2024-01-15: 初版作成
- Store ID不一致問題の自動修正機能追加
- ヘルスチェックエンドポイント実装
- デプロイ前チェックスクリプト作成