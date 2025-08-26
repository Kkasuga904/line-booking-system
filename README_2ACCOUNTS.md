# 🎯 LINE 2アカウント検証環境 設定手順

## 📋 必要なもの

1. **LINE公式アカウント1** (既存)
   - Channel Access Token
   - Channel Secret

2. **LINE公式アカウント2** (新規)
   - Channel Access Token  
   - Channel Secret

## 🚀 クイックスタート

### 1️⃣ トークンとシークレットの取得

**LINE Developers Console** (https://developers.line.biz/console/)

#### アカウント1（既存）の確認
1. 既存のチャネルを開く
2. 「基本設定」タブ → **Channel Secret**をコピー
3. 「Messaging API設定」タブ → **Channel access token**をコピー

#### アカウント2（新規）の作成
1. 新しいチャネルを作成（または別のプロバイダーで作成）
2. 「基本設定」タブ → **Channel Secret**をコピー
3. 「Messaging API設定」タブ → **Channel access token**を発行してコピー

### 2️⃣ バッチファイルの編集

`START_TWO_ACCOUNTS.bat` を右クリック → 編集

```batch
REM ===== アカウント1の設定 =====
set ACCOUNT1_TOKEN=（ここに1つ目のトークンを貼り付け）
set ACCOUNT1_SECRET=（ここに1つ目のシークレットを貼り付け）

REM ===== アカウント2の設定 =====
set ACCOUNT2_TOKEN=（ここに2つ目のトークンを貼り付け）
set ACCOUNT2_SECRET=（ここに2つ目のシークレットを貼り付け）
```

### 3️⃣ 起動

`START_TWO_ACCOUNTS.bat` をダブルクリック

## 📱 動作確認

### システムの違い

| 項目 | 予約システム1 | 予約システム2 |
|------|--------------|--------------|
| ポート | 3001 | 3002 |
| タイトル | 予約システム1 | 予約システム2 |
| Webhook | http://localhost:3001/webhook | http://localhost:3002/webhook |
| データ | ./data/account-1/ | ./data/account-2/ |
| 機能 | 予約/リマインダー/キャンセル/変更 | 予約/リマインダー/キャンセル |

### Webhook URLの設定（ローカルテスト）

**ngrokを使用:**

```bash
# ターミナル1
ngrok http 3001

# ターミナル2  
ngrok http 3002
```

LINE Developers Consoleで設定:
- アカウント1: `https://xxxxx.ngrok.io/webhook`
- アカウント2: `https://yyyyy.ngrok.io/webhook`

## ✅ 確認ポイント

1. **両方のシステムが起動している**
   - http://localhost:3001 → 予約システム1
   - http://localhost:3002 → 予約システム2

2. **各LINEアカウントで友だち追加**
   - それぞれ異なる公式アカウント

3. **メッセージ送信テスト**
   - 「予約」と送信
   - それぞれ独立して応答

4. **データの独立性**
   - `data/account-1/` と `data/account-2/` が別々

## 🔧 トラブルシューティング

### ポートが使用中の場合
```batch
taskkill /F /IM node.exe
```

### トークンエラーが出る場合
- バッチファイルのトークン設定を確認
- LINE Developers Consoleで再発行

### Webhookが届かない場合
- ngrokが起動しているか確認
- URLが正しく設定されているか確認
- Webhook URLの末尾が `/webhook` になっているか確認

## 📝 メモ

- トークンとシークレットは**絶対に**GitHubにコミットしない
- 本番環境では必ずHTTPSを使用
- 各システムは完全に独立して動作