# LIFF設定確認と修正手順

## 現在の状況
- LIFF ID: `2006487876-xd1A5qJB`
- システムエラーが発生中

## 問題の原因
LIFFアプリのエンドポイントURLが正しく設定されていない可能性があります。

## LINE Developersコンソールで確認すべき設定

### 1. LIFF URLエンドポイントの確認
LINE Developersコンソール → LIFFアプリ設定で以下を確認：

**現在のエンドポイントURL候補:**
- Vercel版: `https://line-booking-system-seven.vercel.app/liff-calendar`
- GCP版: `https://line-booking-api-116429620992.asia-northeast1.run.app/liff-calendar`

### 2. 正しいエンドポイントURL設定
GCP Cloud Runを使用している場合は、以下のURLに変更する必要があります：

```
https://line-booking-api-116429620992.asia-northeast1.run.app/liff-calendar.html
```

**重要**: `.html`拡張子を必ず含めてください。拡張子なしだと404エラーになります。

### 3. LIFF設定項目
- **LIFF名**: 予約システム
- **サイズ**: Full
- **エンドポイントURL**: `https://line-booking-api-116429620992.asia-northeast1.run.app/liff-calendar.html`
- **Scope**: 
  - ✅ profile
  - ✅ openid
  - ✅ chat_message.write (オプション)

### 4. 確認手順
1. [LINE Developersコンソール](https://developers.line.biz/) にログイン
2. プロバイダーを選択
3. LINE Messaging APIチャネルを選択
4. 「LIFF」タブを開く
5. LIFF ID `2006487876-xd1A5qJB` のアプリを探す
6. エンドポイントURLを確認・修正

## 修正済み内容
- ✅ LIFF ID を正しい値に修正（`2006487876-xd1A5qJB`）
- ✅ server.jsのLIFF URL形式を修正（`https://liff.line.me/`）
- ✅ 環境変数にLIFF_IDを追加

## テスト方法
1. LINEアプリで「予約」とメッセージを送信
2. 返信されたLIFF URLをタップ
3. 予約カレンダーが正しく表示されることを確認

## トラブルシューティング
もしまだエラーが出る場合：
1. ブラウザでデベロッパーツールを開き、コンソールエラーを確認
2. LIFF SDKの初期化エラーがないか確認
3. CORSエラーがないか確認