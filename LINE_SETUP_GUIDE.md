# LINE 2アカウント設定ガイド

## 📋 準備するもの

1. **2つのLINE公式アカウント**
2. **各アカウントのChannel Access Token**
3. **各アカウントのChannel Secret**

## 🔧 設定手順

### STEP 1: LINE Developers Consoleでの準備

#### アカウント1の設定
1. [LINE Developers Console](https://developers.line.biz/console/) にログイン
2. 1つ目のプロバイダー/チャネルを選択
3. 「Messaging API設定」タブを開く
4. 以下をコピー：
   - **Channel secret**（基本設定タブ）
   - **Channel access token**（Messaging API設定タブ）

#### アカウント2の設定
1. 2つ目のプロバイダー/チャネルを選択（または新規作成）
2. 同様に「Messaging API設定」タブを開く
3. 以下をコピー：
   - **Channel secret**
   - **Channel access token**

### STEP 2: バッチファイルの編集

#### 📁 `start-account1.bat` を編集
```batch
set LINE_CHANNEL_ACCESS_TOKEN=（ここに1つ目のアカウントのトークンを貼り付け）
set LINE_CHANNEL_SECRET=（ここに1つ目のアカウントのシークレットを貼り付け）
```

#### 📁 `start-account2.bat` を編集
```batch
set LINE_CHANNEL_ACCESS_TOKEN=（ここに2つ目のアカウントのトークンを貼り付け）
set LINE_CHANNEL_SECRET=（ここに2つ目のアカウントのシークレットを貼り付け）
```

### STEP 3: Webhook URLの設定

#### ローカルテスト用（ngrokを使用）
1. ngrokをインストール: https://ngrok.com/
2. 各ポートでトンネルを作成：
   ```bash
   ngrok http 3001  # アカウント1用
   ngrok http 3002  # アカウント2用（別ターミナルで）
   ```

3. LINE Developers Consoleで設定：
   - **アカウント1**: `https://xxxxx.ngrok.io/webhook`
   - **アカウント2**: `https://yyyyy.ngrok.io/webhook`

#### 本番環境用
- **アカウント1**: `https://your-domain1.com/webhook`
- **アカウント2**: `https://your-domain2.com/webhook`

### STEP 4: 起動

1. `start-account1.bat` をダブルクリック
2. `start-account2.bat` をダブルクリック

## ✅ 確認事項

### システム1（ポート3001）
- タイトル: **予約システム1**
- Webhook URL: `http://localhost:3001/webhook`
- データ保存先: `./data/test-account-1/`

### システム2（ポート3002）
- タイトル: **テストアカウント2 - 予約システム2**
- Webhook URL: `http://localhost:3002/webhook`
- データ保存先: `./data/test-account-2/`

## 🎯 動作確認

1. 各LINEアカウントを友だち追加
2. それぞれに「予約」とメッセージを送信
3. 異なる応答が返ってくることを確認
4. 予約データが別々に保存されることを確認

## ⚠️ 注意事項

- **トークンとシークレットは絶対に公開しない**
- **本番環境ではHTTPSを使用する**
- **各アカウントのWebhook URLは必ず異なるものにする**
- **データは完全に分離されているため、相互参照はできない**

## 📝 トラブルシューティング

### エラー: "no channel access token"
→ バッチファイルにトークンが正しく設定されているか確認

### Webhookが受信できない
→ ngrokが起動しているか、URLが正しいか確認

### ポートが使用中
→ タスクマネージャーでNode.jsプロセスを終了してから再起動