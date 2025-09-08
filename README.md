# LINE予約管理システム

LINEと連携した予約管理システムです。顧客はLINEから簡単に予約でき、管理者は専用の管理画面から予約を管理できます。

## 🚀 セットアップ手順

### 1. LINE Developer Console設定

1. [LINE Developer Console](https://developers.line.biz/console/)にログイン
2. 新規プロバイダーを作成（または既存のものを選択）
3. 「Messaging API」チャンネルを作成
4. 以下の情報を取得：
   - Channel Access Token（長期トークン）
   - Channel Secret

### 2. Vercelへのデプロイ

```bash
# プロジェクトディレクトリに移動
cd line-booking-system

# Vercel CLIをインストール（未インストールの場合）
npm i -g vercel

# 初回デプロイ
vercel

# 環境変数を設定
vercel env add LINE_CHANNEL_ACCESS_TOKEN production
# → 取得したアクセストークンを入力

vercel env add LINE_CHANNEL_SECRET production
# → 取得したChannel Secretを入力

# プロダクションデプロイ
vercel --prod
```

### 3. Webhook URL設定

LINE Developer Consoleに戻り、以下を設定：

1. **Messaging API設定**タブを開く
2. **Webhook settings**で：
   - Webhook URL: `https://line-booking-system-seven.vercel.app/api/booking`
   - Use webhook: **Enabled**
3. **Verify**ボタンで接続確認

### 4. LINE Official Account Manager設定

[LINE Official Account Manager](https://manager.line.biz/)で：

1. **応答設定**を開く
2. **応答モード**: 「Bot」を選択（重要！）
3. **あいさつメッセージ**: 無効化
4. **応答メッセージ**: 無効化

### 5. 動作確認

1. QRコードまたはIDで公式アカウントを友だち追加
2. 以下のコマンドをテスト：
   - `予約` - 新規予約作成
   - `確認` - 予約状況確認
   - `キャンセル` - 予約キャンセル
   - `ヘルプ` - 使い方表示

## 📁 プロジェクト構造

```
line-booking-system/
├── api/
│   ├── booking.js      # メイン予約システム
│   ├── echo.js         # エコーボット（テスト用）
│   ├── ping.js         # 接続確認用
│   └── webhook.js      # 旧バージョン
├── vercel.json         # Vercel設定（重要！）
├── package.json        # 依存関係
├── .env.example        # 環境変数テンプレート
└── README.md           # このファイル
```

## ⚠️ 重要な注意事項

### vercel.json設定

**新しいAPIエンドポイントを追加する場合、必ず`vercel.json`に登録すること！**

```json
{
  "functions": {
    "api/新しいファイル.js": {
      "maxDuration": 10
    }
  }
}
```

これを忘れると404エラーになります。

### 環境変数

環境変数を変更した後は必ず再デプロイ：
```bash
vercel --prod --force
```

### Next.js API Route形式

すべてのAPIファイルは以下の形式で作成：

```javascript
// Next.js設定
export const config = { api: { bodyParser: true } };

// デフォルトエクスポート必須
export default async function handler(req, res) {
  // 処理
}
```

`module.exports`ではなく`export default`を使用すること。

## 🔍 トラブルシューティング

### 問題: Webhook URLで404エラー

**原因**: `vercel.json`にエンドポイントが登録されていない

**解決方法**:
1. `vercel.json`を編集してエンドポイントを追加
2. `vercel --prod`で再デプロイ

### 問題: イベントが空（events: []）

**原因**: Verifyボタンのテスト、または応答モードが「チャット」

**解決方法**:
1. LINE Official Account Managerで応答モードを「Bot」に変更
2. 実際にスマホからメッセージを送信してテスト

### 問題: 401 Authentication failed

**原因**: アクセストークンが無効または古い

**解決方法**:
1. LINE Developer Consoleで新しいトークンを発行
2. `vercel env rm LINE_CHANNEL_ACCESS_TOKEN production`
3. `vercel env add LINE_CHANNEL_ACCESS_TOKEN production`
4. 新しいトークンを入力
5. `vercel --prod --force`で再デプロイ

### 問題: 返信が来ない

**確認項目**:
- [ ] 友だち追加済みか
- [ ] ブロックしていないか
- [ ] 応答モード = Bot
- [ ] Use webhook = Enabled
- [ ] 正しいチャンネルのトークンか

### デバッグ方法

1. **Vercelのログを確認**:
   ```bash
   vercel logs --prod
   ```

2. **テストエンドポイントを使用**:
   - `/api/ping` - 何でもログ出力
   - `/api/echo` - エコーボット

3. **Recent Deliveriesを確認**:
   LINE Developer Console > Messaging API > Webhook settings > Recent Deliveries

## 🔧 開発のベストプラクティス

1. **必ず実機テスト**: Verifyボタンだけでなく、実際のメッセージ送信でテスト
2. **環境変数の管理**: `.env.example`を更新して必要な変数を文書化
3. **エラーハンドリング**: 常に200を返してLINEの再送信ループを防ぐ
4. **ログ出力**: 問題調査のため適切にログを出力
5. **コメント**: 重要な処理にはコメントを追加

## 📝 今後の改善案

- [ ] データベース連携（PostgreSQL/MongoDB）
- [ ] 日時選択機能
- [ ] 予約枠管理
- [ ] リマインダー機能
- [ ] 管理者用ダッシュボード
- [ ] リッチメニュー実装

## 🆘 サポート

問題が解決しない場合：
1. Vercelのログを確認
2. LINE Developer ConsoleのRecent Deliveriesを確認
3. このREADMEのトラブルシューティングを再確認