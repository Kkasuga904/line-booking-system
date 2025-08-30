# 予約システムのレースコンディション対策ナレッジ

## 問題
同時アクセス時に容量制限を超えて予約が入ってしまう（例：最大2組なのに3組入る）

## 原因
- 複数のリクエストが同時に容量チェックを行うと、互いに「まだ空きがある」と判断してしまう
- トランザクション分離レベルの問題で、他のトランザクションの変更が見えない

## 解決方法：アドバイザリーロックを使用したRPC関数

### 1. PostgreSQL アドバイザリーロック
```sql
-- 同一時間枠に対して排他ロックを取得
PERFORM pg_advisory_xact_lock(
    hashtext(_store_id) # hashtext(_date::text) # hashtext(_time::text)
);
```
- トランザクション終了時に自動解放される
- 同じキーに対して1つのトランザクションのみがロックを取得可能

### 2. 完全なRPC関数実装

```sql
CREATE OR REPLACE FUNCTION public.check_and_create_reservation(
    _store_id   text,
    _date       date,
    _time       time without time zone,
    _party_size integer,
    _user_id    text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    _rule   record;
    _groups integer := 0;
    _people integer := 0;
    _res    public.reservations%rowtype;
BEGIN
    -- 1. アドバイザリーロックで同一スロットを保護
    PERFORM pg_advisory_xact_lock(
        hashtext(_store_id) # hashtext(_date::text) # hashtext(_time::text)
    );

    -- 2. 容量制御ルールを取得
    SELECT * INTO _rule
    FROM public.capacity_control_rules r
    WHERE r.store_id = _store_id
      AND r.is_active = true
      AND (
        (r.date_mode = 'single' AND r.date = _date)
        OR (r.date_mode = 'range' AND _date BETWEEN r.start_date AND r.end_date)
        OR (r.date_mode = 'weekly' AND r.weekday = EXTRACT(dow FROM _date))
      )
      AND _time BETWEEN COALESCE(r.start_time::time, time '00:00') 
                    AND COALESCE(r.end_time::time, time '23:59')
    ORDER BY 
      CASE r.date_mode 
        WHEN 'single' THEN 1
        WHEN 'range' THEN 2
        WHEN 'weekly' THEN 3
      END,
      r.created_at DESC
    LIMIT 1;

    -- 3. 現在の予約状況を集計
    SELECT count(*)::int, COALESCE(sum(people), 0)::int
    INTO _groups, _people
    FROM public.reservations
    WHERE store_id = _store_id
      AND date = _date
      AND time = _time::text
      AND lower(status) IN ('confirmed', 'pending');

    -- 4. 1組あたりの人数制限チェック（最優先）
    IF _rule.max_per_group IS NOT NULL 
       AND _party_size > _rule.max_per_group THEN
        RETURN jsonb_build_object(
            'ok', false,
            'success', false,
            'error', '人数超過',
            'message', format('1組あたりの最大人数（%s名）を超えています。', _rule.max_per_group),
            'code', 'PER_GROUP_LIMIT'
        );
    END IF;

    -- 5. 組数制限チェック
    IF (_rule.control_type IN ('groups', 'both'))
       AND _rule.max_groups IS NOT NULL
       AND (_groups + 1) > _rule.max_groups THEN
        RETURN jsonb_build_object(
            'ok', false,
            'success', false,
            'error', '満席',
            'message', format('申し訳ございません。この時間帯は満席です（最大%s組）。', _rule.max_groups),
            'code', 'CAPACITY_FULL'
        );
    END IF;

    -- 6. 人数制限チェック
    IF (_rule.control_type IN ('people', 'both'))
       AND _rule.max_people IS NOT NULL
       AND (_people + _party_size) > _rule.max_people THEN
        RETURN jsonb_build_object(
            'ok', false,
            'success', false,
            'error', '満席',
            'message', format('申し訳ございません。この時間帯は満席です（最大%s名）。', _rule.max_people),
            'code', 'CAPACITY_FULL'
        );
    END IF;

    -- 7. 予約作成
    INSERT INTO public.reservations(
        store_id, user_id, customer_name, date, time, people, status
    )
    VALUES (
        _store_id, _user_id, 'Guest', _date, _time::text, _party_size, 'confirmed'
    )
    RETURNING * INTO _res;

    RETURN jsonb_build_object(
        'ok', true,
        'success', true,
        'reservation_id', _res.id,
        'message', format('%s名様のご予約を承りました', _party_size)
    );
END;
$function$;
```

## 重要なポイント

### 1. SQLファイルの配置
- **正しい場所**: `supabase/migrations/`
- **間違い**: `supabase/functions/` （これはEdge Functions用）
- SQLファイルには純粋なSQLのみ記載（ファイルパスを書かない）

### 2. テーブルスキーマとの一致
- `reservations`テーブルの実際のカラム名を確認
  - `people` vs `party_size`
  - `customer_name` vs `user_name`
- `status`フィールドの値（大文字小文字に注意）

### 3. time型の扱い
- 必ず `time without time zone` 型を使用
- Node.jsからは `HH:MM:SS` 形式で渡す（例：`18:00:00`）
- `18:00` のような形式はエラーになる

### 4. 権限設定
```sql
GRANT EXECUTE ON FUNCTION public.check_and_create_reservation 
TO anon, authenticated, service_role;

ALTER FUNCTION public.check_and_create_reservation 
OWNER TO postgres;
```

### 5. Node.js側の実装
```javascript
// time形式の変換
const formattedTime = time.includes(':') && time.split(':').length === 2 
  ? `${time}:00` 
  : time;

// RPC関数呼び出し
const { data: result, error } = await supabase.rpc('check_and_create_reservation', {
  _store_id: store_id,
  _date: date,
  _time: formattedTime,  // HH:MM:SS形式
  _party_size: actualPartySize,
  _user_id: user_id
});

// エラーハンドリング
if (result && !result.ok) {
  if (result.code === 'CAPACITY_FULL') {
    // 満席エラー
    return res.status(200).json({
      success: false,
      error: result.message,
      isCapacityFull: true
    });
  }
  // その他のエラー
  return res.status(200).json({
    success: false,
    error: result.message
  });
}
```

## テスト方法

### 並行テスト
```javascript
// 10件同時リクエスト
const promises = [];
for (let i = 0; i < 10; i++) {
  promises.push(
    fetch('/api/reservation/create', {
      method: 'POST',
      body: JSON.stringify({
        store_id: 'default-store',
        date: '2025-08-30',
        time: '18:00',
        party_size: 2,
        user_id: `test-user-${i}`
      })
    })
  );
}

const results = await Promise.all(promises);
// 期待結果: 成功2件、失敗8件（最大2組の場合）
```

### SQL Editorでのテスト
```sql
-- クリーンアップ
DELETE FROM reservations WHERE store_id = 'default-store' AND date = '2025-08-30';

-- テスト実行
SELECT * FROM check_and_create_reservation('default-store', '2025-08-30', '18:00:00', 2, 'test1');
SELECT * FROM check_and_create_reservation('default-store', '2025-08-30', '18:00:00', 3, 'test2');
SELECT * FROM check_and_create_reservation('default-store', '2025-08-30', '18:00:00', 1, 'test3'); -- 満席エラー
SELECT * FROM check_and_create_reservation('default-store', '2025-08-30', '18:00:00', 4, 'test4'); -- 人数超過エラー
```

## トラブルシューティング

### よくあるエラー

1. **"function does not exist"**
   - 引数の型が一致しているか確認
   - 特に`time`型と`text`型の混同に注意

2. **"permission denied"**
   - GRANT文を再実行
   - OWNER設定を確認

3. **組数カウントが0になる**
   - statusフィールドの大文字小文字を確認
   - `lower(status) IN ('confirmed', 'pending')` を使用

4. **時間形式エラー**
   - Node.js側で必ず `HH:MM:SS` 形式に変換
   - PostgreSQLは `time without time zone` 型を期待

## まとめ
アドバイザリーロックを使用することで、同時アクセス時でも確実に容量制限を守ることができる。重要なのは：
1. 排他制御を関数内で完結させる
2. チェックと作成を1つのトランザクションで行う
3. 適切なエラーハンドリングとメッセージ返却