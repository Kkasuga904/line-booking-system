# Supabase Migration 適用手順

## 重要な変更点
- **SQLファイルの配置場所を修正**: `supabase/functions/` ではなく `supabase/migrations/` に配置
- **time型の扱いを修正**: `time without time zone` 型で、HH:MM:SS形式で渡す
- **権限設定を追加**: `set role postgres` と `owner to postgres` で権限問題を解決

## 適用方法

### 方法1: Supabase Dashboard から直接実行（推奨）

1. **Supabase Dashboard にログイン**
   - https://app.supabase.com

2. **SQL Editor を開く**
   - 左メニューから「SQL Editor」を選択

3. **以下のSQLを順番に実行**

   **ステップ1: RPC関数作成**
   ```
   supabase/migrations/20250830_add_check_and_create_reservation.sql
   の内容をコピー＆ペースト
   ```

   **ステップ2: インデックス作成**
   ```
   supabase/migrations/20250830_add_reservation_indexes.sql
   の内容をコピー＆ペースト
   ```

4. **動作確認（SQL Editor で直接テスト）**
   ```sql
   -- テスト実行
   select * from check_and_create_reservation(
     'default-store',           -- store_id
     'test-user-001',          -- user_id
     'テストユーザー',          -- user_name
     '2025-08-30',             -- date
     '18:00:00'::time,         -- time (重要: HH:MM:SS形式)
     2,                        -- party_size
     false,                    -- is_group
     'test',                   -- source
     null,                     -- phone
     null                      -- message
   );
   ```

### 方法2: Supabase CLI を使用

1. **Supabase CLI インストール**
   ```bash
   npm install -g supabase
   ```

2. **プロジェクトにリンク**
   ```bash
   supabase link --project-ref [your-project-ref]
   ```

3. **Migration を適用**
   ```bash
   supabase db push
   ```

## エラー対処法

### 「function does not exist」エラー
```sql
-- 関数の存在確認
SELECT proname, proargtypes 
FROM pg_proc 
WHERE proname = 'check_and_create_reservation';

-- 引数の型を確認
\df check_and_create_reservation
```

### 「permission denied」エラー
```sql
-- 権限を再付与
GRANT EXECUTE ON FUNCTION public.check_and_create_reservation TO anon, authenticated;
ALTER FUNCTION public.check_and_create_reservation OWNER TO postgres;
```

### 「relation does not exist」エラー
```sql
-- テーブルの存在確認
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('reservations', 'capacity_control_rules');
```

### time型のエラー
- Node.js側で必ず `HH:MM:SS` 形式で送る
- 例: `18:00` → `18:00:00`

## 並行テストの実行

1. **環境変数設定**
   ```bash
   export SUPABASE_URL=your_url
   export SUPABASE_ANON_KEY=your_key
   ```

2. **テスト実行**
   ```bash
   npm run test:concurrent
   ```

3. **期待される結果**
   - 最大2組設定の場合
   - 10件同時リクエスト → 成功2件、失敗8件
   - すべて「満席」エラー

## 本番適用チェックリスト

- [ ] バックアップ取得済み
- [ ] ステージング環境でテスト済み
- [ ] Migration SQL実行済み
- [ ] 関数の動作確認済み
- [ ] インデックス作成済み
- [ ] 並行テスト成功
- [ ] エラーメッセージ確認（日本語表示）
- [ ] フロントエンド動作確認

## ロールバック手順

問題が発生した場合：

1. **関数を削除**
   ```sql
   DROP FUNCTION IF EXISTS public.check_and_create_reservation;
   ```

2. **Node.js を旧方式に戻す**
   - `createReservation` を `createReservationOld` に変更

## デバッグ用コマンド

```sql
-- 現在のロック状況
SELECT * FROM pg_locks WHERE locktype = 'advisory';

-- 関数の詳細確認
\sf check_and_create_reservation

-- 実行計画の確認
EXPLAIN (ANALYZE, BUFFERS) 
SELECT count(*), sum(party_size) 
FROM reservations 
WHERE store_id = 'default-store' 
AND date = '2025-08-30' 
AND time = '18:00' 
AND status IN ('confirmed', 'pending');
```