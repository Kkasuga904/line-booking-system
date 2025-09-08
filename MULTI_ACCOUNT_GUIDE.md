# 複数LINE公式アカウント運用ガイド

## 📱 2つのアカウントを並列運用する方法

### 現在の設定

#### アカウント1（既存）
- **Channel Secret**: `95909cf238912a222f05e0bbe636e70c`
- **設定ファイル**: `.env.yaml.account1`
- **用途**: 現在運用中のアカウント

#### アカウント2（新規）
- **Channel Secret**: `cd2213ae47341f3cd302eea78559e0f8`
- **設定ファイル**: `.env.yaml.account2`
- **用途**: 新しく追加するアカウント

## 🔄 切り替え方法

### Windows（バッチファイル使用）
```bash
# 切り替えツールを実行
switch-account.bat

# 1 or 2 を選択
```

### 手動切り替え
```bash
# アカウント1を使う場合
copy .env.yaml.account1 .env.yaml

# アカウント2を使う場合
copy .env.yaml.account2 .env.yaml
```

## 🚀 デプロイ方法

### オプション1: 同じCloud Runインスタンスで切り替え
```bash
# アカウントを切り替えてからデプロイ
gcloud run deploy line-booking-api --source . --region asia-northeast1 --env-vars-file .env.yaml
```

### オプション2: 別々のCloud Runインスタンスで並列運用（推奨）

#### アカウント1専用インスタンス
```bash
gcloud run deploy line-booking-api-account1 \
  --source . \
  --region asia-northeast1 \
  --env-vars-file .env.yaml.account1 \
  --allow-unauthenticated
```
**Webhook URL**: `https://line-booking-api-account1-xxxxx.asia-northeast1.run.app/webhook`

#### アカウント2専用インスタンス
```bash
gcloud run deploy line-booking-api-account2 \
  --source . \
  --region asia-northeast1 \
  --env-vars-file .env.yaml.account2 \
  --allow-unauthenticated
```
**Webhook URL**: `https://line-booking-api-account2-xxxxx.asia-northeast1.run.app/webhook`

## 💡 メリット

### 同じインスタンスで切り替え
- **メリット**: コスト削減、管理が簡単
- **デメリット**: 同時運用不可、切り替えが必要

### 別々のインスタンスで並列運用
- **メリット**: 
  - 両方のアカウントが同時に動作
  - 独立した運用が可能
  - 障害の影響を受けにくい
- **デメリット**: 
  - 若干のコスト増（Cloud Runは使用量課金なので影響は小さい）

## 📊 データベース

両アカウントとも同じSupabaseデータベースを使用するため：
- 予約データは共有される
- 統計情報も統合される
- 管理画面は共通

## 🔧 店舗別管理（オプション）

異なる店舗として管理したい場合：

### .env.yaml.account1
```yaml
STORE_ID: "store-1"
```

### .env.yaml.account2
```yaml
STORE_ID: "store-2"
```

これにより予約データを店舗別に分離できます。

## 📝 注意事項

1. **LIFF ID**: 各アカウントで異なるLIFF IDが必要
2. **Webhook URL**: 各アカウントで正しいURLを設定
3. **リッチメニュー**: 各アカウントで個別に設定

## 🎯 推奨構成

**別々のCloud Runインスタンス**で運用することを推奨します：
- 完全な独立性
- 同時運用可能
- トラブルシューティングが容易
- コストは使用量に応じた課金のみ

---

## クイックスタート

1. 切り替えツールで選択
   ```
   switch-account.bat
   ```

2. デプロイ
   ```bash
   gcloud run deploy line-booking-api-account[1/2] --env-vars-file .env.yaml
   ```

3. LINE Developersで各アカウントのWebhook URLを設定

完了！両方のLINE公式アカウントで予約システムが使えます。