# LINE予約システム - トラブルシューティングナレッジ

## 🔴 重要：環境変数の改行問題（2024年12月解決）

### 最も深刻だった問題：LIFF_IDに改行が混入
**症状**:
- カレンダーボタンをクリックしてもLIFFが開かない
- Vercelログに `"invalid uri scheme","property":"messages[1].quickReply.items[0].action.uri"` エラー
- URLが2行に分割されていた

**根本原因**:
Vercel環境変数設定時に、値の末尾に改行文字（`\n`）が混入
```
LIFF_ID=2007999490-oqz3PXdk\n
```

**解決策**:
1. **即時対応**: `.trim()` と `.replace(/\r?\n/g, '')` を全箇所に追加
2. **恒久対策**: `utils/env-helper.js` を作成し、環境変数アクセスを一元化

```javascript
// utils/env-helper.js - 再発防止のための共通処理
export function getEnv(key, defaultValue = '') {
  const value = process.env[key] || defaultValue;
  return typeof value === 'string' ? value.trim() : value;
}
```

### 2. **LINE Official Account設定ミス - レスポンスが返ってこない**
**症状**:
- Webhookは呼ばれる（メッセージに既読がつく）
- しかしボットからの返信がない
- 自動応答メッセージが表示される

**原因**:
- LINE Official Account Managerで「チャット」モードが有効になっていた
- Bot APIが無効化されていた

**解決方法**:
LINE Official Account Managerで以下を設定:
- 応答設定 > 応答モード: `Bot`（チャットではない）
- あいさつメッセージ: `オフ`
- 応答メッセージ: `オフ`
- Webhook: `オン`

### 3. **LIFF作成時のチャネル問題**
**症状**:
- Messaging APIチャネルでLIFFアプリが作成できない
- エラー: "You can no longer add LIFF apps to a Messaging API channel"

**原因**:
2023年のLINE仕様変更により、Messaging APIチャネルでのLIFF作成が廃止

**解決方法**:
1. LINE Loginチャネルを新規作成
2. LINE LoginチャネルでLIFFアプリを作成
3. LIFF ID（例: `2007999490-oqz3PXdk`）を環境変数に設定

## 🔴 その他の問題と解決方法

### 4. **Supabase APIキーエラー（Invalid API key）**
**原因**: 
- 古いAPIキーを使用していた
- 正しいSupabaseプロジェクトのキーではなかった

**解決方法**:
- Supabase管理画面 > Settings > API から正しいanon keyを取得
- 環境変数を更新: `SUPABASE_ANON_KEY`

### 5. **store_idに改行文字が混入**
**原因**:
- 環境変数設定時に`echo`コマンドで改行が入った
- `process.env.STORE_ID`に`\n`が含まれていた

**解決方法**:
```javascript
// env-helper.jsを使用して自動的に改行除去
import { getEnv } from '../utils/env-helper.js';
const storeId = getEnv('STORE_ID', 'default');
```

### 6. **複数システムで同じデータベースを共有**
**原因**:
- `line-booking-system`と`line-booking-account2`が同じSupabaseを使用
- store_idでの分離が不十分

**解決方法**:
- 各システムで異なるstore_idを設定
- 管理画面でstore_idによるフィルタリング実装

### 7. **Vercel無料プランの関数数制限**
**原因**:
- 12個以上のServerless Functionsは無料プランで使用不可

**解決方法**:
- 不要なAPIファイルを削除
- 機能を統合してファイル数を削減

## ✅ 成功までのステップ

1. **初期セットアップ**
   - Supabaseプロジェクト作成
   - reservationsテーブル作成
   - 環境変数設定

2. **デバッグモード実装**
   - `webhook-debug-full.js`で詳細ログ出力
   - 環境変数の確認機能追加

3. **メモリベース版で動作確認**
   - Supabase接続エラー時の代替手段
   - 基本機能の動作確認

4. **本番版への移行**
   - 正しいAPIキー設定
   - store_idによるマルチテナント対応
   - 管理画面との連携

## 🛡️ 再発防止策

### 環境変数の管理（最重要）
```bash
# 改行を含まないように設定
printf "value" | vercel env add KEY_NAME production

# 設定後に確認
vercel env pull .env.check
cat .env.check
```

### コードレベルの防御（env-helper.jsの活用）
```javascript
// 全ての環境変数アクセスでenv-helperを使用
import { getEnv, sanitizeUrl } from '../utils/env-helper.js';

// 改行・空白が自動的に除去される
const token = getEnv('LINE_CHANNEL_ACCESS_TOKEN');
const liffId = getEnv('LIFF_ID');
const storeId = getEnv('STORE_ID', 'default');

// URLは更に念入りにサニタイズ
const url = sanitizeUrl(`https://liff.line.me/${liffId}`);
```

### デバッグ用エンドポイント
```javascript
// GET /api/webhook でヘルスチェック
if (req.method === 'GET') {
  return res.status(200).json({
    status: 'active',
    database: 'connected/error',
    environment: process.env.NODE_ENV
  });
}
```

### エラーハンドリング
```javascript
try {
  // Supabase操作
} catch (error) {
  console.error('詳細エラー:', error);
  // ユーザーには簡潔なメッセージ
  return res.status(200).json({
    error: 'システムエラーが発生しました'
  });
}
```

## 📊 アーキテクチャ

```
LINE Bot → Webhook (Vercel) → Supabase
                ↓
         管理画面 (HTML/JS)
```

### データフロー
1. LINEメッセージ受信
2. webhookで処理・パース
3. Supabaseに保存
4. 管理画面でリアルタイム表示

## 🔧 よく使うコマンド

```bash
# デプロイ
cd line-booking-system && vercel --prod

# 環境変数設定
vercel env add KEY_NAME production

# ログ確認
vercel logs [deployment-url]

# Supabase SQL実行
# 管理画面 > SQL Editor で実行
```

## 📝 チェックリスト

- [ ] Supabase URLが正しいか
- [ ] APIキーが最新か
- [ ] store_idに改行が含まれていないか
- [ ] 環境変数がproductionに設定されているか
- [ ] テーブルにRLSポリシーが設定されているか