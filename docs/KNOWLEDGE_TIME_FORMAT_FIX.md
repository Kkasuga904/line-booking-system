# 時間フォーマット二重付与問題の解決

## 問題の概要
予約作成時に`invalid input syntax for type time: "14:00:00:00"`エラーが発生。
時間フォーマット`:00`が複数箇所で追加され、不正な形式になっていた。

## 根本原因
1. **分散した正規化ロジック**
   - UI側（reservation-fix.js）: `14:00` → `14:00:00`
   - API側（admin.js内）: さらに`:00`追加 → `14:00:00:00`
   - 各処理が独立して動作し、重複変換が発生

2. **正規化タイミングの問題**
   - 処理の「途中」で正規化していた
   - 複数の関数が独自に時間フォーマットを操作
   - 統一的な入口処理がなかった

## 解決策

### 1. ミドルウェアレベルでの統一正規化（server.js）
```javascript
// 時間フォーマット正規化関数
function normalizeTimeToHHMMSS(t) {
  if (t == null) return null;
  t = String(t).trim();
  
  // "HH:MM" → "HH:MM:SS"
  if (/^\d{1,2}:\d{2}$/.test(t)) {
    return t.padStart(5, '0') + ':00';
  }
  
  // "HH:MM:SS(:…)" → 先頭8文字だけ
  if (/^\d{1,2}:\d{2}:\d{2}(:.*)?$/.test(t)) {
    return t.slice(0, 8);
  }
  
  return null; // 不正
}

// /api/admin の時間正規化ミドルウェア
app.use('/api/admin', (req, res, next) => {
  if (req.body && req.body.time !== undefined) {
    const before = req.body.time;
    const after = normalizeTimeToHHMMSS(before);
    console.log('[TIME_NORMALIZE]', { before, after });
    req.body.time = after;
  }
  next();
});
```

### 2. 重複ロジックの削除
- api/admin.js内の`time + ':00'`を削除
- handleCreate/handleUpdate内の時間変換を削除
- 「ミドルウェアで正規化済み」とコメント追加

### 3. UI側の防御的実装（reservation-minimal.js）
```javascript
let time = get('reservationTime');
// 一度だけ正規化
if (/^\d{1,2}:\d{2}$/.test(time)) {
  time += ':00';
}
// 念のため8文字に切り詰め
if (time.length > 8) {
  time = time.slice(0, 8);
}
```

## 再発防止策

### 1. 単一責任の原則
- 時間正規化は**1箇所のみ**（ミドルウェア）で実施
- 他の場所では「すでに正規化済み」前提で処理

### 2. ログによる可視化
```javascript
console.log('[TIME_NORMALIZE]', { before, after });
```
Cloud Runログで正規化の動作を確認可能

### 3. バリデーション
```javascript
// サーバー側で最終チェック
if (!/^\d{2}:\d{2}:\d{2}$/.test(time)) {
  return res.status(400).json({ 
    error: 'Invalid time format',
    expected: 'HH:MM:SS',
    received: time 
  });
}
```

## チェックリスト

### デプロイ前
- [ ] ミドルウェアで時間正規化が実装されているか
- [ ] 他の場所で`:00`追加ロジックがないか確認
- [ ] `grep -R "':00'" -n`で重複チェック

### デプロイ後
- [ ] Cloud Runログで`[TIME_NORMALIZE]`確認
- [ ] 実際に予約作成してエラーが出ないか確認
- [ ] 時間が正しく保存されているか確認

## トラブルシューティング

### 症状: まだ`14:00:00:00`エラーが出る
1. ミドルウェアの順序確認
   ```javascript
   // 正しい順序
   app.use('/api/admin', express.json());
   app.use('/api/admin', normalizeMiddleware); // ← JSONパース後
   app.use('/api/admin', adminRouter);
   ```

2. 古いリビジョンへのトラフィック確認
   ```bash
   gcloud run services describe line-booking-api \
     --region asia-northeast1 \
     --format="value(status.traffic[].revisionName)"
   ```

3. キャッシュクリア
   - ブラウザ: Ctrl+Shift+R
   - Cloud Run: 新しいリビジョンが100%トラフィックか確認

### 症状: 時間が保存されない
- ミドルウェアが`null`を返していないか確認
- req.body.timeが存在するか確認
- Content-Type: application/jsonが設定されているか確認

## 関連ファイル
- `/server.js` - ミドルウェア実装
- `/api/admin.js` - API処理（重複ロジック削除済み）
- `/public/js/reservation-minimal.js` - UI側の正規化

## 更新履歴
- 2025-09-01: 初版作成
- ミドルウェアベースの統一正規化実装
- 二重付与問題の完全解決