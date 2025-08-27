# LINE Login チャネルでLIFF設定手順

## ステップ1: LINE Loginチャネル作成

1. **LINE Developers Console**
   - https://developers.line.biz/console/

2. **新規チャネル作成**
   - 「新規チャネル作成」をクリック
   - チャネルの種類: **「LINE Login」を選択**（Messaging APIではなく）

3. **チャネル情報入力**
   ```
   チャネル名: 予約カレンダー
   チャネル説明: 予約システムのカレンダー機能
   アプリタイプ: ウェブアプリ
   ```

4. **作成後、LIFFタブへ**
   - LINE Loginチャネルには「LIFF」タブがある

5. **LIFF追加**
   ```
   LIFF名: カレンダー予約
   サイズ: Full
   エンドポイントURL: https://line-booking-system-seven.vercel.app/liff-calendar.html
   Scope: profile, openid
   ```

6. **LIFF ID取得**

## ステップ2: Messaging APIと連携

LINE LoginチャネルのLIFFは、Messaging APIチャネルからも呼び出し可能です。

### Vercel環境変数に追加:
```
LIFF_ID=取得したLIFF ID（LINE Loginチャネルのもの）
```

## 重要な注意点

- LINE LoginチャネルとMessaging APIチャネルは別々
- でもLIFF URLは共通で使える
- ユーザー体験は変わらない