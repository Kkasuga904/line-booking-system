# 🚀 LIFF カレンダー設定 - 5分でできる手順

## ステップ1: LINE Developersでアプリ作成

1. **LINE Developers コンソールにアクセス**
   - https://developers.line.biz/console/
   - LINEアカウントでログイン

2. **Messaging APIチャネルを選択**
   - 既存の予約システムのチャネルを使用

3. **「LIFF」タブをクリック**

4. **「追加」ボタンをクリック**

5. **以下を入力:**
   ```
   LIFF名: カレンダー予約
   サイズ: Full
   エンドポイントURL: https://line-booking-system-seven.vercel.app/liff-calendar.html
   Scope: ✅ profile にチェック
   ボットリンク機能: On (Aggressive)
   ```

6. **「追加」をクリック**

7. **LIFF IDをコピー** (例: 1234567890-abcdefgh)

## ステップ2: コードにLIFF IDを設定

### 方法A: 環境変数で設定（推奨）

1. Vercelダッシュボードで:
   ```
   Settings > Environment Variables
   LIFF_ID = コピーしたLIFF ID
   ```

### 方法B: 直接コードに記述（テスト用）

`public/liff-calendar.html`の232行目を編集:
```javascript
const liffId = '1234567890-abcdefgh'; // あなたのLIFF ID
```

## ステップ3: デプロイ

```bash
git add .
git commit -m "Add LIFF ID"
git push
```

## ステップ4: 動作確認

1. LINEで「メニュー」と送信
2. 「📅 カレンダーで予約」をタップ
3. カレンダーが表示されるか確認

## トラブルシューティング

### カレンダーが開かない場合:

1. **LIFF IDが正しいか確認**
   - LINE Developersコンソールで確認

2. **URLが一致しているか確認**
   - LIFF設定のエンドポイントURL
   - 実際のVercelのURL
   - 両方が完全一致している必要あり

3. **LIFFが有効になっているか確認**
   - LINE DevelopersでLIFFのステータス確認

4. **デバッグ用テストURL**
   ```
   https://line-booking-system-seven.vercel.app/liff-calendar.html
   ```
   このURLを直接ブラウザで開いて動作確認

## よくある間違い

❌ エンドポイントURLの最後に / をつける
✅ エンドポイントURLは .html で終わる

❌ LIFF IDに空白が入っている
✅ LIFF IDは空白なしでコピペ

❌ httpsではなくhttpを使用
✅ 必ずhttpsを使用