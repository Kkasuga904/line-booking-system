# 📊 GCPコスト最適化ガイド - 月額$0運用を目指して

## 🎯 目標: 最小限のコストで本番環境を運用

### 現在の月額コスト見積もり
- **Cloud Run**: $0～$5
- **Cloud Build**: $0（無料枠内）
- **Monitoring**: $0（無料ツール使用）
- **合計**: **月額$0～$5**

## 💰 Cloud Run コスト削減設定

### 1. インスタンス設定
```yaml
# 最小構成
--min-instances=0      # スケールtoゼロ（リクエストがない時は課金なし）
--max-instances=1      # 最大1インスタンス（同時実行を制限）
--memory=256Mi         # 最小メモリ（256MBで十分）
--cpu=1               # CPU 1コア
--concurrency=10      # 同時リクエスト数を制限
```

### 2. リージョン選択
```bash
# アジアで最も安いリージョン
--region=asia-northeast1  # 東京（レイテンシと価格のバランス）
```

### 3. 料金計算例
```
リクエスト: 1000回/日 × 30日 = 30,000回/月
実行時間: 平均200ms/リクエスト
月間実行時間: 30,000 × 0.2秒 = 100分

Cloud Run無料枠:
- 200万リクエスト/月
- 360,000 GB秒/月
- 180,000 vCPU秒/月

→ 完全無料枠内で運用可能！
```

## 🚀 CI/CD コスト削減

### GitHub Actions（推奨）
```yaml
# 無料枠: 2000分/月
jobs:
  deploy:
    runs-on: ubuntu-latest  # 無料ランナー
    timeout-minutes: 10     # タイムアウト設定必須
```

### Cloud Build（代替案）
```yaml
# 無料枠: 120分/月
timeout: 600s  # 10分でタイムアウト
machineType: 'E2_MEDIUM'  # 最小マシンタイプ
```

## 📊 無料監視ツール

### 1. UptimeRobot
- **コスト**: $0
- **機能**: 50モニターまで無料
- **設定**: 5分間隔でヘルスチェック

### 2. Cron-job.org
- **コスト**: $0
- **機能**: 無料クーロンジョブ
- **用途**: 定期的なヘルスチェック

### 3. Google Cloud Monitoring
- **無料枠**: 
  - 100万API呼び出し/月
  - 50GBログ/月
- **設定**: 最小限のメトリクスのみ収集

## 🔥 ホットスタート対策

### 問題
Cloud Runのコールドスタート（初回リクエストが遅い）

### 解決策（無料）
```javascript
// 1. Cron-job.orgで5分ごとにping
// 2. 軽量なヘルスチェックエンドポイント
app.get('/api/ping', (req, res) => {
  res.status(200).send('pong');
});
```

## 📉 データベースコスト削減

### Supabase（無料プラン）
- **ストレージ**: 500MB
- **帯域幅**: 2GB/月
- **API呼び出し**: 無制限

### 最適化方法
```javascript
// 1. 接続プーリング
const supabase = createClient(url, key, {
  connectionLimit: 5  // 接続数制限
});

// 2. キャッシング
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5分

// 3. バッチ処理
const batchInsert = await supabase
  .from('table')
  .insert(records);  // 個別ではなくバッチで
```

## 🎯 実装済みコスト削減施策

### 1. テストコード
- ✅ 最小限の必須テストのみ
- ✅ 並列実行を制限（`maxWorkers=2`）
- ✅ タイムアウト設定

### 2. CI/CDパイプライン
- ✅ GitHub Actions無料枠活用
- ✅ ソースからの直接デプロイ（Artifact Registry不要）
- ✅ ビルドキャッシュ活用

### 3. 監視システム
- ✅ 無料ツール組み合わせ
- ✅ メモリ内メトリクス（DB書き込み削減）
- ✅ 軽量ダッシュボード

## 📋 チェックリスト

### デプロイ前
- [ ] min-instances=0 を確認
- [ ] メモリサイズ最適化（256MB）
- [ ] 不要なログ出力削除
- [ ] 環境変数の最小化

### 運用中
- [ ] 月次コストレポート確認
- [ ] 未使用リソース削除
- [ ] ログローテーション設定
- [ ] アラート閾値調整

## 💡 追加のコスト削減Tips

### 1. 静的ファイルのCDN化
```javascript
// 静的ファイルはGitHub PagesやNetlifyで無料ホスティング
// Cloud Runは APIのみに使用
```

### 2. レート制限
```javascript
// 悪意のあるリクエストによるコスト増加を防ぐ
const rateLimiter = {
  windowMs: 15 * 60 * 1000,  // 15分
  max: 100  // 最大100リクエスト
};
```

### 3. 圧縮
```javascript
// レスポンス圧縮で帯域幅削減
app.use(compression());
```

## 📊 月次コスト監視

### GCPコンソール
```bash
# 予算アラート設定
gcloud billing budgets create \
  --billing-account=YOUR_BILLING_ACCOUNT \
  --display-name="Monthly Budget" \
  --budget-amount=5 \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100
```

### コストレポート
毎月1日に前月のコストを確認:
1. Cloud Console > Billing
2. Reports > 前月を選択
3. サービス別コストを確認

## 🎉 結果

このガイドに従うことで:
- **開発環境**: 完全無料
- **本番環境**: 月額$0～$5
- **監視**: 完全無料
- **CI/CD**: 完全無料

合計: **月額$5以下で本番運用可能！**