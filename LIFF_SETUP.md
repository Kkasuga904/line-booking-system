# LIFF設定手順

## 1. LINE Developersでの設定

### LIFF IDの取得
1. [LINE Developers](https://developers.line.biz/) にログイン
2. プロバイダーを選択（または新規作成）
3. チャネル内の「LIFF」タブを開く
4. 「追加」ボタンをクリック
5. 以下を設定：
   - LIFF名: カレンダー予約
   - サイズ: Full
   - エンドポイントURL: https://your-domain.vercel.app/liff-calendar.html
   - Scope: profile, openid
   - ボットリンク機能: On

### 環境変数の追加
```bash
# Vercelの環境変数に追加
LIFF_ID=取得したLIFF ID
```

## 2. デプロイ手順

```bash
# Vercelにデプロイ
git add .
git commit -m "Add LIFF calendar integration"
git push
vercel --prod
```

## 3. 動作確認

1. LINEで「予約」と送信
2. カレンダーボタンが表示される
3. タップしてカレンダーが開くことを確認
4. 日時を選択して予約
5. 管理画面で予約が反映されているか確認