# LINE予約システム セットアップ手順

## 🔧 Vercel環境変数の設定

1. **Vercelダッシュボードにアクセス**
   - https://vercel.com/tatatas-projects-a26fbad6/line-booking-system/settings/environment-variables

2. **以下の環境変数を追加**

### LINE関連
```
LINE_CHANNEL_ACCESS_TOKEN = tEqSEwb4iCDsEIeoSWvGvyAyt3Swa/P5OpxRoI6kHs/9rPDK92cHZ9voM7NWp3SmCsYIQLiUdSgfSzqP1DV3MK7muFxpWMau1B1bMKXqsAQiAdrejzzSjvoncLmJzrkxMSREnPRkJ88grVyzDztaNAdB04t89/1O/w1cDnyilFU=

LINE_CHANNEL_SECRET = cd2213ae47341f3cd302eea78559e0f8
```

### Supabase関連
```
SUPABASE_URL = https://mthmmqbeyznflvuizkfk.supabase.co

SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10aG1tcWJleXpuZmx2dWl6a2ZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5ODYyMDcsImV4cCI6MjA3MTU2MjIwN30.t2wjuLgdEJvLLzXl7ckB-rZ4Xll0k_f94S94f_laaoE
```

### 店舗ID
```
STORE_ID = restaurant-001
```

3. **すべての環境変数を追加したら「Save」をクリック**

4. **再デプロイして環境変数を反映**
   ```bash
   vercel --prod
   ```

---

## 📱 LINE Developers Console設定

1. **LINE Developers Console**にアクセス
   - https://developers.line.biz/

2. **Messaging API設定**で以下を設定：
   - Webhook URL: `https://line-booking-system.vercel.app/webhook`
   - Webhookの利用: **ON**
   - 応答メッセージ: **OFF**
   - Webhook再送: **OFF**

3. **「Verify」ボタンをクリック**して接続を確認

---

## 🔍 動作確認

### 管理画面
- https://line-booking-system.vercel.app/
- 予約一覧が表示されます

### Webhook確認
```bash
curl https://line-booking-system.vercel.app/webhook
```

### LINEから予約テスト
以下のメッセージを送信：
- 「メニュー」→ クイックリプライが表示
- 「予約 明日 18時 4名」→ 予約が保存される

---

## ✅ これで完了！

line-booking-systemが以下の機能を持つ実用的な予約システムになりました：

- ✅ LINEからの予約受付
- ✅ クイックリプライ機能
- ✅ Supabaseでのデータ保存
- ✅ 管理画面での予約確認
- ✅ line-booking-account2と同じ機能

両方のシステムが同じように動作します。