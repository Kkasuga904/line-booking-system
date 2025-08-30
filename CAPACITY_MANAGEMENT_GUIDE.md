# 容量管理システム実装ガイド

## 概要
人数ベースの予約制限機能を実装しました。従来の「枠数」ベースから「人数」ベースの管理に移行し、より柔軟な予約管理が可能になります。

## 主な機能

### 1. テンプレート機能
- **容量テンプレート作成**: 時間帯ごとの人数上限を設定
- **一括適用**: 期間や曜日を指定してテンプレートを適用
- **3つの容量タイプ**:
  - `people`: 人数制限
  - `groups`: 組数制限  
  - `seats`: 席数制限

### 2. 日次例外設定
- 特定日の容量を個別に上書き
- 祝日やイベント時の特別設定が可能
- 時間指定または終日設定

### 3. 人数ベースの予約検証
- 予約時に人数を指定
- リアルタイムで空き状況を確認
- グループ予約にも対応

## セットアップ手順

### 1. データベースマイグレーション

Supabaseのダッシュボードから以下を実行：

```bash
# SQLエディタで実行
# ファイル: apply-capacity-migration.sql の内容をコピーして実行
```

または、直接SQLファイルを実行：

```sql
-- Supabase SQL エディタで実行
-- apply-capacity-migration.sql の内容を貼り付けて実行
```

### 2. 環境変数の確認

```env
SUPABASE_URL=https://faenvzzeguvlconvrqgp.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
STORE_ID=default-store
```

### 3. サーバーの再起動

```bash
# ローカル開発
npm run dev

# GCP デプロイ
gcloud run deploy line-booking-api --source . --region asia-northeast1
```

## 使い方

### 管理画面へのアクセス

1. **容量テンプレート管理画面**
   - URL: `/capacity-templates`
   - テンプレートの作成・編集・適用

2. **API エンドポイント**

#### テンプレート管理
```javascript
// テンプレート一覧取得
GET /api/capacity-templates/templates?store_id=default-store

// テンプレート作成
POST /api/capacity-templates/templates
{
  "store_id": "default-store",
  "template_name": "平日標準",
  "capacity_type": "people",
  "time_capacities": {
    "09:00": 10,
    "10:00": 15,
    // ...
  },
  "default_capacity": 10
}

// テンプレート適用
POST /api/capacity-templates/templates/apply
{
  "store_id": "default-store",
  "template_id": "uuid",
  "start_date": "2025-01-01",
  "end_date": "2025-01-31",
  "days_of_week": [1, 2, 3, 4, 5] // 月〜金
}
```

#### 例外設定
```javascript
// 日次例外設定
POST /api/capacity-templates/exceptions
{
  "store_id": "default-store",
  "exception_date": "2025-01-01",
  "exception_time": null, // 終日
  "capacity_type": "people",
  "capacity": 0, // 休業
  "reason": "元日"
}
```

#### 予約管理（人数ベース）
```javascript
// 予約可能性チェック
POST /api/reservation/validate
{
  "store_id": "default-store",
  "date": "2025-01-15",
  "time": "14:00",
  "party_size": 4,
  "is_group": false
}

// 予約作成
POST /api/reservation/create
{
  "store_id": "default-store",
  "user_id": "U12345",
  "user_name": "山田太郎",
  "date": "2025-01-15",
  "time": "14:00",
  "party_size": 4,
  "is_group": false
}
```

## データベース構造

### 新規テーブル

1. **capacity_templates**: テンプレート定義
2. **capacity_rules**: テンプレート適用ルール
3. **capacity_exceptions**: 日次例外設定
4. **time_slots_extended**: 拡張時間枠（人数管理）

### 既存テーブルの変更

- **reservations**: 
  - `party_size` カラム追加（人数）
  - `is_group` カラム追加（グループ予約フラグ）

## トラブルシューティング

### Q: テンプレートが適用されない
A: 以下を確認してください：
- 日付範囲が正しいか
- 曜日指定が適切か
- テンプレートがアクティブか

### Q: 予約が作成できない
A: 容量制限を確認：
- 人数上限に達していないか
- グループ数上限に達していないか
- 例外設定で容量0になっていないか

### Q: データ移行時のエラー
A: 既存データとの競合を確認：
- time_slots_extended テーブルの重複
- 外部キー制約違反

## パフォーマンス最適化

### インデックス
以下のインデックスが自動作成されます：
- `idx_capacity_templates_store`
- `idx_capacity_rules_store_dates`
- `idx_capacity_exceptions_store_date`
- `idx_time_slots_extended_store_date`

### キャッシュ戦略
- テンプレート情報は変更頻度が低いため、フロントエンドでキャッシュ推奨
- 容量状況はリアルタイム性が必要なためキャッシュ非推奨

## 今後の拡張案

1. **レポート機能**
   - 人数ベースの利用統計
   - テンプレート効果測定

2. **自動最適化**
   - 過去データから最適な容量を提案
   - 曜日・時間帯別の需要予測

3. **通知機能**
   - 容量到達時の管理者通知
   - 空き発生時の待機ユーザー通知

## サポート

問題が発生した場合は、以下を確認してください：

1. ログ確認
```bash
# GCP ログ確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=line-booking-api" --limit=20
```

2. データベース確認
```sql
-- 容量設定確認
SELECT * FROM capacity_templates WHERE store_id = 'default-store';

-- 適用ルール確認
SELECT * FROM capacity_rules WHERE store_id = 'default-store';

-- 時間枠確認
SELECT * FROM time_slots_extended 
WHERE store_id = 'default-store' 
  AND date = '2025-01-15'
ORDER BY time;
```

## 更新履歴

- 2025-01-29: 初回実装
  - 容量テンプレート機能
  - 人数ベース予約検証
  - 日次例外設定
  - 管理画面UI