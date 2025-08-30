# 🎯 ナレッジ: ESMモジュール対応と容量制限ビジュアル表示の完全実装

## 📋 実装概要
LINEボット予約システムにおいて、予約容量制限の視覚的フィードバックをLIFF（LINE Front-end Framework）に実装。ESM/CommonJSモジュール形式の不一致を解決し、APIを正常に動作させた。

## 🔴 解決した問題

### 1. モジュール形式の不一致
**症状**:
- APIエンドポイントが500エラー
- `Error [ERR_REQUIRE_ESM]`エラー
- 動的import()の失敗

**原因**:
- server.jsはESM形式（type: "module"）
- capacity-status.jsはCommonJS形式（require/module.exports）
- 混在による互換性問題

**解決策**:
```javascript
// ❌ Before (CommonJS)
const { createClient } = require('@supabase/supabase-js');
module.exports = { getCapacityStatus };

// ✅ After (ESM)
import { createClient } from '@supabase/supabase-js';
export { getCapacityStatus };
```

### 2. 環境変数の初期化タイミング
**症状**:
- `supabaseUrl is required`エラー
- モジュールロード時に環境変数が未定義

**解決策**:
```javascript
// 遅延初期化パターン
let supabase = null;

function getSupabaseClient() {
  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
  }
  return supabase;
}
```

### 3. LIFF ID設定エラー
**症状**:
- LIFF app not foundエラー
- 404エラー

**対処**:
- 正しいLIFF IDを環境変数に設定
- LIFFアプリの公開状態を確認

## ✅ 実装した機能

### 1. 容量状態API (`/api/capacity-status`)
```javascript
// リクエスト
GET /api/capacity-status?store_id=default-store&date=2025-08-30

// レスポンス
{
  "success": true,
  "date": "2025-08-30",
  "slots": [
    {
      "time": "18:00",
      "status": "full",        // full | limited | available
      "currentGroups": 1,
      "maxGroups": 1,
      "message": "満席",
      "displayClass": "slot-full",
      "selectable": false
    }
  ]
}
```

### 2. ビジュアル表示のCSS
```css
/* 満席 - 赤色 */
.slot-full {
  background: linear-gradient(135deg, #ff6b6b 0%, #ff5252 100%);
  cursor: not-allowed;
  opacity: 0.7;
}

/* 残りわずか - 黄色 */
.slot-limited {
  background: linear-gradient(135deg, #ffd54f 0%, #ffb300 100%);
}

/* 予約可能 - 緑色 */
.slot-available {
  background: linear-gradient(135deg, #81c784 0%, #4caf50 100%);
}
```

### 3. LIFF統合
```javascript
// 容量状態の取得と表示
async function updateTimeSlotVisuals(selectedDate) {
  const response = await fetch(
    `https://line-booking-api-116429620992.asia-northeast1.run.app/api/capacity-status?store_id=default-store&date=${selectedDate}`
  );
  const data = await response.json();
  
  if (data.success) {
    data.slots.forEach(slot => {
      const element = document.querySelector(`[data-time="${slot.time}"]`);
      if (element) {
        element.className = `time-slot ${slot.displayClass}`;
        element.dataset.selectable = slot.selectable;
        
        if (!slot.selectable) {
          element.onclick = () => alert('満席です');
        }
      }
    });
  }
}
```

## 📁 変更したファイル

1. **`/api/capacity-status.js`**
   - CommonJS → ESM形式に変換
   - 遅延初期化パターンを実装

2. **`/server.js`**
   - 静的importを追加
   - 動的import()を削除

3. **`/public/liff-calendar.html`**
   - 容量状態取得ロジックを追加
   - ビジュアルフィードバックCSS追加

4. **`/public/test-capacity-visual.html`**
   - 動作確認用テストページ作成

## 🚀 デプロイ手順

```bash
# Cloud Runへのデプロイ
gcloud run deploy line-booking-api \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --port 8080 \
  --env-vars-file .env.yaml \
  --memory 256Mi \
  --cpu 1 \
  --max-instances 1 \
  --min-instances 0
```

## 📊 動作確認

### APIテスト
```bash
curl -X GET "https://line-booking-api-116429620992.asia-northeast1.run.app/api/capacity-status?store_id=default-store&date=2025-08-30"
```

### ビジュアルテスト
- URL: `https://line-booking-api-116429620992.asia-northeast1.run.app/test-capacity-visual.html`
- 18:00が赤色（満席）で表示されることを確認
- その他の時間が緑色（予約可能）で表示されることを確認

## 🔧 今後の改善点

1. **他のAPIモジュールのESM変換**
   - reservation-validate.js
   - reservation-create.js
   - その他のCommonJSモジュール

2. **エラーハンドリングの強化**
   - API失敗時のフォールバック表示
   - ネットワークエラー時の再試行

3. **パフォーマンス最適化**
   - 容量状態のキャッシング
   - バッチリクエストの実装

## 💡 学んだこと

1. **ESMとCommonJSの混在は避ける**
   - プロジェクト全体で統一形式を使用
   - package.jsonの"type": "module"設定

2. **環境変数の初期化タイミング**
   - モジュールレベルでの初期化は避ける
   - 遅延初期化パターンの活用

3. **静的vs動的インポート**
   - 可能な限り静的インポートを使用
   - Tree-shakingとバンドル最適化の恩恵

## 📝 メンテナンスガイド

### 新規APIモジュール追加時
1. ESM形式で作成
2. 環境変数は遅延初期化
3. server.jsに静的インポート追加
4. ローカルテスト → デプロイ

### 既存モジュール修正時
1. ESM形式を維持
2. import/export構文を使用
3. ファイル拡張子を明示

## 🎯 成果
- ✅ ESM/CommonJS問題を完全解決
- ✅ 容量制限の視覚的フィードバック実装
- ✅ LIFF統合完了
- ✅ 本番環境で正常動作確認
- ✅ ドキュメント整備完了