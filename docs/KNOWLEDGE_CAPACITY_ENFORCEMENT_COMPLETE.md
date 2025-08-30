# 容量制限実装 完全ガイド

## 問題と解決策

### 発生した問題
管理画面やAPIから予約を作成する際、容量制限（最大組数・最大人数）が適用されず、制限を超えて予約が入ってしまう

### 根本原因
1. **APIとDBの不整合**: RPC関数は正しく動作するが、API経由では素通りしてしまう
2. **キャッシュ問題**: 古いコードがキャッシュされている
3. **環境変数の不一致**: 開発環境と本番環境のSupabase設定が異なる

## 完全な解決策（3段階防御）

### 第1段階: API側のログ強化とエラーハンドリング

```javascript
// api/reservation-validate.js
// RPCの呼び出し前後にログを追加
console.log('[RPC call] payload', { store_id, date, formattedTime, actualPartySize, user_id });

const { data: result, error: rpcError } = await supabase.rpc('check_and_create_reservation', {
  _store_id: store_id,
  _date: date,
  _time: formattedTime,  // 必ずHH:MM:SS形式
  _party_size: actualPartySize,
  _user_id: user_id
});

console.log('[RPC result]', { result, error: rpcError });

// 結果を厳密にチェック
if (result && !result.success) {
  console.log('[RPC rejection] Capacity check failed:', result);
  return res.status(400).json(result);
}
```

### 第2段階: データベーストリガーによる強制防御

```sql
-- BEFORE INSERTトリガーで全ての予約作成をチェック
create trigger trg_enforce_capacity_before_insert
before insert on public.reservations
for each row
execute function public.enforce_capacity_before_insert();
```

**効果**: 
- どの経路（API、管理画面、直接INSERT）からでも容量制限が適用される
- データベースレベルで防御するため、すり抜けが物理的に不可能

### 第3段階: UI側の視覚的フィードバック

```javascript
// 容量状態を取得してUIに反映
const { data: capacityStatus } = await supabase.rpc('get_capacity_status', {
  _store_id: store_id,
  _date: date
});

// 状態に応じて色分け
// - full: グレーアウト（選択不可）
// - limited: 黄色（残りわずか）
// - available: 緑（予約可能）
```

## 重要なポイント

### 1. 時刻形式の統一
- **必須**: `HH:MM:SS` 形式（例: `18:30:00`）
- `18:30` のような形式はエラーの原因

### 2. 環境変数の確認
```bash
# .env.yaml
SUPABASE_URL: "https://your-project.supabase.co"
SUPABASE_ANON_KEY: "your-anon-key"
```

### 3. デプロイ時の注意
```bash
# Cloud Run再デプロイ（変更を反映）
gcloud run deploy line-booking-api --source . --region asia-northeast1

# ブラウザのハードリロード
Ctrl + Shift + R
```

## トラブルシューティング

### 症状: SQLエディタでは制限が効くが、APIでは効かない

**原因**: 
- APIが古いコードを実行している
- RPCの結果を正しく処理していない

**解決策**:
1. APIサーバーを再デプロイ
2. ログを確認してRPCの結果をチェック
3. トリガーを適用して強制防御

### 症状: 「function does not exist」エラー

**原因**: 引数の型が一致していない

**解決策**:
```sql
-- 正しい引数の型を確認
SELECT pg_get_function_arguments(oid) 
FROM pg_proc 
WHERE proname = 'check_and_create_reservation';
```

### 症状: 容量制限の値が反映されない

**原因**: 
- キャッシュされた古いルール
- 間違ったstore_idやdate

**解決策**:
```sql
-- 現在のルールを確認
SELECT * FROM capacity_control_rules 
WHERE store_id = 'default-store' 
  AND is_active = true;
```

## ベストプラクティス

1. **多層防御**: API、RPC、トリガーの3段階で防御
2. **ログ出力**: 全ての重要な処理でログを出力
3. **エラーメッセージ**: ユーザーに分かりやすい日本語メッセージ
4. **視覚的フィードバック**: 予約不可の時間をグレーアウト
5. **定期的な確認**: 容量ルールと実際の予約数を定期的に確認

## 実装チェックリスト

- [ ] API側にログ追加
- [ ] Cloud Run再デプロイ
- [ ] トリガー適用（20250830_006_permanent_capacity_enforcement.sql）
- [ ] 容量状態取得関数の実装
- [ ] UI側の色分け実装
- [ ] エラーメッセージの日本語化
- [ ] テスト実施（並行予約テスト）

## 参考SQL

```sql
-- 容量状態の確認
SELECT * FROM get_capacity_status('default-store', '2025-08-30');

-- 現在の予約状況
SELECT store_id, date, time, count(*) as groups, sum(people) as people
FROM reservations
WHERE status IN ('confirmed', 'pending')
GROUP BY store_id, date, time;
```