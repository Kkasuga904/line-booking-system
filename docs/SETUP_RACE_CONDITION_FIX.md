# レースコンディション修正セットアップ手順

## 概要
同時アクセス時に容量制限を超えて予約が入ってしまう問題を解決するため、PostgreSQLのアドバイザリロックを使用した排他制御を実装しました。

## 実装内容

### 1. アドバイザリロック方式
- **同一スロット（店舗×日付×時刻）の処理を排他制御**
- トランザクション中は他の同じスロットへのアクセスをブロック
- 確実に容量制限を守る

## セットアップ手順

### 1. Supabase SQLエディタでRPC関数を作成

1. Supabaseダッシュボードにログイン
2. SQL Editorを開く
3. 以下のファイルの内容を実行：
   ```
   supabase/functions/check_and_create_reservation.sql
   ```

### 2. インデックスを作成（パフォーマンス最適化）

1. SQL Editorで以下のファイルを実行：
   ```
   supabase/migrations/add_reservation_indexes.sql
   ```

### 3. 環境変数の確認

`.env`ファイルに以下が設定されていることを確認：
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
```

### 4. サーバー再起動

```bash
npm run dev
# または本番環境の場合
npm start
```

## テスト方法

### 1. 並行テストの実行

```bash
# 単発テスト（10件同時リクエスト）
npm run test:concurrent

# 連続テスト（累積チェック）
npm run test:concurrent:double
```

### 期待される結果
- 最大組数が2の場合：
  - 10件同時リクエスト → 成功2件、失敗8件
  - エラーはすべて「満席」エラー

### 2. 手動テスト

1. 管理画面で容量制限ルールを設定（例：最大2組）
2. 複数のブラウザタブから同時に予約を試みる
3. 3組目以降は「満席」エラーになることを確認

## トラブルシューティング

### RPC関数が見つからない場合
```sql
-- 関数の存在確認
SELECT proname FROM pg_proc WHERE proname = 'check_and_create_reservation';
```

### パーミッションエラーの場合
```sql
-- 権限付与
GRANT EXECUTE ON FUNCTION check_and_create_reservation TO anon, authenticated;
```

### デバッグログの確認
```javascript
// Node.js側のログ
console.log('[Reservation]', { store_id, date, time, party_size });

// Supabase側のログ（Functions → Logs）
```

## パフォーマンス監視

### インデックス使用状況の確認
```sql
SELECT * FROM v_index_usage;
```

### ロック待機状況の確認
```sql
SELECT * FROM pg_locks WHERE locktype = 'advisory';
```

## ロールバック手順

旧方式に戻す場合：

1. `api/reservation-validate.js`で`createReservationOld`を使用
2. ルーティングを変更：
   ```javascript
   // createReservation を createReservationOld に置き換え
   ```

## 今後の拡張案

### 方式B（トークン方式）への移行
- より高い並行性が必要な場合
- 予約枠を物理的に制限したい場合

### 方式C（集計テーブル）への移行
- リアルタイムKPIが必要な場合
- 複雑な容量制御が必要な場合

## チェックリスト

- [ ] RPC関数作成済み
- [ ] インデックス作成済み
- [ ] 並行テスト成功（成功数 ≤ 最大組数）
- [ ] 本番環境でのテスト完了
- [ ] エラーメッセージ確認（満席表示）
- [ ] フロントエンドの動作確認（時間選択画面への戻り）

## 参考資料

- [PostgreSQL Advisory Locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS)
- [Supabase RPC Functions](https://supabase.com/docs/guides/database/functions)
- [並行制御パターン](https://martinfowler.com/eaaCatalog/pessimisticOfflineLock.html)