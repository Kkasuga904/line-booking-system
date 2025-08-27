# LINE_CHANNEL_ACCESS_TOKEN 更新手順

## 1. LINE Developers Console で新しいトークンを取得

1. https://developers.line.biz/console/
2. 該当チャネルを選択
3. 「Messaging API設定」タブ
4. 「チャネルアクセストークン（長期）」
5. 「発行」ボタンをクリック
6. 表示されたトークンをコピー

## 2. Vercel で環境変数を更新

```bash
# 古いトークンを削除
vercel env rm LINE_CHANNEL_ACCESS_TOKEN production --yes

# 新しいトークンを追加
echo "新しいトークン" | vercel env add LINE_CHANNEL_ACCESS_TOKEN production

# デプロイ
vercel --prod
```

## 注意点

- トークンは「長期」を選択
- トークンの前後に空白が入らないように注意
- コピー時は全体を確実に選択