# Supabase sourceカラム問題の解決手順

## 問題
- エラー: "record \"new\" has no field \"source\""
- 原因: Supabaseのスキーマとコードの不一致

## 解決手順

### ステップ1: Supabaseダッシュボードにログイン
1. https://app.supabase.com にアクセス
2. プロジェクトを選択

### ステップ2: SQL Editorで確認
以下のSQLを実行してカラムの存在を確認：

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'reservations'
  AND column_name = 'source';
```

### ステップ3: カラムが存在しない場合
以下のSQLを実行：

```sql
-- sourceカラムを追加（NULL許可、デフォルト値付き）
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS source text DEFAULT 'admin';
```

### ステップ4: カラムが存在するがエラーが出る場合
PostgRESTのキャッシュをリロード：

```sql
-- スキーマキャッシュをリロード
NOTIFY pgrst, 'reload schema';
```

### ステップ5: それでもダメな場合
無害なDDLでキャッシュを強制更新：

```sql
-- コメントを追加してスキーマ変更をトリガー
COMMENT ON COLUMN public.reservations.source IS 'reservation source: admin, line, web, etc.';
```

## 確認方法
以下のcurlコマンドで動作確認：

```bash
curl -X POST "https://line-booking-api-116429620992.asia-northeast1.run.app/api/admin?action=create" \
  -H "Content-Type: application/json" \
  -d '{"customer_name":"テスト太郎","phone":"090-1234-5678","date":"2025-09-15","time":"18:00","people":2}'
```

## 注意事項
- RLS（Row Level Security）が有効な場合でも、このカラム追加は影響しません
- 既存のポリシーはそのまま動作します