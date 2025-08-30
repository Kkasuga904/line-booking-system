# Supabase Migration 適用手順（修正版）

## 重要：ファイルパスはSQLに書かない
- SQLファイルには**純粋なSQL文のみ**を記載
- ファイルパスはコマンドやダッシュボードで指定

## 準備されたSQLファイル

```
supabase/migrations/
├── 20250830_001_check_and_create_reservation.sql     # 基本版RPC関数
├── 20250830_002_add_reservation_indexes.sql          # インデックス
└── 20250830_003_check_and_create_reservation_extended.sql  # 拡張版RPC関数
```

## 適用方法

### 方法1: Supabase Dashboard で実行（推奨）

1. **Supabase Dashboard にログイン**
   https://app.supabase.com

2. **SQL Editor を開く**

3. **各SQLファイルの内容をコピー＆ペーストして実行**
   
   順番：
   1. `20250830_001_check_and_create_reservation.sql` の内容
   2. `20250830_002_add_reservation_indexes.sql` の内容
   3. `20250830_003_check_and_create_reservation_extended.sql` の内容（オプション）

### 方法2: Supabase CLI を使用

```bash
# プロジェクトにリンク
supabase link --project-ref [your-project-ref]

# Migration を適用
supabase db push
```

### 方法3: 直接DBに接続

```bash
# 環境変数設定
export DATABASE_URL='postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres'

# psqlで実行
psql $DATABASE_URL -f supabase/migrations/20250830_001_check_and_create_reservation.sql
psql $DATABASE_URL -f supabase/migrations/20250830_002_add_reservation_indexes.sql
psql $DATABASE_URL -f supabase/migrations/20250830_003_check_and_create_reservation_extended.sql
```

## 動作確認

### SQL Editorでテスト（基本版）

```sql
-- 基本版（5引数）のテスト
select * from check_and_create_reservation(
  'default-store',           -- store_id
  '2025-08-30'::date,       -- date
  '18:00:00'::time,         -- time (HH:MM:SS形式)
  2,                        -- party_size
  'test-user-001'           -- user_id (text)
);
```

### SQL Editorでテスト（拡張版）

```sql
-- 拡張版（10引数）のテスト
select * from check_and_create_reservation(
  'default-store',           -- store_id
  '2025-08-30'::date,       -- date
  '18:00:00'::time,         -- time
  2,                        -- party_size
  'test-user-001',          -- user_id
  'テスト太郎',              -- user_name
  false,                    -- is_group
  'test',                   -- source
  '090-1234-5678',          -- phone
  'テストメッセージ'         -- message
);
```

## Node.jsからの呼び出し

```javascript
// 基本版（5引数）
const { data, error } = await supabase.rpc('check_and_create_reservation', {
  _store_id: store_id,
  _date: date,              // '2025-08-30'
  _time: time + ':00',      // '18:00' → '18:00:00'
  _party_size: actualPartySize,
  _user_id: user_id
});

// 拡張版（全引数）
const { data, error } = await supabase.rpc('check_and_create_reservation', {
  _store_id: store_id,
  _date: date,
  _time: formattedTime,     // '18:00:00'
  _party_size: actualPartySize,
  _user_id: user_id,
  _user_name: actualUserName,
  _is_group: is_group || false,
  _source: source || 'web',
  _phone: phone || null,
  _message: message || null
});
```

## エラー対処

### function does not exist
```sql
-- 関数の存在確認
\df check_and_create_reservation

-- 引数の型確認（重要）
SELECT 
  proname,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname = 'check_and_create_reservation';
```

### permission denied
```sql
-- 権限再付与
GRANT EXECUTE ON FUNCTION public.check_and_create_reservation TO anon, authenticated;
ALTER FUNCTION public.check_and_create_reservation OWNER TO postgres;
```

### time型のエラー
- **必ず `HH:MM:SS` 形式で渡す**
- `18:00` ではなく `18:00:00`
- Node.js側で変換処理を入れる

## 並行テスト

```bash
# 環境変数確認
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY

# テスト実行
npm run test:concurrent

# 期待結果（最大2組の場合）
# 成功: 2件
# 失敗: 8件（満席エラー）
```

## チェックリスト

- [ ] SQLファイルにファイルパスを書いていない（純粋なSQLのみ）
- [ ] Migration適用済み（エラーなし）
- [ ] SQL Editorで関数の動作確認済み
- [ ] time引数を `HH:MM:SS` 形式で渡している
- [ ] インデックス作成済み
- [ ] 並行テストで期待通りの結果

## トラブルシューティング

```sql
-- ロック状況確認
SELECT * FROM pg_locks WHERE locktype = 'advisory';

-- 現在の予約数確認
SELECT 
  store_id, date, time, 
  count(*) as groups,
  sum(party_size) as people
FROM reservations 
WHERE status IN ('confirmed', 'pending')
GROUP BY store_id, date, time
ORDER BY date, time;

-- 容量ルール確認
SELECT * FROM capacity_control_rules 
WHERE is_active = true 
ORDER BY created_at DESC;
```