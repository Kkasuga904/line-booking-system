# LINE予約システム - Smart Web Works

LINE公式アカウントで予約を自動受付・管理するシステム

## 🚀 特徴

- **24時間365日稼働** - Vercelで常時稼働
- **固定URL** - PC再起動しても同じURLで動作
- **リッチメニュー対応** - ワンタップで予約開始
- **自動返信** - 予約フローを自動ガイド

## 📋 セットアップ手順

### 1. GitHubへプッシュ

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/line-booking-system.git
git push -u origin main
```

### 2. Vercelにデプロイ

1. [Vercel](https://vercel.com)にアクセス
2. "New Project"をクリック
3. GitHubリポジトリを選択
4. 環境変数を設定：
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `LINE_CHANNEL_SECRET`
5. "Deploy"をクリック

### 3. LINE Developersで設定

1. Webhook URL を設定：
   ```
   https://your-app.vercel.app/webhook
   ```
2. Webhookを「利用する」に設定
3. 応答メッセージを「無効」に設定

## 🔒 セキュリティ

- **環境変数で秘密情報を管理** - トークンやシークレットは環境変数に
- **署名検証** - LINE SDKで自動的に署名を検証
- **.gitignore設定済み** - 秘密情報がGitHubに上がらないよう設定

## 📝 機能一覧

### リッチメニューボタン
- **予約する** - 予約フロー開始（常に最初から）
- **予約確認** - 現在の予約を確認
- **料金プラン** - サービス料金表示
- **お問い合わせ** - 問い合わせ案内
- **ヘルプ** - 使い方ガイド

### 予約フロー
1. サービス選択（Webサイト制作/LINE予約システム/無料相談）
2. プラン選択
3. お客様情報入力
4. 確認・完了

## 🛠️ カスタマイズ

### サービス・プランの変更

`api/webhook.js`の`SERVICES`オブジェクトを編集：

```javascript
const SERVICES = {
    WEBSITE: {
        name: 'Webサイト制作',
        plans: [
            // プランを追加・編集
        ]
    }
};
```

### メッセージのカスタマイズ

各関数内のメッセージテキストを編集してカスタマイズ可能

## 📧 サポート

Smart Web Works
- Email: support@smartwebworks.com
- LINE: @smartwebworks

## 📄 ライセンス

MIT License