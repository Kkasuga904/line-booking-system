# 予約制御システム - トラブルシューティングナレッジ

## 問題: Supabaseテーブルカラムエラー

### 発生状況
- 予約作成時に「Could not find the 'duration' column of 'reservations' in the schema cache」エラー
- 管理画面から予約を作成しようとすると失敗する
- Supabaseのテーブル構造とコードの期待するカラムが一致しない

### 根本原因
1. **スキーマの不一致**
   - コードで使用しているカラムがSupabaseテーブルに存在しない
   - 新機能追加時にテーブル定義を更新していない
   - 異なる環境間でスキーマが統一されていない

2. **存在しないカラム例**
   - `duration` - 予約時間の長さ
   - `is_date_range` - 日付範囲フラグ
   - `start_date`, `end_date` - 日付範囲の開始・終了
   - `start_time`, `end_time` - 時間範囲の開始・終了

### 解決方法

#### 1. 即座の修正（カラムを除外）
```javascript
// 基本フィールドのみを使用
const reservationData = {
  store_id: storeId,
  store_name: storeName,
  user_id: 'admin-manual',
  customer_name: finalCustomerName,
  date: date,
  time: time + ':00',
  people: peopleNum,
  message: finalMessage || null,
  phone: finalPhone || null,
  email: email || null,
  status: 'confirmed',
  created_at: new Date().toISOString()
};
```

#### 2. スキーマチェック機能の実装
```javascript
// api/supabase-schema-check.js
export async function getTableColumns(tableName) {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);
  
  const columns = data && data.length > 0 ? Object.keys(data[0]) : [];
  return columns;
}

export async function filterReservationData(data) {
  const columns = await getTableColumns('reservations');
  const filtered = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (columns.includes(key)) {
      filtered[key] = value;
    } else {
      console.warn(`Removing non-existent column: ${key}`);
    }
  }
  
  return filtered;
}
```

#### 3. セーフインサート機能
```javascript
export async function safeInsert(data) {
  // スキーマ検証
  const validation = await validateSchema(data);
  
  if (!validation.valid) {
    // 存在しないカラムを除外
    data = await filterReservationData(data);
  }
  
  try {
    const { data: result, error } = await supabase
      .from('reservations')
      .insert([data])
      .select();
    
    if (error && error.message.includes('column')) {
      // 基本フィールドでリトライ
      const basicData = filterToBasicFields(data);
      return await retryWithBasicFields(basicData);
    }
    
    return { success: true, data: result[0] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### 再発防止策

1. **スキーマバージョン管理**
   - テーブル定義をコードで管理
   - マイグレーションスクリプトの作成
   - 環境間でのスキーマ同期

2. **動的スキーマチェック**
   - アプリ起動時にテーブル構造を確認
   - 存在しないカラムを自動除外
   - エラー時に基本フィールドへフォールバック

3. **基本フィールドの定義**
   ```javascript
   const BASIC_RESERVATION_FIELDS = [
     'store_id', 'store_name', 'user_id',
     'customer_name', 'date', 'time',
     'people', 'message', 'phone',
     'email', 'status', 'created_at'
   ];
   ```

### デバッグ手順

1. **テーブル構造の確認**
   ```javascript
   const columns = await getTableColumns('reservations');
   console.log('Available columns:', columns);
   ```

2. **データ検証**
   ```javascript
   const validation = await validateSchema(reservationData);
   console.log('Missing columns:', validation.missingInTable);
   ```

3. **セーフモードでインサート**
   ```javascript
   const result = await safeInsert(reservationData);
   if (result.filtered) {
     console.log('Data was filtered to match schema');
   }
   ```

---

#

## 問題: 時刻表示が「undefined - undefined」や「(時刻なし)」になる

### 発生状況
- 予約制御設定画面で保存したルールの時刻が表示されない
- LocalStorageには正しくデータが保存されているのに画面に反映されない
- コンソールで確認すると `startTime: "18:00"` のようにデータは存在する

### 根本原因
1. **データスキーマの不一致**
   - 古いバージョンのデータ構造と新しいコードの期待する構造が異なる
   - プロパティ名の変更（start → startTime、end → endTime）

2. **マイグレーション処理の不足**
   - ページロード時にデータ移行が実行されない
   - 保存時と読み込み時でデータ形式が異なる

3. **表示ロジックの問題**
   - formatTimeRange関数が適切にデータを取得できない
   - HTMLテンプレート生成時にデータが正しく埋め込まれない

### 解決方法

#### 1. 時刻正規化関数の実装
```javascript
// あらゆる形式の時刻をHH:mm形式に変換
export function normalizeHHMMAny(v) {
  if (v == null || v === "") return "";
  
  // 数値、日本語形式、各種区切り文字に対応
  // "9時30分"、"0900"、"9:30" など全て "09:30" に変換
}
```

#### 2. プロパティ名の柔軟な解決
```javascript
export function resolveTimes(rule) {
  const startKeys = ["startTime", "start", "from", "time.start", ...];
  const endKeys = ["endTime", "end", "to", "time.end", ...];
  
  // 複数のプロパティ名から値を探索
  return { s, e, isAllDay };
}
```

#### 3. 自動マイグレーション
```javascript
export function loadRules() {
  const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  const migrated = raw.map(ensureRuleShape);
  
  // マイグレーション済みデータを保存し直す（重要！）
  localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
  return migrated;
}
```

#### 4. データ整合性チェック
```javascript
export function ensureRuleShape(rule) {
  const { s, e, isAllDay } = resolveTimes(rule);
  
  // 既存の有効な時刻を保持しつつ、形式を正規化
  if (s && e) {
    r.startTime = s;
    r.endTime = e;
  }
  
  r.schemaVersion = 3; // バージョン管理
  return r;
}
```

### デバッグ手順

1. **LocalStorageの確認**
   ```javascript
   JSON.parse(localStorage.getItem('capacityRules'))
   ```

2. **データ診断の実行**
   ```javascript
   import { diagnoseLocalStorage } from './utils/validation.js';
   diagnoseLocalStorage();
   ```

3. **自動修復の試行**
   ```javascript
   import { repairData } from './utils/validation.js';
   repairData();
   ```

### 再発防止策

1. **スキーマバージョン管理**
   - 全てのルールに `schemaVersion` を付与
   - バージョンに応じた適切なマイグレーション処理

2. **防御的プログラミング**
   - 複数のプロパティ名に対応
   - null/undefined チェックの徹底
   - デフォルト値の設定

3. **診断ツールの常備**
   - データ整合性チェック機能
   - 自動修復機能
   - デバッグ情報出力機能

4. **モジュール化**
   - 時刻処理: `utils/time.js`
   - データモデル: `model/rule.js`
   - UI描画: `ui/render.js`
   - バリデーション: `utils/validation.js`

### Docker/GCPデプロイ時の注意

1. **.dockerignoreの設定**
   ```
   # distディレクトリを除外しない
   # dist (webpackビルド済みファイルを含めるためコメントアウト)
   ```

2. **静的ファイル配信の設定**
   ```javascript
   app.use(express.static(path.join(__dirname, 'public')));
   app.use('/dist', express.static(path.join(__dirname, 'dist')));
   ```

3. **ビルドプロセス**
   ```bash
   npm install
   npm run build  # webpack実行
   gcloud run deploy
   ```

## チェックリスト

### 新機能実装時
- [ ] LocalStorageのスキーマ変更を検討
- [ ] マイグレーション処理を追加
- [ ] 既存データとの互換性を確認
- [ ] エラーハンドリングを実装

### デプロイ前
- [ ] npm run build を実行
- [ ] distディレクトリが生成されているか確認
- [ ] .dockerignoreでdistが除外されていないか確認
- [ ] server.jsで/distパスが設定されているか確認

### トラブル発生時
- [ ] LocalStorageのデータを確認
- [ ] コンソールでエラーを確認
- [ ] diagnoseLocalStorage()を実行
- [ ] 必要に応じてrepairData()を実行

## 関連ファイル

- `src/utils/time.js` - 時刻正規化処理
- `src/model/rule.js` - ルールモデルとCRUD操作
- `src/ui/render.js` - UI描画ロジック
- `src/utils/validation.js` - データ診断・修復機能
- `src/main.js` - エントリーポイント
- `webpack.config.js` - ビルド設定
- `.dockerignore` - Dockerビルド時の除外設定