# LIFF設定ガイド

## 🎯 重要：LINEから予約が取れるようにする設定

### 1. LINE Developersコンソールにアクセス
https://developers.line.biz/console/

### 2. LIFF設定を更新
1. 対象のプロバイダー → チャネル → LIFF タブを選択
2. 既存のLIFFアプリをクリック、または新規作成

### 3. 必須設定項目
```
LIFF アプリ名: 予約システム
サイズ: Full
エンドポイントURL: https://line-booking-system-seven.vercel.app/liff-booking.html
Scope: 
  ✅ profile (必須：名前を取得)
  ✅ openid (必須)
  ✅ chat_message.write (オプション：トークに送信)
```

### 4. 環境変数の設定（Vercel）
```
LIFF_ID=取得したLIFF ID
LINE_CHANNEL_ACCESS_TOKEN=チャネルアクセストークン
LINE_CHANNEL_SECRET=チャネルシークレット
STORE_ID=restaurant-001
```

### 5. 動作確認
1. LINEで「予約」とメッセージを送信
2. 返信されたLIFF URLをタップ
3. LINE内ブラウザで予約フォームが開く
4. 自動的にLINEの名前が入力される
5. 予約完了後、データベースに保存される

## ⚠️ トラブルシューティング

### 予約が反映されない場合
1. **LIFF URLの確認**
   - LINE Developersで正しいエンドポイントURLが設定されているか
   - `/liff-booking.html` が指定されているか

2. **権限の確認**
   - profileスコープが有効になっているか
   - LINEログインが有効になっているか

3. **環境変数の確認**
   ```bash
   vercel env ls
   ```
   - LIFF_IDが正しく設定されているか
   - STORE_IDが一致しているか

### LINEの名前が取得できない場合
- profileスコープが有効になっていない
- LIFF初期化が失敗している
- ユーザーが権限を拒否している

## 📱 テスト方法
1. LINE Official Account Managerでテスト送信
2. 実際のLINEアカウントから「予約」と送信
3. 管理画面で確認：https://line-booking-system-seven.vercel.app/check-reservations.html